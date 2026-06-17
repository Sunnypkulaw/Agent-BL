// On-chain oracle payload builder (BE-8).
//
// Maps a PricingQuote to the exact arguments the RiskPricingOracle and
// RWAOfferingPool need on-chain, so the AI's pricing decision can be written as
// a verifiable event. Two hashes travel with it:
//   evidence_hash anchors the INPUTS behind the price (valuation, risk, docs)
//   quote_hash    anchors the TERMS the pool opens with (price, supply, action)
//
// Pure / deterministic. See PRD §9.3 (RiskPricingOracle.updatePricing,
// RWAOfferingPool.createOffering) and src/core/pricingSchema.js.

import { STATE_BY_PRICING_ACTION } from './pricingSchema.js';

/**
 * Build the RiskPricingOracle / RWAOfferingPool update payload from a quote.
 * @param {object} quote a validated PricingQuote
 * @param {object} [opts] { pool_id }
 * @returns the on-chain update payload (snake_case, JSON-serialisable)
 */
export function toOracleUpdate(quote, opts = {}) {
  return {
    pool_id: opts.pool_id ?? null,
    case_id: quote.case_id,
    bl_id: quote.bl_id,
    // RiskPricingOracle.updatePricing(poolId, issuePrice, riskLevel, action, evidenceHash)
    issue_price_usd: quote.final_issue_price_usd,
    risk_level: quote.risk_level,
    risk_score_bps: quote.risk_score_bps,
    pricing_action: quote.pricing_action,
    offering_state: STATE_BY_PRICING_ACTION[quote.pricing_action] ?? null,
    evidence_hash: quote.evidence_hash,
    quote_hash: quote.quote_hash,
    // RWAOfferingPool.createOffering(eblId, tokenSupply, issuePrice, targetRedemptionValue)
    recommended_token_supply: quote.recommended_token_supply,
    target_redemption_value_usd: quote.target_redemption_value_usd,
    target_redemption_exposure_usd: quote.target_redemption_exposure_usd
  };
}
