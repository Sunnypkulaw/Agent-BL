import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { handleRequest, logAgentActivity } from '../src/app/server.js';
import { resetStore } from '../src/app/store.js';

function request(method, path, body = null) {
  return new Promise((resolve) => {
    const req = http.request({
      method,
      hostname: '127.0.0.1',
      port: 8084,
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

test('BE-15: Agent Activity API Tests', async (t) => {
  const server = http.createServer(handleRequest);
  await new Promise(res => server.listen(8084, res));

  try {
    resetStore();

    await t.test('GET /api/agent/activity returns empty array initially', async () => {
      const res = await request('GET', '/api/agent/activity');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert(Array.isArray(res.data.activities));
    });

    await t.test('GET /api/agent/activity returns logged activities', async () => {
      // Log some mock activities
      logAgentActivity({
        type: 'PRICING',
        action: 'QUOTE_GENERATED',
        caseId: 'CASE-TEST-1',
        details: { price: 0.85 }
      });

      logAgentActivity({
        type: 'RISK',
        action: 'RISK_ASSESSED',
        caseId: 'CASE-TEST-1',
        details: { riskLevel: 'MEDIUM' }
      });

      const res = await request('GET', '/api/agent/activity');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert.strictEqual(res.data.activities.length, 2);
      assert.strictEqual(res.data.activities[0].type, 'PRICING');
      assert.ok(res.data.activities[0].id);
      assert.ok(res.data.activities[0].timestamp);
    });

    await t.test('GET /api/agent/activity filters by case_id', async () => {
      logAgentActivity({
        type: 'PRICING',
        caseId: 'CASE-A',
        action: 'PRICE_UPDATE'
      });

      logAgentActivity({
        type: 'PRICING',
        caseId: 'CASE-B',
        action: 'PRICE_UPDATE'
      });

      const res = await request('GET', '/api/agent/activity?case_id=CASE-A');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      const caseAActivities = res.data.activities.filter(a => a.caseId === 'CASE-A');
      assert(caseAActivities.length > 0);
      assert(res.data.activities.every(a => !a.caseId || a.caseId === 'CASE-A'));
    });

    await t.test('GET /api/agent/activity filters by pool_id', async () => {
      logAgentActivity({
        type: 'POOL',
        poolId: 'POOL-X',
        action: 'SUBSCRIPTION'
      });

      logAgentActivity({
        type: 'POOL',
        poolId: 'POOL-Y',
        action: 'SUBSCRIPTION'
      });

      const res = await request('GET', '/api/agent/activity?pool_id=POOL-X');

      assert.strictEqual(res.status, 200);
      const poolXActivities = res.data.activities.filter(a => a.poolId === 'POOL-X');
      assert(poolXActivities.length > 0);
      assert(res.data.activities.every(a => !a.poolId || a.poolId === 'POOL-X'));
    });

    await t.test('GET /api/agent/activity/stream establishes SSE connection', async () => {
      await new Promise((resolve, reject) => {
      let finished = false;
      let timeout;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        req.destroy();
        if (error) reject(error);
        else resolve();
      };
      const req = http.request({
        method: 'GET',
        hostname: '127.0.0.1',
        port: 8084,
        path: '/api/agent/activity/stream?case_id=CASE-SSE-TEST'
      }, (res) => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'text/event-stream');
        assert.strictEqual(res.headers['cache-control'], 'no-cache');

        let receivedData = '';
        res.on('data', (chunk) => {
          receivedData += chunk.toString();

          // Check for connection event
          if (receivedData.includes('"type":"connected"')) {
            // Connection successful, send an activity
            setTimeout(() => {
              logAgentActivity({
                type: 'TEST',
                caseId: 'CASE-SSE-TEST',
                action: 'SSE_BROADCAST_TEST'
              });
            }, 100);
          }

          // Check for activity event
          if (receivedData.includes('"type":"activity"')) {
            finish();
          }
        });
        res.on('error', finish);

        // Timeout after 2 seconds
        timeout = setTimeout(() => finish(new Error('Timed out waiting for SSE activity')), 2000);
      });

      req.on('error', finish);
      req.end();
      });
    });

    await t.test('Agent activities do not expose internal chain-of-thought', async () => {
      logAgentActivity({
        type: 'DECISION',
        action: 'REPRICE',
        caseId: 'CASE-COT-TEST',
        details: {
          decision: 'REPRICE',
          newPrice: 0.82
        }
        // No raw LLM reasoning exposed
      });

      const res = await request('GET', '/api/agent/activity?case_id=CASE-COT-TEST');

      assert.strictEqual(res.status, 200);
      const activity = res.data.activities.find(a => a.caseId === 'CASE-COT-TEST');
      assert.ok(activity);
      assert.ok(activity.details.decision);
      // Verify no raw prompts or internal reasoning
      assert.strictEqual(activity.details.raw_prompt, undefined);
      assert.strictEqual(activity.details.chain_of_thought, undefined);
    });

  } finally {
    server.close();
  }
});
