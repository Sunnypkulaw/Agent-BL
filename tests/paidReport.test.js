import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PAID_REPORT_ENVELOPE_SCHEMA,
  PAID_REPORT_REQUIRED_FIELDS,
  PaidReportValidationError,
  assertPaidReportEnvelope,
  computeReportHash,
  createPaidReportEnvelope,
  findSensitivePaths,
  isPaidReportExpired,
  validatePaidReportEnvelope
} from '../src/x402/paidReport.js';

const NOW = '2026-06-29T08:00:00.000Z';
const PAYER = '0x1111111111111111111111111111111111111111';
const PAYEE = '0x2222222222222222222222222222222222222222';
const ASSET = '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d';
const TX = `0x${'ab'.repeat(32)}`;
const EVIDENCE = `0x${'cd'.repeat(32)}`;

function input(overrides = {}) {
  return {
    kind: 'risk-intelligence',
    case_id: 'CASE-EBL-2026-0001',
    payer: PAYER,
    payee: PAYEE,
    network: 'eip155:1439',
    asset: ASSET,
    amount: '1000',
    payment_tx: TX,
    settled_at: NOW,
    data_snapshot: {
      risk_level: 'WARNING',
      score_bps: 640,
      sources: ['fixture:risk-feed']
    },
    model_provider: 'deterministic-agentbl',
    evidence_hash: EVIDENCE,
    ...overrides
  };
}

function envelope(overrides = {}, options = {}) {
  return createPaidReportEnvelope(input(overrides), { now: NOW, ttlSeconds: 300, ...options });
}

test('X402-7: schema manifest contains every required envelope field', () => {
  assert.deepEqual(PAID_REPORT_ENVELOPE_SCHEMA.required, PAID_REPORT_REQUIRED_FIELDS);
  assert.equal(PAID_REPORT_REQUIRED_FIELDS.length, 15);
});

test('X402-7: creates a valid immutable-delivery envelope with deterministic IDs', () => {
  const report = envelope();
  assertPaidReportEnvelope(report);
  assert.match(report.report_id, /^rpt_[0-9a-f]{64}$/u);
  assert.match(report.report_hash, /^0x[0-9a-f]{64}$/u);
  assert.equal(report.report_hash, computeReportHash(report));
  assert.equal(report.expires_at, '2026-06-29T08:05:00.000Z');
  assert.equal(report.asset, ASSET.toLowerCase());
});

test('MBOX-X402-2: Mystery envelope canonically binds payment, case, pool, passport and reveal proof', () => {
  const riskPassportHash = `0x${'11'.repeat(32)}`;
  const revealProofHash = `0x${'22'.repeat(32)}`;
  const report = envelope({
    kind: 'mystery-voyage-risk-passport',
    case_id: 'CASE-SELECTED',
    selected_pool_id: 'pool-selected',
    risk_passport_hash: riskPassportHash,
    reveal_proof_hash: revealProofHash,
    data_snapshot: {
      selected_pool_id: 'pool-selected',
      risk_passport_hash: riskPassportHash,
      reveal_proof_hash: revealProofHash
    }
  });
  assertPaidReportEnvelope(report);
  const tampered = structuredClone(report);
  tampered.selected_pool_id = 'pool-other';
  tampered.report_hash = computeReportHash(tampered);
  assert.equal(validatePaidReportEnvelope(tampered).valid, false);
});

test('X402-7: report hash is stable under object key reordering', () => {
  const first = envelope({ data_snapshot: { alpha: 1, nested: { beta: 2, gamma: 3 } } });
  const second = envelope({ data_snapshot: { nested: { gamma: 3, beta: 2 }, alpha: 1 } });
  assert.equal(first.report_id, second.report_id);
  assert.equal(first.report_hash, second.report_hash);
});

test('X402-7: payload tampering invalidates the canonical report hash', () => {
  const report = structuredClone(envelope());
  report.data_snapshot.score_bps = 10;
  assert.throws(
    () => assertPaidReportEnvelope(report),
    (error) => error instanceof PaidReportValidationError
      && error.errors.some((message) => message.includes('report_hash does not match'))
  );
});

test('X402-7: malformed identities, amount, network and expiry are rejected', () => {
  const mutations = [
    ['payer', '0x1234'],
    ['network', 'injective-888'],
    ['amount', '0.001'],
    ['expires_at', NOW],
    ['evidence_hash', '0x1234']
  ];
  for (const [field, value] of mutations) {
    const report = structuredClone(envelope());
    report[field] = value;
    report.report_hash = computeReportHash(report);
    assert.equal(validatePaidReportEnvelope(report).valid, false, field);
  }
});

test('X402-7: creator strips chain-of-thought, private keys and raw documents', () => {
  const report = envelope({
    data_snapshot: {
      safe_summary: 'Risk increased because insurance expires before ETA.',
      chain_of_thought: 'private reasoning',
      nested: {
        private_key: 'never include me',
        raw_document: 'invoice body',
        bill_of_lading: { shipper: 'sensitive full document' }
      }
    }
  });
  assert.equal(report.data_snapshot.safe_summary.includes('insurance'), true);
  assert.equal('chain_of_thought' in report.data_snapshot, false);
  assert.deepEqual(report.data_snapshot.nested, {});
  assert.deepEqual(findSensitivePaths(report), []);
});

test('X402-7: manually supplied sensitive fields fail validation even with a recomputed hash', () => {
  const report = structuredClone(envelope());
  report.data_snapshot.chain_of_thought = 'do not disclose';
  report.report_hash = computeReportHash(report);
  assert.throws(
    () => assertPaidReportEnvelope(report),
    (error) => error.errors.some((message) => message.includes('sensitive content'))
  );
});

test('X402-7: demo receipt identifiers are explicit while fake transaction hashes are rejected', () => {
  const demo = envelope({ payment_tx: `demo://receipt/${'ab'.repeat(32)}` });
  assert.equal(assertPaidReportEnvelope(demo), demo);
  const malformed = structuredClone(demo);
  malformed.payment_tx = '0xdeadbeef';
  malformed.report_hash = computeReportHash(malformed);
  assert.equal(validatePaidReportEnvelope(malformed).valid, false);
});

test('X402-7: expiry is deterministic at and after the TTL boundary', () => {
  const report = envelope();
  assert.equal(isPaidReportExpired(report, '2026-06-29T08:04:59.999Z'), false);
  assert.equal(isPaidReportExpired(report, report.expires_at), true);
});

test('X402-7: envelope creation does not mutate the caller snapshot', () => {
  const source = input({ data_snapshot: { safe: true, private_key: 'remove' } });
  const before = structuredClone(source);
  createPaidReportEnvelope(source, { now: NOW });
  assert.deepEqual(source, before);
});
