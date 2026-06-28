import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  AUTONOMOUS_ACTIONS,
  AutonomousAgent
} from '../src/agent/autonomousAgent.js';
import { DecisionLogger } from '../src/agent/decisionLogger.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copperCase = JSON.parse(await fs.readFile(path.join(root, 'data/cases/copper-sg-shanghai.case.json'), 'utf8'));

const warningEvent = {
  date: '2026-06-10',
  type: 'severe_weather',
  region: 'South China Sea',
  severity: 'warning',
  description: 'Typhoon risk raises delay and cargo handling uncertainty.'
};

const criticalEvent = {
  date: '2026-06-10',
  type: 'war_risk',
  region: 'Singapore shipping lane',
  severity: 'critical',
  description: 'Active conflict closes the route and invalidates normal insurance assumptions.'
};

test('AI-14: six event families map to OPEN/REPRICE/PAUSE/RESUME/SETTLE/WARNING', async () => {
  const agent = new AutonomousAgent({ logger: new DecisionLogger({ filePath: null }) });
  const decisions = [
    await agent.decide({ event_id: 'mint', type: 'EBL_MINTED', case_data: copperCase }),
    await agent.decide({ event_id: 'risk-warning', type: 'WORLD_RISK_UPDATED', case_data: copperCase, world_risk_events: [warningEvent] }),
    await agent.decide({ event_id: 'risk-critical', type: 'WORLD_RISK_UPDATED', case_data: copperCase, world_risk_events: [criticalEvent] }),
    await agent.decide({ event_id: 'cleared', type: 'RISK_CLEARED', case_id: copperCase.case_id, pool_id: 1 }),
    await agent.decide({ event_id: 'paid', type: 'PAYMENT_RECEIVED', case_id: copperCase.case_id, pool_id: 1, data: { payment_tx: '0xabc' } }),
    await agent.decide({ event_id: 'expired', type: 'INSURANCE_EXPIRED', case_id: copperCase.case_id, pool_id: 1, pool_state: 'Redeemed' })
  ];
  assert.deepEqual(decisions.map((decision) => decision.action), AUTONOMOUS_ACTIONS);
  assert.equal(decisions[0].protocol_action.method, 'createOffering');
  assert.equal(decisions[1].protocol_action.method, 'repriceOffering');
  assert.equal(decisions[2].protocol_action.method, 'pauseOffering');
  assert.equal(decisions[3].protocol_action.method, 'resumeOffering');
  assert.equal(decisions[4].protocol_action.method, 'settleOffering');
  assert.equal(decisions[5].protocol_action.method, 'recordWarning');
});

test('AI-14: cargo arrival settles only after importer payment is verified', async () => {
  const agent = new AutonomousAgent({ logger: new DecisionLogger({ filePath: null }) });
  const waiting = await agent.decide({
    event_id: 'arrived-1', type: 'CARGO_ARRIVED', case_id: copperCase.case_id, pool_id: 1,
    data: { payment_received: false, arrival_proof: 'proof-1' }
  });
  const settled = await agent.decide({
    event_id: 'arrived-2', type: 'CARGO_ARRIVED', case_id: copperCase.case_id, pool_id: 1,
    data: { payment_received: true, arrival_proof: 'proof-2' }
  });
  assert.equal(waiting.action, 'WARNING');
  assert.equal(settled.action, 'SETTLE');
});

test('AI-15: bounded retry succeeds and records the real attempt count', async () => {
  let calls = 0;
  const agent = new AutonomousAgent({
    logger: new DecisionLogger({ filePath: null }),
    maxAttempts: 3,
    baseDelayMs: 0,
    sleep: async () => {},
    executor: async ({ idempotency_key }) => {
      calls += 1;
      if (calls === 1) throw new Error('temporary RPC timeout');
      if (calls === 2) return { success: false, error: 'transaction was not accepted' };
      return { success: true, tx_hash: `0x${'22'.repeat(32)}`, idempotency_key };
    }
  });
  const result = await agent.processEvent({
    event_id: 'retry-event', type: 'RISK_CLEARED', case_id: copperCase.case_id, pool_id: 7
  });
  assert.equal(calls, 3);
  assert.equal(result.execution.attempts, 3);
  assert.equal(result.decision.status, 'COMPLETED');
});

test('AI-15: concurrent and repeated delivery of one event never creates a duplicate tx', async () => {
  let calls = 0;
  const logger = new DecisionLogger({ filePath: null });
  const agent = new AutonomousAgent({
    logger,
    executor: async () => {
      calls += 1;
      await Promise.resolve();
      return { success: true, tx_hash: `0x${'33'.repeat(32)}` };
    }
  });
  const event = { event_id: 'same-event', type: 'RISK_CLEARED', case_id: copperCase.case_id, pool_id: 3 };
  const [a, b] = await Promise.all([agent.processEvent(event), agent.processEvent(structuredClone(event))]);
  assert.equal(calls, 1);
  assert.equal(a.decision.decision_id, b.decision.decision_id);
  const repeated = await agent.processEvent(event);
  assert.equal(repeated.duplicate, true);
  assert.equal(calls, 1);
  assert.equal((await logger.list()).length, 1);
});

test('AI-15: a completed decision survives process restart and is not resubmitted', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbl-agent-restart-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'decisions.json');
  let firstCalls = 0;
  const event = { event_id: 'restart-event', type: 'PAYMENT_RECEIVED', case_id: copperCase.case_id, pool_id: 9 };
  const first = new AutonomousAgent({
    logger: new DecisionLogger({ filePath }),
    executor: async () => {
      firstCalls += 1;
      return { success: true, tx_hash: `0x${'44'.repeat(32)}` };
    }
  });
  await first.processEvent(event);
  assert.equal(firstCalls, 1);

  let secondCalls = 0;
  const restarted = new AutonomousAgent({
    logger: new DecisionLogger({ filePath }),
    executor: async () => {
      secondCalls += 1;
      return { success: true, tx_hash: `0x${'55'.repeat(32)}` };
    }
  });
  const result = await restarted.processEvent(event);
  assert.equal(result.duplicate, true);
  assert.equal(result.execution.tx_hash, `0x${'44'.repeat(32)}`);
  assert.equal(secondCalls, 0);
});

test('AI-15: an EXECUTING record reconciles a prior tx before any resubmission', async () => {
  const logger = new DecisionLogger({ filePath: null });
  const probe = new AutonomousAgent({ logger });
  const event = { event_id: 'recover-event', type: 'RISK_CLEARED', case_id: copperCase.case_id, pool_id: 10 };
  const decision = await probe.decide(event);
  await logger.record({ ...decision, decision: { protocol_action: decision.protocol_action }, status: 'EXECUTING' });

  let submissions = 0;
  const executor = async () => {
    submissions += 1;
    return { success: true, tx_hash: `0x${'66'.repeat(32)}` };
  };
  executor.findByIdempotencyKey = async () => ({ tx_hash: `0x${'77'.repeat(32)}`, block_number: 77 });
  const recoveredAgent = new AutonomousAgent({ logger, executor });
  const result = await recoveredAgent.processEvent(event);
  assert.equal(result.recovered, true);
  assert.equal(result.execution.tx_hash, `0x${'77'.repeat(32)}`);
  assert.equal(submissions, 0);
});

test('AI-15: monitoring polls repeatedly while duplicate events remain idempotent', async () => {
  const controller = new AbortController();
  let fetches = 0;
  let executions = 0;
  const agent = new AutonomousAgent({
    logger: new DecisionLogger({ filePath: null }),
    executor: async () => {
      executions += 1;
      return { success: true, tx_hash: `0x${'88'.repeat(32)}` };
    }
  });
  const event = { event_id: 'poll-event', type: 'RISK_CLEARED', case_id: copperCase.case_id, pool_id: 11 };
  const monitor = agent.startMonitoring(async () => {
    fetches += 1;
    if (fetches >= 2) controller.abort();
    return [event];
  }, { controller, intervalMs: 0, sleep: async () => {} });
  const summary = await monitor.done;
  assert.equal(summary.stopped, true);
  assert.equal(fetches, 2);
  assert.equal(executions, 1);
});
