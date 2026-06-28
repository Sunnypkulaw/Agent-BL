import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { encodePaymentSignatureHeader, parsePaymentRequired } from '@injectivelabs/x402/client';
import { loadX402Config } from '../src/x402/config.js';
import { buildPaymentRequired, createX402PaymentMiddleware } from '../src/x402/server.js';
import { PaymentSettlementError, X402SettlementService, paymentIdFor } from '../src/x402/settlement.js';

const PAYER = '0x3333333333333333333333333333333333333333';

async function withApp({ config = loadX402Config({}), settlementService, handler } = {}, run) {
  const service = settlementService ?? new X402SettlementService({ mode: config.mode });
  const app = express();
  app.use(createX402PaymentMiddleware({ config, settlementService: service }));
  app.get('/api/x402/smoke', handler ?? ((req, res) => res.json({ ok: true, payment: req.x402 })));
  app.get('/api/free', (_req, res) => res.json({ free: true }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run({ baseUrl, config, service });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function expectedRequirement(config) {
  const route = config.endpoints.find((entry) => entry.id === 'x402-smoke');
  return buildPaymentRequired(config, route, {
    url: 'http://example.invalid/api/x402/smoke',
    description: route.description,
    mimeType: route.mimeType
  }).accepts[0];
}

function makePaymentHeader(config, mutate = () => {}) {
  const requirement = expectedRequirement(config);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    x402Version: 2,
    accepted: structuredClone(requirement),
    payload: {
      signature: `0x${'aa'.repeat(65)}`,
      authorization: {
        from: PAYER,
        to: requirement.payTo,
        value: requirement.amount,
        validAfter: String(now - 10),
        validBefore: String(now + 60),
        nonce: `0x${'bb'.repeat(32)}`
      }
    }
  };
  mutate(payload);
  return { header: encodePaymentSignatureHeader(payload), payload, requirement };
}

async function paidFetch(baseUrl, header) {
  return fetch(`${baseUrl}/api/x402/smoke`, { headers: { 'PAYMENT-SIGNATURE': header } });
}

test('X402-4: unpaid request returns a decodable V2 PAYMENT-REQUIRED challenge', async () => {
  await withApp({}, async ({ baseUrl, config }) => {
    const response = await fetch(`${baseUrl}/api/x402/smoke`);
    const body = await response.json();
    assert.equal(response.status, 402);
    assert.equal(body.x402Version, 2);
    assert.equal(body.extensions.state, 'CHALLENGED');
    assert.equal(body.accepts[0].network, config.network);
    assert.equal(body.accepts[0].asset, config.asset);
    const decoded = parsePaymentRequired(response.headers.get('payment-required'));
    assert.deepEqual(decoded.accepts, body.accepts);
    assert.match(response.headers.get('access-control-expose-headers'), /PAYMENT-RESPONSE/u);
  });
});

test('X402-4: matching payment settles, exposes receipt metadata, and unlocks after 2xx', async () => {
  await withApp({}, async ({ baseUrl, config, service }) => {
    const payment = makePaymentHeader(config);
    const response = await paidFetch(baseUrl, payment.header);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.payment.mode, 'demo');
    assert.equal(body.payment.onchain, false);
    assert.equal(body.payment.transaction, null);
    const receipt = JSON.parse(Buffer.from(response.headers.get('payment-response'), 'base64').toString('utf8'));
    assert.equal(receipt.success, true);
    assert.equal(receipt.payer, PAYER);
    const id = paymentIdFor(payment.payload, payment.requirement);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await service.get(id)).state, 'UNLOCKED');
  });
});

test('X402-4: malformed payment header is rejected before settlement', async () => {
  await withApp({}, async ({ baseUrl }) => {
    const response = await paidFetch(baseUrl, 'not-base64-json');
    const body = await response.json();
    assert.equal(response.status, 402);
    assert.equal(body.extensions.errorCode, 'payment_signature_invalid');
  });
});

test('X402-4: expired, future, and overlong authorizations are rejected', async () => {
  await withApp({}, async ({ baseUrl, config }) => {
    const now = Math.floor(Date.now() / 1000);
    const expired = makePaymentHeader(config, (payload) => {
      payload.payload.authorization.validBefore = String(now - 1);
    });
    let response = await paidFetch(baseUrl, expired.header);
    assert.equal(response.status, 402);
    assert.equal((await response.json()).extensions.errorCode, 'payment_expired');

    const future = makePaymentHeader(config, (payload) => {
      payload.payload.authorization.validAfter = String(now + 30);
    });
    response = await paidFetch(baseUrl, future.header);
    assert.equal(response.status, 402);
    assert.equal((await response.json()).extensions.errorCode, 'payment_not_yet_valid');

    const overlong = makePaymentHeader(config, (payload) => {
      payload.payload.authorization.validBefore = String(now + 3600);
    });
    response = await paidFetch(baseUrl, overlong.header);
    assert.equal(response.status, 402);
    assert.equal((await response.json()).extensions.errorCode, 'payment_ttl_exceeded');
  });
});

test('X402-4: wrong network is rejected', async () => {
  await withApp({}, async ({ baseUrl, config }) => {
    const payment = makePaymentHeader(config, (payload) => {
      payload.accepted.network = 'eip155:1776';
    });
    const response = await paidFetch(baseUrl, payment.header);
    assert.equal(response.status, 402);
    assert.equal((await response.json()).extensions.errorCode, 'payment_network_mismatch');
  });
});

test('X402-4: wrong amount is rejected in both accepted terms and signed authorization', async () => {
  await withApp({}, async ({ baseUrl, config }) => {
    const acceptedMismatch = makePaymentHeader(config, (payload) => {
      payload.accepted.amount = '999';
    });
    let response = await paidFetch(baseUrl, acceptedMismatch.header);
    assert.equal(response.status, 402);
    assert.equal((await response.json()).extensions.errorCode, 'payment_amount_mismatch');

    const signedMismatch = makePaymentHeader(config, (payload) => {
      payload.payload.authorization.value = '999';
    });
    response = await paidFetch(baseUrl, signedMismatch.header);
    assert.equal(response.status, 402);
    assert.equal((await response.json()).extensions.errorCode, 'payment_amount_mismatch');
  });
});

test('X402-4: wrong recipient is rejected in accepted terms and signed authorization', async () => {
  await withApp({}, async ({ baseUrl, config }) => {
    const wrong = '0x4444444444444444444444444444444444444444';
    const acceptedMismatch = makePaymentHeader(config, (payload) => {
      payload.accepted.payTo = wrong;
    });
    let response = await paidFetch(baseUrl, acceptedMismatch.header);
    assert.equal(response.status, 402);
    assert.equal((await response.json()).extensions.errorCode, 'payment_recipient_mismatch');

    const signedMismatch = makePaymentHeader(config, (payload) => {
      payload.payload.authorization.to = wrong;
    });
    response = await paidFetch(baseUrl, signedMismatch.header);
    assert.equal(response.status, 402);
    assert.equal((await response.json()).extensions.errorCode, 'payment_recipient_mismatch');
  });
});

test('X402-4: settlement failure never releases the protected handler', async () => {
  let handlerCalls = 0;
  const settlementService = {
    async process() {
      throw new PaymentSettlementError('facilitator_settle_http_error', 'Facilitator returned HTTP 503', { retryable: true });
    },
    async markUnlocked() { throw new Error('must not unlock'); }
  };
  await withApp({
    settlementService,
    handler: (_req, res) => { handlerCalls += 1; res.json({ secret: true }); }
  }, async ({ baseUrl, config }) => {
    const payment = makePaymentHeader(config);
    const response = await paidFetch(baseUrl, payment.header);
    const body = await response.json();
    assert.equal(response.status, 402);
    assert.equal(body.extensions.errorCode, 'facilitator_settle_http_error');
    assert.equal(handlerCalls, 0);
    const receipt = JSON.parse(Buffer.from(response.headers.get('payment-response'), 'base64').toString('utf8'));
    assert.equal(receipt.success, false);
  });
});

test('X402-4: middleware leaves unprotected routes untouched', async () => {
  await withApp({}, async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/free`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { free: true });
    assert.equal(response.headers.get('payment-required'), null);
  });
});
