// SKILL-1: TradeShield Pricing Analyst
//
// Chains MCP tools: get_trade_case → search_knowledge_base → generate_pricing_quote
//
// This skill simulates an AI pricing analyst that:
// 1. Loads the trade case
// 2. Searches for relevant risk intelligence
// 3. Generates a complete pricing quote with risk assessment
//
// Input: { case_id: string, payout_speed?: 'FAST'|'BALANCED'|'LOW_COST' }
// Output: { skill, analysis: { case, risk_events, quote, chain } }

import { callTool } from '../mcp/mcpServer.js';

/**
 * Run the full pricing analyst workflow.
 *
 * @param {Object} params
 * @param {string} params.case_id - The trade case identifier
 * @param {'FAST'|'BALANCED'|'LOW_COST'} [params.payout_speed] - Exporter's payout preference
 * @returns {Promise<Object>} Skill execution result
 */
export async function runPricingAnalyst({ case_id, payout_speed } = {}) {
  if (!case_id) {
    throw new Error('SKILL-1: pricing-analyst requires case_id parameter');
  }

  const steps = [];
  const errors = [];

  // Step 1: Get the trade case
  let caseResult;
  try {
    caseResult = await callTool('get_trade_case', { case_id });
    steps.push({ step: 1, tool: 'get_trade_case', status: 'ok', summary: `Loaded case ${caseResult.result.case_id}` });
  } catch (err) {
    errors.push(`get_trade_case failed: ${err.message}`);
    steps.push({ step: 1, tool: 'get_trade_case', status: 'error', error: err.message });
    return { skill: 'tradeshield-pricing-analyst', status: 'failed', errors, steps };
  }

  const bl = caseResult.result.bill_of_lading;
  const market = caseResult.result.market;

  // Step 2: Search for relevant risk intelligence
  // Build a rich query from the trade case data
  const routeQuery = `${bl.port_of_loading} ${bl.port_of_discharge}`;
  const cargoQuery = `${bl.cargo} ${market.commodity}`;
  const fullQuery = `${routeQuery} ${cargoQuery} shipping risk`;

  let riskResult;
  try {
    riskResult = await callTool('search_knowledge_base', {
      query: fullQuery,
      limit: 5
    });
    const matchCount = riskResult.result.match_count;
    const topSeverities = riskResult.result.matches.slice(0, 3).map(m => m.severity);
    steps.push({
      step: 2,
      tool: 'search_knowledge_base',
      status: 'ok',
      summary: `Found ${matchCount} relevant risk intelligence entries (top severities: ${topSeverities.join(', ')})`
    });
  } catch (err) {
    errors.push(`search_knowledge_base failed: ${err.message}`);
    steps.push({ step: 2, tool: 'search_knowledge_base', status: 'error', error: err.message });
    // Continue anyway — pricing can work without RAG
    riskResult = { result: { matches: [], match_count: 0 } };
  }

  // Step 3: Generate pricing quote
  let quoteResult;
  try {
    quoteResult = await callTool('generate_pricing_quote', {
      trade_case: caseResult.result
    });
    const q = quoteResult.result;
    steps.push({
      step: 3,
      tool: 'generate_pricing_quote',
      status: 'ok',
      summary: `Issue price: $${q.final_issue_price_usd} | Risk: ${q.risk_level} | Yield: ${q.implied_gross_yield_bps} bps | Action: ${q.pricing_action}`
    });
  } catch (err) {
    errors.push(`generate_pricing_quote failed: ${err.message}`);
    steps.push({ step: 3, tool: 'generate_pricing_quote', status: 'error', error: err.message });
    return { skill: 'tradeshield-pricing-analyst', status: 'failed', errors, steps };
  }

  // Assemble the full analysis
  return {
    skill: 'tradeshield-pricing-analyst',
    status: errors.length > 0 ? 'partial' : 'ok',
    analysis: {
      case_id: case_id,
      payout_speed: payout_speed || 'BALANCED',
      route: `${bl.port_of_loading} → ${bl.port_of_discharge}`,
      cargo: `${bl.quantity_mt} MT ${bl.cargo}`,
      case: {
        bl_id: bl.bl_id,
        shipper: bl.shipper,
        consignee: bl.consignee,
        vessel: bl.vessel,
        declared_value_usd: bl.declared_value_usd,
        insured_value_usd: caseResult.result.insurance.insured_value_usd,
        requested_amount_usd: caseResult.result.financing.requested_amount_usd,
        initial_price: market.initial_price_usd_per_mt,
        current_price: market.current_price_usd_per_mt,
        shipment_events_count: caseResult.result.shipment_events.length
      },
      risk_intelligence: {
        match_count: riskResult.result.match_count,
        top_risks: (riskResult.result.matches || []).slice(0, 5).map(m => ({
          title: m.title,
          severity: m.severity,
          category: m.category,
          relevance_score: m._score
        }))
      },
      pricing_quote: quoteResult.result
    },
    chain: steps.map(s => s.tool),
    steps,
    errors: errors.length > 0 ? errors : undefined
  };
}
