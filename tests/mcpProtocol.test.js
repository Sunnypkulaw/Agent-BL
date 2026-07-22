import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { assertPaidReportEnvelope } from '../src/x402/paidReport.js';

function parseTool(result) {
  assert.equal(result.isError, undefined, JSON.stringify(result));
  return JSON.parse(result.content.find((item) => item.type === 'text').text);
}

test('MCP-6/7/8: official SDK stdio lifecycle executes 7 tools + reads 3 resources', async () => {
  const client = new Client({ name: 'agentbl-protocol-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('src/mcp/standalone-server.js')],
    cwd: process.cwd(),
    stderr: 'pipe'
  });
  await client.connect(transport);
  try {
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 7);
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [
      'generate_pricing_quote',
      'get_trade_case',
      'purchase_premium_analysis',
      'push_pricing_to_oracle',
      'search_knowledge_base',
      'simulate_offering',
      'verify_trade_documents'
    ]);
    for (const tool of listed.tools) {
      assert.equal(tool.inputSchema.type, 'object');
      assert.ok(tool.description);
    }

    const caseId = 'CASE-EBL-2026-0001';
    const tradeCase = parseTool(await client.callTool({ name: 'get_trade_case', arguments: { case_id: caseId } }));
    assert.equal(tradeCase.result.case_id, caseId);
    const quote = parseTool(await client.callTool({ name: 'generate_pricing_quote', arguments: { case_id: caseId } }));
    assert.ok(quote.result.final_issue_price_usd > 0);
    const simulation = parseTool(await client.callTool({ name: 'simulate_offering', arguments: { case_id: caseId } }));
    assert.ok(simulation.result.steps.length > 0);
    const oracle = parseTool(await client.callTool({
      name: 'push_pricing_to_oracle',
      arguments: { case_id: caseId, pricing_quote: quote.result }
    }));
    assert.equal(oracle.result.status, 'dry_run');
    const search = parseTool(await client.callTool({
      name: 'search_knowledge_base',
      arguments: { query: 'copper shipping risk', limit: 2 }
    }));
    assert.ok(search.result.matches.length > 0);
    const documents = parseTool(await client.callTool({ name: 'verify_trade_documents', arguments: { case_id: caseId } }));
    assert.ok(Array.isArray(documents.result.checks));
    const purchase = parseTool(await client.callTool({
      name: 'purchase_premium_analysis',
      arguments: { case_id: caseId, kind: 'fraud-review', mode: 'demo' }
    }));
    assert.equal(purchase.result.payment.challenged, true);
    assertPaidReportEnvelope(purchase.result.report);

    const resources = await client.listResources();
    assert.equal(resources.resources.length, 3);
    assert.deepEqual(resources.resources.map((item) => item.uri).sort(), [
      'agentbl://cases/catalog',
      'agentbl://contracts/deployments',
      'agentbl://risk/methodology'
    ]);
    for (const resource of resources.resources) {
      const read = await client.readResource({ uri: resource.uri });
      assert.equal(read.contents.length, 1);
      assert.equal(read.contents[0].mimeType, 'application/json');
      assert.doesNotThrow(() => JSON.parse(read.contents[0].text));
    }
    await assert.rejects(() => client.readResource({ uri: 'agentbl://unknown' }));
  } finally {
    await client.close();
  }
});
