// TradeShield AI dynamic-pricing engine for eBL-backed RWA discount issuance.
//
// The job of this engine is NOT to "write an explanation" — it is to decide, for
// a given trade case, the RWA issue price, the financing the exporter can take,
// the investor's implied yield, and the on-chain pricing action. It is pure,
// deterministic and network-free (it calls the local valuation policy directly),
// so the same numbers come out in tests, the CLI demo and a future API.
//
// Pricing philosophy (this is the novel part):
//   The discount the investor earns IS the exporter's financing cost, and we set
//   that cost as a SHARE OF THE EXPORTER'S VERIFIED TRADE PROFIT.
//
//       gross_profit P  = invoice_value - cost_of_goods
//       financing_cost  = share * P
//       issue_price     = cash / (cash + financing_cost)          // = cash/(cash + share*P)
//
//   - payout speed sets the BASE share given up for speed (the "reasonable ratio"):
//         FAST 0.50   BALANCED 0.33   LOW_COST 0.20
//     => "很快到账" sacrifices more margin for speed; "正常到账" keeps more margin.
//   - trade risk (war / volatility / shipment / docs) ADDS to the share, so a
//     riskier deal is priced lower (investors are paid more to take it).
//   - AI-verified collateral CAPS the safe redemption exposure: a hard price floor.
//   - if the total share would exceed MAX_PROFIT_SHARE, the offering is paused.
//
// 1.00 USD per token is a TARGET redemption value, not a capital guarantee.

import crypto from 'node:crypto';
import { computeCargoValuation } from '../agent/tools/copperValuationTools.js';
import { suggestHaircut } from '../agent/valuationAgent.js';
import { checkDocumentConsistency } from '../agent/documentConsistency.js';
import { retrieveRiskIntel } from '../agent/riskIntel.js';
import { PAYOUT_SPEEDS } from './pricingSchema.js';

export { PAYOUT_SPEEDS };

// Base share of the exporter's gross trade profit handed to investors as the
// financing discount, BEFORE any risk premium — the "reasonable ratio" per speed.
export const BASE_PROFIT_SHARE = { FAST: 0.5, BALANCED: 0.33, LOW_COST: 0.2 };

// Above this share, financing is "aggressive" for that speed -> open with warning.
const PROFIT_SHARE_WARN = { FAST: 0.65, BALANCED: 0.5, LOW_COST: 0.35 };

// Hard ceiling: never give away more than this share of the exporter's profit.
const MAX_PROFIT_SHARE = 0.85;

// Map risk basis points into extra profit-share (350bps risk -> +0.10 share).
const RISK_BPS_PER_PROFIT_SHARE = 3500;
const MAX_RISK_PROFIT_SHARE = 0.3;

// Absolute price clamps (target redemption value = 1.00 USD/token).
const MIN_PRICE = 0.5;
const MAX_PRICE = 0.97;

// --- risk scoring (basis points of "risk pressure") ---
const MACRO_RISK_BPS = {
  war_risk: { info: 60, warning: 200, critical: 450 },
  sanction_risk: { info: 60, warning: 200, critical: 400 },
  commodity_volatility: { info: 50, warning: 150, critical: 300 },
  fx_volatility: { info: 20, warning: 80, critical: 160 },
  port_congestion: { info: 40, warning: 120, critical: 220 },
  severe_weather: { info: 40, warning: 120, critical: 220 },
  buyer_country_risk: { info: 60, warning: 150, critical: 300 }
};

const SHIPMENT_RISK_BPS = {
  loaded_on_board: 0,
  no_damage_reported: 0,
  bad_weather: 80,
  delay: 60,
  route_deviation: 120,
  port_strike: 150,
  cargo_damage: 300,
  partial_loss: 350,
  insurance_expiry_risk: 200,
  insurance_invalid: 400
};

const MAX_RISK_BPS = 1800;

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function bps(fraction) {
  return Math.round(fraction * 10000);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function riskLevelFromBps(totalBps) {
  if (totalBps < 150) return 'LOW';
  if (totalBps < 400) return 'MEDIUM';
  if (totalBps < 900) return 'WARNING';
  return 'CRITICAL';
}

/**
 * Score the trade risk of a case into a basis-point "risk discount" plus the
 * human-readable factors behind it. Pure function of the case data.
 */
export function scoreRisk(caseData) {
  const factors = [];
  let totalBps = 0;

  for (const event of caseData.macro_risk_events ?? []) {
    const table = MACRO_RISK_BPS[event.type];
    const points = table?.[event.severity] ?? (event.severity === 'critical' ? 300 : event.severity === 'warning' ? 120 : 30);
    if (points > 0) {
      totalBps += points;
      factors.push(`${event.type}/${event.severity}${event.region ? ` (${event.region})` : ''}: +${points}bps`);
    }
  }

  for (const event of caseData.shipment_events ?? []) {
    let points = SHIPMENT_RISK_BPS[event.type] ?? 60;
    if (event.type === 'delay' && typeof event.delay_days === 'number') {
      points = Math.min(180, points + Math.max(0, event.delay_days - 3) * 10);
    }
    if (points > 0) {
      totalBps += points;
      factors.push(`${event.type}: +${points}bps`);
    }
  }

  // Adverse price move since the cargo was contracted.
  const market = caseData.market ?? {};
  const initial = Number(market.initial_price_usd_per_mt ?? market.initial_price_usd_per_bbl);
  const current = Number(market.current_price_usd_per_mt ?? market.current_price_usd_per_bbl ?? market.reference_price_usd_per_bbl);
  if (Number.isFinite(initial) && Number.isFinite(current) && current < initial) {
    const dropPct = (initial - current) / initial;
    const points = Math.min(300, Math.round(dropPct * 100) * 12);
    if (points > 0) {
      totalBps += points;
      factors.push(`commodity_price_drop ${Math.round(dropPct * 100)}%: +${points}bps`);
    }
  }

  // Document consistency (eBL / invoice / insurance) — AI-8 feeds the price.
  const documents = checkDocumentConsistency(caseData);
  if (documents.penalty_bps > 0) {
    totalBps += documents.penalty_bps;
    for (const issue of documents.issues) factors.push(`doc: ${issue}`);
  }

  totalBps = Math.min(MAX_RISK_BPS, totalBps);
  if (factors.length === 0) factors.push('no elevated trade-risk signals detected');

  return {
    risk_score_bps: totalBps,
    risk_level: riskLevelFromBps(totalBps),
    risk_factors: factors,
    document_checks: documents
  };
}

function priceFromShare(cash, share, profit) {
  return cash / (cash + share * profit);
}

function pickPricingAction({ riskLevel, paused, profitShare, payoutSpeed, binding }) {
  if (paused) return 'PAUSE_OFFERING';
  if (riskLevel === 'CRITICAL') return 'PAUSE_OFFERING';
  if (binding === 'COLLATERAL' && riskLevel === 'WARNING') return 'OPEN_WITH_WARNING';
  if (riskLevel === 'WARNING') return 'OPEN_WITH_WARNING';
  if (profitShare > PROFIT_SHARE_WARN[payoutSpeed]) return 'OPEN_WITH_WARNING';
  return 'OPEN_OFFERING';
}

function hashEvidence(payload) {
  return '0x' + crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function pct(value) {
  return Math.round(value * 1000) / 10; // one-decimal percentage for prose
}

function usd(value) {
  return Math.round(value).toLocaleString('en-US');
}

function buildInvestorExplanation(q) {
  const yieldPct = (q.implied_gross_yield_bps / 100).toFixed(1);
  const floorNote =
    q.binding_constraint === 'COLLATERAL'
      ? ` The price is floored by AI-verified collateral: safe redemption exposure is capped at USD ${usd(q.max_safe_redemption_exposure_usd)}, so the discount cannot go deeper without exceeding coverage.`
      : '';
  return (
    `This eBL-backed RWA is offered at USD ${q.final_issue_price_usd.toFixed(2)} per token versus a USD 1.00 ` +
    `target redemption value — an implied ${yieldPct}% gross upside. The exporter chose ${q.payout_speed} ` +
    `payout, which sets a ${pct(BASE_PROFIT_SHARE[q.payout_speed])}% base share of their verified trade margin as ` +
    `investor compensation; current ${q.risk_level} trade risk (${q.risk_factors.join('; ')}) adds ` +
    `${q.risk_discount_bps}bps of discount.${floorNote} Target redemption is not guaranteed: it depends on ` +
    `importer payment, cargo settlement and insurance coverage.`
  );
}

function buildExporterExplanation(q) {
  const cheaper = q.payout_speed !== 'LOW_COST'
    ? ` A LOW_COST payout would lower the financing cost but release cash more slowly.`
    : '';
  const aggressive = q.exporter_profit_share_bps > PROFIT_SHARE_WARN[q.payout_speed] * 10000
    ? ` This is an aggressive share of your margin to give up for speed — consider a slower payout if you are not time-critical.`
    : '';
  const paused = q.pricing_action === 'PAUSE_OFFERING'
    ? ` AI has PAUSED the offering: at current risk the financing would consume too much of your margin or exceed safe collateral coverage.`
    : '';
  const collateral = q.binding_constraint === 'COLLATERAL'
    ? ` Note: the issue price was floored to keep redemption within safe collateral coverage, so you receive USD ${usd(q.expected_cash_to_exporter_usd)} of the USD ${usd(q.requested_cash_usd)} requested.`
    : '';
  return (
    `Choosing ${q.payout_speed} payout advances USD ${usd(q.expected_cash_to_exporter_usd)} now at an issue price of ` +
    `USD ${q.final_issue_price_usd.toFixed(2)}. The financing cost is USD ${usd(q.financing_cost_usd)} — ` +
    `${(q.exporter_profit_share_bps / 100).toFixed(1)}% of your USD ${usd(q.exporter_gross_profit_usd)} verified trade ` +
    `profit — leaving an estimated USD ${usd(q.exporter_net_profit_usd)} net.${aggressive}${collateral}${cheaper}${paused}`
  );
}

/** Evidence graph (AI-7): each price component with the evidence behind it. */
function buildEvidenceGraph(core, collateralFloor, evidence) {
  const intelCites = (evidence.intel ?? []).map((i) => `${i.id} (${i.source})`);
  const docIssues = evidence.documents?.issues ?? [];
  const floorPrice = Number.isFinite(collateralFloor) ? round(collateralFloor, 4) : null;
  return [
    {
      component: 'base_issue_price',
      price_usd: core.base_issue_price_usd,
      basis: `Patient-money anchor: LOW_COST gives up ${pct(BASE_PROFIT_SHARE.LOW_COST)}% of verified profit`,
      evidence: [`verified gross profit USD ${usd(core.exporter_gross_profit_usd)} = invoice - cost_of_goods`]
    },
    {
      component: 'urgency_discount',
      discount_bps: core.urgency_discount_bps,
      basis: `${core.payout_speed} payout gives up ${pct(BASE_PROFIT_SHARE[core.payout_speed])}% of profit for speed`,
      evidence: [`payout_speed = ${core.payout_speed}`]
    },
    {
      component: 'risk_discount',
      discount_bps: core.risk_discount_bps,
      basis: `${core.risk_level} trade risk (${core.risk_score_bps}bps) widens the discount`,
      evidence: [...core.risk_factors, ...intelCites, ...docIssues.map((d) => `doc: ${d}`)]
    },
    {
      component: 'collateral_floor',
      price_usd: floorPrice,
      basis: `Safe redemption coverage caps exposure (collateral x ${core.redemption_coverage_limit})`,
      evidence: [`AI-verified collateral USD ${usd(core.ai_verified_collateral_value_usd)} -> max safe USD ${usd(core.max_safe_redemption_exposure_usd)}`],
      binding: core.binding_constraint === 'COLLATERAL'
    }
  ];
}

/**
 * Core pricing policy. Pure function of explicit numbers — no case parsing, no
 * network. This is what the unit / invariant tests target.
 *
 * @param {object} input
 *   case_id, bl_id, payout_speed,
 *   requested_cash_usd, gross_profit_usd, cost_of_goods_usd,
 *   ai_verified_collateral_value_usd, redemption_coverage_limit,
 *   risk_discount_bps, risk_level, risk_factors,
 *   invoice_value_usd?, target_redemption_value_usd?=1
 * @returns {object} a complete PricingQuote
 */
export function priceRwaOffering(input) {
  const speed = input.payout_speed;
  if (!PAYOUT_SPEEDS.includes(speed)) throw new Error(`Unknown payout_speed: ${speed}`);

  const cash = Number(input.requested_cash_usd);
  const profit = Math.max(1, Number(input.gross_profit_usd)); // guard /0
  const collateral = Number(input.ai_verified_collateral_value_usd);
  const coverage = Number(input.redemption_coverage_limit ?? 0.9);
  const target = Number(input.target_redemption_value_usd ?? 1);
  const riskScoreBps = Number(input.risk_score_bps ?? input.risk_discount_bps ?? 0);
  const riskLevel = input.risk_level ?? riskLevelFromBps(riskScoreBps);

  const maxSafeRedemption = round(collateral * coverage, 2);

  // Profit-share model.
  const baseShare = BASE_PROFIT_SHARE[speed];
  const riskShare = clamp(riskScoreBps / RISK_BPS_PER_PROFIT_SHARE, 0, MAX_RISK_PROFIT_SHARE);
  const totalShare = baseShare + riskShare;
  const paused = totalShare > MAX_PROFIT_SHARE;
  const effectiveShare = Math.min(totalShare, MAX_PROFIT_SHARE);

  // Additive decomposition (pre-floor) for the AI Pricing Console waterfall.
  const anchorPrice = priceFromShare(cash, BASE_PROFIT_SHARE.LOW_COST, profit); // patient-money anchor
  const speedPrice = priceFromShare(cash, baseShare, profit);
  const indicativePrice = priceFromShare(cash, effectiveShare, profit);
  const urgencyDiscountBps = Math.max(0, bps(anchorPrice - speedPrice));
  const riskDiscountBps = Math.max(0, bps(speedPrice - indicativePrice));

  // Collateral coverage guardrail (AI-5): final price can only be lifted by it.
  const collateralFloor = maxSafeRedemption > 0 ? cash / maxSafeRedemption : Infinity;
  let finalPrice = Math.max(indicativePrice, collateralFloor);
  let binding = finalPrice > indicativePrice + 1e-9 ? 'COLLATERAL' : 'EXPORTER_PROFIT';
  if (finalPrice > MAX_PRICE || finalPrice < MIN_PRICE) {
    finalPrice = clamp(finalPrice, MIN_PRICE, MAX_PRICE);
    binding = 'PRICE_CLAMP';
  }
  finalPrice = round(finalPrice, 4);

  // Size the offering. Floor the supply so redemption can never exceed coverage.
  const supplyFromCash = cash / finalPrice;
  const tokenSupply = Math.floor(Math.min(supplyFromCash, maxSafeRedemption));
  const redemptionExposure = round(tokenSupply * target, 2);
  const expectedCash = round(tokenSupply * finalPrice, 2);
  const financingCost = round(redemptionExposure - expectedCash, 2);
  const profitShare = financingCost / profit;
  const netProfit = round(profit - financingCost, 2);
  const impliedYieldBps = bps(target / finalPrice - 1);

  // A *material* funding shortfall (requested cash cannot be served within safe
  // collateral coverage) pauses the offering; sub-0.5% rounding shortfalls do not.
  const materialShortfall = expectedCash < cash * 0.995;
  const pricingAction = pickPricingAction({
    riskLevel,
    paused: paused || materialShortfall,
    profitShare,
    payoutSpeed: speed,
    binding
  });

  const core = {
    case_id: input.case_id,
    bl_id: input.bl_id,
    payout_speed: speed,
    target_redemption_value_usd: target,
    ai_verified_collateral_value_usd: round(collateral, 2),
    redemption_coverage_limit: coverage,
    max_safe_redemption_exposure_usd: maxSafeRedemption,
    requested_cash_usd: round(cash, 2),
    exporter_cost_of_goods_usd: round(Number(input.cost_of_goods_usd ?? 0), 2),
    exporter_gross_profit_usd: round(profit, 2),
    exporter_gross_margin_pct: input.invoice_value_usd
      ? round(profit / Number(input.invoice_value_usd), 4)
      : 0,
    base_issue_price_usd: round(anchorPrice, 4),
    urgency_discount_bps: urgencyDiscountBps,
    risk_discount_bps: riskDiscountBps,
    indicative_issue_price_usd: round(indicativePrice, 4),
    final_issue_price_usd: finalPrice,
    binding_constraint: binding,
    recommended_token_supply: tokenSupply,
    target_redemption_exposure_usd: redemptionExposure,
    expected_cash_to_exporter_usd: expectedCash,
    financing_cost_usd: financingCost,
    exporter_profit_share_bps: bps(profitShare),
    exporter_net_profit_usd: netProfit,
    implied_gross_yield_bps: impliedYieldBps,
    risk_level: riskLevel,
    risk_score_bps: riskScoreBps,
    risk_factors: input.risk_factors ?? [],
    pricing_action: pricingAction
  };

  // Evidence graph (AI-7) — each component with the evidence behind it.
  const evidence = input.evidence ?? {};
  core.evidence_graph = buildEvidenceGraph(core, collateralFloor, evidence);

  // Explanations (AI-6) reference the computed numbers above.
  core.investor_explanation = buildInvestorExplanation(core);
  core.exporter_explanation = buildExporterExplanation(core);

  // BE-8: two hashes for the on-chain RiskPricingOracle.
  //   evidence_hash anchors the INPUTS behind the price (valuation, risk, docs);
  //   quote_hash anchors the TERMS the pool opens with (price, supply, action).
  core.evidence_hash = hashEvidence({
    collateral: core.ai_verified_collateral_value_usd,
    max_safe: core.max_safe_redemption_exposure_usd,
    gross_profit: core.exporter_gross_profit_usd,
    risk_score_bps: core.risk_score_bps,
    risk_factors: core.risk_factors,
    documents: evidence.documents?.checks ?? null,
    intel: (evidence.intel ?? []).map((i) => i.id)
  });
  core.quote_hash = hashEvidence({
    case_id: core.case_id,
    bl_id: core.bl_id,
    payout_speed: core.payout_speed,
    final_issue_price_usd: core.final_issue_price_usd,
    recommended_token_supply: core.recommended_token_supply,
    target_redemption_exposure_usd: core.target_redemption_exposure_usd,
    target_redemption_value_usd: core.target_redemption_value_usd,
    pricing_action: core.pricing_action
  });

  return core;
}

/** Pull the deterministic collateral valuation straight from the case data. */
function collateralFromCase(caseData) {
  const cargo = caseData.cargo ?? {};
  const bl = caseData.bill_of_lading ?? {};
  const market = caseData.market ?? {};
  const invoice = caseData.commercial_invoice ?? {};
  const insurance = caseData.insurance ?? {};
  const financing = caseData.financing ?? {};

  const quantityMt = Number(cargo.quantity_mt ?? bl.quantity_mt ?? cargo.quantity);
  // Landed price per MT: explicit, else reference+premium, else from per-bbl.
  let landedPerMt = Number(market.landed_price_usd_per_mt);
  if (!Number.isFinite(landedPerMt)) {
    const ref = Number(market.reference_price_usd_per_mt);
    const prem = Number(market.regional_premium_usd_per_mt ?? 0);
    if (Number.isFinite(ref)) landedPerMt = ref + prem;
  }
  if (!Number.isFinite(landedPerMt)) {
    const perBbl = Number(market.landed_price_usd_per_bbl ?? market.reference_price_usd_per_bbl);
    const bblPerMt = Number(market.bbl_per_mt ?? cargo.bbl_per_mt);
    if (Number.isFinite(perBbl) && Number.isFinite(bblPerMt)) landedPerMt = perBbl * bblPerMt;
  }

  const declared = Number(invoice.total_amount_usd ?? bl.declared_value_usd);
  const insured = Number(insurance.insured_value_usd);
  const coverage = Number(financing.redemption_coverage_limit ?? 0.9);

  return computeCargoValuation({
    quantity_mt: quantityMt,
    market_price_usd_per_mt: Number.isFinite(landedPerMt) ? landedPerMt : declared / Math.max(1, quantityMt),
    premium_usd_per_mt: 0,
    declared_invoice_value_usd: declared,
    insured_value_usd: insured,
    volatility_haircut_pct: suggestHaircut(caseData),
    redemption_coverage_limit: coverage
  });
}

/** Derive the exporter's verified gross trade profit from the case. */
function profitFromCase(caseData) {
  const te = caseData.trade_economics ?? {};
  const invoice = Number(caseData.commercial_invoice?.total_amount_usd ?? caseData.bill_of_lading?.declared_value_usd);
  const cargo = caseData.cargo ?? {};
  const bl = caseData.bill_of_lading ?? {};
  const quantity = Number(cargo.quantity_mt ?? bl.quantity_mt ?? cargo.quantity);

  let costOfGoods;
  if (Number.isFinite(Number(te.cost_of_goods_usd))) costOfGoods = Number(te.cost_of_goods_usd);
  else if (Number.isFinite(Number(te.cost_basis_usd_per_mt)) && Number.isFinite(quantity)) {
    costOfGoods = Number(te.cost_basis_usd_per_mt) * quantity;
  } else if (Number.isFinite(Number(te.cost_basis_usd_per_unit)) && Number.isFinite(Number(cargo.quantity))) {
    costOfGoods = Number(te.cost_basis_usd_per_unit) * Number(cargo.quantity);
  } else if (Number.isFinite(Number(te.gross_margin_pct))) {
    costOfGoods = invoice * (1 - Number(te.gross_margin_pct));
  } else {
    // Conservative fallback: assume a 12% gross margin if the case omits economics.
    costOfGoods = invoice * 0.88;
  }

  // Always recompute profit/margin from the dollar figures so a stored typo
  // cannot silently mis-price (Plan review R4).
  const grossProfit = Math.max(0, invoice - costOfGoods);
  return {
    invoice_value_usd: invoice,
    cost_of_goods_usd: costOfGoods,
    gross_profit_usd: grossProfit,
    gross_margin_pct: invoice > 0 ? grossProfit / invoice : 0
  };
}

/**
 * Produce a PricingQuote directly from a structured case (data/cases/*.json).
 * Deterministic and network-free.
 * @param {object} caseData
 * @param {object} [options] { payout_speed, requested_cash_usd }
 */
export function quoteFromCase(caseData, options = {}) {
  const valuation = collateralFromCase(caseData);
  const economics = profitFromCase(caseData);
  const risk = scoreRisk(caseData);
  const intel = retrieveRiskIntel(caseData, { k: 3 });
  const financing = caseData.financing ?? {};

  return priceRwaOffering({
    case_id: caseData.case_id,
    bl_id: caseData.bill_of_lading?.bl_id,
    payout_speed: options.payout_speed ?? financing.payout_speed ?? 'BALANCED',
    requested_cash_usd: Number(options.requested_cash_usd ?? financing.requested_cash_usd),
    gross_profit_usd: economics.gross_profit_usd,
    cost_of_goods_usd: economics.cost_of_goods_usd,
    invoice_value_usd: economics.invoice_value_usd,
    ai_verified_collateral_value_usd: valuation.ai_verified_collateral_value_usd,
    redemption_coverage_limit: valuation.redemption_coverage_limit,
    target_redemption_value_usd: Number(financing.target_redemption_value_usd ?? 1),
    risk_score_bps: risk.risk_score_bps,
    risk_level: risk.risk_level,
    risk_factors: risk.risk_factors,
    evidence: { documents: risk.document_checks, intel }
  });
}

/** Recommend a speed: the cheapest-financing option that still opens cleanly. */
function recommendSpeed(quotes) {
  const opens = quotes.filter((q) => q.pricing_action === 'OPEN_OFFERING');
  const pool = opens.length > 0 ? opens : quotes;
  // Prefer the one whose profit share is most "balanced" (closest to BALANCED base).
  return pool
    .slice()
    .sort((a, b) => a.exporter_profit_share_bps - b.exporter_profit_share_bps)
    .find((q) => q.payout_speed === 'BALANCED') ?? pool[0];
}

/**
 * Quote all three payout speeds for a case so the exporter can compare the
 * "speed vs cost-of-financing" trade-off side by side, plus a recommendation.
 */
export function compareSpeeds(caseData, options = {}) {
  const quotes = PAYOUT_SPEEDS.map((speed) => quoteFromCase(caseData, { ...options, payout_speed: speed }));
  const recommended = recommendSpeed(quotes);
  return {
    case_id: caseData.case_id,
    bl_id: caseData.bill_of_lading?.bl_id,
    quotes,
    recommended_payout_speed: recommended.payout_speed,
    recommended_quote: recommended
  };
}
