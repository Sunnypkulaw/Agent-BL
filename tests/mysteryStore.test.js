import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { hashCanonical } from '../src/mystery/fairness.js';
import { normalizeRiskPassport } from '../src/mystery/policy.js';
import { MysteryRevealStore } from '../src/mystery/store.js';

const WALLET = '0x1111111111111111111111111111111111111111';
const OTHER_WALLET = '0x2222222222222222222222222222222222222222';
const NONCE = `0x${'33'.repeat(32)}`;
const PAYMENT = `0x${'44'.repeat(32)}`;
const temporaryDirectories = [];

async function store(options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbl-mystery-'));
  temporaryDirectories.push(directory);
  return new MysteryRevealStore({ filePath: path.join(directory, 'reveals.json'), ...options });
}

function previewInput(overrides = {}) {
  return {
    wallet_address: WALLET,
    idempotency_key: 'preview-1',
    risk_passport: normalizeRiskPassport({ tier: 'BALANCED' }),
    candidates: [
      { pool_id: 'pool-a', quote_hash: hashCanonical({ quote: 'a' }), weight: 1 },
      { pool_id: 'pool-b', quote_hash: hashCanonical({ quote: 'b' }), weight: 1 }
    ],
    ttl_seconds: 300,
    ...overrides
  };
}

function revealInput(preview, overrides = {}) {
  return {
    reveal_id: preview.reveal_id,
    wallet_address: WALLET,
    user_nonce: NONCE,
    payment_tx_hash: PAYMENT,
    validateCandidate: async () => true,
    buildReport: async (proof) => ({ selected_pool_id: proof.selected_pool_id }),
    ...overrides
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

test('MBOX-BE-4: preview persists commitment, restores after restart and hides secret/candidates', async () => {
  const first = await store();
  const preview = await first.createPreview(previewInput());
  assert.equal(preview.state, 'COMMITTED');
  assert.equal(preview.candidate_count, 2);
  assert.equal('server_secret' in preview, false);
  assert.equal('candidate_pool_ids' in preview, false);

  const restored = new MysteryRevealStore({ filePath: first.filePath });
  const record = await restored.get(preview.reveal_id, { internal: true });
  assert.equal(record.server_commitment, preview.server_commitment);
  assert.equal(record.candidates.length, 2);
});

test('MBOX-BE-4: idempotency is scoped to wallet and payment receipts cannot be replayed', async () => {
  const target = await store();
  const first = await target.createPreview(previewInput());
  const retry = await target.createPreview(previewInput());
  assert.equal(retry.reveal_id, first.reveal_id);
  const other = await target.createPreview(previewInput({ wallet_address: OTHER_WALLET }));
  assert.notEqual(other.reveal_id, first.reveal_id);
  await target.markPaidAndReveal(revealInput(first));
  await assert.rejects(
    target.markPaidAndReveal(revealInput(other, { wallet_address: OTHER_WALLET })),
    (error) => error.code === 'payment_replay'
  );
});

test('MBOX-BE-4: concurrent payment attempts yield one reveal and one fail-closed result', async () => {
  const target = await store();
  const preview = await target.createPreview(previewInput());
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const first = target.markPaidAndReveal(revealInput(preview, {
    validateCandidate: async () => { await gate; return true; }
  }));
  await new Promise((resolve) => setImmediate(resolve));
  const second = target.markPaidAndReveal(revealInput(preview));
  release();
  const results = await Promise.allSettled([first, second]);
  assert.equal(results.filter((entry) => entry.status === 'fulfilled').length, 1);
  assert.equal(results.filter((entry) => entry.status === 'rejected').length, 1);
  assert.equal((await target.get(preview.reveal_id)).state, 'REVEALED');
});

test('MBOX-BE-4/6: expiry and post-payment invalidation are terminal and auditable', async () => {
  let now = new Date('2026-07-23T00:00:00.000Z');
  const target = await store({ now: () => now });
  const expired = await target.createPreview(previewInput({ idempotency_key: 'expires', ttl_seconds: 10 }));
  now = new Date('2026-07-23T00:00:11.000Z');
  assert.equal((await target.get(expired.reveal_id)).state, 'EXPIRED');

  now = new Date('2026-07-23T00:01:00.000Z');
  const invalid = await target.createPreview(previewInput({ idempotency_key: 'invalidated' }));
  await assert.rejects(
    target.markPaidAndReveal(revealInput(invalid, {
      payment_tx_hash: `0x${'55'.repeat(32)}`,
      validateCandidate: async () => false
    })),
    (error) => error.code === 'candidate_invalidated'
      && error.details.abort.free_reopen_eligible === true
  );
  const aborted = await target.get(invalid.reveal_id);
  assert.equal(aborted.state, 'ABORTED');
  assert.equal(aborted.abort.refund_status, 'REFUND_OR_FREE_REOPEN_AVAILABLE');
});
