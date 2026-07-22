import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { handleRequest } from '../src/app/server.js';
import { resetStore } from '../src/app/store.js';
import { quoteFromCase } from '../src/core/pricingEngine.js';
import { normalizePricingQuoteHashes, PAYOUT_SPEEDS } from '../src/core/pricingSchema.js';

let port;

function request(method, path, body = null) {
  return new Promise((resolve) => {
    const req = http.request({
      method,
      hostname: '127.0.0.1',
      port,
      path,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test('BE-11: Market API Tests', async (t) => {
  // Start server
  const server = http.createServer(handleRequest);
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  port = server.address().port;

  try {
    resetStore();

    await t.test('GET /api/market/listings returns active pools', async () => {
      const res = await request('GET', '/api/market/listings');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert(Array.isArray(res.data.pools));
      assert(res.data.pools.length > 0); // Should load demo cases
      for (const pool of res.data.pools) {
        const configuredSpeed = pool.caseData.financing.payout_speed;
        const expected = normalizePricingQuoteHashes(quoteFromCase(pool.caseData, {
          payout_speed: PAYOUT_SPEEDS.includes(configuredSpeed) ? configuredSpeed : 'BALANCED'
        }));
        assert.strictEqual(pool.quote.quote_hash, expected.quote_hash);
        assert.strictEqual(pool.quote.risk_score_bps, expected.risk_score_bps);
        assert.strictEqual(pool.quote.final_issue_price_usd, expected.final_issue_price_usd);
        assert.notStrictEqual(pool.quote.final_issue_price_usd, 0.9);
        assert.notStrictEqual(pool.quote.risk_score_bps, undefined);
      }
      assert.equal(res.data.pools.some((pool) => pool.quote.pricing_action === 'PAUSE_OFFERING'), false);
    });

    await t.test('POST /api/market/search returns AI recommendations', async () => {
      const res = await request('POST', '/api/market/search', { preference: 'safe and low risk' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert(Array.isArray(res.data.recommendations));
      const listings = (await request('GET', '/api/market/listings')).data.pools;
      const byId = new Map(listings.map((pool) => [pool.poolId, pool]));
      for (const recommendation of res.data.recommendations) {
        assert.strictEqual(recommendation.riskBps, byId.get(recommendation.id).quote.risk_score_bps);
      }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
