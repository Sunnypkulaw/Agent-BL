import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createDecisionId,
  DecisionLogger,
  hashSnapshot
} from '../src/agent/decisionLogger.js';

async function tempLog(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbl-decisions-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return path.join(dir, 'decisions.json');
}

function sample(overrides = {}) {
  return {
    idempotency_key: 'event:evt-1',
    event_id: 'evt-1',
    event_type: 'EBL_MINTED',
    case_id: 'CASE-1',
    action: 'OPEN',
    reasoning_summary: 'Documents agree; the verified quote may open.',
    evidence_hash: hashSnapshot({ evidence: 1 }),
    input_snapshot: { b: 2, a: 1 },
    decision: { method: 'createOffering' },
    ...overrides
  };
}

test('AI-16: decision_id and evidence hashes are reproducible under key reordering', () => {
  const left = sample({ input_snapshot: { b: 2, a: 1 } });
  const right = sample({ input_snapshot: { a: 1, b: 2 } });
  assert.equal(createDecisionId(left), createDecisionId(right));
  assert.equal(hashSnapshot(left.input_snapshot), hashSnapshot(right.input_snapshot));
});

test('AI-16: decisions persist across logger restarts and remain queryable by idempotency key', async (t) => {
  const filePath = await tempLog(t);
  const logger = new DecisionLogger({ filePath });
  const saved = await logger.record(sample());
  assert.match(saved.decision_id, /^decision_[0-9a-f]{24}$/u);
  assert.equal(saved.status, 'DECIDED');

  const reloaded = new DecisionLogger({ filePath });
  const found = await reloaded.findByIdempotencyKey('event:evt-1');
  assert.equal(found.decision_id, saved.decision_id);
  assert.deepEqual(found.input_snapshot, { b: 2, a: 1 });
  assert.equal(found.reasoning_summary.includes('Documents agree'), true);
});

test('AI-16: transaction backfill is persisted without changing the deterministic decision_id', async (t) => {
  const filePath = await tempLog(t);
  const logger = new DecisionLogger({ filePath });
  const saved = await logger.record(sample({ status: 'EXECUTING' }));
  const completed = await logger.attachTransaction(saved.decision_id, {
    success: true,
    tx_hash: `0x${'ab'.repeat(32)}`,
    block_number: 42
  });
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.decision_id, saved.decision_id);

  const reloaded = new DecisionLogger({ filePath });
  const record = await reloaded.get(saved.decision_id);
  assert.equal(record.transaction.block_number, 42);
  assert.equal((await reloaded.list({ status: 'COMPLETED' })).length, 1);
});

test('AI-16: repeated record calls upsert one audit record rather than duplicating it', async () => {
  const logger = new DecisionLogger({ filePath: null });
  const first = await logger.record(sample());
  const second = await logger.record(sample({ status: 'EXECUTING' }));
  assert.equal(first.decision_id, second.decision_id);
  assert.equal((await logger.list()).length, 1);
  assert.equal(second.status, 'EXECUTING');
});

