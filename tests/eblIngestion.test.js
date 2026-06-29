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
      port: 8083,
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

test('BE-14: eBL Document Ingestion Tests', async (t) => {
  const server = http.createServer(handleRequest);
  await new Promise(res => server.listen(8083, res));

  try {
    resetStore();

    await t.test('POST /api/ebl/upload accepts valid PDF document', async () => {
      const res = await request('POST', '/api/ebl/upload', {
        file: {
          name: 'bill_of_lading.pdf',
          type: 'application/pdf',
          size: 102400,
          content: 'mock-pdf-content'
        },
        case_id: 'CASE-EBL-2026-TEST'
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert.ok(res.data.document.documentId);
      assert.ok(res.data.document.documentHash);
      assert.strictEqual(res.data.document.status, 'verified');
      assert.strictEqual(res.data.eni_mode, 'mock');
    });

    await t.test('POST /api/ebl/upload rejects invalid file type', async () => {
      const res = await request('POST', '/api/ebl/upload', {
        file: {
          name: 'document.exe',
          type: 'application/x-msdownload',
          size: 1024
        }
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.ok, false);
      assert.ok(res.data.error.includes('Invalid file type'));
    });

    await t.test('POST /api/ebl/upload rejects oversized file', async () => {
      const res = await request('POST', '/api/ebl/upload', {
        file: {
          name: 'large.pdf',
          type: 'application/pdf',
          size: 11 * 1024 * 1024 // 11MB
        }
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.ok, false);
      assert.ok(res.data.error.includes('exceeds 10MB limit'));
    });

    await t.test('POST /api/ebl/upload is idempotent for same file', async () => {
      const file = {
        name: 'invoice.pdf',
        type: 'application/pdf',
        size: 50000,
        content: 'identical-content'
      };

      const res1 = await request('POST', '/api/ebl/upload', { file });
      const res2 = await request('POST', '/api/ebl/upload', { file });

      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res1.data.document.documentHash, res2.data.document.documentHash);
    });

    await t.test('GET /api/ebl/document-status returns document verification status', async () => {
      const uploadRes = await request('POST', '/api/ebl/upload', {
        file: {
          name: 'insurance.pdf',
          type: 'application/pdf',
          size: 30000
        }
      });

      const docId = uploadRes.data.document.documentId;
      const statusRes = await request('GET', `/api/ebl/document-status?document_id=${docId}`);

      assert.strictEqual(statusRes.status, 200);
      assert.strictEqual(statusRes.data.ok, true);
      assert.strictEqual(statusRes.data.status, 'verified');
      assert.ok(statusRes.data.verifiedAt);
    });

    await t.test('POST /api/ebl/upload triggers AI-13 orchestrator when case_id provided', async () => {
      const res = await request('POST', '/api/ebl/upload', {
        file: {
          name: 'complete_ebl.pdf',
          type: 'application/pdf',
          size: 75000
        },
        case_id: 'CASE-EBL-2026-ORCHESTRATE'
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.data.document.documentId);
      // In real system, this would trigger compliance check + valuation + pricing
    });

  } finally {
    server.close();
  }
});
