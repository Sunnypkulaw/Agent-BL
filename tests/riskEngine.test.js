import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { calculateRisk } from '../src/core/riskEngine.js';
import { assertRiskReport, assertTradeCase } from '../src/core/schema.js';

test('risk engine returns a structured report for the demo case', async () => {
  const data = JSON.parse(await fs.readFile('data/demo-case.json', 'utf8'));
  assertTradeCase(data);
  const report = calculateRisk(data);
  assertRiskReport(report, data);

  assert.equal(report.bl_id, 'EBL-2026-0001');
  assert.ok(report.cargo_health_score <= 100);
  assert.ok(report.verified_cargo_value_usd > 0);
  assert.ok(report.health_factor > 0);
  assert.ok(report.evidence_hash.startsWith('0x'));
});

test('risk engine becomes more conservative when price drops further', async () => {
  const data = JSON.parse(await fs.readFile('data/demo-case.json', 'utf8'));
  const base = calculateRisk(data);
  data.market.current_price_usd_per_mt = 5000;
  data.shipment_events.push({ type: 'cargo_damage', date: '2026-06-21', severity: 'critical', description: 'Mock cargo damage report.' });
  const stressed = calculateRisk(data);

  assert.ok(stressed.health_factor < base.health_factor);
  assert.ok(['FREEZE_POOL', 'TRIGGER_LIQUIDATION'].includes(stressed.contract_action));
});
