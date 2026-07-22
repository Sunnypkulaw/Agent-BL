import { getAddress } from 'ethers';
import { verifyRevealProof } from './fairness.js';
import { evaluateMysteryCandidate, filterMysteryCandidates } from './policy.js';
import { buildMysteryRiskPassport } from './riskPassport.js';
import { getMysteryRevealStore, MysteryStoreError } from './store.js';

const HASH_RE = /^0x[0-9a-f]{64}$/u;

function normalizeWallet(value) {
  try {
    return getAddress(String(value ?? '')).toLowerCase();
  } catch {
    throw new MysteryStoreError('wallet_invalid', 'wallet_address must be a valid EVM address');
  }
}

function poolMap(pools) {
  return pools instanceof Map
    ? pools
    : new Map(Array.from(pools ?? [], (pool) => [String(pool.poolId), pool]));
}

export async function previewMysteryVoyage(input, options = {}) {
  const walletAddress = normalizeWallet(input?.wallet_address);
  const pools = poolMap(options.pools);
  const filtered = filterMysteryCandidates(pools.values(), input?.risk_passport ?? {}, {
    now: options.now
  });
  const store = options.store ?? getMysteryRevealStore();
  const preview = await store.createPreview({
    wallet_address: walletAddress,
    idempotency_key: input?.idempotency_key,
    risk_passport: filtered.risk_passport,
    candidates: filtered.eligible,
    ttl_seconds: input?.ttl_seconds,
    round_id: input?.round_id
  });
  return {
    ok: true,
    ...preview,
    rejected_count: filtered.rejected.length
  };
}

export async function revealMysteryVoyage(input, options = {}) {
  const walletAddress = normalizeWallet(input?.wallet_address);
  const userNonce = String(input?.user_nonce ?? '').toLowerCase();
  if (!HASH_RE.test(userNonce)) {
    throw new MysteryStoreError('nonce_invalid', 'user_nonce must be a 32-byte hex value');
  }
  const pools = poolMap(options.pools);
  const store = options.store ?? getMysteryRevealStore();
  return store.markPaidAndReveal({
    reveal_id: String(input?.reveal_id ?? ''),
    wallet_address: walletAddress,
    user_nonce: userNonce,
    payment_tx_hash: String(input?.payment_tx_hash ?? ''),
    validateCandidate: async (selectedPoolId, record) => {
      const pool = pools.get(selectedPoolId);
      if (!pool) return false;
      const snapshotted = record.candidates.find((candidate) => candidate.pool_id === selectedPoolId);
      if (!snapshotted || String(pool.quote?.quote_hash).toLowerCase() !== snapshotted.quote_hash) return false;
      return evaluateMysteryCandidate(pool, record.risk_passport, { now: options.now }).eligible;
    },
    buildReport: async (proof, record) => buildMysteryRiskPassport({
      pool: pools.get(proof.selected_pool_id),
      riskPassport: record.risk_passport,
      proof,
      now: options.now
    })
  });
}

export async function preflightMysteryVoyage(input, options = {}) {
  const walletAddress = normalizeWallet(input?.wallet_address);
  const userNonce = String(input?.user_nonce ?? '').toLowerCase();
  if (!HASH_RE.test(userNonce)) {
    throw new MysteryStoreError('nonce_invalid', 'user_nonce must be a 32-byte hex value');
  }
  const pools = poolMap(options.pools);
  const store = options.store ?? getMysteryRevealStore();
  const record = await store.get(String(input?.reveal_id ?? ''), { internal: true });
  if (record.wallet_address !== walletAddress) {
    throw new MysteryStoreError('wallet_mismatch', 'Paying wallet does not match preview wallet');
  }
  if (record.state !== 'COMMITTED') {
    throw new MysteryStoreError('mystery_bad_state', 'Mystery reveal is not payable in state ' + record.state);
  }
  const invalidCandidates = record.candidates.filter((candidate) => {
    const pool = pools.get(candidate.pool_id);
    if (!pool || String(pool.quote?.quote_hash).toLowerCase() !== candidate.quote_hash) return true;
    return !evaluateMysteryCandidate(pool, record.risk_passport, { now: options.now }).eligible;
  }).map((candidate) => candidate.pool_id);
  if (invalidCandidates.length > 0) {
    const aborted = await store.abortCommitted({
      reveal_id: record.reveal_id,
      wallet_address: walletAddress,
      invalid_candidates: invalidCandidates
    });
    throw new MysteryStoreError(
      'candidate_invalidated_before_payment',
      'The committed candidate set changed before settlement; payment was not collected',
      { abort: aborted.abort }
    );
  }
  return { ok: true, reveal_id: record.reveal_id, state: record.state };
}

export async function getMysteryProof(revealId, options = {}) {
  const store = options.store ?? getMysteryRevealStore();
  const record = await store.get(String(revealId ?? ''));
  if (record.state !== 'REVEALED') {
    throw new MysteryStoreError(
      record.state === 'ABORTED' ? 'mystery_aborted' : 'mystery_not_revealed',
      record.state === 'ABORTED'
        ? 'Mystery reveal was aborted and has no valid proof'
        : 'Reveal proof is available only after a settled payment',
      { state: record.state, abort: record.abort }
    );
  }
  return {
    ok: true,
    reveal_id: record.reveal_id,
    state: record.state,
    proof: record.proof,
    verification: verifyRevealProof(record.proof),
    report: record.report
  };
}

export function mysteryHttpStatus(error) {
  if (!(error instanceof MysteryStoreError)) return 500;
  if (error.code === 'mystery_not_found') return 404;
  if (['wallet_invalid', 'nonce_invalid', 'mystery_no_candidates'].includes(error.code)) return 400;
  return 409;
}
