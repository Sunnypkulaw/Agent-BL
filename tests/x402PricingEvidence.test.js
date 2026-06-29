import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { quoteFromCase } from '../src/core/pricingEngine.js';
import { assertPricingQuote } from '../src/core/pricingSchema.js';
import {
  PaidReportValidationError,
  createPaidReportEnvelope
} from '../src/x402/paidReport.js';
import { injectPaidReportEvidence } from '../src/x402/reportEvidence.js';

const caseData = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);

const now = new Date('2026-06-29T08:00:00.000Z');
const envelope = createPaidReportEnvelope({
  kind: 'risk-intelligence',
  case_id: caseData.case_id,
  payer: '0x1111111111111111111111111111111111111111',
  payee: '0x2222222222222222222222222222222222222222',
  network: 'eip155:1439',
  asset: '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d',
  amount: '1000',
  payment_tx: `0x${'ab'.repeat(32)}`,
  settled_at: now.toISOString(),
  data_snapshot: {
    case_id: caseData.case_id,
    risk_score_bps: 350,
    summary: 'Five-dimensional trade-risk report'
  },
  model_provider: 'agentbl-risk-agent',
  evidence_hash: `0x${'cd'.repeat(32)}`
}, { now, ttlSeconds: 300 });

const invariantFields = [
  'risk_score_bps',
  'risk_level',
  'risk_discount_bps',
  'final_issue_price_usd',
  'pricing_action',
  'recommended_token_supply',
  'financing_cost_usd',
  'exporter_profit_share_bps',
  'implied_gross_yield_bps',
  'quote_hash'
];

test('X402-10: a paid envelope adds provenance without changing any risk or price result', () => {
  const free = quoteFromCase(caseData, { payout_speed: 'FAST' });
  const paid = quoteFromCase(caseData, {
    payout_speed: 'FAST',
    paid_report_envelope: envelope,
    paid_report_now: new Date('2026-06-29T08:01:00.000Z')
  });

  for (const field of invariantFields) assert.deepEqual(paid[field], free[field], field);
  assert.notEqual(paid.evidence_hash, free.evidence_hash);
  assert.equal(paid.paid_report_evidence.length, 1);
  assert.equal(paid.paid_report_evidence[0].report_hash, envelope.report_hash);
  assert.doesNotThrow(() => assertPricingQuote(paid, caseData));
});

test('X402-10: paid report is a clearly neutral evidence-graph node', () => {
  const quote = quoteFromCase(caseData, {
    paid_report_envelopes: [envelope],
    paid_report_now: new Date('2026-06-29T08:01:00.000Z')
  });
  const node = quote.evidence_graph.find((entry) => entry.component === 'paid_report_provenance');
  assert.ok(node);
  assert.equal(node.neutral_to_pricing, true);
  assert.equal(node.report_id, envelope.report_id);
  assert.equal(node.payment_tx, envelope.payment_tx);
  assert.match(node.basis, /does not change risk or price/u);
});

test('X402-10: tampered report hash cannot enter pricing', () => {
  const tampered = structuredClone(envelope);
  tampered.data_snapshot.risk_score_bps = 0;
  assert.throws(() => quoteFromCase(caseData, {
    paid_report_envelope: tampered,
    paid_report_now: new Date('2026-06-29T08:01:00.000Z')
  }), PaidReportValidationError);
});

test('X402-10: expired report cannot enter pricing', () => {
  assert.throws(() => quoteFromCase(caseData, {
    paid_report_envelope: envelope,
    paid_report_now: new Date('2026-06-29T08:05:00.000Z')
  }), /has expired/u);
});

test('X402-10: report from another trade case cannot enter pricing', () => {
  const wrongCase = createPaidReportEnvelope({
    ...envelope,
    report_id: undefined,
    report_hash: undefined,
    case_id: 'CASE-OTHER'
  }, { now, ttlSeconds: 300 });
  assert.throws(() => quoteFromCase(caseData, {
    paid_report_envelope: wrongCase,
    paid_report_now: new Date('2026-06-29T08:01:00.000Z')
  }), /does not match pricing case/u);
});

test('X402-10: duplicate report ids are idempotent in the evidence graph', () => {
  const base = quoteFromCase(caseData);
  const injected = injectPaidReportEvidence(base, [envelope, structuredClone(envelope)], {
    now: new Date('2026-06-29T08:01:00.000Z')
  });
  assert.equal(injected.paid_report_evidence.length, 1);
  assert.equal(injected.evidence_graph.filter((entry) => entry.component === 'paid_report_provenance').length, 1);
});

