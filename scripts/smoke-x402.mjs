/**
 * x402 Smoke Test — AgentBL
 *
 * End-to-end verification of the x402 paid-intel flow:
 *  1. Request premium risk intel WITHOUT payment → expect HTTP 402
 *  2. Assert PAYMENT-REQUIRED header present
 *  3. Request WITH payment → expect HTTP 200 + intel unlocked
 *  4. Assert settlement tx hash present in PAYMENT-RESPONSE header
 *  5. Assert intel data contains expected fields
 *
 * Usage: node scripts/smoke-x402.mjs
 *        BASE_URL=http://localhost:3000 node scripts/smoke-x402.mjs
 */

import assert from 'node:assert/strict';
import { createServer } from '../src/app/server.js';

const base = (process.env.BASE_URL || process.env.SMOKE_BASE_URL || '').replace(/\/$/, '');

/** Spin up a temp server if no BASE_URL is provided; otherwise use the given URL. */
async function withServer(fn) {
  if (base) {
    // External server — test directly
    return fn(base);
  }
  // Start an internal server
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  try {
    await fn(url);
  } finally {
    server.close();
  }
}

await withServer(async (baseUrl) => {
  console.log(`x402 smoke test → ${baseUrl}`);

  // Step 1: Request premium risk intel WITHOUT payment → expect HTTP 402
  const unpaidUrl = `${baseUrl}/api/x402/intel/premium-risk?caseType=copper&locale=en`;
  const unpaidRes = await request(unpaidUrl, {
    headers: { Accept: 'application/json' }
  });
  const unpaidBody = await unpaidRes.json().catch(() => ({}));

  console.log(`  1. Unpaid request: status=${unpaidRes.status} serviceId=${unpaidBody.serviceId || 'unknown'}`);

  assert.equal(unpaidRes.status, 402, `Expected HTTP 402, got ${unpaidRes.status}`);
  assert.equal(unpaidRes.headers.get('PAYMENT-REQUIRED'), 'true', 'PAYMENT-REQUIRED header missing');
  assert.ok(unpaidBody.serviceId, '402 body should have serviceId');
  assert.ok(unpaidBody.priceUSDC > 0, '402 body should have priceUSDC > 0');

  // Step 2: Simulate payment (add x402-payment header)
  const paymentProof = '0x' + 'ab'.repeat(32); // mock EIP-3009 signature
  const paidRes = await request(unpaidUrl, {
    headers: {
      Accept: 'application/json',
      'X402-Payment': paymentProof,
      'X-Price-USDC': String(unpaidBody.priceUSDC),
      'X-Network': unpaidBody.network || 'eip155:1439',
      'X-Pay-To': unpaidBody.payTo || '0x0000000000000000000000000000000000000000'
    }
  });
  const paidBody = await paidRes.json().catch(() => ({}));

  console.log(`  2. Paid request: status=${paidRes.status} ok=${paidBody.ok} service=${paidBody.service || 'unknown'}`);

  assert.equal(paidRes.status, 200, `Expected HTTP 200 after payment, got ${paidRes.status}`);
  assert.equal(paidBody.ok, true, 'Paid response should have ok: true');
  const paymentResponse = paidRes.headers.get('PAYMENT-RESPONSE');
  assert.ok(paymentResponse, 'PAYMENT-RESPONSE header missing after payment');
  const paymentData = JSON.parse(paymentResponse);
  assert.ok(paymentData.txHash, 'PAYMENT-RESPONSE should contain txHash');
  assert.equal(paymentData.txHash.startsWith('0x'), true, 'txHash should be hex');

  // Step 3: Verify intel data quality
  assert.ok(Array.isArray(paidBody.events), 'Response should have events array');
  assert.ok(Array.isArray(paidBody.deepIntel), 'Response should have deepIntel array');
  assert.ok(typeof paidBody.before_quote === 'object', 'Response should have before_quote');
  assert.ok(typeof paidBody.after_quote === 'object', 'Response should have after_quote');
  assert.ok(typeof paidBody.delta === 'object', 'Response should have delta');

  console.log(`  3. Intel quality: ${paidBody.events.length} events, ${paidBody.deepIntel.length} deep intel entries`);
  console.log(`     Before price: ${paidBody.before_quote?.final_issue_price_usd} → After price: ${paidBody.after_quote?.final_issue_price_usd}`);
  console.log(`     Price delta: ${paidBody.delta?.issue_price_delta_usd}`);

  // Step 4: Smoke test the full x402 smoke endpoint
  const smokeRes = await request(`${baseUrl}/api/x402/smoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ locale: 'en' })
  });
  const smokeBody = await smokeRes.json().catch(() => ({}));

  console.log(`  4. x402 smoke endpoint: ok=${smokeBody.ok} steps=${smokeBody.steps?.length || 0} tx=${smokeBody.payment?.txHash || 'none'}`);

  assert.equal(smokeBody.ok, true, 'x402 smoke endpoint should return ok: true');
  assert.equal(smokeBody.steps.length, 4, 'x402 smoke should have 4 steps (challenge→sign→settle→unlock)');
  assert.ok(smokeBody.payment?.txHash, 'x402 smoke should return a settlement tx hash');

  // Step 5: x402 config endpoint
  const configRes = await request(`${baseUrl}/api/x402/config`, {
    headers: { Accept: 'application/json' }
  });
  const configBody = await configRes.json().catch(() => ({}));

  console.log(`  5. x402 config: ok=${configBody.ok} services=${configBody.services?.length || 0}`);

  assert.equal(configBody.ok, true);
  assert.ok(configBody.services.length >= 2, 'Should have at least 2 x402 services');

  console.log('\n✅ x402 smoke passed: 402 challenge → payment → settlement → intel unlocked → config verified.');
});

/** Fetch with retry (max 3 attempts). */
async function request(url, init, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}
