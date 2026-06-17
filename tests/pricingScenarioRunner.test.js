import assert from 'node:assert/strict';
import test from 'node:test';
import { runPricingScenarios } from '../src/core/pricingScenarioRunner.js';

// AI-4 (risk discount) + AI-10 (high-risk scenario) regression. This is the
// test-suite counterpart of `npm run scenarios`: it locks the fast / balanced /
// high-risk-reprice / high-risk-pause fixtures so a change to the risk scoring
// or the offering lifecycle can never silently regress the demo.
const results = await runPricingScenarios();
const byName = Object.fromEntries(results.map((r) => [r.name, r]));

test('AI-4/AI-10: all bundled pricing scenarios pass and cover the demo arc', () => {
  assert.ok(results.length >= 4, `expected >= 4 pricing scenarios, got ${results.length}`);
  for (const name of ['fast-payout', 'balanced-payout', 'high-risk-reprice', 'high-risk-pause']) {
    assert.ok(byName[name], `missing scenario ${name}`);
  }
});

test('AI-4: fast vs balanced open cleanly with the urgency-monotone price', () => {
  const fast = byName['fast-payout'];
  const balanced = byName['balanced-payout'];
  assert.equal(fast.pricing_action, 'OPEN_OFFERING');
  assert.equal(balanced.pricing_action, 'OPEN_OFFERING');
  // More urgent payout => deeper discount => lower issue price.
  assert.ok(fast.final_issue_price_usd < balanced.final_issue_price_usd);
  assert.ok(fast.exporter_profit_share_bps > balanced.exporter_profit_share_bps);
});

test('AI-10: an in-transit risk shock reprices the pool but it still settles', () => {
  const reprice = byName['high-risk-reprice'];
  assert.equal(reprice.pricing_action, 'OPEN_OFFERING'); // opens healthy
  assert.equal(reprice.offering_final_state, 'Redeemed'); // settles after reprice
  assert.ok(reprice.offering_states.includes('Repriced')); // reprice happened mid-flight
});

test('AI-10: a critical war-crisis case is paused, never opened', () => {
  const pause = byName['high-risk-pause'];
  assert.equal(pause.risk_level, 'CRITICAL');
  assert.equal(pause.pricing_action, 'PAUSE_OFFERING');
  assert.equal(pause.offering_final_state, 'Paused');
  assert.ok(!pause.offering_states.includes('Open'));
});

test('AI-4/AI-10: the scenario set covers both an opening and a pausing action', () => {
  const actions = new Set(results.map((r) => r.pricing_action));
  assert.ok(actions.has('OPEN_OFFERING'), 'no OPEN_OFFERING scenario');
  assert.ok(actions.has('PAUSE_OFFERING'), 'no PAUSE_OFFERING scenario');
  // Risk rises monotonically from the clean case to the war-crisis case.
  assert.ok(byName['high-risk-pause'].risk_score_bps > byName['fast-payout'].risk_score_bps);
});
