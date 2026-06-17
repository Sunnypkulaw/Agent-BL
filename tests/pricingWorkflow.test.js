import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { simulatePricingWorkflow } from '../src/core/pricingWorkflow.js';
import { assertPricingQuote } from '../src/core/pricingSchema.js';

// BE-6: the merged workflow simulation must fuse the AI PricingQuote, a compact
// risk_report and the RWA offering lifecycle into ONE object, and they must agree.

const copperCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);
const warCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai-warcrisis.case.json', import.meta.url), 'utf8')
);

test('BE-6: merged workflow carries pricing_quote + risk_report + offering that agree', () => {
  const wf = simulatePricingWorkflow(copperCase, { payout_speed: 'FAST' });

  assert.equal(wf.case_id, copperCase.case_id);
  assert.equal(wf.bl_id, copperCase.bill_of_lading.bl_id);
  assert.doesNotThrow(() => assertPricingQuote(wf.pricing_quote, copperCase));

  // pricing_quote and risk_report agree on action + the anchoring evidence hash.
  assert.equal(wf.risk_report.pricing_action, wf.pricing_quote.pricing_action);
  assert.equal(wf.risk_report.evidence_hash, wf.pricing_quote.evidence_hash);
  assert.equal(wf.risk_report.risk_level, wf.pricing_quote.risk_level);

  // final_state mirrors the offering lifecycle; a healthy case settles.
  assert.equal(wf.final_state, wf.offering.final_state);
  assert.equal(wf.final_state, 'Redeemed');
});

test('BE-6: a war-crisis case merges to a paused offering', () => {
  const wf = simulatePricingWorkflow(warCase, { payout_speed: 'FAST' });
  assert.equal(wf.pricing_quote.pricing_action, 'PAUSE_OFFERING');
  assert.equal(wf.risk_report.risk_level, 'CRITICAL');
  assert.equal(wf.final_state, 'Paused');
});

test('BE-6: risk_report surfaces document-consistency findings and risk factors', () => {
  const wf = simulatePricingWorkflow(copperCase, { payout_speed: 'BALANCED' });
  assert.ok(wf.risk_report.document_consistency);
  assert.equal(typeof wf.risk_report.document_consistency.ok, 'boolean');
  assert.ok(Array.isArray(wf.risk_report.risk_factors));
  assert.ok(wf.risk_report.risk_factors.length >= 1);
});

test('BE-6: an in-transit risk shock is reflected in the merged final_state', () => {
  const wf = simulatePricingWorkflow(copperCase, {
    payout_speed: 'FAST',
    events: [
      { category: 'macro', type: 'severe_weather', severity: 'warning', region: 'East China Sea', description: 'typhoon' },
      { category: 'shipment', type: 'route_deviation', severity: 'warning', description: 'reroute' }
    ]
  });
  // It opens healthy, reprices mid-transit, and still settles.
  assert.ok(wf.offering.steps.some((s) => s.state === 'Repriced'));
  assert.equal(wf.final_state, 'Redeemed');
});
