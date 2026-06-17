import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from '../src/app/server.js';

// BE-7: the AI-pricing endpoints must reject malformed input with HTTP 400 and a
// structured { ok:false, details:[...] } body — never a 500 or a silent bad quote.

const copperCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);

/** Start a throwaway server and run `fn(baseUrl)`, always closing it after. */
async function withServer(fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

const postJson = (baseUrl, pathname, payload) =>
  fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

test('BE-7: invalid payout_speed is rejected with 400', async () => {
  await withServer(async (baseUrl) => {
    const res = await postJson(baseUrl, '/api/pricing/quote', { payout_speed: 'INSTANT' });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.ok, false);
    assert.ok(body.details.some((d) => d.includes('payout_speed')));
  });
});

test('BE-7: a non-positive requested_cash_usd is rejected (price/amount not valid)', async () => {
  await withServer(async (baseUrl) => {
    for (const bad of [0, -5000, 'lots']) {
      const res = await postJson(baseUrl, '/api/pricing/quote', { requested_cash_usd: bad });
      const body = await res.json();
      assert.equal(res.status, 400, `requested_cash_usd=${bad}`);
      assert.ok(body.details.some((d) => d.includes('requested_cash_usd')));
    }
  });
});

test('BE-7: a negative subscription_usd is rejected on /api/offering/simulate', async () => {
  await withServer(async (baseUrl) => {
    const res = await postJson(baseUrl, '/api/offering/simulate', { subscription_usd: -1 });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.ok(body.details.some((d) => d.includes('subscription_usd')));
  });
});

test('BE-7: a case whose target redemption is not 1.00 is rejected (exceeds the fixed target)', async () => {
  await withServer(async (baseUrl) => {
    const tampered = structuredClone(copperCase);
    tampered.financing.target_redemption_value_usd = 2; // would over-promise vs collateral
    const res = await postJson(baseUrl, '/api/pricing/quote', tampered);
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.ok(body.details.some((d) => d.includes('target_redemption_value_usd')));
  });
});

test('BE-7: events must be an array', async () => {
  await withServer(async (baseUrl) => {
    const res = await postJson(baseUrl, '/api/offering/simulate', { events: 'typhoon' });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.ok(body.details.some((d) => d.includes('events')));
  });
});

test('BE-7: a well-formed override still succeeds (validation is not over-eager)', async () => {
  await withServer(async (baseUrl) => {
    const res = await postJson(baseUrl, '/api/pricing/quote', { payout_speed: 'FAST', requested_cash_usd: 3_000_000 });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.final_issue_price_usd > 0 && body.final_issue_price_usd <= 1);
  });
});
