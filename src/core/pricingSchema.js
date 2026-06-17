// PricingQuote schema + validator for the AI dynamic-pricing RWA model.
//
// This is the NEW-model counterpart to src/core/schema.js (which validates the
// legacy RiskReport). It is kept in a separate file on purpose: the legacy
// validator is wired into check.mjs / workflow.js / scenarioRunner.js / server.js
// and must stay untouched during the migration (see README "Current vs Target").
//
// A PricingQuote is the single structured artifact the AI Pricing & Risk Agent
// produces. Backend, frontend and the RiskPricingOracle all consume this shape.

import { RISK_LEVELS, ValidationError } from './schema.js';

export const PAYOUT_SPEEDS = ['FAST', 'BALANCED', 'LOW_COST'];

export const PRICING_ACTIONS = [
  'OPEN_OFFERING',
  'OPEN_WITH_WARNING',
  'REPRICE_DOWN',
  'PAUSE_OFFERING',
  'FREEZE_POOL',
  'TRIGGER_LIQUIDATION'
];

// Which lever set the final issue price:
//   EXPORTER_PROFIT - the profit-share policy price (the normal path)
//   COLLATERAL      - the safe-coverage floor lifted the price above the policy price
//   PRICE_CLAMP     - the absolute MIN/MAX price clamp bound it (edge case)
export const BINDING_CONSTRAINTS = ['EXPORTER_PROFIT', 'COLLATERAL', 'PRICE_CLAMP'];

// RWA offering lifecycle states (PRD §8.5).
export const RWA_OFFERING_STATES = [
  'Created',
  'Priced',
  'Open',
  'Subscribed',
  'Funded',
  'InTransit',
  'Repriced',
  'Paused',
  'Frozen',
  'Repaid',
  'Redeemed',
  'Liquidation',
  'Defaulted',
  'Cancelled'
];

// pricing_action -> the offering state it drives.
export const STATE_BY_PRICING_ACTION = {
  OPEN_OFFERING: 'Open',
  OPEN_WITH_WARNING: 'Open',
  REPRICE_DOWN: 'Repriced',
  PAUSE_OFFERING: 'Paused',
  FREEZE_POOL: 'Frozen',
  TRIGGER_LIQUIDATION: 'Liquidation'
};

export { RISK_LEVELS };

const HASH_RE = /^0x[0-9a-f]{64}$/u; // identical to schema.js evidence_hash format

// --- local validation primitives (mirror schema.js; kept local so the legacy
// --- validator file is not modified) ---------------------------------------
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, field, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${field} must be a non-empty string`);
  }
}

function requireNumber(value, field, errors, { min, max } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${field} must be a finite number`);
    return;
  }
  if (min !== undefined && value < min) errors.push(`${field} must be >= ${min}`);
  if (max !== undefined && value > max) errors.push(`${field} must be <= ${max}`);
}

function requireEnum(value, field, allowed, errors) {
  if (!allowed.includes(value)) errors.push(`${field} must be one of: ${allowed.join(', ')}`);
}

function requireStringArray(value, field, errors) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    errors.push(`${field} must be an array of strings`);
  }
}

/**
 * Validate a PricingQuote. Throws ValidationError on the first batch of problems.
 * @param {object} quote   the PricingQuote to validate
 * @param {object} [caseData] optional case to cross-check case_id / bl_id
 * @returns the quote (for chaining)
 */
export function assertPricingQuote(quote, caseData) {
  const errors = [];
  if (!isRecord(quote)) throw new ValidationError('PricingQuote validation failed', ['quote must be an object']);

  requireString(quote.case_id, 'case_id', errors);
  requireString(quote.bl_id, 'bl_id', errors);
  requireEnum(quote.payout_speed, 'payout_speed', PAYOUT_SPEEDS, errors);
  requireNumber(quote.target_redemption_value_usd, 'target_redemption_value_usd', errors, { min: 1, max: 1 });

  // Collateral block.
  requireNumber(quote.ai_verified_collateral_value_usd, 'ai_verified_collateral_value_usd', errors, { min: 0 });
  requireNumber(quote.redemption_coverage_limit, 'redemption_coverage_limit', errors, { min: 0, max: 1 });
  requireNumber(quote.max_safe_redemption_exposure_usd, 'max_safe_redemption_exposure_usd', errors, { min: 0 });

  // Exporter economics.
  requireNumber(quote.requested_cash_usd, 'requested_cash_usd', errors, { min: 0 });
  requireNumber(quote.exporter_cost_of_goods_usd, 'exporter_cost_of_goods_usd', errors, { min: 0 });
  requireNumber(quote.exporter_gross_profit_usd, 'exporter_gross_profit_usd', errors, { min: 0 });
  requireNumber(quote.exporter_gross_margin_pct, 'exporter_gross_margin_pct', errors, { min: 0, max: 1 });

  // Pricing decomposition. Issue prices are a discount to the 1.00 target.
  requireNumber(quote.base_issue_price_usd, 'base_issue_price_usd', errors, { min: 0, max: 1 });
  requireNumber(quote.urgency_discount_bps, 'urgency_discount_bps', errors, { min: 0 });
  requireNumber(quote.risk_discount_bps, 'risk_discount_bps', errors, { min: 0 });
  requireNumber(quote.indicative_issue_price_usd, 'indicative_issue_price_usd', errors, { min: 0, max: 1 });
  requireNumber(quote.final_issue_price_usd, 'final_issue_price_usd', errors, { min: 0, max: 1 });
  requireEnum(quote.binding_constraint, 'binding_constraint', BINDING_CONSTRAINTS, errors);

  // Results.
  requireNumber(quote.recommended_token_supply, 'recommended_token_supply', errors, { min: 0 });
  requireNumber(quote.target_redemption_exposure_usd, 'target_redemption_exposure_usd', errors, { min: 0 });
  requireNumber(quote.expected_cash_to_exporter_usd, 'expected_cash_to_exporter_usd', errors, { min: 0 });
  requireNumber(quote.financing_cost_usd, 'financing_cost_usd', errors, { min: 0 });
  requireNumber(quote.exporter_profit_share_bps, 'exporter_profit_share_bps', errors, { min: 0 });
  requireNumber(quote.exporter_net_profit_usd, 'exporter_net_profit_usd', errors);
  requireNumber(quote.implied_gross_yield_bps, 'implied_gross_yield_bps', errors, { min: 0 });

  // Risk + action + explanation.
  requireEnum(quote.risk_level, 'risk_level', RISK_LEVELS, errors);
  requireNumber(quote.risk_score_bps, 'risk_score_bps', errors, { min: 0 });
  requireStringArray(quote.risk_factors, 'risk_factors', errors);
  requireEnum(quote.pricing_action, 'pricing_action', PRICING_ACTIONS, errors);
  requireString(quote.investor_explanation, 'investor_explanation', errors);
  requireString(quote.exporter_explanation, 'exporter_explanation', errors);

  // Evidence graph (AI-7): each price component with its evidence.
  if (!Array.isArray(quote.evidence_graph) || quote.evidence_graph.length === 0) {
    errors.push('evidence_graph must be a non-empty array');
  } else {
    for (const [i, node] of quote.evidence_graph.entries()) {
      if (!isRecord(node)) errors.push(`evidence_graph[${i}] must be an object`);
      else {
        requireString(node.component, `evidence_graph[${i}].component`, errors);
        if (!Array.isArray(node.evidence)) errors.push(`evidence_graph[${i}].evidence must be an array`);
      }
    }
  }

  // BE-8: oracle hashes.
  if (typeof quote.evidence_hash !== 'string' || !HASH_RE.test(quote.evidence_hash)) {
    errors.push('evidence_hash must be a 0x-prefixed sha256 hash');
  }
  if (typeof quote.quote_hash !== 'string' || !HASH_RE.test(quote.quote_hash)) {
    errors.push('quote_hash must be a 0x-prefixed sha256 hash');
  }

  // --- structural invariants (the heart of a defensible AI price) ---
  if (errors.length === 0) {
    // AI-5 collateral guardrail: redemption exposure must never exceed safe coverage.
    if (quote.target_redemption_exposure_usd > quote.max_safe_redemption_exposure_usd + 1) {
      errors.push('target_redemption_exposure_usd must be <= max_safe_redemption_exposure_usd');
    }
    // The exporter cannot be advanced more cash than requested.
    if (quote.expected_cash_to_exporter_usd > quote.requested_cash_usd + 1) {
      errors.push('expected_cash_to_exporter_usd must be <= requested_cash_usd');
    }
    // The additive decomposition must reconstruct the indicative price.
    const reconstructed =
      quote.base_issue_price_usd - quote.urgency_discount_bps / 10000 - quote.risk_discount_bps / 10000;
    if (Math.abs(reconstructed - quote.indicative_issue_price_usd) > 0.0005) {
      errors.push('indicative_issue_price_usd must equal base - urgency - risk discount');
    }
    // The collateral floor only ever lifts the price, never lowers it.
    if (quote.final_issue_price_usd < quote.indicative_issue_price_usd - 0.0005) {
      errors.push('final_issue_price_usd must be >= indicative_issue_price_usd');
    }
  }

  if (caseData) {
    if (quote.case_id !== caseData.case_id) errors.push('case_id must match case.case_id');
    const blId = caseData.bill_of_lading?.bl_id;
    if (blId && quote.bl_id !== blId) errors.push('bl_id must match bill_of_lading.bl_id');
  }

  if (errors.length > 0) throw new ValidationError('PricingQuote validation failed', errors);
  return quote;
}
