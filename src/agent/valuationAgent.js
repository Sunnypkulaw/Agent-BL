// TradeShield AI valuation agent.
//
// Orchestrates the copper-cathode market valuation:
//   1. live LME-linked price   2. regional premium
//   3. historical comparable trade prices (HS code)   4. deterministic valuation
//
// Two execution paths, identical output shape:
//   - LLM path: an OpenAI-compatible model (DeepSeek/Qwen) drives the tool calls.
//   - Deterministic fallback: when no LLM key is set, we call the same tools in
//     a fixed order and template the explanation. The demo therefore always runs.

import { chatCompletion, isConfigured, resolveProvider } from './llm/openaiCompatClient.js';
import {
  TOOL_SPECS,
  TOOL_EXECUTORS,
  getLiveCommodityPrice,
  getRegionalPhysicalPremium,
  getHistoricalComparableTrades,
  computeCargoValuation
} from './tools/copperValuationTools.js';

const SYSTEM_PROMPT = `You are TradeShield's AI Pricing & Risk valuation analyst.
Given a trade case backed by an electronic bill of lading, value the cargo so the protocol can price an RWA discount.
Workflow:
1. Call get_live_commodity_price for the commodity.
2. Call get_regional_physical_premium for the discharge market.
3. Call get_historical_comparable_trades for the cargo's HS code to sanity-check the price level.
4. Decide a volatility haircut (0-0.10) reflecting the macro risk events (war premium, commodity volatility).
5. Call compute_cargo_valuation LAST with the gathered numbers.
Then write a 2-4 sentence investor-facing explanation of the verified collateral value and why the haircut applies.
Be conservative: the verified collateral value is the floor the RWA issuance is sized against. Do not overstate value at war-premium highs.`;

/** Suggest a volatility haircut from macro risk events (used by both paths / as guidance). */
export function suggestHaircut(caseData) {
  let haircut = 0;
  for (const event of caseData.macro_risk_events ?? []) {
    if (event.type === 'war_risk') haircut += event.severity === 'critical' ? 0.04 : 0.02;
    if (event.type === 'commodity_volatility') haircut += event.severity === 'critical' ? 0.05 : 0.03;
  }
  return Math.min(0.1, Math.round(haircut * 100) / 100);
}

function caseFacts(caseData) {
  const cargo = caseData.cargo ?? {};
  const invoice = caseData.commercial_invoice ?? {};
  const insurance = caseData.insurance ?? {};
  const financing = caseData.financing ?? {};
  return {
    commodity: cargo.commodity ?? 'Copper Cathode',
    hs_code: String(cargo.hs_code ?? '740311'),
    quantity_mt: Number(cargo.quantity_mt ?? cargo.quantity),
    destination: (caseData.bill_of_lading?.port_of_discharge ?? 'Shanghai').split('(')[0].trim(),
    declared_invoice_value_usd: Number(invoice.total_amount_usd ?? caseData.bill_of_lading?.declared_value_usd),
    insured_value_usd: Number(insurance.insured_value_usd),
    redemption_coverage_limit: Number(financing.redemption_coverage_limit ?? 0.9),
    macro: caseData.macro_risk_events ?? []
  };
}

function buildUserPrompt(caseData) {
  const f = caseFacts(caseData);
  return `Trade case ${caseData.case_id}:
- Commodity: ${f.commodity} (HS ${f.hs_code}), quantity ${f.quantity_mt} MT
- Discharge market: ${f.destination}
- Declared invoice value: USD ${f.declared_invoice_value_usd}
- Insured value: USD ${f.insured_value_usd}
- Redemption coverage limit: ${f.redemption_coverage_limit}
- Macro risk events: ${f.macro.map((e) => `${e.type}/${e.severity} (${e.region})`).join('; ') || 'none'}
Value this cargo using the tools and return the verified collateral value.`;
}

function parseArgs(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

/** Run the LLM-driven tool-calling loop, capturing tool outputs. */
async function runWithLlm(caseData, env, maxIterations, chat = chatCompletion) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(caseData) }
  ];
  const captured = {};
  const toolTrace = [];

  for (let i = 0; i < maxIterations; i += 1) {
    const message = await chat({ messages, tools: TOOL_SPECS }, env);
    messages.push(message);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { explanation: (message.content ?? '').trim(), captured, toolTrace };
    }

    for (const call of toolCalls) {
      const name = call.function?.name;
      const args = parseArgs(call.function?.arguments);
      const executor = TOOL_EXECUTORS[name];
      let result;
      try {
        result = executor ? await executor(args, env) : { error: `unknown tool ${name}` };
      } catch (error) {
        result = { error: error.message };
      }
      captured[name] = result;
      toolTrace.push({ tool: name, args, source: result?.source ?? null });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return { explanation: '(max tool iterations reached)', captured, toolTrace };
}

/** Deterministic path: call the tools in order, template the explanation. */
async function runDeterministic(caseData, env) {
  const f = caseFacts(caseData);
  const toolTrace = [];
  const captured = {};

  captured.get_live_commodity_price = await getLiveCommodityPrice({ commodity: f.commodity }, env);
  toolTrace.push({ tool: 'get_live_commodity_price', args: { commodity: f.commodity }, source: captured.get_live_commodity_price.source });

  captured.get_regional_physical_premium = await getRegionalPhysicalPremium({ destination: f.destination, commodity: f.commodity }, env);
  toolTrace.push({ tool: 'get_regional_physical_premium', args: { destination: f.destination, commodity: f.commodity }, source: captured.get_regional_physical_premium.source });

  captured.get_historical_comparable_trades = await getHistoricalComparableTrades({ hs_code: f.hs_code, reporter_code: '156' }, env);
  toolTrace.push({ tool: 'get_historical_comparable_trades', args: { hs_code: f.hs_code, reporter_code: '156' }, source: captured.get_historical_comparable_trades.source });

  const haircut = suggestHaircut(caseData);
  const valuationArgs = {
    quantity_mt: f.quantity_mt,
    market_price_usd_per_mt: captured.get_live_commodity_price.price_usd_per_mt,
    premium_usd_per_mt: captured.get_regional_physical_premium.premium_usd_per_mt,
    declared_invoice_value_usd: f.declared_invoice_value_usd,
    insured_value_usd: f.insured_value_usd,
    volatility_haircut_pct: haircut,
    redemption_coverage_limit: f.redemption_coverage_limit
  };
  captured.compute_cargo_valuation = computeCargoValuation(valuationArgs);
  toolTrace.push({ tool: 'compute_cargo_valuation', args: valuationArgs, source: 'local-deterministic' });

  const v = captured.compute_cargo_valuation;
  const explanation = `Verified collateral value USD ${v.ai_verified_collateral_value_usd} = ${v.valuation_basis}. `
    + `Live ${f.commodity} ~USD ${captured.get_live_commodity_price.price_usd_per_mt}/MT plus a USD ${captured.get_regional_physical_premium.premium_usd_per_mt}/MT ${f.destination} premium. `
    + `A ${Math.round(haircut * 100)}% haircut is applied because prices sit at war-premium highs (Strait of Hormuz), so the issuance is sized against a conservative floor of USD ${v.max_safe_redemption_exposure_usd}.`;

  return { explanation, captured, toolTrace };
}

function assembleReport(caseData, { explanation, captured, toolTrace }, provider) {
  const f = caseFacts(caseData);
  const live = captured.get_live_commodity_price ?? {};
  const premium = captured.get_regional_physical_premium ?? {};
  const hist = captured.get_historical_comparable_trades ?? {};

  // Guarantee a valuation even if the LLM skipped the compute tool.
  const valuation = captured.compute_cargo_valuation ?? computeCargoValuation({
    quantity_mt: f.quantity_mt,
    market_price_usd_per_mt: live.price_usd_per_mt,
    premium_usd_per_mt: premium.premium_usd_per_mt ?? 0,
    declared_invoice_value_usd: f.declared_invoice_value_usd,
    insured_value_usd: f.insured_value_usd,
    volatility_haircut_pct: suggestHaircut(caseData),
    redemption_coverage_limit: f.redemption_coverage_limit
  });

  return {
    case_id: caseData.case_id,
    commodity: f.commodity,
    hs_code: f.hs_code,
    quantity_mt: f.quantity_mt,
    live_market: {
      price_usd_per_mt: live.price_usd_per_mt ?? null,
      regional_premium_usd_per_mt: premium.premium_usd_per_mt ?? null,
      landed_price_usd_per_mt: valuation.landed_price_usd_per_mt ?? null,
      as_of: live.as_of ?? null,
      sources: [live.source, premium.source].filter(Boolean)
    },
    historical_comparables: hist.comparables ?? [],
    historical_source: hist.source ?? null,
    valuation,
    ai_explanation: explanation,
    provider,
    tool_trace: toolTrace
  };
}

/**
 * Run the valuation agent on a case.
 * @param {object} caseData parsed case JSON (e.g. data/cases/copper-sg-shanghai.case.json)
 * @param {object} [options] { env, maxIterations, forceDeterministic, chat }
 *   options.chat overrides the chat-completion function (injected for testing the
 *   LLM -> deterministic fallback path without a network call).
 * @returns structured valuation report (market valuation + historical comparables)
 */
export async function runValuationAgent(caseData, options = {}) {
  const env = options.env ?? process.env;
  const maxIterations = options.maxIterations ?? 6;
  const chat = options.chat ?? chatCompletion;

  if (options.forceDeterministic || !isConfigured(env)) {
    const run = await runDeterministic(caseData, env);
    return assembleReport(caseData, run, 'deterministic-fallback');
  }

  const provider = resolveProvider(env)?.provider ?? 'llm';
  try {
    const run = await runWithLlm(caseData, env, maxIterations, chat);
    // If the model produced no usable numbers, backfill deterministically.
    if (!run.captured.get_live_commodity_price) {
      const det = await runDeterministic(caseData, env);
      return assembleReport(caseData, { ...det, explanation: run.explanation || det.explanation }, provider);
    }
    return assembleReport(caseData, run, provider);
  } catch (error) {
    const det = await runDeterministic(caseData, env);
    det.explanation = `[LLM error: ${error.message}; used deterministic fallback] ${det.explanation}`;
    return assembleReport(caseData, det, 'deterministic-fallback');
  }
}
