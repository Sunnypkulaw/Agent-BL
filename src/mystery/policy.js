import { hashCanonical } from './fairness.js';

export const DEFAULT_MYSTERY_QUOTE_MAX_AGE_SECONDS = 3600;

export const RISK_PASSPORT_TIERS = Object.freeze({
  CONSERVATIVE: Object.freeze({
    max_risk_score_bps: 500,
    max_stress_loss_pct: 0.25,
    min_collateral_coverage_ratio: 1.15
  }),
  BALANCED: Object.freeze({
    max_risk_score_bps: 1000,
    max_stress_loss_pct: 0.5,
    min_collateral_coverage_ratio: 1.05
  }),
  ADVENTUROUS: Object.freeze({
    max_risk_score_bps: 1500,
    max_stress_loss_pct: 0.75,
    min_collateral_coverage_ratio: 1
  })
});

const ACTIVE_STATES = new Set(['Open', 'Repriced']);

export function normalizeRiskPassport(input = {}) {
  const tier = String(input.tier ?? 'BALANCED').toUpperCase();
  const defaults = RISK_PASSPORT_TIERS[tier];
  if (!defaults) throw new TypeError('tier must be one of: ' + Object.keys(RISK_PASSPORT_TIERS).join(', '));
  const passport = {
    tier,
    max_risk_score_bps: finite(input.max_risk_score_bps, defaults.max_risk_score_bps, 0, 10_000),
    max_stress_loss_pct: finite(input.max_stress_loss_pct, defaults.max_stress_loss_pct, 0, 1),
    min_collateral_coverage_ratio: finite(
      input.min_collateral_coverage_ratio,
      defaults.min_collateral_coverage_ratio,
      0,
      10
    ),
    max_quote_age_seconds: finite(
      input.max_quote_age_seconds,
      DEFAULT_MYSTERY_QUOTE_MAX_AGE_SECONDS,
      10,
      86_400
    ),
    min_remaining_capacity_usd: finite(input.min_remaining_capacity_usd, 1, 0, Number.MAX_SAFE_INTEGER),
    excluded_cargo: normalizeList(input.excluded_cargo),
    excluded_routes: normalizeList(input.excluded_routes),
    excluded_jurisdictions: normalizeList(input.excluded_jurisdictions),
    require_compliance: input.require_compliance !== false
  };
  passport.risk_passport_hash = hashCanonical(passport);
  return passport;
}

export function deriveStressLossPct(quote) {
  if (Number.isFinite(Number(quote.stress_loss_pct))) {
    return clamp(Number(quote.stress_loss_pct), 0, 1);
  }
  const riskComponent = Number(quote.risk_score_bps ?? 0) / 2000;
  const collateral = Number(quote.ai_verified_collateral_value_usd ?? 0);
  const exposure = Number(quote.target_redemption_exposure_usd ?? quote.requested_cash_usd ?? 0);
  const coverageGap = exposure > 0 ? Math.max(0, 1 - collateral / exposure) : 0;
  return round(clamp(riskComponent + coverageGap, 0.05, 0.95), 4);
}

export function collateralCoverageRatio(quote) {
  const collateral = Number(quote.ai_verified_collateral_value_usd ?? 0);
  const exposure = Number(quote.target_redemption_exposure_usd ?? quote.requested_cash_usd ?? 0);
  return exposure > 0 ? collateral / exposure : 0;
}

export function evaluateMysteryCandidate(pool, passportInput, options = {}) {
  const passport = passportInput?.risk_passport_hash ? passportInput : normalizeRiskPassport(passportInput);
  const nowMs = new Date(options.now ?? Date.now()).getTime();
  const quote = pool?.quote ?? {};
  const reasons = [];
  if (!pool || !pool.poolId) reasons.push('pool_missing');
  if (!ACTIVE_STATES.has(pool?.status)) reasons.push('pool_not_active');
  if (passport.require_compliance && pool?.investorEligible === false) reasons.push('investor_not_eligible');
  if (pool?.complianceStatus === 'BLOCKED') reasons.push('compliance_blocked');
  const remainingCapacity = Number(pool?.targetUsd ?? 0) - Number(pool?.subscribedUsd ?? 0);
  if (remainingCapacity < passport.min_remaining_capacity_usd) reasons.push('insufficient_capacity');
  if (Number(quote.risk_score_bps ?? Infinity) > passport.max_risk_score_bps) reasons.push('risk_score_exceeded');
  const stressLossPct = deriveStressLossPct(quote);
  if (stressLossPct > passport.max_stress_loss_pct) reasons.push('stress_loss_exceeded');
  const coverageRatio = collateralCoverageRatio(quote);
  if (coverageRatio < passport.min_collateral_coverage_ratio) reasons.push('collateral_coverage_too_low');
  const quoteUpdatedAt = pool.quoteUpdatedAt ?? pool.createdAt;
  const quoteAgeSeconds = Number.isFinite(Date.parse(quoteUpdatedAt))
    ? Math.max(0, (nowMs - Date.parse(quoteUpdatedAt)) / 1000)
    : Infinity;
  if (quoteAgeSeconds > passport.max_quote_age_seconds) reasons.push('quote_stale');
  const bill = pool.caseData?.bill_of_lading ?? {};
  const cargo = normalizeText(bill.cargo);
  const route = normalizeText(String(bill.port_of_loading ?? '') + ' → ' + String(bill.port_of_discharge ?? ''));
  const jurisdictions = [
    bill.port_of_loading,
    bill.port_of_discharge,
    pool.caseData?.exporter?.country,
    pool.caseData?.importer?.country
  ].map(normalizeText).filter(Boolean);
  if (passport.excluded_cargo.some((term) => cargo.includes(term))) reasons.push('cargo_excluded');
  if (passport.excluded_routes.some((term) => route.includes(term))) reasons.push('route_excluded');
  if (passport.excluded_jurisdictions.some((term) => jurisdictions.some((value) => value.includes(term)))) {
    reasons.push('jurisdiction_excluded');
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    metrics: {
      remaining_capacity_usd: round(remainingCapacity, 2),
      risk_score_bps: Number(quote.risk_score_bps ?? 0),
      stress_loss_pct: stressLossPct,
      collateral_coverage_ratio: round(coverageRatio, 4),
      quote_age_seconds: round(quoteAgeSeconds, 1)
    }
  };
}

export function filterMysteryCandidates(pools, passportInput, options = {}) {
  const passport = normalizeRiskPassport(passportInput);
  const evaluated = Array.from(pools, (pool) => ({
    pool,
    evaluation: evaluateMysteryCandidate(pool, passport, options)
  }));
  const eligible = evaluated
    .filter((entry) => entry.evaluation.eligible)
    .map(({ pool, evaluation }) => ({
      pool_id: String(pool.poolId),
      quote_hash: String(pool.quote.quote_hash).toLowerCase(),
      weight: 1,
      metrics: evaluation.metrics
    }))
    .sort((left, right) => left.pool_id.localeCompare(right.pool_id));
  return {
    risk_passport: passport,
    eligible,
    rejected: evaluated
      .filter((entry) => !entry.evaluation.eligible)
      .map(({ pool, evaluation }) => ({ pool_id: String(pool?.poolId ?? ''), reasons: evaluation.reasons }))
  };
}

function finite(value, fallback, min, max) {
  const number = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new TypeError('value must be a number between ' + min + ' and ' + max);
  }
  return number;
}

function normalizeList(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new TypeError('exclusion fields must be arrays');
  return [...new Set(value.map(normalizeText).filter(Boolean))].sort();
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
