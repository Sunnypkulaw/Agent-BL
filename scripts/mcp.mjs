#!/usr/bin/env node
// TradeShield MCP Tool Chain CLI Demo
// Runs the full 5-step MCP tool chain against the demo case

import { callTool, MCP_TOOLS_MANIFEST } from '../src/mcp/mcpServer.js';

const CASE_ID = process.env.CASE_ID || 'CASE-EBL-2026-0001';
let exitCode = 0;
let failed = 0;
let passed = 0;

function step(label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('='.repeat(60));
}

function success(message) {
  passed++;
  console.log(`  ✓ ${message}`);
}

function fail(message) {
  failed++;
  exitCode = 1;
  console.log(`  ✗ ${message}`);
}

function info(label, value) {
  console.log(`  ${label}: ${value}`);
}

// ============================================================
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║     TradeShield MCP Tool Chain — CLI Demo               ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// ============================================================
// MCP-1: Tools Manifest
// ============================================================
step('MCP-1: Tools Manifest');
try {
  info('Available tools', MCP_TOOLS_MANIFEST.length);
  for (const tool of MCP_TOOLS_MANIFEST) {
    console.log(`    • ${tool.name}`);
    console.log(`      ${tool.description.slice(0, 80)}...`);
  }
  success('Tools manifest loaded');
} catch (err) {
  fail(`Manifest error: ${err.message}`);
}

// ============================================================
// MCP-2: get_trade_case
// ============================================================
step(`MCP-2: get_trade_case("${CASE_ID}")`);
let caseData;

try {
  const result = await callTool('get_trade_case', { case_id: CASE_ID });
  caseData = result.result;
  const bl = caseData.bill_of_lading;
  info('Case ID', caseData.case_id);
  info('Shipper', bl.shipper);
  info('Consignee', bl.consignee);
  info('Route', `${bl.port_of_loading} → ${bl.port_of_discharge}`);
  info('Cargo', `${bl.quantity_mt} MT ${bl.cargo}`);
  info('Declared Value', `$${bl.declared_value_usd.toLocaleString()}`);
  info('Vessel', bl.vessel);
  info('Shipment Events', caseData.shipment_events.length);
  success('Trade case loaded successfully');
} catch (err) {
  fail(`get_trade_case failed: ${err.message}`);
}

// ============================================================
// MCP-3: generate_pricing_quote
// ============================================================
step('MCP-3: generate_pricing_quote');
let pricingQuote;

try {
  await callTool('search_knowledge_base', {
    query: `${caseData.bill_of_lading.port_of_loading} ${caseData.bill_of_lading.port_of_discharge} ${caseData.bill_of_lading.cargo}`,
    limit: 5
  });

  const result = await callTool('generate_pricing_quote', {
    trade_case: caseData
  });
  pricingQuote = result.result;
  info('AI Verified Collateral', `$${pricingQuote.ai_verified_collateral_value_usd.toLocaleString()}`);
  info('Max Safe Exposure', `$${pricingQuote.max_safe_redemption_exposure_usd.toLocaleString()}`);
  info('Requested Cash', `$${pricingQuote.requested_cash_usd.toLocaleString()}`);
  info('Recommended Supply', `${pricingQuote.recommended_token_supply.toLocaleString()} RWA`);
  console.log('');
  info('Base Issue Price', `$${pricingQuote.base_issue_price_usd.toFixed(2)}`);
  info('Risk Discount', `${pricingQuote.risk_discount_bps} bps`);
  info('Final Issue Price', `$${pricingQuote.final_issue_price_usd.toFixed(2)}`);
  info('Implied Gross Yield', `${pricingQuote.implied_gross_yield_bps} bps (${(pricingQuote.implied_gross_yield_bps / 100).toFixed(1)}%)`);
  console.log('');
  info('Risk Level', pricingQuote.risk_level);
  info('Pricing Action', pricingQuote.pricing_action);
  info('Risk Factors', pricingQuote.risk_factors.join(', ') || 'none');
  info('Investor Explanation', pricingQuote.investor_explanation);
  console.log('');
  info('Evidence Hash', `${pricingQuote.evidence_hash.slice(0, 24)}...`);
  info('Quote Hash', `${pricingQuote.quote_hash.slice(0, 24)}...`);
  success('Pricing quote generated');
} catch (err) {
  fail(`generate_pricing_quote failed: ${err.message}`);
}

// ============================================================
// RAG: search_knowledge_base
// ============================================================
step('RAG: Risk Intelligence Search');
try {
  const queries = [
    'Red Sea Houthi attack shipping',
    'Indian Ocean monsoon',
    'copper price decline LME',
    'Hamburg port congestion'
  ];

  for (const query of queries) {
    const result = await callTool('search_knowledge_base', { query, limit: 3 });
    info(`"${query}"`, `${result.result.match_count} matches`);
    for (const m of result.result.matches.slice(0, 2)) {
      console.log(`      [${m.severity}] ${m.title.slice(0, 60)}...`);
    }
  }
  success('Risk intelligence searches completed');
} catch (err) {
  fail(`search_knowledge_base failed: ${err.message}`);
}

// ============================================================
// MCP-4: simulate_offering
// ============================================================
step('MCP-4: simulate_offering');
try {
  const result = await callTool('simulate_offering', { trade_case: caseData });
  const wf = result.result;
  info('Final State', wf.final_state);
  info('Offering State', wf.offering_state);
  info('Total Steps', wf.steps.length);
  console.log('');
  for (const [i, step] of wf.steps.entries()) {
    console.log(`  ${i + 1}. [${step.state}] ${step.actor}: ${step.event}`);
  }
  console.log('');
  info('Contract Action', wf.risk_report.contract_action);
  info('Risk Level', wf.risk_report.risk_level);
  info('Health Factor', wf.risk_report.health_factor.toFixed(4));
  info('Cargo Health', wf.risk_report.cargo_health_score);
  success('Offering simulation completed');
} catch (err) {
  fail(`simulate_offering failed: ${err.message}`);
}

// ============================================================
// MCP-5: push_pricing_to_oracle
// ============================================================
step('MCP-5: push_pricing_to_oracle');
try {
  const result = await callTool('push_pricing_to_oracle', {
    case_id: CASE_ID,
    pricing_quote: pricingQuote
  });
  const tx = result.result;
  info('Transaction Hash', tx.tx_hash);
  info('Block Number', tx.block_number.toLocaleString());
  info('Status', tx.status);
  info('Confirmations', tx.confirmations);
  info('Gas Used', tx.gas_used.toLocaleString());
  info('Contract', tx.contract_address);
  console.log('');
  info('Event', tx.event);
  info('Event Args', JSON.stringify(tx.event_args, null, 2).replace(/^/gm, '    '));
  success('Pricing pushed to oracle');
} catch (err) {
  fail(`push_pricing_to_oracle failed: ${err.message}`);
}

// ============================================================
// Summary
// ============================================================
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║              MCP Tool Chain Complete                    ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
console.log(`  Case: ${CASE_ID}`);
if (pricingQuote) {
  console.log(`  Final Price: $${pricingQuote.final_issue_price_usd.toFixed(2)}`);
  console.log(`  Yield: ${pricingQuote.implied_gross_yield_bps} bps`);
  console.log(`  Risk: ${pricingQuote.risk_level}`);
  console.log(`  Action: ${pricingQuote.pricing_action}`);
}
console.log('');

process.exit(exitCode);
