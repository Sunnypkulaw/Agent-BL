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
      port: 8081,
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

test('BE-12: Pool API Tests', async (t) => {
  // Start server
  const server = http.createServer(handleRequest);
  await new Promise(res => server.listen(8081, res));

  try {
    resetStore();

    // First ensure pools are loaded by calling market/listings
    await request('GET', '/api/market/listings');
    const firstPoolId = Array.from(storeState.pools.keys())[0];

    await t.test('POST /api/pool/subscribe works for valid amount', async () => {
      const res = await request('POST', '/api/pool/subscribe', {
        wallet_address: '0xTest',
        pool_id: firstPoolId,
        amount_usd: 1000
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert.ok(res.data.txHash);
      assert.strictEqual(res.data.investment.amountUsd, 1000);
    });

    await t.test('GET /api/pool/status returns correct subscription state', async () => {
      const res = await request('GET', `/api/pool/status?pool_id=${firstPoolId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert.strictEqual(res.data.subscribedUsd, 1000);
    });

    await t.test('POST /api/pool/subscribe rejects over-subscription', async () => {
      const pool = storeState.pools.get(firstPoolId);
      const remaining = pool.targetUsd - pool.subscribedUsd;
      
      const res = await request('POST', '/api/pool/subscribe', {
        wallet_address: '0xTest',
        pool_id: firstPoolId,
        amount_usd: remaining + 1000 // Exceed target
      });
      assert.strictEqual(res.status, 500); 
      assert.strictEqual(res.data.ok, false);
      assert.ok(res.data.error.includes('Subscription exceeds target amount'));
    });
  } finally {
    server.close();
  }
});
