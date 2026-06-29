import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { authorizeMcpWrite, MCP_PINNED_NETWORK } from './security.js';

function textResult(response) {
  const text = response?.content?.find((item) => item.type === 'text')?.text;
  if (!text) return response;
  try { return JSON.parse(text); } catch { return text; }
}

/** MCP-9 adapter for the official InjectiveLabs/mcp-server stdio process. */
export class InjectiveMcpAdapter {
  constructor(options = {}) {
    const command = options.command ?? process.env.INJECTIVE_MCP_COMMAND ?? 'node';
    const serverPath = options.serverPath ?? process.env.INJECTIVE_MCP_SERVER_PATH;
    const args = options.args ?? (serverPath ? [serverPath] : []);
    if (args.length === 0) {
      throw new Error('INJECTIVE_MCP_SERVER_PATH is required (official Injective dist/mcp/server.js)');
    }
    this.client = options.client ?? new Client({ name: 'agentbl-injective-adapter', version: '1.0.0' });
    this.transport = options.transport ?? new StdioClientTransport({
      command,
      args,
      env: {
        ...process.env,
        ...(options.env ?? {}),
        INJECTIVE_NETWORK: 'testnet'
      },
      stderr: 'pipe'
    });
  }

  async connect() {
    await this.client.connect(this.transport);
    const listed = await this.client.listTools();
    const names = new Set(listed.tools.map((tool) => tool.name));
    for (const required of ['usdc_native_info', 'evm_broadcast']) {
      if (!names.has(required)) throw new Error(`Official Injective MCP is missing required tool: ${required}`);
    }
    return listed.tools;
  }

  async queryNativeUsdc() {
    const response = await this.client.callTool({ name: 'usdc_native_info', arguments: {} });
    if (response.isError) throw new Error(`Injective MCP query failed: ${textResult(response)}`);
    return textResult(response);
  }

  async broadcastEvm(request) {
    const policy = authorizeMcpWrite({
      operation: 'raw_evm_smoke',
      network: request.network ?? MCP_PINNED_NETWORK,
      contract: request.to,
      amount_usdc: request.amount_usdc ?? 0,
      calldata: request.data,
      dry_run: request.dry_run,
      approved: request.approved,
      approval_token: request.approval_token
    });
    if (policy.dry_run) return { ok: true, policy, broadcast: false };

    const response = await this.client.callTool({
      name: 'evm_broadcast',
      arguments: {
        address: request.address,
        password: request.password,
        to: request.to,
        data: request.data ?? '0x',
        value: String(request.value ?? '0'),
        gasLimit: request.gasLimit ?? '300000',
        // The current official server can observe a zero testnet base fee;
        // pin a bounded non-zero price so the chain's minimum-fee ante check
        // remains authoritative instead of broadcasting an invalid 0-fee tx.
        gasPrice: request.gasPrice ?? '500000000',
        chainId: 1439,
        // Injective's Ethereum extension ante handler requires Cosmos memo
        // (and timeout/non-critical extensions) to be empty.
        memo: ''
      }
    });
    if (response.isError) throw new Error(`Injective MCP evm_broadcast failed: ${textResult(response)}`);
    return { ok: true, policy, broadcast: true, result: textResult(response) };
  }

  async close() {
    await this.client.close();
  }
}
