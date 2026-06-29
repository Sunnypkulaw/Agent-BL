import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { InjectiveMcpAdapter } from '../src/mcp/injectiveAdapter.js';
import chainConfig from '../scripts/lib/chain-config.cjs';

class FakeClient {
  calls = [];
  async connect() {}
  async listTools() { return { tools: [{ name: 'usdc_native_info' }, { name: 'evm_broadcast' }] }; }
  async callTool(request) {
    this.calls.push(request);
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, tool: request.name }) }] };
  }
  async close() {}
}

test('MCP-9: official Injective adapter queries and keeps writes dry-run by default', async () => {
  const client = new FakeClient();
  const adapter = new InjectiveMcpAdapter({ client, args: ['official-server.js'], transport: {} });
  await adapter.connect();
  const query = await adapter.queryNativeUsdc();
  assert.equal(query.tool, 'usdc_native_info');

  const config = chainConfig.resolveNetworkConfig(
    JSON.parse(await fs.readFile('public/chain-config.json', 'utf8')),
    'injective-testnet'
  );
  const result = await adapter.broadcastEvm({
    to: config.contracts.AgentBLRWA,
    data: '0x18e56131',
    dry_run: true
  });
  assert.equal(result.broadcast, false);
  assert.deepEqual(client.calls.map((call) => call.name), ['usdc_native_info']);
});
