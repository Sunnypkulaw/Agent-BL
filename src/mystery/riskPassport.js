import { hashCanonical } from './fairness.js';
import { collateralCoverageRatio, deriveStressLossPct } from './policy.js';

export function buildMysteryRiskPassport({ pool, riskPassport, proof, now = new Date() }) {
  if (!pool?.quote || !pool?.caseData) throw new TypeError('pool with quote and caseData is required');
  const quote = pool.quote;
  const bill = pool.caseData.bill_of_lading ?? {};
  const stressLossPct = deriveStressLossPct(quote);
  const paidPrice = Number(quote.final_issue_price_usd ?? 0);
  const target = Number(quote.target_redemption_value_usd ?? 1);
  const stressRecoveryPerToken = round(Math.max(0, paidPrice * (1 - stressLossPct)), 4);
  const freshness = buildFreshness(pool, now);
  const matching = [
    Number(quote.risk_score_bps) <= Number(riskPassport.max_risk_score_bps)
      ? 'Risk score is within the selected passport ceiling.'
      : null,
    stressLossPct <= Number(riskPassport.max_stress_loss_pct)
      ? 'Deterministic stress loss is within the selected passport ceiling.'
      : null,
    collateralCoverageRatio(quote) >= Number(riskPassport.min_collateral_coverage_ratio)
      ? 'Collateral coverage meets the selected passport floor.'
      : null
  ].filter(Boolean);
  const evidence = Array.isArray(quote.evidence_graph)
    ? quote.evidence_graph.map((entry) => ({
      component: entry.component,
      discount_bps: Number(entry.discount_bps ?? 0),
      evidence: Array.isArray(entry.evidence) ? entry.evidence : [],
      freshness_status: freshness.status
    }))
    : [];
  const report = {
    kind: 'mystery-voyage-risk-passport',
    service: 'mystery-voyage',
    provider: 'deterministic-agentbl',
    case_id: pool.caseData.case_id,
    reveal_id: proof.reveal_id,
    selected_pool_id: String(pool.poolId),
    risk_passport_hash: riskPassport.risk_passport_hash,
    reveal_proof_hash: proof.reveal_proof_hash,
    cargo: {
      category: bill.cargo ?? 'Trade cargo',
      quantity_mt: Number(bill.quantity_mt ?? 0),
      port_of_loading: bill.port_of_loading ?? null,
      port_of_discharge: bill.port_of_discharge ?? null,
      eta: bill.eta ?? null,
      ebl_reference: bill.bl_id ?? bill.bl_no ?? quote.bl_id ?? null
    },
    pricing: {
      issue_price_usd: paidPrice,
      target_redemption_value_usd: target,
      target_is_guaranteed: false,
      implied_gross_yield_bps: Number(quote.implied_gross_yield_bps ?? 0),
      base_issue_price_usd: Number(quote.base_issue_price_usd ?? 0),
      urgency_discount_bps: Number(quote.urgency_discount_bps ?? 0),
      risk_discount_bps: Number(quote.risk_discount_bps ?? 0),
      binding_constraint: quote.binding_constraint
    },
    risk: {
      level: quote.risk_level,
      score_bps: Number(quote.risk_score_bps ?? 0),
      factors: quote.risk_factors ?? [],
      pricing_action: quote.pricing_action,
      stress_loss_pct: stressLossPct,
      stress_recovery_per_token_usd: stressRecoveryPerToken,
      stress_loss_per_token_usd: round(Math.max(0, paidPrice - stressRecoveryPerToken), 4),
      principal_may_be_fully_lost: true
    },
    collateral: {
      ai_verified_value_usd: Number(quote.ai_verified_collateral_value_usd ?? 0),
      target_redemption_exposure_usd: Number(quote.target_redemption_exposure_usd ?? 0),
      coverage_ratio: round(collateralCoverageRatio(quote), 4)
    },
    suitability: {
      tier: riskPassport.tier,
      matched: matching.length === 3,
      reasons: matching,
      ceilings: {
        max_risk_score_bps: riskPassport.max_risk_score_bps,
        max_stress_loss_pct: riskPassport.max_stress_loss_pct,
        min_collateral_coverage_ratio: riskPassport.min_collateral_coverage_ratio
      }
    },
    evidence_freshness: freshness,
    evidence_graph: evidence,
    non_guarantee_notice: 'Target redemption, AI analysis and evidence are not guarantees. Investors may lose some or all principal.',
    generated_at: new Date(now).toISOString()
  };
  report.evidence_hash = hashCanonical({
    reveal_proof_hash: report.reveal_proof_hash,
    quote_hash: quote.quote_hash,
    evidence_graph: report.evidence_graph,
    freshness: report.evidence_freshness
  });
  report.report_snapshot_hash = hashCanonical(report);
  return report;
}

function buildFreshness(pool, now) {
  const observedAt = pool.quoteUpdatedAt ?? pool.createdAt;
  const ageSeconds = Number.isFinite(Date.parse(observedAt))
    ? Math.max(0, (new Date(now).getTime() - Date.parse(observedAt)) / 1000)
    : Infinity;
  return {
    observed_at: observedAt ?? null,
    age_seconds: Number.isFinite(ageSeconds) ? round(ageSeconds, 1) : null,
    ttl_seconds: 3600,
    status: ageSeconds <= 3600 ? 'FRESH' : 'STALE'
  };
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
