import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from '../src/app/server.js';
import { PRICING_ACTIONS } from '../src/core/pricingSchema.js';

const copperCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);
const warCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai-warcrisis.case.json', import.meta.url), 'utf8')
);

test('smoke: mock API supports the main demo flow', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
    assert.equal(health.ok, true);

    const demo = await fetch(`${baseUrl}/api/demo-data`).then((response) => response.json());
    assert.equal(demo.bill_of_lading.cargo, 'Copper Cathodes');

    const workflow = await fetch(`${baseUrl}/api/workflow/simulate`, { method: 'POST' }).then((response) => response.json());
    assert.equal(workflow.case_id, 'CASE-EBL-2026-0001');
    assert.ok(workflow.final_state);
    assert.ok(workflow.risk_report.contract_action);

    const scenarios = await fetch(`${baseUrl}/api/scenarios`).then((response) => response.json());
    assert.equal(scenarios.ok, true);
    assert.ok(scenarios.scenarios.length >= 4);
    assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'APPROVE_FINANCING'));
  } finally {
    server.close();
  }
});

test('smoke: invalid case payload is rejected as a client error', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const response = await fetch(`${baseUrl}/api/risk/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ case_id: 'BROKEN' })
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.ok(payload.details.length > 0);
  } finally {
    server.close();
  }
});

test('BE-3/BE-4: pricing quote and offering simulate endpoints work end to end', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // BE-3: empty body prices the demo case into a valid PricingQuote.
    const quote = await fetch(`${baseUrl}/api/pricing/quote`, { method: 'POST' }).then((r) => r.json());
    assert.ok(quote.final_issue_price_usd > 0 && quote.final_issue_price_usd <= 1);
    assert.ok(PRICING_ACTIONS.includes(quote.pricing_action));
    assert.match(quote.quote_hash, /^0x[0-9a-f]{64}$/);
    assert.ok(quote.target_redemption_exposure_usd <= quote.max_safe_redemption_exposure_usd + 1);

    // compare=true returns all three payout speeds + a recommendation.
    const comparison = await fetch(`${baseUrl}/api/pricing/quote?compare=true`, { method: 'POST' }).then((r) => r.json());
    assert.equal(comparison.quotes.length, 3);
    assert.ok(comparison.recommended_payout_speed);

    // A war-crisis case posted as the body is priced directly and pauses.
    const paused = await fetch(`${baseUrl}/api/pricing/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(warCase)
    }).then((r) => r.json());
    assert.equal(paused.pricing_action, 'PAUSE_OFFERING');

    // BE-4: empty body runs the offering lifecycle from Created to a terminal state.
    const offering = await fetch(`${baseUrl}/api/offering/simulate`, { method: 'POST' }).then((r) => r.json());
    assert.equal(offering.steps[0].state, 'Created');
    assert.ok(offering.final_state);

    // A mid-transit risk shock reprices the open copper offering; it still settles.
    const repriced = await fetch(`${baseUrl}/api/offering/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        case: copperCase,
        payout_speed: 'FAST',
        events: [
          { category: 'macro', type: 'severe_weather', severity: 'warning', region: 'East China Sea', description: 'typhoon' },
          { category: 'shipment', type: 'route_deviation', severity: 'warning', description: 'reroute' }
        ]
      })
    }).then((r) => r.json());
    assert.ok(repriced.steps.some((s) => s.state === 'Repriced'));
    assert.equal(repriced.final_state, 'Redeemed');
  } finally {
    server.close();
  }
});

test('BE-3: an invalid payout_speed is rejected as a client error', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const response = await fetch(`${baseUrl}/api/pricing/quote?payout_speed=INSTANT`, { method: 'POST' });
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
  } finally {
    server.close();
  }
});
