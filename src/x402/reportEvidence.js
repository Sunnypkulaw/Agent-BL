import crypto from 'node:crypto';
import {
  PaidReportValidationError,
  assertPaidReportEnvelope,
  isPaidReportExpired
} from './paidReport.js';

function sha256(value) {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function normalizeEnvelopes(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Verify a paid report before it can become PricingQuote evidence.
 * Verification is deliberately provenance-only: report payment metadata is
 * never transformed into score, discount, confidence, or pricing inputs.
 */
export function verifyPaidReportForPricing(envelope, options = {}) {
  assertPaidReportEnvelope(envelope);
  const errors = [];
  if (isPaidReportExpired(envelope, options.now ?? Date.now())) {
    errors.push(`paid report ${envelope.report_id} has expired`);
  }
  if (options.caseId && envelope.case_id !== options.caseId) {
    errors.push(`paid report case_id ${envelope.case_id} does not match pricing case ${options.caseId}`);
  }
  if (errors.length > 0) throw new PaidReportValidationError(errors);
  return envelope;
}

export function paidReportEvidenceNode(envelope) {
  return {
    component: 'paid_report_provenance',
    basis: 'Verified x402-paid AI report; payment proves provenance and does not change risk or price',
    evidence: [
      `report_id=${envelope.report_id}`,
      `report_hash=${envelope.report_hash}`,
      `payment_tx=${envelope.payment_tx}`,
      `model_provider=${envelope.model_provider}`,
      `expires_at=${envelope.expires_at}`
    ],
    report_id: envelope.report_id,
    report_kind: envelope.kind,
    report_hash: envelope.report_hash,
    payment_tx: envelope.payment_tx,
    payment_network: envelope.network,
    payment_asset: envelope.asset,
    payment_amount: envelope.amount,
    neutral_to_pricing: true
  };
}

/**
 * Return a quote carrying verified paid-report provenance. All economic and
 * risk fields remain untouched; only the evidence graph/evidence hash changes.
 */
export function injectPaidReportEvidence(quote, envelopes, options = {}) {
  const unique = new Map();
  for (const envelope of normalizeEnvelopes(envelopes)) {
    const verified = verifyPaidReportForPricing(envelope, {
      caseId: options.caseId ?? quote.case_id,
      now: options.now
    });
    unique.set(verified.report_id, verified);
  }
  if (unique.size === 0) return quote;

  const verified = [...unique.values()].sort((left, right) => left.report_id.localeCompare(right.report_id));
  const references = verified.map((envelope) => ({
    report_id: envelope.report_id,
    kind: envelope.kind,
    report_hash: envelope.report_hash,
    payment_tx: envelope.payment_tx,
    network: envelope.network,
    asset: envelope.asset,
    amount: envelope.amount
  }));

  return {
    ...quote,
    evidence_graph: [
      ...quote.evidence_graph,
      ...verified.map(paidReportEvidenceNode)
    ],
    paid_report_evidence: references,
    evidence_hash: sha256({
      base_evidence_hash: quote.evidence_hash,
      paid_reports: references
    })
  };
}

