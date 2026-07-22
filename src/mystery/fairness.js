import crypto from 'node:crypto';
import { getAddress, keccak256, toUtf8Bytes } from 'ethers';

const HASH_RE = /^0x[0-9a-f]{64}$/u;
const PAYMENT_RE = /^(?:0x[0-9a-f]{64}|demo:\/\/receipt\/[0-9a-zA-Z._:-]{8,160})$/u;

export const MYSTERY_ALGORITHM_VERSION = 'mystery-voyage-v1';

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

export function hashCanonical(value) {
  return keccak256(toUtf8Bytes(canonicalJson(value)));
}

export function createServerSecret() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

export function createUserNonce() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

export function serverCommitment(serverSecret) {
  assertHash(serverSecret, 'server_secret');
  return keccak256(serverSecret);
}

export function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new TypeError('candidates must be a non-empty array');
  }
  const normalized = candidates.map((candidate) => {
    const poolId = String(candidate.pool_id ?? candidate.poolId ?? '');
    const quoteHash = String(candidate.quote_hash ?? candidate.quoteHash ?? '').toLowerCase();
    const weight = Number(candidate.weight ?? 1);
    if (!poolId) throw new TypeError('candidate pool_id is required');
    assertHash(quoteHash, 'candidate quote_hash');
    if (!Number.isSafeInteger(weight) || weight <= 0) {
      throw new TypeError('candidate weight must be a positive safe integer');
    }
    return { pool_id: poolId, quote_hash: quoteHash, weight };
  });
  normalized.sort((left, right) => left.pool_id.localeCompare(right.pool_id));
  const ids = new Set();
  for (const candidate of normalized) {
    if (ids.has(candidate.pool_id)) throw new TypeError('duplicate candidate pool_id: ' + candidate.pool_id);
    ids.add(candidate.pool_id);
  }
  return normalized;
}

export function candidateSetHash(candidates) {
  return hashCanonical({
    algorithm_version: MYSTERY_ALGORITHM_VERSION,
    candidates: normalizeCandidates(candidates)
  });
}

export function selectionHash(input) {
  const walletAddress = getAddress(input.wallet_address).toLowerCase();
  assertHash(input.server_secret, 'server_secret');
  assertHash(input.user_nonce, 'user_nonce');
  assertHash(input.candidate_set_hash, 'candidate_set_hash');
  if (!PAYMENT_RE.test(String(input.payment_tx_hash ?? ''))) {
    throw new TypeError('payment_tx_hash must be a transaction hash or demo receipt');
  }
  return hashCanonical({
    algorithm_version: input.algorithm_version ?? MYSTERY_ALGORITHM_VERSION,
    round_id: String(input.round_id),
    server_secret: input.server_secret.toLowerCase(),
    user_nonce: input.user_nonce.toLowerCase(),
    payment_tx_hash: String(input.payment_tx_hash),
    candidate_set_hash: input.candidate_set_hash.toLowerCase(),
    wallet_address: walletAddress
  });
}

export function rejectionSample(hash, upperBound) {
  assertHash(hash, 'selection_hash');
  if (!Number.isSafeInteger(upperBound) || upperBound <= 0) {
    throw new TypeError('upperBound must be a positive safe integer');
  }
  const range = 1n << 256n;
  const bound = BigInt(upperBound);
  const limit = range - (range % bound);
  let digest = hash;
  for (let counter = 0; counter < 1024; counter += 1) {
    const value = BigInt(digest);
    if (value < limit) return Number(value % bound);
    digest = hashCanonical({ hash: digest, counter: counter + 1 });
  }
  throw new Error('rejection sampling did not converge');
}

function selectWeightedIndex(hash, candidates) {
  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  const ticket = rejectionSample(hash, totalWeight);
  let cursor = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    cursor += candidates[index].weight;
    if (ticket < cursor) return index;
  }
  throw new Error('weighted selection failed');
}

export function createRevealProof(input) {
  const candidates = normalizeCandidates(input.candidates);
  const computedCandidateHash = candidateSetHash(candidates);
  if (input.candidate_set_hash && input.candidate_set_hash.toLowerCase() !== computedCandidateHash) {
    throw new Error('candidate_set_hash does not match candidates');
  }
  const commitment = serverCommitment(input.server_secret);
  if (input.server_commitment && input.server_commitment.toLowerCase() !== commitment) {
    throw new Error('server_secret does not match server_commitment');
  }
  const selectedHash = selectionHash({
    ...input,
    candidate_set_hash: computedCandidateHash
  });
  const selectedIndex = selectWeightedIndex(selectedHash, candidates);
  const proof = {
    reveal_id: String(input.reveal_id),
    round_id: String(input.round_id),
    algorithm_version: input.algorithm_version ?? MYSTERY_ALGORITHM_VERSION,
    risk_passport_hash: String(input.risk_passport_hash).toLowerCase(),
    candidate_pool_ids: candidates.map((candidate) => candidate.pool_id),
    candidate_quote_hashes: candidates.map((candidate) => candidate.quote_hash),
    disclosed_weights: candidates.map((candidate) => candidate.weight),
    candidate_set_hash: computedCandidateHash,
    server_commitment: commitment,
    server_secret: input.server_secret.toLowerCase(),
    user_nonce: input.user_nonce.toLowerCase(),
    payment_tx_hash: String(input.payment_tx_hash),
    wallet_address: getAddress(input.wallet_address).toLowerCase(),
    selection_hash: selectedHash,
    selected_index: selectedIndex,
    selected_pool_id: candidates[selectedIndex].pool_id,
    created_at: new Date(input.created_at ?? Date.now()).toISOString(),
    expires_at: new Date(input.expires_at).toISOString()
  };
  assertHash(proof.risk_passport_hash, 'risk_passport_hash');
  proof.reveal_proof_hash = hashCanonical(proof);
  return proof;
}

export function verifyRevealProof(proof) {
  try {
    const suppliedPreimage = { ...proof };
    delete suppliedPreimage.reveal_proof_hash;
    if (hashCanonical(suppliedPreimage) !== proof.reveal_proof_hash) {
      return { valid: false, errors: ['reveal_proof_hash mismatch'] };
    }
    if (!Array.isArray(proof.candidate_pool_ids)
      || !Array.isArray(proof.candidate_quote_hashes)
      || !Array.isArray(proof.disclosed_weights)
      || proof.candidate_pool_ids.length !== proof.candidate_quote_hashes.length
      || proof.candidate_pool_ids.length !== proof.disclosed_weights.length) {
      return { valid: false, errors: ['candidate proof arrays mismatch'] };
    }
    const candidates = proof.candidate_pool_ids.map((poolId, index) => ({
      pool_id: poolId,
      quote_hash: proof.candidate_quote_hashes[index],
      weight: proof.disclosed_weights[index]
    }));
    const rebuilt = createRevealProof({
      ...proof,
      candidates
    });
    const fields = [
      'candidate_set_hash',
      'server_commitment',
      'selection_hash',
      'selected_index',
      'selected_pool_id',
      'reveal_proof_hash'
    ];
    const mismatches = fields.filter((field) => rebuilt[field] !== proof[field]);
    return { valid: mismatches.length === 0, errors: mismatches.map((field) => field + ' mismatch') };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

function assertHash(value, name) {
  if (!HASH_RE.test(String(value ?? '').toLowerCase())) {
    throw new TypeError(name + ' must be a 32-byte lowercase hex hash');
  }
}
