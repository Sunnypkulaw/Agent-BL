import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFacilitatorRequest } from '@injectivelabs/x402/protocol';
import { SettleResponseSchema, VerifyResponseSchema } from '@injectivelabs/x402/schemas';
import { x402Network, x402PayTo, x402RpcUrl, x402Usdc } from './config.js';

export const SETTLEMENT_STATES = Object.freeze({
  CHALLENGED: 'CHALLENGED',
  SIGNED: 'SIGNED',
  SETTLING: 'SETTLING',
  SETTLED: 'SETTLED',
  UNLOCKED: 'UNLOCKED',
  FAILED: 'FAILED'
});

const TRANSITIONS = Object.freeze({
  CHALLENGED: new Set(['SIGNED', 'FAILED']),
  SIGNED: new Set(['SETTLING', 'SETTLED', 'FAILED']),
  SETTLING: new Set(['SETTLED', 'FAILED']),
  SETTLED: new Set(['UNLOCKED']),
  UNLOCKED: new Set(),
  FAILED: new Set()
});

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/u;

export class PaymentSettlementError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'PaymentSettlementError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.paymentId = options.paymentId ?? null;
    this.cause = options.cause;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => [key, canonicalize(value[key])]));
}

export function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function paymentIdFor(paymentPayload, paymentRequirements) {
  const identity = {
    x402Version: paymentPayload?.x402Version,
    network: paymentRequirements?.network,
    asset: paymentRequirements?.asset?.toLowerCase?.(),
    payer: paymentPayload?.payload?.authorization?.from?.toLowerCase?.(),
    payTo: paymentPayload?.payload?.authorization?.to?.toLowerCase?.(),
    value: paymentPayload?.payload?.authorization?.value,
    nonce: paymentPayload?.payload?.authorization?.nonce?.toLowerCase?.(),
    signature: paymentPayload?.payload?.signature?.toLowerCase?.()
  };
  return `pay_${crypto.createHash('sha256').update(stableStringify(identity)).digest('hex')}`;
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function nowIso(clock) {
  return clock().toISOString();
}

export class JsonReceiptStore {
  constructor(options = {}) {
    this.filePath = options.filePath === null ? null : options.filePath;
    this.records = new Map();
    this.initialized = false;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    if (this.initialized) return this;
    if (this.filePath) {
      try {
        const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
        const records = Array.isArray(parsed) ? parsed : parsed.records;
        if (!Array.isArray(records)) throw new Error('x402 receipt store must contain a records array');
        for (const record of records) {
          if (!record?.payment_id || typeof record.payment_id !== 'string') {
            throw new Error('x402 receipt record is missing payment_id');
          }
          this.records.set(record.payment_id, record);
        }
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    this.initialized = true;
    return this;
  }

  async persist() {
    if (!this.filePath) return;
    const target = this.filePath;
    const body = `${JSON.stringify({ version: 1, records: [...this.records.values()] }, null, 2)}\n`;
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(temporary, body, 'utf8');
      await fs.rename(temporary, target);
    });
    await this.writeQueue;
  }

  async get(paymentId) {
    await this.init();
    return clone(this.records.get(paymentId) ?? null);
  }

  async upsert(record) {
    await this.init();
    this.records.set(record.payment_id, clone(record));
    await this.persist();
    return clone(record);
  }

  async list() {
    await this.init();
    return clone([...this.records.values()]);
  }
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function defaultDelay(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class FacilitatorAdapter {
  constructor(options = {}) {
    if (!options.facilitatorUrl) throw new TypeError('facilitatorUrl is required');
    this.facilitatorUrl = options.facilitatorUrl.replace(/\/$/u, '');
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 100;
    this.delay = options.delay ?? defaultDelay;
  }

  async request(endpoint, innerRequest, schema) {
    const requestBody = createFacilitatorRequest(innerRequest);
    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(`${this.facilitatorUrl}/${endpoint}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        if (!response.ok) {
          const retryable = isRetryableStatus(response.status);
          const error = new PaymentSettlementError(
            `facilitator_${endpoint}_http_error`,
            `Facilitator ${endpoint} returned HTTP ${response.status}`,
            { retryable }
          );
          if (!retryable || attempt === this.maxAttempts) throw error;
          lastError = error;
        } else {
          let json;
          try {
            json = await response.json();
          } catch (cause) {
            throw new PaymentSettlementError(
              `facilitator_${endpoint}_invalid_json`,
              `Facilitator ${endpoint} did not return JSON`,
              { cause }
            );
          }
          const parsed = schema.safeParse(json);
          if (!parsed.success) {
            throw new PaymentSettlementError(
              `facilitator_${endpoint}_invalid_response`,
              `Facilitator ${endpoint} response failed schema validation: ${parsed.error.issues[0]?.message ?? 'invalid response'}`
            );
          }
          return { response: parsed.data, attempts: attempt };
        }
      } catch (error) {
        const normalized = error instanceof PaymentSettlementError
          ? error
          : new PaymentSettlementError(
            `facilitator_${endpoint}_unavailable`,
            `Facilitator ${endpoint} request failed: ${error.message}`,
            { retryable: true, cause: error }
          );
        if (!normalized.retryable || attempt === this.maxAttempts) throw normalized;
        lastError = normalized;
      } finally {
        clearTimeout(timer);
      }
      await this.delay(this.baseDelayMs * (2 ** (attempt - 1)));
    }
    throw lastError;
  }

  verify(innerRequest) {
    return this.request('verify', innerRequest, VerifyResponseSchema);
  }

  settle(innerRequest) {
    return this.request('settle', innerRequest, SettleResponseSchema);
  }
}

function assertTransition(from, to) {
  if (!TRANSITIONS[from]?.has(to)) {
    throw new PaymentSettlementError('invalid_settlement_transition', `Invalid settlement transition: ${from} -> ${to}`);
  }
}

function transition(record, state, clock, patch = {}) {
  assertTransition(record.state, state);
  const timestamp = nowIso(clock);
  return {
    ...record,
    ...clone(patch),
    state,
    updated_at: timestamp,
    history: [...record.history, { state, at: timestamp }]
  };
}

function createRecord({ paymentId, paymentPayload, paymentRequirements, resource, mode, clock }) {
  const timestamp = nowIso(clock);
  return {
    payment_id: paymentId,
    idempotency_key: paymentId,
    state: SETTLEMENT_STATES.CHALLENGED,
    mode,
    onchain: false,
    resource,
    network: paymentRequirements.network,
    asset: paymentRequirements.asset,
    amount: paymentRequirements.amount,
    pay_to: paymentRequirements.payTo,
    payer: paymentPayload.payload.authorization.from,
    nonce: paymentPayload.payload.authorization.nonce,
    transaction: null,
    verify_attempts: 0,
    settle_attempts: 0,
    error: null,
    created_at: timestamp,
    updated_at: timestamp,
    history: [{ state: SETTLEMENT_STATES.CHALLENGED, at: timestamp }],
    unlock: null
  };
}

function sameResource(left, right) {
  return String(left ?? '') === String(right ?? '');
}

export class X402SettlementService {
  constructor(options = {}) {
    this.mode = options.mode ?? 'demo';
    if (!['demo', 'live'].includes(this.mode)) throw new TypeError('mode must be demo or live');
    this.clock = options.clock ?? (() => new Date());
    this.store = options.store ?? new JsonReceiptStore({ filePath: options.receiptStorePath ?? null });
    this.adapter = options.adapter ?? (this.mode === 'live'
      ? new FacilitatorAdapter({
        facilitatorUrl: options.facilitatorUrl,
        fetchImpl: options.fetchImpl,
        timeoutMs: options.timeoutMs,
        maxAttempts: options.maxAttempts,
        baseDelayMs: options.baseDelayMs,
        delay: options.delay
      })
      : null);
    this.inflight = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return this;
    await this.store.init();
    const records = await this.store.list();
    for (const record of records) {
      if (record.state !== SETTLEMENT_STATES.SETTLING) continue;
      const failed = transition(record, SETTLEMENT_STATES.FAILED, this.clock, {
        error: {
          code: 'settlement_reconciliation_required',
          message: 'Process restarted during settlement; on-chain reconciliation is required before unlock',
          retryable: false
        }
      });
      await this.store.upsert(failed);
    }
    this.initialized = true;
    return this;
  }

  async process({ paymentPayload, paymentRequirements, resource }) {
    await this.init();
    const paymentId = paymentIdFor(paymentPayload, paymentRequirements);
    const running = this.inflight.get(paymentId);
    if (running) return running;
    const operation = this.#processLocked({ paymentId, paymentPayload, paymentRequirements, resource })
      .finally(() => this.inflight.delete(paymentId));
    this.inflight.set(paymentId, operation);
    return operation;
  }

  async #processLocked({ paymentId, paymentPayload, paymentRequirements, resource }) {
    const existing = await this.store.get(paymentId);
    if (existing) {
      if (!sameResource(existing.resource, resource)) {
        throw new PaymentSettlementError(
          'payment_already_bound',
          'This payment authorization is already bound to a different resource',
          { paymentId }
        );
      }
      if ([SETTLEMENT_STATES.SETTLED, SETTLEMENT_STATES.UNLOCKED].includes(existing.state)) {
        return { record: existing, replayed: true };
      }
      if (existing.state === SETTLEMENT_STATES.FAILED) {
        throw new PaymentSettlementError(
          existing.error?.code ?? 'previous_settlement_failed',
          existing.error?.message ?? 'Previous settlement attempt failed',
          { retryable: existing.error?.retryable ?? false, paymentId }
        );
      }
    }

    let record = existing ?? createRecord({
      paymentId,
      paymentPayload,
      paymentRequirements,
      resource,
      mode: this.mode,
      clock: this.clock
    });
    if (!existing) await this.store.upsert(record);
    if (record.state === SETTLEMENT_STATES.CHALLENGED) {
      record = transition(record, SETTLEMENT_STATES.SIGNED, this.clock);
      await this.store.upsert(record);
    }

    if (this.mode === 'demo') {
      record = transition(record, SETTLEMENT_STATES.SETTLED, this.clock, {
        settlement: 'simulated',
        onchain: false,
        transaction: null,
        verified_at: nowIso(this.clock),
        settled_at: nowIso(this.clock)
      });
      await this.store.upsert(record);
      return { record, replayed: false };
    }

    const innerRequest = { paymentPayload, paymentRequirements };
    try {
      const verified = await this.adapter.verify(innerRequest);
      record = { ...record, verify_attempts: verified.attempts, updated_at: nowIso(this.clock) };
      await this.store.upsert(record);
      if (!verified.response.isValid) {
        throw new PaymentSettlementError(
          verified.response.invalidReason ?? 'payment_verification_failed',
          verified.response.invalidMessage ?? 'Facilitator rejected the payment'
        );
      }

      record = transition(record, SETTLEMENT_STATES.SETTLING, this.clock, {
        verified_at: nowIso(this.clock)
      });
      await this.store.upsert(record);
      const settled = await this.adapter.settle(innerRequest);
      record = { ...record, settle_attempts: settled.attempts, updated_at: nowIso(this.clock) };
      await this.store.upsert(record);
      const response = settled.response;
      if (!response.success) {
        throw new PaymentSettlementError(
          response.errorReason ?? 'payment_settlement_failed',
          response.errorMessage ?? 'Facilitator failed to settle the payment'
        );
      }
      if (!TX_HASH_RE.test(response.transaction)) {
        throw new PaymentSettlementError('settlement_tx_invalid', 'Settlement response is missing a valid transaction hash');
      }
      if (response.network !== paymentRequirements.network) {
        throw new PaymentSettlementError('settlement_network_mismatch', 'Settlement response network does not match the payment requirement');
      }
      if (response.payer?.toLowerCase() !== paymentPayload.payload.authorization.from.toLowerCase()) {
        throw new PaymentSettlementError('settlement_payer_mismatch', 'Settlement response payer does not match the signed authorization');
      }
      record = transition(record, SETTLEMENT_STATES.SETTLED, this.clock, {
        settlement: 'onchain',
        onchain: true,
        transaction: response.transaction,
        settled_at: nowIso(this.clock),
        error: null
      });
      await this.store.upsert(record);
      return { record, replayed: false };
    } catch (error) {
      const normalized = error instanceof PaymentSettlementError
        ? error
        : new PaymentSettlementError('payment_settlement_failed', error.message, { cause: error });
      const latest = await this.store.get(paymentId) ?? record;
      if (latest.state !== SETTLEMENT_STATES.FAILED) {
        const failed = transition(latest, SETTLEMENT_STATES.FAILED, this.clock, {
          error: { code: normalized.code, message: normalized.message, retryable: normalized.retryable },
          failed_at: nowIso(this.clock)
        });
        await this.store.upsert(failed);
      }
      normalized.paymentId = paymentId;
      throw normalized;
    }
  }

  async markUnlocked(paymentId, metadata = {}) {
    await this.init();
    const record = await this.store.get(paymentId);
    if (!record) throw new PaymentSettlementError('payment_not_found', `Unknown payment: ${paymentId}`, { paymentId });
    if (record.state === SETTLEMENT_STATES.UNLOCKED) return record;
    if (record.state !== SETTLEMENT_STATES.SETTLED) {
      throw new PaymentSettlementError('payment_not_settled', `Cannot unlock a payment in state ${record.state}`, { paymentId });
    }
    const unlocked = transition(record, SETTLEMENT_STATES.UNLOCKED, this.clock, {
      unlocked_at: nowIso(this.clock),
      unlock: clone(metadata)
    });
    await this.store.upsert(unlocked);
    return unlocked;
  }

  async get(paymentId) {
    await this.init();
    return this.store.get(paymentId);
  }
}

// PaymentOracle compatibility layer used by the paid-report UI and smoke CLI.
// It supplements the facilitator-backed state machine above with an immutable
// audit record after a report payment has settled.
const compatibilityRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let compatibilityProvider;
let compatibilityWallet;
let compatibilityOracle;

function loadPaymentOracleConfig() {
  try {
    return JSON.parse(fsSync.readFileSync(path.join(compatibilityRoot, 'public', 'chain-config.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function getPaymentOracleContract() {
  if (compatibilityOracle) return compatibilityOracle;
  const config = loadPaymentOracleConfig();
  const address = config?.contracts?.PaymentOracle ?? config?.paymentOracle?.address;
  const abi = config?.paymentOracle?.abi;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!address || !abi || !privateKey) return null;

  const { ethers } = await import('ethers');
  compatibilityProvider ??= new ethers.JsonRpcProvider(x402RpcUrl());
  compatibilityWallet ??= new ethers.Wallet(privateKey, compatibilityProvider);
  compatibilityOracle ??= new ethers.Contract(address, abi, compatibilityWallet);
  return compatibilityOracle;
}

function compatibilityReceipt({ serviceId, amountUSDC, paymentRef, timestamp }) {
  return {
    network: x402Network(),
    token: x402Usdc(),
    payTo: x402PayTo(),
    amountUSDC,
    amountMicrousd: Math.floor(amountUSDC * 1_000_000),
    serviceId,
    paymentRef,
    timestamp
  };
}

export function generatePaymentReceipt({ serviceId, amountUSDC, paymentRef }) {
  const timestamp = new Date().toISOString();
  const nonce = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = stableStringify({ serviceId, amountUSDC, paymentRef, timestamp, nonce });
  const txHash = `0x${crypto.createHash('sha256').update(payload).digest('hex')}`;
  return {
    txHash,
    receipt: compatibilityReceipt({
      serviceId,
      amountUSDC,
      paymentRef: paymentRef || txHash,
      timestamp
    })
  };
}

export function buildPaymentEvidence({ requestId, payer, serviceId, amountUSDC, paymentRef, responseData }) {
  const responseHash = responseData
    ? `0x${crypto.createHash('sha256').update(stableStringify(responseData)).digest('hex')}`
    : `0x${'00'.repeat(32)}`;
  return {
    requestId: requestId || (Math.floor(Date.now() / 1000) % 1_000_000),
    payer: payer || '0x0000000000000000000000000000000000000000',
    serviceId,
    amountMicrousd: Math.floor(amountUSDC * 1_000_000),
    paymentRef: paymentRef || `x402:${serviceId}:${Date.now()}`,
    responseHash
  };
}

export async function recordPaymentEvidence({ serviceId, amountUSDC, responseData, payer }) {
  const evidence = buildPaymentEvidence({ serviceId, amountUSDC, responseData, payer });
  const demoMode = process.env.DEMO_MODE !== 'false';
  if (!demoMode) {
    try {
      const oracle = await getPaymentOracleContract();
      if (!oracle) {
        throw new PaymentSettlementError(
          'payment_oracle_unavailable',
          'Live mode requires DEPLOYER_PRIVATE_KEY and a deployed PaymentOracle'
        );
      }
      const resolvedPayer = payer || await compatibilityWallet.getAddress();
      const transaction = await oracle.logPaymentEvidence(
        resolvedPayer,
        serviceId,
        evidence.amountMicrousd,
        evidence.paymentRef,
        evidence.responseHash,
        evidence.responseHash,
        evidence.responseHash,
        'OPEN'
      );
      const mined = await transaction.wait();
      const config = loadPaymentOracleConfig();
      const explorerBase = config?.explorerBase ?? 'https://testnet.blockscout.injective.network';
      const timestamp = new Date().toISOString();
      return {
        ok: true,
        payment: {
          txHash: mined.hash,
          blockNumber: mined.blockNumber,
          explorerUrl: `${explorerBase}/tx/${mined.hash}`,
          receipt: compatibilityReceipt({
            serviceId,
            amountUSDC,
            paymentRef: evidence.paymentRef,
            timestamp
          }),
          evidence,
          onChainEvent: 'PaymentEvidenceLogged',
          live: true,
          onchain: true
        }
      };
    } catch (error) {
      throw error instanceof PaymentSettlementError
        ? error
        : new PaymentSettlementError('payment_oracle_write_failed', `PaymentOracle write failed: ${error.message}`, { cause: error });
    }
  }

  const generated = generatePaymentReceipt({ serviceId, amountUSDC, paymentRef: evidence.paymentRef });
  return {
    ok: true,
    payment: {
      txHash: generated.txHash,
      receipt: generated.receipt,
      evidence,
      onChainEvent: 'PaymentEvidenceLogged',
      live: false,
      onchain: false,
      mode: 'demo'
    }
  };
}
