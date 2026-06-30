import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function loadDotEnv(root) {
  let source;
  try { source = await fs.readFile(path.join(root, '.env'), 'utf8'); } catch { return; }
  for (const raw of source.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

export function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_key, entry) => typeof entry === 'bigint' ? entry.toString() : entry));
}

export async function atomicJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(jsonSafe(value), null, 2)}\n`, 'utf8');
  await fs.rename(temporary, file);
}

export async function waitBlockscoutTransaction(txHash, explorerApi, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${explorerApi}/transactions/${txHash}`);
      if (response.ok) {
        const transaction = await response.json();
        if (transaction.status === 'ok') return transaction;
        if (transaction.status === 'error') throw new Error(`Transaction reverted: ${txHash}`);
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for ${txHash}${lastError ? `: ${lastError.message}` : ''}`);
}

export function parseMcpTool(response) {
  if (response?.isError) throw new Error(response.content?.[0]?.text ?? 'Official Injective MCP tool failed');
  const text = response?.content?.find((item) => item.type === 'text')?.text;
  if (!text) return response;
  try { return JSON.parse(text); } catch { return text; }
}

export async function connectOfficialInjectiveMcp() {
  const defaultPath = path.join(os.tmpdir(), 'agentbl-injective-mcp-server', 'dist', 'mcp', 'server.js');
  const serverPath = process.env.INJECTIVE_MCP_SERVER_PATH?.trim() || defaultPath;
  await fs.access(serverPath);
  const client = new Client({ name: 'agentbl-precompile-spike', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: { ...process.env, INJECTIVE_NETWORK: 'testnet' },
    stderr: 'pipe'
  });
  await client.connect(transport);
  return {
    serverPath,
    client,
    call: async (name, args = {}) => parseMcpTool(await client.callTool({ name, arguments: args })),
    close: () => client.close()
  };
}
