import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidateSetHash,
  createRevealProof,
  hashCanonical,
  rejectionSample,
  serverCommitment,
  verifyRevealProof
} from '../src/mystery/fairness.js';

const SECRET = `0x${'11'.repeat(32)}`;
const NONCE = `0x${'22'.repeat(32)}`;
const PAYMENT = `0x${'33'.repeat(32)}`;
const WALLET = '0x4444444444444444444444444444444444444444';
const RISK_HASH = `0x${'55'.repeat(32)}`;

function candidates() {
  return [
    { pool_id: 'pool-c', quote_hash: hashCanonical({ quote: 'c' }), weight: 3 },
    { pool_id: 'pool-a', quote_hash: hashCanonical({ quote: 'a' }), weight: 1 },
    { pool_id: 'pool-b', quote_hash: hashCanonical({ quote: 'b' }), weight: 2 }
  ];
}

function proof(overrides = {}) {
  const frozen = candidates();
  return createRevealProof({
    reveal_id: 'mrv_test',
    round_id: 'round_test',
    candidates: frozen,
    candidate_set_hash: candidateSetHash(frozen),
    server_secret: SECRET,
    server_commitment: serverCommitment(SECRET),
    user_nonce: NONCE,
    payment_tx_hash: PAYMENT,
    wallet_address: WALLET,
    risk_passport_hash: RISK_HASH,
    created_at: '2026-07-23T00:00:00.000Z',
    expires_at: '2026-07-23T00:05:00.000Z',
    ...overrides
  });
}

test('MBOX-BE-3: same committed inputs always select the same pool', () => {
  const first = proof();
  const second = proof();
  assert.equal(first.selected_pool_id, second.selected_pool_id);
  assert.equal(first.selection_hash, second.selection_hash);
  assert.equal(first.reveal_proof_hash, second.reveal_proof_hash);
  assert.deepEqual(verifyRevealProof(first), { valid: true, errors: [] });
});

test('MBOX-BE-3: candidate, weight, nonce, payment and quote tampering fail verification', () => {
  const original = proof();
  const mutations = [
    (value) => { value.candidate_pool_ids[0] = 'pool-evil'; },
    (value) => { value.disclosed_weights[0] += 1; },
    (value) => { value.user_nonce = `0x${'66'.repeat(32)}`; },
    (value) => { value.payment_tx_hash = `0x${'77'.repeat(32)}`; },
    (value) => { value.candidate_quote_hashes[0] = hashCanonical({ quote: 'tampered' }); },
    (value) => { value.candidate_quote_hashes.push(hashCanonical({ quote: 'extra' })); }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(original);
    mutate(changed);
    assert.equal(verifyRevealProof(changed).valid, false);
  }
});

test('MBOX-BE-3: 10,000 deterministic seeds exercise rejection sampling without material bias', () => {
  const buckets = [0, 0, 0, 0];
  for (let seed = 0; seed < 10_000; seed += 1) {
    buckets[rejectionSample(hashCanonical({ seed }), buckets.length)] += 1;
  }
  for (const count of buckets) {
    assert.ok(count > 2200 && count < 2800, `unexpected distribution: ${buckets.join(',')}`);
  }
});
