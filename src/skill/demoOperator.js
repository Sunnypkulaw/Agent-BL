// SKILL-2: TradeShield Demo Operator
//
// Full demo pipeline: runs the complete MCP tool chain and produces
// a demo-ready summary suitable for CLI output or API response.
//
// Chain: get_trade_case → search_knowledge_base → generate_pricing_quote
//        → simulate_offering → push_pricing_to_oracle
//
// Input: { case_id: string }
// Output: { skill, demo: { steps[], summary, full_chain_outputs } }

import { callTool } from '../mcp/mcpServer.js';

/**
 * Run the full demo operator workflow — all 5 MCP tools in sequence.
 *
 * @param {Object} params
 * @param {string} params.case_id - The trade case identifier
 * @returns {Promise<Object>} Skill execution result
 */
export async function runDemoOperator({ case_id } = {}) {
  if (!case_id) {
    throw new Error('SKILL-2: demo-operator requires case_id parameter');
  }

  const steps = [];
  const errors = [];
  const outputs = {};

  // Step 1: get_trade_case
  let caseResult;
  try {
    caseResult = await callTool('get_trade_case', { case_id });
    outputs.get_trade_case = caseResult.result;
    steps.push({ step: 1, tool: 'get_trade_case', status: 'ok', summary: `Loaded: ${caseResult.result.case_id}` });
  } catch (err) {
    errors.push(err.message);
    steps.push({ step: 1, tool: 'get_trade_case', status: 'error', error: err.message });
    return { skill: 'tradeshield-demo-operator', status: 'failed', errors, steps };
  }

  const bl = outputs.get_trade_case.bill_of_lading;

  // Step 2: search_knowledge_base
  try {
    const riskResult = await callTool('search_knowledge_base', {
      query: `${bl.port_of_loading} ${bl.port_of_discharge} ${bl.cargo} risk`,
      limit: 5
    });
    outputs.search_knowledge_base = riskResult.result;
    steps.push({
      step: 2,
      tool: 'search_knowledge_base',
      status: 'ok',
      summary: `Risk intelligence: ${riskResult.result.match_count} entries found`
    });
  } catch (err) {
    errors.push(err.message);
    steps.push({ step: 2, tool: 'search_knowledge_base', status: 'error', error: err.message });
    outputs.search_knowledge_base = { matches: [], match_count: 0 };
  }

  // Step 3: generate_pricing_quote
  try {
    const quoteResult = await callTool('generate_pricing_quote', {
      trade_case: outputs.get_trade_case
    });
    outputs.generate_pricing_quote = quoteResult.result;
    steps.push({
      step: 3,
      tool: 'generate_pricing_quote',
      status: 'ok',
      summary: `Price: $${quoteResult.result.final_issue_price_usd} | ${quoteResult.result.risk_level} | ${quoteResult.result.pricing_action}`
    });
  } catch (err) {
    errors.push(err.message);
    steps.push({ step: 3, tool: 'generate_pricing_quote', status: 'error', error: err.message });
    return { skill: 'tradeshield-demo-operator', status: 'failed', errors, steps };
  }

  // Step 4: simulate_offering
  try {
    const offeringResult = await callTool('simulate_offering', {
      trade_case: outputs.get_trade_case
    });
    outputs.simulate_offering = offeringResult.result;
    steps.push({
      step: 4,
      tool: 'simulate_offering',
      status: 'ok',
      summary: `Offering state: ${offeringResult.result.final_state} | ${offeringResult.result.steps.length} workflow steps`
    });
  } catch (err) {
    errors.push(err.message);
    steps.push({ step: 4, tool: 'simulate_offering', status: 'error', error: err.message });
    outputs.simulate_offering = null;
  }

  // Step 5: push_pricing_to_oracle
  try {
    const oracleResult = await callTool('push_pricing_to_oracle', {
      case_id: case_id,
      pricing_quote: outputs.generate_pricing_quote
    });
    outputs.push_pricing_to_oracle = oracleResult.result;
    steps.push({
      step: 5,
      tool: 'push_pricing_to_oracle',
      status: 'ok',
      summary: `Tx: ${oracleResult.result.tx_hash.slice(0, 18)}... | ${oracleResult.result.status} | Block ${oracleResult.result.block_number}`
    });
  } catch (err) {
    errors.push(err.message);
    steps.push({ step: 5, tool: 'push_pricing_to_oracle', status: 'error', error: err.message });
    outputs.push_pricing_to_oracle = null;
  }

  // Build the demo summary
  const quote = outputs.generate_pricing_quote;
  const offering = outputs.simulate_offering;
  const oracle = outputs.push_pricing_to_oracle;

  return {
    skill: 'tradeshield-demo-operator',
    status: errors.length > 0 ? 'partial' : 'ok',
    demo: {
      case_id: case_id,
      route: `${bl.port_of_loading} → ${bl.port_of_discharge}`,
      cargo: `${bl.quantity_mt} MT ${bl.cargo}`,
      summary: {
        verified_collateral: quote.ai_verified_collateral_value_usd,
        requested_cash: quote.requested_cash_usd,
        final_issue_price: quote.final_issue_price_usd,
        risk_level: quote.risk_level,
        pricing_action: quote.pricing_action,
        implied_yield_bps: quote.implied_gross_yield_bps,
        investor_explanation: quote.investor_explanation,
        workflow_final_state: offering ? offering.final_state : 'unknown',
        oracle_tx_status: oracle ? oracle.status : 'failed',
        oracle_tx_hash: oracle ? oracle.tx_hash : null
      },
      timeline: [
        { stage: '1. Case Loaded', detail: `Trade case ${case_id} loaded: ${bl.cargo} from ${bl.shipper}` },
        { stage: '2. Risk Intelligence Gathered', detail: `${outputs.search_knowledge_base.match_count} risk events identified on the ${bl.port_of_loading} → ${bl.port_of_discharge} route` },
        { stage: '3. AI Priced RWA', detail: `Issue price $${quote.final_issue_price_usd} (${quote.risk_discount_bps} bps risk discount, ${quote.implied_gross_yield_bps} bps implied yield)` },
        { stage: '4. Offering Simulated', detail: `Workflow reached "${offering ? offering.final_state : 'unknown'}" state with action ${quote.pricing_action}` },
        { stage: '5. Oracle Updated', detail: `Pricing pushed on-chain: ${quote.evidence_hash.slice(0, 18)}... via tx ${oracle ? oracle.tx_hash.slice(0, 18) : 'N/A'}...` }
      ],
      chain: ['get_trade_case', 'search_knowledge_base', 'generate_pricing_quote', 'simulate_offering', 'push_pricing_to_oracle']
    },
    steps,
    errors: errors.length > 0 ? errors : undefined
  };
}
