import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  OFFERING_STATE_BY_CONTRACT_ACTION,
  PRICING_ACTION_BY_CONTRACT_ACTION,
  PRICING_ACTION_TO_UINT8,
  RISK_LEVEL_TO_UINT8,
  simulateContractHarness
} from '../src/core/contractHarness.js';

async function readCase(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

test('contract harness emits pricing oracle evidence for the demo case', async () => {
  const data = await readCase('data/demo-case.json');
  const result = simulateContractHarness(data);
  const pricingEvent = result.events.find((event) => event.event === 'PricingUpdated');

  assert.equal(result.ebl.bl_id, data.bill_of_lading.bl_id);
  assert.equal(result.offering.pool_id, 1);
  assert.equal(result.offering.state, OFFERING_STATE_BY_CONTRACT_ACTION[result.risk_report.contract_action]);
  assert.equal(result.pricing_quote.pricing_action, PRICING_ACTION_BY_CONTRACT_ACTION[result.risk_report.contract_action]);
  assert.ok(pricingEvent);
  assert.equal(pricingEvent.args.evidenceHash, result.risk_report.evidence_hash);
  assert.equal(pricingEvent.args.quoteHash, result.pricing_quote.quote_hash);
  assert.match(pricingEvent.args.quoteHash, /^0x[0-9a-f]{64}$/u);
  assert.equal(pricingEvent.args.riskLevelCode, RISK_LEVEL_TO_UINT8[result.pricing_quote.risk_level]);
  assert.equal(pricingEvent.args.actionCode, PRICING_ACTION_TO_UINT8[result.pricing_quote.pricing_action]);
});

test('contract harness aligns event fields with the frozen contract design', async () => {
  const data = await readCase('data/demo-case.json');
  const result = simulateContractHarness(data);
  const byEvent = (name) => result.events.find((event) => event.event === name);

  const pledged = byEvent('EBLPledged');
  assert.equal(pledged.args.holder, data.bill_of_lading.shipper);

  const subscribed = byEvent('Subscribed');
  assert.equal(subscribed.args.paidAmount, result.offering.subscribed_paid_amount);

  const minted = byEvent('RWAMinted');
  assert.equal(minted.contract, 'RWAToken');
  assert.equal(minted.args.investor, subscribed.args.investor);
  assert.equal(minted.args.amount, subscribed.args.amount);

  const stateChanged = byEvent('OfferingStateChanged');
  assert.equal(stateChanged.args.newState, result.offering.state);
  assert.equal(stateChanged.args.actionCode, PRICING_ACTION_TO_UINT8[result.pricing_quote.pricing_action]);
  assert.ok('oldState' in stateChanged.args);
});

test('contract harness rejects non-permissioned investors', async () => {
  const data = await readCase('data/demo-case.json');

  assert.throws(
    () => simulateContractHarness(data, { investor: 'unlisted-investor', whitelist: ['permissioned-investor-1'] }),
    /not permissioned/u
  );
});

test('contract harness covers scenario contract actions with oracle events', async () => {
  const scenarioFiles = await fs.readdir('data/scenarios');

  for (const file of scenarioFiles.filter((item) => item.endsWith('.json'))) {
    const data = await readCase(path.join('data/scenarios', file));
    const result = simulateContractHarness(data);
    const pricingEvent = result.oracle.latest_event;

    assert.equal(result.offering.state, OFFERING_STATE_BY_CONTRACT_ACTION[result.risk_report.contract_action], file);
    assert.equal(pricingEvent.event, 'PricingUpdated', file);
    assert.equal(pricingEvent.args.action, PRICING_ACTION_BY_CONTRACT_ACTION[result.risk_report.contract_action], file);
    assert.equal(pricingEvent.args.evidenceHash, result.risk_report.evidence_hash, file);
  }
});
