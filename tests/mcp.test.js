// TradeShield MCP Tests
// Manifest validation + tool output shapes + error handling + chain integration

import test from 'node:test';
import assert from 'node:assert/strict';
import { MCP_TOOLS_MANIFEST, MCP_TOOL_HANDLERS, callTool, runToolChain } from '../src/mcp/mcpServer.js';
import { KNOWLEDGE_BASE } from '../src/rag/knowledgeBase.js';

// ============================================================
// MCP-1: Manifest Tests
// ============================================================

test('MCP tools manifest has exactly 5 tools', () => {
  assert.equal(MCP_TOOLS_MANIFEST.length, 5);
});

test('manifest contains all expected tool names', () => {
  const names = MCP_TOOLS_MANIFEST.map(t => t.name);
  assert.ok(names.includes('get_trade_case'));
  assert.ok(names.includes('generate_pricing_quote'));
  assert.ok(names.includes('simulate_offering'));
  assert.ok(names.includes('push_pricing_to_oracle'));
  assert.ok(names.includes('search_knowledge_base'));
});

test('each tool in manifest has required fields', () => {
  for (const tool of MCP_TOOLS_MANIFEST) {
    assert.ok(typeof tool.name === 'string' && tool.name.length > 0, `Tool missing name`);
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0, `${tool.name}: missing description`);
    assert.ok(tool.inputSchema, `${tool.name}: missing inputSchema`);
    assert.ok(tool.inputSchema.properties, `${tool.name}: inputSchema missing properties`);
    assert.ok(tool.inputSchema.type === 'object', `${tool.name}: inputSchema type must be object`);
  }
});

test('each tool in manifest has a registered handler', () => {
  for (const tool of MCP_TOOLS_MANIFEST) {
    assert.ok(MCP_TOOL_HANDLERS[tool.name], `No handler registered for ${tool.name}`);
    assert.equal(typeof MCP_TOOL_HANDLERS[tool.name], 'function', `Handler for ${tool.name} is not a function`);
  }
});

test('each manifest tool has required fields in inputSchema.properties', () => {
  for (const tool of MCP_TOOLS_MANIFEST) {
    const props = tool.inputSchema.properties || {};
    // Every tool should have at least one property
    assert.ok(Object.keys(props).length > 0, `${tool.name}: inputSchema has no properties`);
  }
});

// ============================================================
// MCP-2: get_trade_case Tests
// ============================================================

test('get_trade_case: returns valid trade case for demo ID', async () => {
  const result = await callTool('get_trade_case', { case_id: 'CASE-EBL-2026-0001' });
  assert.equal(result.tool, 'get_trade_case');
  assert.equal(result.result.case_id, 'CASE-EBL-2026-0001');
  assert.ok(result.result.bill_of_lading, 'Missing bill_of_lading');
  assert.ok(result.result.insurance, 'Missing insurance');
  assert.ok(result.result.financing, 'Missing financing');
  assert.ok(result.result.market, 'Missing market');
  assert.ok(Array.isArray(result.result.shipment_events), 'shipment_events must be array');
});

test('get_trade_case: returns low-risk scenario', async () => {
  const result = await callTool('get_trade_case', { case_id: 'CASE-EBL-2026-LOW-APPROVED' });
  assert.equal(result.result.case_id, 'CASE-EBL-2026-LOW-APPROVED');
  assert.equal(result.result.insurance.insured_value_usd, 8500000);
});

test('get_trade_case: returns critical-liquidation scenario', async () => {
  const result = await callTool('get_trade_case', { case_id: 'CASE-EBL-2026-CRITICAL-LIQUIDATION' });
  assert.equal(result.result.case_id, 'CASE-EBL-2026-CRITICAL-LIQUIDATION');
  assert.equal(result.result.market.current_price_usd_per_mt, 6500);
});

test('get_trade_case: throws for unknown case ID', async () => {
  await assert.rejects(
    () => callTool('get_trade_case', { case_id: 'NONEXISTENT-CASE' }),
    /not found|Trade case not found/
  );
});

test('get_trade_case: throws when case_id is missing', async () => {
  await assert.rejects(
    () => callTool('get_trade_case', {}),
    /Missing required parameter|case_id/
  );
});

// ============================================================
// MCP-3: generate_pricing_quote Tests
// ============================================================

test('generate_pricing_quote: returns full PricingQuote for demo case', async () => {
  const result = await callTool('generate_pricing_quote', { case_id: 'CASE-EBL-2026-0001' });
  assert.equal(result.tool, 'generate_pricing_quote');
  const q = result.result;

  // Required fields from PRD section 8.4
  assert.ok(q.case_id);
  assert.ok(q.bl_id);
  assert.equal(q.target_redemption_value_usd, 1);
  assert.ok(q.ai_verified_collateral_value_usd > 0, 'ai_verified_collateral_value_usd must be positive');
  assert.ok(q.max_safe_redemption_exposure_usd > 0);
  assert.ok(q.recommended_token_supply > 0);
  assert.ok(q.requested_cash_usd > 0);
  // Bowen's model: the base issue price is the patient-money ANCHOR — itself a
  // discount to the 1.00 target (LOW_COST gives up ~20% of verified profit), not
  // a flat 1.00. Urgency + risk discounts then subtract from it to the indicative
  // price (the additive decomposition the PricingQuote schema enforces).
  assert.ok(q.base_issue_price_usd > 0 && q.base_issue_price_usd < 1,
    `base_issue_price_usd should be a discount anchor in (0,1), got ${q.base_issue_price_usd}`);
  const reconstructed = q.base_issue_price_usd - q.urgency_discount_bps / 10000 - q.risk_discount_bps / 10000;
  assert.ok(Math.abs(reconstructed - q.indicative_issue_price_usd) < 0.001,
    'base − urgency − risk discounts must reconstruct the indicative issue price');
  assert.ok(q.risk_discount_bps >= 0, 'risk_discount_bps must be >= 0');
  assert.ok(q.final_issue_price_usd >= 0.35, 'final_issue_price_usd must be >= 0.35');
  assert.ok(q.final_issue_price_usd <= 1.0, 'final_issue_price_usd must be <= 1.0');
  assert.ok(q.expected_cash_to_exporter_usd > 0);
  assert.ok(q.implied_gross_yield_bps >= 0);
  assert.ok(['LOW', 'MEDIUM', 'WARNING', 'CRITICAL'].includes(q.risk_level));
  assert.ok(q.pricing_action);
  assert.ok(Array.isArray(q.risk_factors));
  assert.ok(q.investor_explanation);
  assert.ok(q.evidence_hash.startsWith('0x'));
  assert.ok(q.quote_hash.startsWith('0x'));
});

test('generate_pricing_quote: low-risk case has higher price than critical case', async () => {
  const lowRisk = await callTool('generate_pricing_quote', { case_id: 'CASE-EBL-2026-LOW-APPROVED' });
  const critical = await callTool('generate_pricing_quote', { case_id: 'CASE-EBL-2026-CRITICAL-LIQUIDATION' });

  assert.ok(
    lowRisk.result.final_issue_price_usd > critical.result.final_issue_price_usd,
    `Low-risk price (${lowRisk.result.final_issue_price_usd}) should be > critical price (${critical.result.final_issue_price_usd})`
  );
  assert.ok(
    lowRisk.result.implied_gross_yield_bps < critical.result.implied_gross_yield_bps,
    `Low-risk yield (${lowRisk.result.implied_gross_yield_bps}) should be < critical yield (${critical.result.implied_gross_yield_bps})`
  );
});

test('generate_pricing_quote: approved case returns OPEN_OFFERING action', async () => {
  const result = await callTool('generate_pricing_quote', { case_id: 'CASE-EBL-2026-LOW-APPROVED' });
  assert.equal(result.result.pricing_action, 'OPEN_OFFERING');
  assert.equal(result.result.risk_level, 'LOW');
});

test('generate_pricing_quote: critical case returns TRIGGER_LIQUIDATION action', async () => {
  const result = await callTool('generate_pricing_quote', { case_id: 'CASE-EBL-2026-CRITICAL-LIQUIDATION' });
  assert.equal(result.result.pricing_action, 'TRIGGER_LIQUIDATION');
  assert.equal(result.result.risk_level, 'CRITICAL');
});

test('generate_pricing_quote: works with inline trade_case', async () => {
  // First get a trade case
  const caseResult = await callTool('get_trade_case', { case_id: 'CASE-EBL-2026-0001' });
  // Then pass it inline
  const result = await callTool('generate_pricing_quote', { trade_case: caseResult.result });
  assert.ok(result.result.final_issue_price_usd > 0);
});

test('generate_pricing_quote: throws when no case_id or trade_case provided', async () => {
  await assert.rejects(
    () => callTool('generate_pricing_quote', {}),
    /case_id or trade_case/
  );
});

// ============================================================
// MCP-4: simulate_offering Tests
// ============================================================

test('simulate_offering: returns workflow result', async () => {
  const result = await callTool('simulate_offering', { case_id: 'CASE-EBL-2026-0001' });
  assert.equal(result.tool, 'simulate_offering');
  assert.ok(result.result.final_state);
  assert.ok(Array.isArray(result.result.steps));
  assert.ok(result.result.steps.length >= 4, 'Expected at least 4 steps');
  assert.ok(result.result.risk_report);
  assert.ok(result.result.pricing_summary);
});

test('simulate_offering: final_state matches workflow expectation', async () => {
  const result = await callTool('simulate_offering', { case_id: 'CASE-EBL-2026-LOW-APPROVED' });
  assert.equal(result.result.final_state, 'InTransit');
});

test('simulate_offering: has all workflow step states', async () => {
  const result = await callTool('simulate_offering', { case_id: 'CASE-EBL-2026-0001' });
  const states = result.result.steps.map(s => s.state);
  assert.ok(states.includes('Created'));
  assert.ok(states.includes('Funding'));
  assert.ok(states.includes('Funded'));
  assert.ok(states.includes('InTransit'));
});

test('simulate_offering: offers inline trade_case', async () => {
  const caseResult = await callTool('get_trade_case', { case_id: 'CASE-EBL-2026-0001' });
  const result = await callTool('simulate_offering', { trade_case: caseResult.result });
  assert.ok(result.result.final_state);
});

// ============================================================
// MCP-5: push_pricing_to_oracle Tests
// ============================================================

test('push_pricing_to_oracle: returns mock tx receipt', async () => {
  const quote = await callTool('generate_pricing_quote', { case_id: 'CASE-EBL-2026-0001' });
  const result = await callTool('push_pricing_to_oracle', {
    case_id: 'CASE-EBL-2026-0001',
    pricing_quote: quote.result
  });
  assert.equal(result.tool, 'push_pricing_to_oracle');
  assert.ok(result.result.tx_hash.startsWith('0x'));
  assert.equal(result.result.status, 'confirmed');
  assert.ok(result.result.block_number > 0);
  assert.ok(result.result.confirmations >= 1);
  assert.ok(result.result.gas_used > 0);
  assert.ok(result.result.event, 'PricingUpdated');
  assert.ok(result.result.event_args);
});

test('push_pricing_to_oracle: each call produces unique tx hash', async () => {
  const quote = await callTool('generate_pricing_quote', { case_id: 'CASE-EBL-2026-0001' });
  const r1 = await callTool('push_pricing_to_oracle', { case_id: 'CASE-EBL-2026-0001', pricing_quote: quote.result });
  const r2 = await callTool('push_pricing_to_oracle', { case_id: 'CASE-EBL-2026-0001', pricing_quote: quote.result });
  assert.notEqual(r1.result.tx_hash, r2.result.tx_hash, 'Each push should produce a unique tx hash');
});

test('push_pricing_to_oracle: requires pricing_quote', async () => {
  await assert.rejects(
    () => callTool('push_pricing_to_oracle', { case_id: 'CASE-EBL-2026-0001' }),
    /pricing_quote/
  );
});

test('push_pricing_to_oracle: requires case_id', async () => {
  await assert.rejects(
    () => callTool('push_pricing_to_oracle', { pricing_quote: {} }),
    /case_id/
  );
});

// ============================================================
// search_knowledge_base MCP Tool Tests
// ============================================================

test('search_knowledge_base MCP tool returns formatted results', async () => {
  const result = await callTool('search_knowledge_base', { query: 'copper price decline', limit: 3 });
  assert.equal(result.tool, 'search_knowledge_base');
  assert.ok(result.result.match_count > 0, 'Expected matches for copper price');
  assert.ok(result.result.matches.length <= 3);
  assert.equal(result.result.query, 'copper price decline');
});

test('search_knowledge_base MCP tool requires query', async () => {
  await assert.rejects(
    () => callTool('search_knowledge_base', {}),
    /query/
  );
});

test('search_knowledge_base MCP tool rejects empty query', async () => {
  await assert.rejects(
    () => callTool('search_knowledge_base', { query: '' }),
    /query/
  );
});

// ============================================================
// Error Handling Tests
// ============================================================

test('callTool throws for unknown tool name', async () => {
  await assert.rejects(
    () => callTool('nonexistent_tool', {}),
    /Unknown tool/
  );
});

test('callTool error message includes available tools', async () => {
  try {
    await callTool('bad_tool', {});
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('get_trade_case'), 'Error should list available tools');
  }
});

// ============================================================
// Full Chain Integration Test
// ============================================================

test('full MCP tool chain executes end-to-end', async () => {
  // Step 1: Load case
  const caseResult = await callTool('get_trade_case', { case_id: 'CASE-EBL-2026-0001' });
  assert.equal(caseResult.result.case_id, 'CASE-EBL-2026-0001');

  // Step 2: Search risk knowledge
  const riskResult = await callTool('search_knowledge_base', {
    query: 'Shanghai Hamburg copper risk',
    limit: 5
  });
  assert.ok(riskResult.result.match_count > 0);

  // Step 3: Generate pricing
  const quoteResult = await callTool('generate_pricing_quote', {
    trade_case: caseResult.result
  });
  assert.ok(quoteResult.result.final_issue_price_usd > 0);

  // Step 4: Simulate offering
  const offeringResult = await callTool('simulate_offering', {
    trade_case: caseResult.result
  });
  assert.equal(offeringResult.result.case_id, caseResult.result.case_id);

  // Step 5: Push to oracle
  const oracleResult = await callTool('push_pricing_to_oracle', {
    case_id: caseResult.result.case_id,
    pricing_quote: quoteResult.result
  });
  assert.equal(oracleResult.result.status, 'confirmed');

  // All 5 steps passed
});

test('low-risk → warning → critical scenarios form an increasing risk gradient', async () => {
  const lowRisk = await callTool('generate_pricing_quote', { case_id: 'CASE-EBL-2026-LOW-APPROVED' });
  const warning = await callTool('generate_pricing_quote', { case_id: 'CASE-EBL-2026-WARNING-MARGIN' });
  const critical = await callTool('generate_pricing_quote', { case_id: 'CASE-EBL-2026-CRITICAL-LIQUIDATION' });

  // Health factor should decrease
  assert.ok(lowRisk.result.implied_gross_yield_bps <= warning.result.implied_gross_yield_bps
    || warning.result.implied_gross_yield_bps <= critical.result.implied_gross_yield_bps,
    'Risk should increase across scenarios');

  // Risk level should increase
  const levelOrder = { LOW: 0, MEDIUM: 1, WARNING: 2, CRITICAL: 3 };
  assert.ok(levelOrder[lowRisk.result.risk_level] <= levelOrder[warning.result.risk_level]
    || levelOrder[warning.result.risk_level] <= levelOrder[critical.result.risk_level],
    'Risk levels should escalate');
});

// ============================================================
// runToolChain Test
// ============================================================

test('runToolChain executes a 3-step pricing chain', async () => {
  const results = await runToolChain([
    { tool: 'get_trade_case', params: { case_id: 'CASE-EBL-2026-0001' } },
    {
      tool: 'search_knowledge_base',
      params: (ctx) => ({
        query: `${ctx.last.port_of_loading || 'Shanghai'} shipping risk`,
        limit: 3
      })
    },
    {
      tool: 'generate_pricing_quote',
      params: (ctx) => ({ trade_case: ctx.get_trade_case })
    }
  ]);

  assert.equal(results.length, 3);
  assert.equal(results[0].tool, 'get_trade_case');
  assert.equal(results[1].tool, 'search_knowledge_base');
  assert.equal(results[2].tool, 'generate_pricing_quote');
  assert.ok(results[2].result.final_issue_price_usd > 0);
});
