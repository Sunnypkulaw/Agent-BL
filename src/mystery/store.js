import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { candidateSetHash, createRevealProof, createServerSecret, hashCanonical, serverCommitment } from './fairness.js';

const HASH_RE = /^0x[0-9a-f]{64}$/u;
const PAYMENT_RE = /^(?:0x[0-9a-f]{64}|demo:\/\/receipt\/[0-9a-zA-Z._:-]{8,160})$/u;

export const MYSTERY_REVEAL_STATES = Object.freeze([
  'PREVIEWED',
  'COMMITTED',
  'PAID',
  'REVEALED',
  'ABORTED',
  'EXPIRED'
]);

const TRANSITIONS = Object.freeze({
  PREVIEWED: new Set(['COMMITTED', 'ABORTED', 'EXPIRED']),
  COMMITTED: new Set(['PAID', 'ABORTED', 'EXPIRED']),
  PAID: new Set(['REVEALED', 'ABORTED']),
  REVEALED: new Set(),
  ABORTED: new Set(),
  EXPIRED: new Set()
});

export class MysteryStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'MysteryStoreError';
    this.code = code;
    this.details = details;
  }
}

export class MysteryRevealStore {
  constructor(options = {}) {
    this.filePath = path.resolve(options.filePath ?? process.env.MYSTERY_STORE_PATH ?? 'data/runtime/mystery-reveals.json');
    this.now = options.now ?? (() => new Date());
    this.records = new Map();
    this.paymentIndex = new Map();
    this.idempotencyIndex = new Map();
    this.loaded = false;
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (this.loaded) return this;
    let data = { version: 1, records: [] };
    try {
      data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    for (const record of data.records ?? []) this.index(record);
    this.loaded = true;
    await this.expireStale();
    return this;
  }

  async reset() {
    this.records.clear();
    this.paymentIndex.clear();
    this.idempotencyIndex.clear();
    this.loaded = true;
    await this.persist();
  }

  async createPreview(input) {
    await this.load();
    const walletAddress = String(input.wallet_address ?? '').toLowerCase();
    const idempotencyScope = input.idempotency_key
      ? `${walletAddress}:${String(input.idempotency_key)}`
      : null;
    const existingId = idempotencyScope && this.idempotencyIndex.get(idempotencyScope);
    if (existingId) return this.publicPreview(this.records.get(existingId));
    if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
      throw new MysteryStoreError('mystery_no_candidates', 'No eligible pools match this Risk Passport');
    }
    const createdAt = new Date(input.created_at ?? this.now()).toISOString();
    const expiresAt = new Date(input.expires_at ?? Date.parse(createdAt) + Number(input.ttl_seconds ?? 300) * 1000).toISOString();
    const serverSecret = createServerSecret();
    const revealId = input.reveal_id ?? 'mrv_' + crypto.randomBytes(16).toString('hex');
    const record = {
      reveal_id: revealId,
      round_id: input.round_id ?? 'round_' + createdAt.slice(0, 10),
      state: 'PREVIEWED',
      wallet_address: walletAddress,
      idempotency_key: input.idempotency_key ?? null,
      risk_passport: input.risk_passport,
      risk_passport_hash: input.risk_passport.risk_passport_hash,
      candidates: input.candidates,
      candidate_set_hash: candidateSetHash(input.candidates),
      server_commitment: serverCommitment(serverSecret),
      server_secret: serverSecret,
      created_at: createdAt,
      updated_at: createdAt,
      expires_at: expiresAt,
      payment_tx_hash: null,
      user_nonce: null,
      proof: null,
      report: null,
      abort: null
    };
    this.index(record);
    this.transition(record, 'COMMITTED');
    await this.persist();
    return this.publicPreview(record);
  }

  async get(revealId, options = {}) {
    await this.load();
    const record = this.records.get(revealId);
    if (!record) throw new MysteryStoreError('mystery_not_found', 'Mystery reveal not found');
    await this.expireRecord(record);
    return options.internal ? structuredClone(record) : this.publicRecord(record);
  }

  async markPaidAndReveal(input) {
    await this.load();
    const record = this.records.get(input.reveal_id);
    if (!record) throw new MysteryStoreError('mystery_not_found', 'Mystery reveal not found');
    await this.expireRecord(record);
    if (record.state === 'REVEALED') {
      if (record.payment_tx_hash !== input.payment_tx_hash) {
        throw new MysteryStoreError('payment_replay', 'Reveal was already settled with another payment');
      }
      return structuredClone(record);
    }
    if (record.state !== 'COMMITTED') {
      throw new MysteryStoreError('mystery_bad_state', 'Mystery reveal is not payable in state ' + record.state);
    }
    if (record.wallet_address !== input.wallet_address.toLowerCase()) {
      throw new MysteryStoreError('wallet_mismatch', 'Paying wallet does not match preview wallet');
    }
    if (!HASH_RE.test(String(input.user_nonce ?? '').toLowerCase())) {
      throw new MysteryStoreError('nonce_invalid', 'user_nonce must be a 32-byte lowercase hex value');
    }
    if (!PAYMENT_RE.test(String(input.payment_tx_hash ?? ''))) {
      throw new MysteryStoreError('payment_invalid', 'payment_tx_hash must be a transaction hash or demo receipt');
    }
    const existingReveal = this.paymentIndex.get(input.payment_tx_hash);
    if (existingReveal && existingReveal !== record.reveal_id) {
      throw new MysteryStoreError('payment_replay', 'Payment transaction is already bound to another reveal');
    }
    record.payment_tx_hash = input.payment_tx_hash;
    record.user_nonce = input.user_nonce;
    this.paymentIndex.set(input.payment_tx_hash, record.reveal_id);
    this.transition(record, 'PAID');
    try {
      const proof = createRevealProof({
        ...record,
        wallet_address: record.wallet_address,
        user_nonce: input.user_nonce,
        payment_tx_hash: input.payment_tx_hash
      });
      const candidateIsValid = await input.validateCandidate(proof.selected_pool_id, record);
      if (!candidateIsValid) {
        record.abort = {
          code: 'CANDIDATE_INVALIDATED',
          refund_status: input.refund_status ?? 'REFUND_OR_FREE_REOPEN_AVAILABLE',
          free_reopen_eligible: true,
          aborted_at: new Date(this.now()).toISOString()
        };
        this.transition(record, 'ABORTED');
        await this.persist();
        throw new MysteryStoreError(
          'candidate_invalidated',
          'Selected pool became ineligible after payment; no replacement was selected',
          { abort: record.abort }
        );
      }
      record.proof = proof;
      record.report = await input.buildReport(proof, record);
      this.transition(record, 'REVEALED');
      await this.persist();
      return structuredClone(record);
    } catch (error) {
      if (record.state === 'PAID') {
        record.abort = {
          code: 'REPORT_GENERATION_FAILED',
          refund_status: 'REFUND_OR_FREE_REOPEN_AVAILABLE',
          free_reopen_eligible: true,
          aborted_at: new Date(this.now()).toISOString()
        };
        this.transition(record, 'ABORTED');
        await this.persist();
      }
      throw error;
    }
  }

  async abortCommitted(input) {
    await this.load();
    const record = this.records.get(input.reveal_id);
    if (!record) throw new MysteryStoreError('mystery_not_found', 'Mystery reveal not found');
    await this.expireRecord(record);
    if (record.state === 'ABORTED') return structuredClone(record);
    if (record.state !== 'COMMITTED') {
      throw new MysteryStoreError('mystery_bad_state', 'Mystery reveal cannot be aborted in state ' + record.state);
    }
    if (record.wallet_address !== String(input.wallet_address ?? '').toLowerCase()) {
      throw new MysteryStoreError('wallet_mismatch', 'Paying wallet does not match preview wallet');
    }
    record.abort = {
      code: input.code ?? 'CANDIDATE_INVALIDATED_BEFORE_PAYMENT',
      refund_status: 'PAYMENT_NOT_SETTLED',
      free_reopen_eligible: true,
      invalid_candidates: input.invalid_candidates ?? [],
      aborted_at: new Date(this.now()).toISOString()
    };
    this.transition(record, 'ABORTED');
    await this.persist();
    return structuredClone(record);
  }

  publicPreview(record) {
    return {
      reveal_id: record.reveal_id,
      round_id: record.round_id,
      state: record.state,
      algorithm_version: 'mystery-voyage-v1',
      risk_passport: record.risk_passport,
      risk_passport_hash: record.risk_passport_hash,
      candidate_count: record.candidates.length,
      candidate_set_hash: record.candidate_set_hash,
      server_commitment: record.server_commitment,
      created_at: record.created_at,
      expires_at: record.expires_at,
      disclosure: {
        purchase: 'AI_DUE_DILIGENCE_REVEAL_ONLY',
        automatically_subscribes_rwa: false,
        target_redemption_is_guaranteed: false,
        candidate_identities_disclosed_after_payment: true,
        selection_weights_disclosed_in_reveal_proof: true
      }
    };
  }

  publicRecord(record) {
    if (record.state !== 'REVEALED') {
      const preview = this.publicPreview(record);
      if (record.abort) preview.abort = record.abort;
      return preview;
    }
    return {
      ...this.publicPreview(record),
      state: record.state,
      proof: record.proof,
      report: record.report
    };
  }

  transition(record, nextState) {
    if (!MYSTERY_REVEAL_STATES.includes(nextState)) {
      throw new MysteryStoreError('mystery_state_invalid', 'Unknown reveal state: ' + nextState);
    }
    if (!TRANSITIONS[record.state]?.has(nextState)) {
      throw new MysteryStoreError('mystery_transition_invalid', record.state + ' cannot transition to ' + nextState);
    }
    record.state = nextState;
    record.updated_at = new Date(this.now()).toISOString();
  }

  async expireStale() {
    let changed = false;
    for (const record of this.records.values()) {
      changed = await this.expireRecord(record, false) || changed;
    }
    if (changed) await this.persist();
  }

  async expireRecord(record, persist = true) {
    if (!['PREVIEWED', 'COMMITTED'].includes(record.state)) return false;
    if (Date.parse(record.expires_at) > new Date(this.now()).getTime()) return false;
    this.transition(record, 'EXPIRED');
    if (persist) await this.persist();
    return true;
  }

  index(record) {
    this.records.set(record.reveal_id, record);
    if (record.payment_tx_hash) this.paymentIndex.set(record.payment_tx_hash, record.reveal_id);
    if (record.idempotency_key) {
      this.idempotencyIndex.set(
        `${record.wallet_address}:${String(record.idempotency_key)}`,
        record.reveal_id
      );
    }
  }

  async persist() {
    // The hackathon store is local-only. Production deployments must encrypt
    // server_secret at rest (KMS/HSM) and restrict access to the reveal worker.
    const snapshot = {
      version: 1,
      snapshot_hash: hashCanonical([...this.records.values()].map((record) => ({
        reveal_id: record.reveal_id,
        state: record.state,
        updated_at: record.updated_at
      }))),
      records: [...this.records.values()]
    };
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = this.filePath + '.' + process.pid + '.' + Date.now() + '.tmp';
      await fs.writeFile(temporaryPath, JSON.stringify(snapshot, null, 2), 'utf8');
      await fs.rename(temporaryPath, this.filePath);
    });
    await this.writeQueue;
  }
}

let defaultStore;

export function getMysteryRevealStore() {
  if (!defaultStore) defaultStore = new MysteryRevealStore();
  return defaultStore;
}

export function resetDefaultMysteryRevealStore() {
  defaultStore = undefined;
}
