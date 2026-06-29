import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { handleRequest } from '../src/app/server.js';
import { resetStore } from '../src/app/store.js';

function request(method, path, body = null) {
  return new Promise((resolve) => {
    const req = http.request({
      method,
      hostname: '127.0.0.1',
      port: 8080,
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
  await new Promise(res => server.listen(8080, res));

  try {
    resetStore();

    await t.test('GET /api/market/listings returns active pools', async () => {
      const res = await request('GET', '/api/market/listings');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert(Array.isArray(res.data.pools));
      assert(res.data.pools.length > 0); // Should load demo cases
    });

    await t.test('POST /api/market/search returns AI recommendations', async () => {
      const res = await request('POST', '/api/market/search', { preference: 'safe and low risk' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert(Array.isArray(res.data.recommendations));
    });
  } finally {
    server.close();
  }
});
