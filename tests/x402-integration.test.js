/**
 * x402 Integration Tests — AgentBL
 *
 * Tests the x402 module: config, server, client, and settlement.
 * All tests run offline (no real chain needed).
 */

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { createServer } from '../src/app/server.js';

describe('x402 Config', () => {
  test('exports network identifiers', async () => {
    const { x402Network, x402FacilitatorUrl, x402Usdc, isX402Configured } = await import('../src/x402/config.js');
    assert.ok(x402Network(), 'Should have network');
    assert.ok(x402FacilitatorUrl(), 'Should have facilitator URL');
    assert.ok(x402Usdc(), 'Should have USDC address');
    assert.equal(typeof isX402Configured(), 'boolean');
  });

  test('has at least 2 services', async () => {
    const { X402_SERVICES } = await import('../src/x402/config.js');
    assert.ok(X402_SERVICES.length >= 2);
    assert.ok(X402_SERVICES.every((s) => s.serviceId && s.endpoint && s.priceUSDC > 0));
  });
});

describe('x402 Server', () => {
  test('buildPaymentRequiredResponse returns valid 402 body', async () => {
    const { buildPaymentRequiredResponse } = await import('../src/x402/server.js');
    const body = buildPaymentRequiredResponse('test-service', 0.001, 'eip155:1439', '0x1234');
    assert.equal(body.serviceId, 'test-service');
    assert.equal(body.priceUSDC, 0.001);
    assert.ok(body.paymentInstructions);
  });

  test('createX402Route returns handler function', async () => {
    const { createX402Route } = await import('../src/x402/server.js');
    const route = createX402Route({
      serviceId: 'test',
      priceUSDC: 0.001,
      handler: async () => ({ ok: true })
    });
    assert.equal(typeof route, 'function');
  });
});

describe('x402 Client', () => {
  test('createPaidFetch returns fetch-compatible function', async () => {
    const { createPaidFetch } = await import('../src/x402/client.js');
    const paidFetch = createPaidFetch({ budgetUSDC: 0.01 });
    assert.equal(typeof paidFetch, 'function');
  });

  test('fetchPaidIntel detects free endpoints', async () => {
    const server = createServer();
    await new Promise((r) => server.listen(0, r));
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    try {
      const { fetchPaidIntel } = await import('../src/x402/client.js');
      const result = await fetchPaidIntel(base, '/api/x402/intel/premium-risk', { budgetUSDC: 0.01 });
      // Should get either x402_required=true (402) or false (demo mode)
      assert.ok(typeof result.x402_required === 'boolean');
      assert.ok(result.unpaid, 'Should have unpaid response');
    } finally {
      server.close();
    }
  });
});

describe('x402 Settlement', () => {
  test('generatePaymentReceipt returns txHash + receipt', async () => {
    const { generatePaymentReceipt } = await import('../src/x402/settlement.js');
    const result = generatePaymentReceipt({ serviceId: 'premium-risk', amountUSDC: 0.001 });
    assert.ok(result.txHash.startsWith('0x'));
    assert.ok(result.receipt);
    assert.equal(result.receipt.serviceId, 'premium-risk');
    assert.equal(result.receipt.amountUSDC, 0.001);
  });

  test('buildPaymentEvidence returns structured evidence', async () => {
    const { buildPaymentEvidence } = await import('../src/x402/settlement.js');
    const evidence = buildPaymentEvidence({
      serviceId: 'premium-risk',
      amountUSDC: 0.001,
      responseData: { ok: true }
    });
    assert.ok(evidence.requestId > 0);
    assert.equal(evidence.serviceId, 'premium-risk');
    assert.ok(evidence.responseHash.startsWith('0x'));
    assert.ok(evidence.responseHash.length === 66, 'Should be 32-byte hex hash');
  });

  test('recordPaymentEvidence returns full payment record', async () => {
    const { recordPaymentEvidence } = await import('../src/x402/settlement.js');
    const result = await recordPaymentEvidence({
      serviceId: 'premium-risk',
      amountUSDC: 0.001,
      responseData: { test: true }
    });
    assert.equal(result.ok, true);
    assert.ok(result.payment.txHash);
    assert.equal(result.payment.onChainEvent, null);
  });
});

describe('x402 Endpoints (integration)', () => {
  let server, base;

  test('GET /api/x402/config returns services', async () => {
    server = createServer();
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
    try {
      const res = await fetch(`${base}/api/x402/config`);
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.ok, true);
      assert.ok(data.services.length >= 2);
    } finally {
      server.close();
    }
  });

  test('GET /api/x402/intel/premium-risk returns 402 without payment', async () => {
    server = createServer();
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
    try {
      const res = await fetch(`${base}/api/x402/intel/premium-risk`);
      assert.equal(res.status, 402);
      assert.equal(res.headers.get('PAYMENT-REQUIRED'), 'true');
      const body = await res.json();
      assert.ok(body.serviceId);
      assert.ok(body.priceUSDC > 0);
    } finally {
      server.close();
    }
  });

  test('POST /api/x402/smoke returns full flow', async () => {
    server = createServer();
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
    try {
      const res = await fetch(`${base}/api/x402/smoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: 'en' })
      });
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.ok, true);
      assert.equal(data.steps.length, 4);
      assert.ok(data.payment?.txHash);
    } finally {
      server.close();
    }
  });
});
