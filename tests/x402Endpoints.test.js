import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { createServer } from '../src/app/server.js';
import { createPaidFetch, fetchPaidIntel } from '../src/x402/client.js';
import { X402_SERVICES } from '../src/x402/config.js';
import { assertPaidReportEnvelope } from '../src/x402/paidReport.js';
import {
  buildPremiumFraudReview,
  buildPremiumRiskIntel,
  buildPremiumValuation
} from '../src/x402/endpoints.js';

const demoCase = JSON.parse(await fs.readFile('data/demo-case.json', 'utf8'));
let server;
let baseUrl;

before(async () => {
  process.env.DEMO_MODE = 'true';
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function challengeResponse(overrides = {}) {
  const body = {
    serviceId: 'test',
    priceUSDC: 0.001,
    network: 'eip155:1439',
    payTo: '0x1111111111111111111111111111111111111439',
    nonce: 'nonce-1',
    challenge: 'sign me',
    ...overrides
  };
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: {
      'content-type': 'application/json',
      'PAYMENT-REQUIRED': 'true',
      'X-Price-USDC': String(body.priceUSDC),
      'X-Network': body.network,
      'X-Pay-To': body.payTo
    }
  });
}

test('X402-8: catalog exposes exactly three distinct paid business reports', () => {
  assert.deepEqual(X402_SERVICES.map((entry) => entry.serviceId), [
    'premium-risk', 'premium-valuation', 'fraud-review'
  ]);
  assert.equal(new Set(X402_SERVICES.map((entry) => entry.endpoint)).size, 3);
});

test('X402-8: premium risk report reuses world-risk repricing', async () => {
  const report = await buildPremiumRiskIntel(demoCase);
  assert.equal(report.service, 'premium-risk');
  assert.ok(Array.isArray(report.events));
  assert.ok(report.before_quote?.quote_hash);
  assert.ok(report.after_quote?.quote_hash);
  assert.equal(report.delta.issue_price_delta_usd, report.delta.issue_price_usd);
});

test('X402-8: premium valuation report reuses valuation tools and comparables', async () => {
  const report = await buildPremiumValuation(demoCase);
  assert.equal(report.service, 'premium-valuation');
  assert.ok(report.cargo_value > 0);
  assert.ok(report.max_safe_redemption_exposure_usd > 0);
  assert.ok(Array.isArray(report.tool_trace));
  assert.ok(report.data_sources.length > 0);
});

test('X402-8: fraud review reuses consistency checker, pricing and scenario runner', async () => {
  const report = await buildPremiumFraudReview(demoCase);
  assert.equal(report.service, 'fraud-review');
  assert.ok(['PASS', 'REVIEW', 'BLOCK'].includes(report.verdict));
  assert.ok(report.checks.length >= 3);
  assert.ok(report.pricing_result.quote_hash.startsWith('0x'));
  assert.ok(report.scenario.final_state);
});

test('X402-8: all three business endpoints return HTTP 402 before payment', async () => {
  for (const service of X402_SERVICES) {
    const response = await fetch(`${baseUrl}${service.endpoint}`);
    assert.equal(response.status, 402, service.serviceId);
    assert.equal((await response.json()).serviceId, service.serviceId);
  }
});

for (const service of X402_SERVICES) {
  test(`X402-8: ${service.serviceId} unlocks after a signed demo payment`, async () => {
    const result = await fetchPaidIntel(baseUrl, service.endpoint, {
      demoMode: true,
      budgetUSDC: 0.005,
      caseData: demoCase
    });
    assert.equal(result.x402_required, true);
    assert.equal(result.paid?.ok, true);
    assert.equal(result.paid?.service, service.serviceId);
    assert.equal(result.paid?.case_id, demoCase.case_id);
    assert.equal(result.paid?.payment?.live, false);
    assertPaidReportEnvelope(result.paid?.report_envelope);
    assert.equal(result.paid.report_envelope.kind, result.paid.kind);
    assert.match(result.paid.report_envelope.payment_tx, /^demo:\/\/receipt\//u);
  });
}

test('X402-13/14: client rejects a challenge above its budget before signing', async () => {
  const paidFetch = createPaidFetch({
    demoMode: true,
    budgetUSDC: 0.01,
    fetchImpl: async () => challengeResponse({ priceUSDC: 1 })
  });
  await assert.rejects(paidFetch('https://example.invalid/report'), (error) => error.code === 'X402_BUDGET_EXCEEDED');
});

test('X402-14: client refuses a challenge on an unapproved network', async () => {
  const paidFetch = createPaidFetch({
    demoMode: true,
    fetchImpl: async () => challengeResponse({ network: 'eip155:1' })
  });
  await assert.rejects(paidFetch('https://example.invalid/report'), (error) => error.code === 'X402_WRONG_NETWORK');
});

test('X402-14: wallet cancellation is a recoverable typed error', async () => {
  const rejection = new Error('cancelled');
  rejection.code = 4001;
  const paidFetch = createPaidFetch({
    signer: { address: '0x1111111111111111111111111111111111111111', async signMessage() { throw rejection; } },
    fetchImpl: async () => challengeResponse()
  });
  await assert.rejects(paidFetch('https://example.invalid/report'), (error) => (
    error.code === 'X402_SIGNATURE_CANCELLED' && error.recoverable
  ));
});

test('X402-14: live client fails safely when no signer is configured', async () => {
  const paidFetch = createPaidFetch({
    demoMode: false,
    env: { DEMO_MODE: 'false', X402_MODE: 'live' },
    fetchImpl: async () => challengeResponse()
  });
  await assert.rejects(paidFetch('https://example.invalid/report'), (error) => error.code === 'X402_SIGNER_REQUIRED');

  const previous = process.env.DEMO_MODE;
  process.env.DEMO_MODE = 'false';
  try {
    const response = await fetch(`${baseUrl}/api/x402/intel/premium-risk`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.code, 'x402_v2_live_transport_required');
  } finally {
    process.env.DEMO_MODE = previous ?? 'true';
  }
});

test('X402-14: network timeout becomes a recoverable typed error', async () => {
  const paidFetch = createPaidFetch({
    demoMode: true,
    timeoutMs: 5,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    })
  });
  await assert.rejects(paidFetch('https://example.invalid/report'), (error) => error.code === 'X402_TIMEOUT');
});

test('DEMO-1: mode endpoint defaults to explicit demo and supports deterministic reset', async () => {
  let response = await fetch(`${baseUrl}/api/demo/mode`);
  const beforeReset = await response.json();
  assert.equal(beforeReset.demoMode, true);
  response = await fetch(`${baseUrl}/api/demo/reset`, { method: 'POST' });
  const afterReset = await response.json();
  assert.equal(response.status, 200);
  assert.equal(afterReset.generation, beforeReset.generation + 1);
});

test('DEMO-1: live toggle fails explicitly when live infrastructure is absent', async () => {
  const response = await fetch(`${baseUrl}/api/demo/mode`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'live' })
  });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.code, 'live_mode_unavailable');
  assert.ok(body.missing.length > 0);
});
