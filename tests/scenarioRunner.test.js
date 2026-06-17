import test from 'node:test';
import assert from 'node:assert/strict';
import { runHarnessScenarios } from '../src/core/scenarioRunner.js';

test('scenario harness validates expected contract actions across core cases', async () => {
  const results = await runHarnessScenarios();
  const actions = new Set(results.map((result) => result.contract_action));

  assert.ok(results.length >= 4);
  assert.ok(actions.has('APPROVE_FINANCING'));
  assert.ok(actions.has('TRIGGER_MARGIN_CALL'));
  assert.ok(actions.has('TRIGGER_LIQUIDATION'));
});

test('scenario harness exposes concise summaries for downstream agents and UI', async () => {
  const [first] = await runHarnessScenarios();

  assert.ok(first.case_id);
  assert.ok(first.file.endsWith('.json'));
  assert.ok(first.final_state);
  assert.ok(first.risk_level);
  assert.ok(Array.isArray(first.detected_risks));
});
