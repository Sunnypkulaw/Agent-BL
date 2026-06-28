/**
 * MCP Server tests — AgentBL
 *
 * Tests the MCP tool handlers and standalone server capabilities.
 * verifies all 5+ tools work end-to-end with valid inputs.
 */

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { MCP_TOOLS_MANIFEST, MCP_TOOL_HANDLERS, callTool } from '../src/mcp/mcpServer.js';

describe('MCP Tool Manifest', () => {
  test('has at least 5 tools', () => {
    assert.ok(MCP_TOOLS_MANIFEST.length >= 5, `Expected >=5 tools, got ${MCP_TOOLS_MANIFEST.length}`);
  });

  test('all tools have required fields', () => {
    for (const tool of MCP_TOOLS_MANIFEST) {
      assert.ok(tool.name, `Tool missing name`);
      assert.ok(tool.description, `Tool ${tool.name} missing description`);
      assert.ok(tool.inputSchema, `Tool ${tool.name} missing inputSchema`);
    }
  });

  test('all manifest tools have handlers', () => {
    for (const tool of MCP_TOOLS_MANIFEST) {
      assert.ok(MCP_TOOL_HANDLERS[tool.name], `Tool ${tool.name} missing handler`);
    }
  });
});

describe('MCP Tool Handlers', () => {
  test('get_trade_case — loads demo case', async () => {
    const result = await MCP_TOOL_HANDLERS.get_trade_case({ case_id: 'CASE-EBL-2026-0001' });
    assert.ok(result.result, 'Should have result');
    assert.equal(result.result.case_id, 'CASE-EBL-2026-0001');
    assert.ok(result.result.bill_of_lading, 'Should have bill_of_lading');
  });

  test('get_trade_case — throws on missing case_id', async () => {
    await assert.rejects(
      () => MCP_TOOL_HANDLERS.get_trade_case({}),
      /Missing required parameter/
    );
  });

  test('get_trade_case — throws on unknown case', async () => {
    await assert.rejects(
      () => MCP_TOOL_HANDLERS.get_trade_case({ case_id: 'NONEXISTENT' }),
      /not found/
    );
  });

  test('generate_pricing_quote — prices demo case', async () => {
    const result = await MCP_TOOL_HANDLERS.generate_pricing_quote({ case_id: 'CASE-EBL-2026-0001' });
    assert.ok(result.result, 'Should have result');
    assert.ok(result.result.final_issue_price_usd > 0, 'Should have positive price');
    assert.ok(result.result.final_issue_price_usd <= 1, 'Should have price <= 1');
  });

  test('search_knowledge_base — finds results', async () => {
    const result = await MCP_TOOL_HANDLERS.search_knowledge_base({ query: 'copper' });
    assert.ok(result.result, 'Should have result');
    assert.ok(result.result.matches?.length > 0, 'Should have matches');
  });

  test('search_knowledge_base — respects limit', async () => {
    const result = await MCP_TOOL_HANDLERS.search_knowledge_base({ query: 'risk', limit: 2 });
    assert.ok(result.result.matches.length <= 2, 'Should respect limit');
  });

  test('simulate_offering — runs full lifecycle', async () => {
    const result = await MCP_TOOL_HANDLERS.simulate_offering({ case_id: 'CASE-EBL-2026-0001' });
    assert.ok(result.result, 'Should have result');
    assert.ok(result.result.steps?.length >= 2, 'Should have steps');
    assert.ok(result.result.final_state, 'Should have final_state');
  });

  test('push_pricing_to_oracle — produces oracle payload', async () => {
    const pricing = await MCP_TOOL_HANDLERS.generate_pricing_quote({ case_id: 'CASE-EBL-2026-0001' });
    const result = await MCP_TOOL_HANDLERS.push_pricing_to_oracle({
      case_id: 'CASE-EBL-2026-0001',
      pricing_quote: pricing.result
    });
    assert.ok(result.result, 'Should have result');
    const hasHash = result.result.evidence_hash?.startsWith('0x') || result.result.quote_hash?.startsWith('0x') || result.result.tx_hash?.startsWith('0x');
    assert.ok(hasHash, 'Should have some hash field');
  });
});

describe('MCP callTool Dispatcher', () => {
  test('dispatches known tool', async () => {
    const result = await callTool('get_trade_case', { case_id: 'CASE-EBL-2026-0001' });
    assert.equal(result.tool, 'get_trade_case');
    assert.ok(result.result);
  });

  test('throws on unknown tool', async () => {
    await assert.rejects(
      () => callTool('nonexistent_tool', {}),
      /Unknown tool/
    );
  });
});

describe('MCP Tool Chain', () => {
  test('pricing chain runs end-to-end', async () => {
    const { runToolChain, PRICING_CHAIN } = await import('../src/mcp/mcpServer.js');

    const chain = PRICING_CHAIN.map((step) => ({
      ...step,
      params: step.params?.case_id
        ? { case_id: 'CASE-EBL-2026-0001' }
        : step.params
    }));

    const adaptedChain = [
      { tool: 'get_trade_case', params: { case_id: 'CASE-EBL-2026-0001' } },
      {
        tool: 'search_knowledge_base',
        params: () => ({ query: 'copper Singapore Shanghai', limit: 3 })
      },
      {
        tool: 'generate_pricing_quote',
        params: { case_id: 'CASE-EBL-2026-0001' }
      }
    ];

    const results = await runToolChain(adaptedChain);
    assert.equal(results.length, 3, 'Should have 3 results');
    assert.ok(results[2].result?.final_issue_price_usd > 0, 'Final step should have price');
  });
});
