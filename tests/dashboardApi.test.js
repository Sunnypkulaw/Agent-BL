import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { handleRequest } from '../src/app/server.js';
import { resetStore, storeState } from '../src/app/store.js';

function request(method, path, body = null) {
  return new Promise((resolve) => {
    const req = http.request({
      method,
      hostname: '127.0.0.1',
      port: 8082,
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

test('BE-13: Dashboard API Tests', async (t) => {
  // Start server
  const server = http.createServer(handleRequest);
  await new Promise(res => server.listen(8082, res));

  try {
    resetStore();

    // First ensure pools are loaded by calling market/listings
    await request('GET', '/api/market/listings');
    const firstPoolId = Array.from(storeState.pools.keys())[0];

    // Seed an investment
    await request('POST', '/api/pool/subscribe', {
      wallet_address: '0xInvestor',
      pool_id: firstPoolId,
      amount_usd: 5000
    });

    await t.test('GET /api/investors/portfolio returns investments and summary', async () => {
      const res = await request('GET', '/api/investors/portfolio?wallet_address=0xInvestor');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert.strictEqual(res.data.wallet, '0xInvestor');
      assert.strictEqual(res.data.investments.length, 1);
      assert.strictEqual(res.data.summary.totalInvestedUsd, 5000);
    });

    await t.test('GET /api/exporters/dashboard returns ebl pools', async () => {
      const res = await request('GET', '/api/exporters/dashboard');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert.ok(res.data.total_ebl_submitted > 0);
      assert.ok(res.data.pools.length > 0);
    });
  } finally {
    server.close();
  }
});
