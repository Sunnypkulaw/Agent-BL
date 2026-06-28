import { checkDocumentConsistency } from '../agent/documentConsistency.js';
import { retrieveRiskIntel } from '../agent/riskIntel.js';
import { runValuationAgent } from '../agent/valuationAgent.js';
import { assessWorldRisk } from '../agent/worldRiskAgent.js';
import { quoteFromCase } from '../core/pricingEngine.js';
import { runScenario } from '../core/scenarioRunner.js';
import { repriceWithWorldRisk } from '../core/worldRiskPricing.js';

/**
 * X402-8 paid-report builders. They compose the existing deterministic agents;
 * payment affects access only and never changes the underlying risk score.
 */
export async function buildPremiumRiskIntel(caseData, options = {}) {
  const assessment = await assessWorldRisk(caseData, options.worldRisk ?? {});
  const repriced = repriceWithWorldRisk(caseData, assessment.events);
  const deepIntel = retrieveRiskIntel(caseData, { k: 8, includePolicies: true });
  return {
    ok: true,
    kind: 'risk-intelligence',
    service: 'premium-risk',
    case_id: caseData.case_id,
    live: assessment.live,
    provider: assessment.provider,
    queried: assessment.queried,
    profile: assessment.profile,
    events: assessment.events,
    signals: assessment.signals,
    sources: assessment.sources,
    deepIntel: deepIntel.map((entry) => ({
      id: entry.id,
      type: entry.type,
      region: entry.region,
      severity: entry.severity,
      source: entry.source,
      snippet: entry.snippet,
      score: entry.score
    })),
    summary: assessment.summary,
    evidence_hash: assessment.evidence_hash,
    before_quote: repriced.before,
    after_quote: repriced.after,
    delta: {
      ...repriced.delta,
      issue_price_delta_usd: repriced.delta.issue_price_usd
    }
  };
}

export async function buildPremiumValuation(caseData, options = {}) {
  const bill = caseData.bill_of_lading ?? {};
  const valuationCase = {
    ...caseData,
    cargo: {
      commodity: caseData.cargo?.commodity ?? caseData.market?.commodity ?? bill.cargo,
      quantity_mt: caseData.cargo?.quantity_mt ?? caseData.cargo?.quantity ?? bill.quantity_mt,
      hs_code: caseData.cargo?.hs_code ?? caseData.commercial_invoice?.hs_code ?? '740311',
      ...(caseData.cargo ?? {})
    }
  };
  const report = await runValuationAgent(valuationCase, options.valuation ?? {});
  const marketIntel = retrieveRiskIntel(caseData, { k: 5 });
  const valuation = report.valuation ?? {};
  return {
    ok: true,
    kind: 'collateral-valuation',
    service: 'premium-valuation',
    case_id: caseData.case_id,
    provider: report.provider,
    cargo_value: valuation.ai_verified_collateral_value_usd ?? null,
    max_safe_redemption_exposure_usd: valuation.max_safe_redemption_exposure_usd ?? null,
    unit_price: valuation.landed_price_usd_per_mt ?? report.live_market?.price_usd_per_mt ?? null,
    valuation_method: valuation.valuation_basis ?? 'conservative-market-comparable',
    live_market: report.live_market,
    historical_comparables: report.historical_comparables,
    risk_comparables: marketIntel.filter((entry) => entry.type === 'commodity_volatility'),
    volatility_haircut_pct: valuation.volatility_haircut_pct ?? null,
    explanation: report.ai_explanation,
    data_sources: [
      ...(report.live_market?.sources ?? []),
      report.historical_source
    ].filter(Boolean),
    tool_trace: report.tool_trace ?? []
  };
}

export async function buildPremiumFraudReview(caseData) {
  const consistency = checkDocumentConsistency(caseData);
  const quote = quoteFromCase(caseData);
  const scenario = runScenario(caseData, { assertExpectations: false });
  return {
    ok: true,
    kind: 'document-fraud-review',
    service: 'fraud-review',
    case_id: caseData.case_id,
    verdict: consistency.has_critical ? 'BLOCK' : consistency.ok ? 'PASS' : 'REVIEW',
    five_dimension_summary: {
      identity_and_quantity: consistency.checks.filter((item) => ['quantity_match', 'hs_code_present'].includes(item.id)),
      invoice_integrity: consistency.checks.filter((item) => ['declared_vs_invoice', 'invoice_vs_market'].includes(item.id)),
      trade_terms: consistency.checks.filter((item) => item.id === 'incoterms_match'),
      insurance: consistency.checks.filter((item) => item.id.startsWith('insurance_')),
      lifecycle: {
        final_state: scenario.final_state,
        contract_action: scenario.risk_report.contract_action
      }
    },
    checks: consistency.checks,
    issues: consistency.issues,
    document_penalty_bps: consistency.penalty_bps,
    pricing_result: {
      risk_score_bps: quote.risk_score_bps,
      risk_level: quote.risk_level,
      issue_price_usd: quote.final_issue_price_usd,
      pricing_action: quote.pricing_action,
      quote_hash: quote.quote_hash,
      evidence_hash: quote.evidence_hash
    },
    scenario: {
      final_state: scenario.final_state,
      steps: scenario.steps
    }
  };
}

export const PAID_REPORT_BUILDERS = Object.freeze({
  'premium-risk': buildPremiumRiskIntel,
  'premium-valuation': buildPremiumValuation,
  'fraud-review': buildPremiumFraudReview
});
