import { loadEthers } from './web3.js';

const HASH_RE = /^0x[0-9a-f]{64}$/u;
const PAYMENT_RE = /^(?:0x[0-9a-f]{64}|demo:\/\/receipt\/[0-9a-zA-Z._:-]{8,160})$/u;
const ALGORITHM_VERSION = 'mystery-voyage-v1';

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export async function hashCanonical(value) {
  const { keccak256, toUtf8Bytes } = await loadEthers();
  return keccak256(toUtf8Bytes(canonicalJson(value)));
}

function assertHash(value, name) {
  const normalized = String(value ?? '').toLowerCase();
  if (!HASH_RE.test(normalized)) throw new TypeError(`${name} must be a 32-byte lowercase hex hash`);
  return normalized;
}

function normalizeCandidates(proof) {
  const ids = proof?.candidate_pool_ids;
  const hashes = proof?.candidate_quote_hashes;
  const weights = proof?.disclosed_weights;
  if (!Array.isArray(ids) || !Array.isArray(hashes) || !Array.isArray(weights)
    || ids.length === 0 || ids.length !== hashes.length || ids.length !== weights.length) {
    throw new TypeError('candidate proof arrays mismatch');
  }
  const seen = new Set();
  return ids.map((poolId, index) => {
    const pool_id = String(poolId ?? '');
    const quote_hash = assertHash(hashes[index], 'candidate quote_hash');
    const weight = Number(weights[index]);
    if (!pool_id || seen.has(pool_id)) throw new TypeError('candidate pool IDs must be unique and non-empty');
    if (!Number.isSafeInteger(weight) || weight <= 0) throw new TypeError('candidate weight must be a positive integer');
    seen.add(pool_id);
    return { pool_id, quote_hash, weight };
  }).sort((left, right) => left.pool_id.localeCompare(right.pool_id));
}

async function candidateSetHash(candidates) {
  return hashCanonical({ algorithm_version: ALGORITHM_VERSION, candidates });
}

async function selectionHash(proof, candidateHash) {
  const { getAddress } = await loadEthers();
  const payment = String(proof.payment_tx_hash ?? '');
  if (!PAYMENT_RE.test(payment)) throw new TypeError('payment_tx_hash is not a transaction hash or demo receipt');
  return hashCanonical({
    algorithm_version: proof.algorithm_version ?? ALGORITHM_VERSION,
    round_id: String(proof.round_id),
    server_secret: assertHash(proof.server_secret, 'server_secret'),
    user_nonce: assertHash(proof.user_nonce, 'user_nonce'),
    payment_tx_hash: payment,
    candidate_set_hash: candidateHash,
    wallet_address: getAddress(String(proof.wallet_address)).toLowerCase()
  });
}

async function rejectionSample(hash, upperBound) {
  assertHash(hash, 'selection_hash');
  if (!Number.isSafeInteger(upperBound) || upperBound <= 0) {
    throw new TypeError('selection weight must be a positive integer');
  }
  const range = 1n << 256n;
  const bound = BigInt(upperBound);
  const limit = range - (range % bound);
  let digest = hash;
  for (let counter = 0; counter < 1024; counter += 1) {
    const value = BigInt(digest);
    if (value < limit) return Number(value % bound);
    digest = await hashCanonical({ hash: digest, counter: counter + 1 });
  }
  throw new Error('rejection sampling did not converge');
}

function selectedIndex(ticket, candidates) {
  let cursor = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    cursor += candidates[index].weight;
    if (ticket < cursor) return index;
  }
  throw new Error('weighted selection failed');
}

function compareBinding(errors, label, actual, expected) {
  if (expected != null && actual !== expected) errors.push(`${label} mismatch`);
}

export async function verifyMysteryProof(proof, options = {}) {
  const errors = [];
  try {
    if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
      throw new TypeError('proof must be an object');
    }
    if (proof.algorithm_version !== ALGORITHM_VERSION) errors.push('algorithm_version mismatch');
    assertHash(proof.risk_passport_hash, 'risk_passport_hash');
    const candidates = normalizeCandidates(proof);
    const candidateHash = await candidateSetHash(candidates);
    compareBinding(errors, 'candidate_set_hash', proof.candidate_set_hash, candidateHash);

    const { keccak256 } = await loadEthers();
    const commitment = keccak256(assertHash(proof.server_secret, 'server_secret'));
    compareBinding(errors, 'server_commitment', proof.server_commitment, commitment);

    const computedSelectionHash = await selectionHash(proof, candidateHash);
    compareBinding(errors, 'selection_hash', proof.selection_hash, computedSelectionHash);
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    const ticket = await rejectionSample(computedSelectionHash, totalWeight);
    const index = selectedIndex(ticket, candidates);
    compareBinding(errors, 'selected_index', proof.selected_index, index);
    compareBinding(errors, 'selected_pool_id', proof.selected_pool_id, candidates[index]?.pool_id);

    const preimage = { ...proof };
    delete preimage.reveal_proof_hash;
    const proofHash = await hashCanonical(preimage);
    compareBinding(errors, 'reveal_proof_hash', proof.reveal_proof_hash, proofHash);

    const report = options.report;
    const envelope = options.envelope;
    if (report) {
      compareBinding(errors, 'report selected_pool_id', report.selected_pool_id, proof.selected_pool_id);
      compareBinding(errors, 'report reveal_proof_hash', report.reveal_proof_hash, proof.reveal_proof_hash);
      compareBinding(errors, 'report risk_passport_hash', report.risk_passport_hash, proof.risk_passport_hash);
    }
    if (envelope) {
      compareBinding(errors, 'envelope selected_pool_id', envelope.selected_pool_id, proof.selected_pool_id);
      compareBinding(errors, 'envelope reveal_proof_hash', envelope.reveal_proof_hash, proof.reveal_proof_hash);
      compareBinding(errors, 'envelope risk_passport_hash', envelope.risk_passport_hash, proof.risk_passport_hash);
      compareBinding(errors, 'envelope payment_tx', envelope.payment_tx, proof.payment_tx_hash);
    }

    return {
      valid: errors.length === 0,
      errors,
      summary: {
        algorithm_version: proof.algorithm_version,
        candidate_count: candidates.length,
        total_weight: totalWeight,
        selected_index: index,
        selected_pool_id: candidates[index]?.pool_id,
        candidate_set_hash: candidateHash,
        server_commitment: commitment,
        selection_hash: computedSelectionHash,
        reveal_proof_hash: proofHash,
        payment_tx_hash: proof.payment_tx_hash
      }
    };
  } catch (error) {
    return { valid: false, errors: [...errors, error.message], summary: null };
  }
}

export function isIndependentSubscriptionAuthorized({ amountUsd, acknowledged, report, selectedPoolId }) {
  return Boolean(
    acknowledged
    && Number.isFinite(Number(amountUsd))
    && Number(amountUsd) > 0
    && report?.selected_pool_id
    && String(report.selected_pool_id) === String(selectedPoolId)
    && Number(report?.risk?.stress_loss_pct) >= 0
  );
}
