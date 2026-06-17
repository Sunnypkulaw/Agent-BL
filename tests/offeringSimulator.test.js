import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { simulateOffering } from '../src/core/offeringSimulator.js';
import { RWA_OFFERING_STATES } from '../src/core/pricingSchema.js';

const copperCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);
const warCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai-warcrisis.case.json', import.meta.url), 'utf8')
);

const states = (o) => o.steps.map((s) => s.state);

test('BE-4: a healthy offering runs Created -> ... -> Redeemed', () => {
  const offering = simulateOffering(copperCase, { payout_speed: 'FAST' });
  assert.equal(offering.final_state, 'Redeemed');
  const seq = states(offering);
  for (const expected of ['Created', 'Priced', 'Open', 'Subscribed', 'Funded', 'InTransit', 'Repaid', 'Redeemed']) {
    assert.ok(seq.includes(expected), `missing state ${expected}`);
  }
  // every emitted state is a valid RWA offering state
  assert.ok(seq.every((s) => RWA_OFFERING_STATES.includes(s)));
});

test('BE-4: an in-transit risk shock reprices the pool down', () => {
  const offering = simulateOffering(copperCase, {
    payout_speed: 'FAST',
    events: [
      { category: 'macro', type: 'severe_weather', severity: 'warning', region: 'East China Sea', description: 'typhoon' },
      { category: 'shipment', type: 'route_deviation', severity: 'warning', description: 'reroute' }
    ]
  });
  assert.ok(states(offering).includes('Repriced'));
  assert.ok(offering.final_quote.final_issue_price_usd < offering.initial_quote.final_issue_price_usd);
});

test('BE-4: a critical case never opens — it pauses', () => {
  const offering = simulateOffering(warCase, { payout_speed: 'FAST' });
  assert.equal(offering.final_state, 'Paused');
  assert.ok(!states(offering).includes('Open'));
  assert.equal(offering.subscription.tokens, 0);
});

test('BE-4: subscription never mints more than the recommended supply', () => {
  const offering = simulateOffering(copperCase, { payout_speed: 'FAST', subscription_usd: 99_000_000 });
  assert.ok(offering.subscription.tokens <= offering.initial_quote.recommended_token_supply);
});
