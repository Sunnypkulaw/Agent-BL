// Combined pricing + risk workflow (BE-6).
//
// Merges the AI PricingQuote and the trade-risk assessment into a single
// workflow-simulation object, alongside the RWA offering lifecycle. This is the
// new-model analogue of src/core/workflow.js (which still drives the legacy
// RiskReport for data/demo-case.json). One call -> everything the frontend,
// the demo CLI and the contract mock need.

import { quoteFromCase, scoreRisk } from './pricingEngine.js';
import { simulateOffering } from './offeringSimulator.js';
import { assertPricingQuote } from './pricingSchema.js';

/**
 * Run the unified pricing + risk + offering workflow for a structured case.
 * @param {object} caseData
 * @param {object} [opts] { payout_speed, requested_cash_usd, subscription_usd, events }
 * @returns {object} { case_id, bl_id, payout_speed, final_state, pricing_quote, risk_report, offering }
 */
export function simulatePricingWorkflow(caseData, opts = {}) {
  const pricingQuote = quoteFromCase(caseData, opts);
  assertPricingQuote(pricingQuote, caseData);

  const risk = scoreRisk(caseData);
  const offering = simulateOffering(caseData, opts);

  // A compact risk_report block (new-model RiskReport) merged with the quote.
  const riskReport = {
    case_id: pricingQuote.case_id,
    bl_id: pricingQuote.bl_id,
    risk_level: risk.risk_level,
    risk_score_bps: risk.risk_score_bps,
    risk_factors: risk.risk_factors,
    document_consistency: {
      ok: risk.document_checks.ok,
      has_critical: risk.document_checks.has_critical,
      issues: risk.document_checks.issues
    },
    pricing_action: pricingQuote.pricing_action,
    evidence_hash: pricingQuote.evidence_hash
  };

  return {
    case_id: pricingQuote.case_id,
    bl_id: pricingQuote.bl_id,
    payout_speed: pricingQuote.payout_speed,
    final_state: offering.final_state,
    pricing_quote: pricingQuote,
    risk_report: riskReport,
    offering
  };
}
