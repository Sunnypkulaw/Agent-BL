// RWA offering lifecycle simulator (BE-4).
//
// Drives an eBL-backed RWA offering through its on-chain states using the AI
// PricingQuote, and shows what happens when risk escalates mid-transit: the
// RiskPricingOracle reprices the pool, pauses it, or it settles and redeems.
//
//   Created -> Priced -> Open -> Subscribed -> Funded -> InTransit
//             -> (Repriced | Paused | Frozen)
//             -> Repaid -> Redeemed                     (importer pays: investors earn the discount)
//             -> Defaulted -> Liquidation               (importer defaults: investors recover < paid)
//
// Pure / deterministic / offline (built on quoteFromCase).

import { quoteFromCase } from './pricingEngine.js';
import { STATE_BY_PRICING_ACTION } from './pricingSchema.js';

const NON_OPENING_ACTIONS = new Set(['PAUSE_OFFERING', 'FREEZE_POOL', 'TRIGGER_LIQUIDATION']);
const REPRICE_THRESHOLD = 0.005; // >0.5c price drop counts as a reprice event

// --- default / liquidation recovery model --------------------------------
// When the importer (or exporter) defaults, the pool seizes the pledged eBL,
// liquidates the cargo and claims insurance. A forced sale, plus the very risk
// that triggered the default (war-premium retrace, price crash, insurance
// dispute), means the AI-verified collateral realizes LESS than its verified
// value — so investors recover BELOW the 1.00 target and can lose money. That
// residual loss, the part the over-collateral buffer does NOT cover, is exactly
// what the AI's risk discount is paid to compensate for.
const BASE_LIQUIDATION_HAIRCUT = 0.12; // a forced/fire sale always loses ~12% vs verified value
const RISK_RECOVERY_BPS_DIVISOR = 4000; // higher trade risk -> worse realization at liquidation
const MAX_RISK_RECOVERY_HAIRCUT = 0.5; // cap the risk-driven realization loss
const MIN_REALIZATION_FACTOR = 0.2; // MVP: never assume a total wipeout of the seized cargo

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const usd = (n) => 'USD ' + Math.round(n).toLocaleString('en-US');

/** Clone a case and merge in risk events that "arrive" after the offering opens. */
function applyEvents(caseData, events) {
  const merged = structuredClone(caseData);
  merged.macro_risk_events = [...(merged.macro_risk_events ?? [])];
  merged.shipment_events = [...(merged.shipment_events ?? [])];
  for (const event of events) {
    const { category = 'macro', ...rest } = event;
    if (category === 'shipment') merged.shipment_events.push(rest);
    else merged.macro_risk_events.push(rest);
  }
  return merged;
}

/**
 * Healthy settlement: importer pays, exporter repays the pool, investors redeem
 * at the target. The investor's gain is the discount they bought at.
 */
function settleByRepayment(quote, subscription) {
  const proceeds = round(subscription.tokens * quote.target_redemption_value_usd, 2);
  const pnl = round(proceeds - subscription.raised_usd, 2);
  return {
    outcome: 'REPAID',
    redemption_value_per_token: quote.target_redemption_value_usd,
    investor_capital_usd: subscription.raised_usd,
    investor_proceeds_usd: proceeds,
    investor_pnl_usd: pnl,
    investor_return_pct: subscription.raised_usd > 0 ? round(pnl / subscription.raised_usd, 4) : 0
  };
}

/**
 * Default settlement: the pool liquidates the pledged eBL. Recovery is the
 * AI-verified collateral value times a realization rate (forced sale + the risk
 * that caused the default), capped at what investors are owed — surplus, if any,
 * is the exporter's, not the investors'. Investors take a loss whenever the
 * recovery per token falls below the price they paid.
 *
 * The realization rate is either passed explicitly (opts.recovery_rate, to model
 * a specific tail) or derived from the trade risk score.
 */
function settleByDefault(quote, subscription, opts = {}) {
  const collateral = quote.ai_verified_collateral_value_usd;
  const autoRate = clamp(
    1 - BASE_LIQUIDATION_HAIRCUT - Math.min(MAX_RISK_RECOVERY_HAIRCUT, (quote.risk_score_bps ?? 0) / RISK_RECOVERY_BPS_DIVISOR),
    MIN_REALIZATION_FACTOR,
    1
  );
  const realizationRate = clamp(Number(opts.recovery_rate ?? autoRate), 0, 1);

  const recoverableValue = round(collateral * realizationRate, 2); // cargo sale + insurance, net of costs
  const owed = round(subscription.tokens * quote.target_redemption_value_usd, 2);
  const recoveredToPool = round(Math.min(recoverableValue, owed), 2);
  const recoveryPerToken = subscription.tokens > 0 ? round(recoveredToPool / subscription.tokens, 4) : 0;
  const proceeds = round(subscription.tokens * recoveryPerToken, 2);
  const pnl = round(proceeds - subscription.raised_usd, 2);

  return {
    outcome: 'IMPORTER_DEFAULT',
    redemption_value_per_token: recoveryPerToken,
    investor_capital_usd: subscription.raised_usd,
    investor_proceeds_usd: proceeds,
    investor_pnl_usd: pnl,
    investor_return_pct: subscription.raised_usd > 0 ? round(pnl / subscription.raised_usd, 4) : 0,
    liquidation: {
      ai_verified_collateral_value_usd: round(collateral, 2),
      realization_rate: round(realizationRate, 4),
      recoverable_value_usd: recoverableValue,
      amount_owed_usd: owed,
      recovered_to_pool_usd: recoveredToPool
    }
  };
}

/**
 * Simulate the full RWA offering lifecycle for a case.
 * @param {object} caseData
 * @param {object} [opts] { payout_speed, requested_cash_usd, subscription_usd, events, settlement, recovery_rate, default_reason }
 *   events: [{ category:'macro'|'shipment', type, severity, region?, description?, ... }]
 *   settlement: 'REPAID' (default) | 'IMPORTER_DEFAULT' — force the terminal outcome.
 *   recovery_rate: 0..1 fraction of AI-verified collateral realized at liquidation
 *     (default: derived from the trade risk score). Only used on default.
 *   default_reason: human-readable cause shown on the Defaulted step.
 * @returns {object} { case_id, final_state, initial_quote, final_quote, subscription, settlement, steps }
 */
export function simulateOffering(caseData, opts = {}) {
  const events = opts.events ?? [];
  const quoteOpts = { payout_speed: opts.payout_speed, requested_cash_usd: opts.requested_cash_usd };
  const initialQuote = quoteFromCase(caseData, quoteOpts);

  const steps = [];
  const push = (state, actor, event) => steps.push({ state, actor, event });
  const shortHash = (h) => (typeof h === 'string' ? h.slice(0, 10) : 'n/a');

  push('Created', 'Exporter',
    `Pledge eBL ${initialQuote.bl_id} backing cargo valued at ${usd(initialQuote.ai_verified_collateral_value_usd)}`);
  push('Priced', 'AI Pricing Agent',
    `${initialQuote.pricing_action}: issue ${initialQuote.final_issue_price_usd.toFixed(3)}, supply ${initialQuote.recommended_token_supply.toLocaleString('en-US')}, ${(initialQuote.implied_gross_yield_bps / 100).toFixed(1)}% target upside (quote ${shortHash(initialQuote.quote_hash)})`);

  // AI declines to open the offering at all.
  if (NON_OPENING_ACTIONS.has(initialQuote.pricing_action)) {
    const state = STATE_BY_PRICING_ACTION[initialQuote.pricing_action];
    push(state, 'RiskPricingOracle', `Offering not opened — ${initialQuote.investor_explanation}`);
    return finalize(initialQuote, initialQuote, { requested_usd: 0, raised_usd: 0, tokens: 0 }, state, steps);
  }

  push('Open', 'Contract',
    `RWA offering opens at ${usd(initialQuote.final_issue_price_usd)}/token for ${initialQuote.recommended_token_supply.toLocaleString('en-US')} tokens (1.00 target redemption, not guaranteed)`);

  const subscriptionUsd = Number(opts.subscription_usd ?? initialQuote.expected_cash_to_exporter_usd);
  const tokens = Math.floor(Math.min(subscriptionUsd / initialQuote.final_issue_price_usd, initialQuote.recommended_token_supply));
  const raised = round(tokens * initialQuote.final_issue_price_usd, 2);
  push('Subscribed', 'Investors', `Permissioned investors subscribe ${usd(raised)} for ${tokens.toLocaleString('en-US')} RWA`);
  push('Funded', 'Contract', `${usd(raised)} released to exporter; eBL held as pool collateral`);
  push('InTransit', 'Carrier', 'Cargo in transit; AI Pricing & Risk Agent monitors macro and shipment risk');
  const subscription = { requested_usd: round(subscriptionUsd, 2), raised_usd: raised, tokens };

  let finalQuote = initialQuote;
  let endState = 'InTransit';

  if (events.length > 0) {
    const reQuote = quoteFromCase(applyEvents(caseData, events), quoteOpts);
    finalQuote = reQuote;
    if (NON_OPENING_ACTIONS.has(reQuote.pricing_action)) {
      endState = STATE_BY_PRICING_ACTION[reQuote.pricing_action];
      push(endState, 'RiskPricingOracle',
        `Risk escalated to ${reQuote.risk_level}: ${reQuote.pricing_action}. New evidence ${shortHash(reQuote.evidence_hash)}`);
    } else if (reQuote.final_issue_price_usd < initialQuote.final_issue_price_usd - REPRICE_THRESHOLD) {
      endState = 'Repriced';
      push('Repriced', 'RiskPricingOracle',
        `Risk up to ${reQuote.risk_level}: reprice ${initialQuote.final_issue_price_usd.toFixed(3)} -> ${reQuote.final_issue_price_usd.toFixed(3)} (evidence ${shortHash(reQuote.evidence_hash)})`);
    } else {
      push('InTransit', 'RiskPricingOracle', `Risk reassessed (${reQuote.risk_level}); price held at ${reQuote.final_issue_price_usd.toFixed(3)}`);
    }
  }

  // Settlement. A funded pool has two terminal outcomes:
  //   REPAID  -> importer pays the exporter, the exporter repays the pool, and
  //              investors redeem at the target (they earn the discount they bought at).
  //   DEFAULT -> importer (or exporter) defaults; the pool seizes and liquidates the
  //              pledged eBL. Recovery is capped by what the cargo + insurance fetch,
  //              so investors redeem BELOW what they paid and can lose money.
  // There is no L/C and no bank here: the pool only holds the pledged eBL, so the
  // repayment chain (importer -> exporter -> pool -> investors) has two human links
  // that can break. `opts.settlement` forces the outcome for the demo; a mid-transit
  // TRIGGER_LIQUIDATION (endState 'Liquidation') also settles by liquidation.
  const settlementOpt = String(opts.settlement ?? '').toUpperCase();
  const defaulted =
    settlementOpt === 'IMPORTER_DEFAULT' || settlementOpt === 'DEFAULT' || endState === 'Liquidation';

  let settlement = null;
  if (defaulted && subscription.tokens > 0) {
    settlement = settleByDefault(finalQuote, subscription, opts);
    const liq = settlement.liquidation;
    const pricePaid = round(subscription.raised_usd / subscription.tokens, 4); // what subscribers actually paid
    const reason = opts.default_reason
      ?? 'importer walks from the contract after the cargo is re-marked below the invoice price';
    const verdict = settlement.investor_pnl_usd < 0 ? 'net LOSS' : 'net gain';
    push('Defaulted', 'Importer', `Importer default — ${reason}; the repayment chain breaks`);
    push('Liquidation', 'Pool',
      `Pool seizes the pledged eBL and liquidates: AI-verified collateral ${usd(liq.ai_verified_collateral_value_usd)} realizes ${usd(liq.recoverable_value_usd)} (${Math.round(liq.realization_rate * 100)}% — forced sale under ${finalQuote.risk_level} stress) against ${usd(liq.amount_owed_usd)} owed to RWA holders`);
    push('Liquidation', 'Investors',
      `Investors recover ${settlement.redemption_value_per_token.toFixed(3)}/token vs ${pricePaid.toFixed(3)} paid — ${verdict} ${usd(Math.abs(settlement.investor_pnl_usd))} (${(settlement.investor_return_pct * 100).toFixed(1)}% on ${usd(settlement.investor_capital_usd)} subscribed)`);
    endState = 'Liquidation';
  } else if (endState === 'InTransit' || endState === 'Repriced') {
    settlement = settleByRepayment(finalQuote, subscription);
    push('Repaid', 'Exporter', 'Importer pays the exporter for the delivered cargo; the exporter repays the pool, releasing the pledged eBL — pool receives funds');
    push('Redeemed', 'Investors',
      `Investors redeem RWA at the ${finalQuote.target_redemption_value_usd.toFixed(2)} target — net gain ${usd(settlement.investor_pnl_usd)} (${(settlement.investor_return_pct * 100).toFixed(1)}% on ${usd(settlement.investor_capital_usd)}); the discount they earned was the exporter's ${usd(finalQuote.financing_cost_usd)} financing cost`);
    endState = 'Redeemed';
  }

  return finalize(initialQuote, finalQuote, subscription, endState, steps, settlement);
}

function finalize(initialQuote, finalQuote, subscription, finalState, steps, settlement = null) {
  return {
    case_id: initialQuote.case_id,
    bl_id: initialQuote.bl_id,
    payout_speed: initialQuote.payout_speed,
    final_state: finalState,
    initial_quote: initialQuote,
    final_quote: finalQuote,
    subscription,
    settlement,
    steps
  };
}
