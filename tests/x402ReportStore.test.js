import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PaidReportCache } from '../src/x402/reportStore.js';

// X402-11 re-read store: a buyer who already settled must be able to re-read the
// same report within its TTL (e.g. after a refresh) without paying again, and a
// report must become unreadable the moment it expires.

async function tmpStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'x402-reports-'));
  return path.join(dir, 'reports.json');
}

function envelope({ id = `rpt_${'a'.repeat(64)}`, expiresInMs = 60_000, now = Date.now() } = {}) {
  return {
    report_id: id,
    kind: 'premium-risk',
    case_id: 'demo-case',
    expires_at: new Date(now + expiresInMs).toISOString()
  };
}

test('X402-11: a saved report is re-readable within its TTL without re-payment', async () => {
  const filePath = await tmpStorePath();
  const cache = new PaidReportCache({ filePath });
  const env = envelope();
  await cache.save({ envelope: env, report: { service: 'premium-risk', secret: 42 } });
  const got = await cache.read(env.report_id);
  assert.ok(got, 'report is cached');
  assert.equal(got.report.secret, 42);
  assert.equal(got.expires_at, env.expires_at);
});

test('X402-11: an unknown report id is a clean miss', async () => {
  const cache = new PaidReportCache({ filePath: null });
  assert.equal(await cache.read('rpt_does_not_exist'), null);
});

test('X402-11: an expired report is pruned and no longer readable', async () => {
  let clock = Date.parse('2026-06-29T00:00:00.000Z');
  const cache = new PaidReportCache({ filePath: null, now: () => clock });
  const env = envelope({ expiresInMs: 1_000, now: clock });
  await cache.save({ envelope: env, report: { ok: true } });
  assert.ok(await cache.read(env.report_id), 'readable before expiry');
  clock += 2_000; // advance past expires_at
  assert.equal(await cache.read(env.report_id), null, 'unreadable after expiry');
});

test('X402-11: a report without a valid expires_at is not cached', async () => {
  const cache = new PaidReportCache({ filePath: null });
  const saved = await cache.save({ envelope: { report_id: 'rpt_x' }, report: { ok: true } });
  assert.equal(saved, null);
  assert.equal(await cache.read('rpt_x'), null);
});

test('X402-11: cached reports survive a process restart within TTL', async () => {
  const filePath = await tmpStorePath();
  const env = envelope();
  const writer = new PaidReportCache({ filePath });
  await writer.save({ envelope: env, report: { service: 'premium-valuation' } });

  // Simulate a fresh process (e.g. server restart) reading the same file.
  const reader = new PaidReportCache({ filePath });
  const got = await reader.read(env.report_id);
  assert.ok(got, 'report restored from disk');
  assert.equal(got.report.service, 'premium-valuation');
});

test('X402-11: expired entries are dropped when the store is reloaded', async () => {
  const filePath = await tmpStorePath();
  const base = Date.parse('2026-06-29T00:00:00.000Z');
  const writer = new PaidReportCache({ filePath, now: () => base });
  await writer.save({ envelope: envelope({ expiresInMs: 1_000, now: base }), report: { ok: true } });

  const reader = new PaidReportCache({ filePath, now: () => base + 5_000 });
  assert.deepEqual(await reader.list(), [], 'expired entry pruned on reload');
});

test('X402-11: list returns identity metadata for unexpired reports only', async () => {
  const cache = new PaidReportCache({ filePath: null });
  await cache.save({ envelope: envelope({ id: `rpt_${'b'.repeat(64)}` }), report: {} });
  const listed = await cache.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].kind, 'premium-risk');
  assert.equal(listed[0].case_id, 'demo-case');
});
