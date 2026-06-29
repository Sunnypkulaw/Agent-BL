/** MCP-9 live smoke against InjectiveLabs/mcp-server. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import { InjectiveMcpAdapter } from '../src/mcp/injectiveAdapter.js';

const root = path.resolve(import.meta.dirname, '..');
const explorer = 'https://testnet.blockscout.injective.network';
const explorerApi = 'https://testnet.blockscout-api.injective.network/api/v2';

async function loadDotEnv() {
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

function parseTool(response) {
  if (response?.isError) throw new Error(response.content?.[0]?.text ?? 'Official MCP tool failed');
  const text = response?.content?.find((item) => item.type === 'text')?.text;
  if (!text) return response;
  try { return JSON.parse(text); } catch { return text; }
}

function findTxHash(value) {
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/u.test(value)) return value;
  if (typeof value === 'string' && /^[0-9a-fA-F]{64}$/u.test(value)) return `0x${value.toLowerCase()}`;
  if (!value || typeof value !== 'object') return null;
  for (const [key, entry] of Object.entries(value)) {
    if (/tx.*hash|hash.*tx|transaction/iu.test(key)) {
      const found = findTxHash(entry);
      if (found) return found;
    }
  }
  for (const entry of Object.values(value)) {
    const found = findTxHash(entry);
    if (found) return found;
  }
  return null;
}

async function waitTransaction(txHash) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(`${explorerApi}/transactions/${txHash}`);
    if (response.ok) {
      const transaction = await response.json();
      if (transaction.status === 'ok') return transaction;
      if (transaction.status === 'error') throw new Error(`Official MCP transaction reverted: ${txHash}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for official MCP transaction: ${txHash}`);
}

async function resolveEvmTransactionHash(cosmosTxHash) {
  const lcdHash = cosmosTxHash.replace(/^0x/u, '').toUpperCase();
  const response = await fetch(`https://testnet.sentry.lcd.injective.network/cosmos/tx/v1beta1/txs/${lcdHash}`);
  if (!response.ok) throw new Error(`Injective LCD could not resolve Cosmos tx ${lcdHash}`);
  const body = await response.json();
  if (Number(body.tx_response?.code ?? -1) !== 0) {
    throw new Error(`Official MCP Cosmos tx failed: ${body.tx_response?.raw_log ?? lcdHash}`);
  }
  const raw = body.tx?.body?.messages?.[0]?.raw;
  if (!/^0x[0-9a-fA-F]+$/u.test(raw ?? '')) throw new Error('MsgEthereumTx raw payload is missing');
  const computed = ethers.keccak256(raw);
  const event = body.tx_response?.events
    ?.find((item) => item.type === 'ethereum_tx')
    ?.attributes?.find((item) => item.key === 'ethereumTxHash')?.value;
  if (event) assert.equal(event.toLowerCase(), computed.toLowerCase());
  return {
    cosmosTxHash: lcdHash,
    evmTxHash: computed,
    height: Number(body.tx_response.height)
  };
}

await loadDotEnv();
const privateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
if (!privateKey) throw new Error('DEPLOYER_PRIVATE_KEY is required for the controlled testnet smoke');
if (process.env.MCP_LIVE_CONFIRM !== 'injective-testnet') {
  throw new Error('Set MCP_LIVE_CONFIRM=injective-testnet to explicitly approve the controlled testnet smoke');
}
const approvalToken = crypto.randomBytes(32).toString('base64url');
process.env.MCP_HUMAN_APPROVAL_TOKEN = approvalToken;
const defaultServerPath = path.join(os.tmpdir(), 'agentbl-injective-mcp-server', 'dist', 'mcp', 'server.js');
const serverPath = process.env.INJECTIVE_MCP_SERVER_PATH?.trim() || defaultServerPath;
await fs.access(serverPath);

const chain = JSON.parse(await fs.readFile(path.join(root, 'public', 'chain-config.json'), 'utf8'));
const target = chain.contracts.AgentBLRWA;
assert.ok(ethers.isAddress(target));
const temporaryHome = path.join(os.tmpdir(), `agentbl-injective-mcp-home-${process.pid}`);
await fs.mkdir(temporaryHome, { recursive: true });
const password = crypto.randomBytes(24).toString('base64url');
const adapter = new InjectiveMcpAdapter({
  serverPath,
  env: { USERPROFILE: temporaryHome, HOME: temporaryHome, INJECTIVE_NETWORK: 'testnet' }
});

let importedAddress;
try {
  const tools = await adapter.connect();
  assert.ok(tools.some((tool) => tool.name === 'wallet_import'));
  const nativeUsdc = await adapter.queryNativeUsdc();
  const imported = parseTool(await adapter.client.callTool({
    name: 'wallet_import',
    arguments: { privateKeyHex: privateKey, password, name: 'agentbl-wave-b-smoke' }
  }));
  importedAddress = imported.address;
  assert.match(importedAddress, /^inj1/u);

  const data = new ethers.Interface(['function nextPoolId() view returns (uint256)'])
    .encodeFunctionData('nextPoolId');
  const broadcast = await adapter.broadcastEvm({
    network: 'eip155:1439',
    approved: true,
    approval_token: approvalToken,
    dry_run: false,
    amount_usdc: 0,
    address: importedAddress,
    password,
    to: target,
    data,
    value: '0',
    gasLimit: '300000',
    memo: 'AgentBL MCP-9 controlled read-calldata transaction'
  });
  const outerTxHash = findTxHash(broadcast.result);
  assert.match(outerTxHash, /^0x[0-9a-fA-F]{64}$/u);
  const resolved = await resolveEvmTransactionHash(outerTxHash);
  const txHash = resolved.evmTxHash;
  const transaction = await waitTransaction(txHash);
  assert.equal(transaction.to?.hash?.toLowerCase(), target.toLowerCase());
  assert.equal(transaction.raw_input.toLowerCase(), data.toLowerCase());

  const evidence = {
    schema: 'agentbl-injective-mcp-smoke-v1',
    verified_at: new Date().toISOString(),
    network: 'injective_testnet',
    chain_id: 1439,
    official_server: 'https://github.com/InjectiveLabs/mcp-server',
    official_server_path: serverPath,
    tool_trace: [
      {
        tool: 'usdc_native_info',
        arguments_summary: {},
        result_summary: {
          symbol: nativeUsdc.symbol ?? nativeUsdc.token?.symbol ?? 'USDC',
          evm_address: nativeUsdc.evmAddress ?? nativeUsdc.evm_address ?? nativeUsdc.address ?? null,
          network: nativeUsdc.network ?? 'testnet'
        }
      },
      {
        tool: 'evm_broadcast',
        arguments_summary: {
          sender: importedAddress,
          to: target,
          value: '0',
          calldata_selector: data.slice(0, 10),
          chain_id: 1439,
          approved: true,
          allowlisted: true
        },
        cosmos_tx_hash: resolved.cosmosTxHash,
        evm_tx_hash: txHash,
        explorer: `${explorer}/tx/${txHash}`,
        status: transaction.status
      }
    ],
    secrets_logged: false
  };
  const output = path.join(root, 'docs', 'evidence', 'injective-mcp-smoke.json');
  await fs.writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log('MCP-9 PASS: official Injective query + controlled evm_broadcast');
  console.log(`  tx: ${txHash}`);
  console.log(`  evidence: ${output}`);
} finally {
  if (importedAddress) {
    await adapter.client.callTool({ name: 'wallet_remove', arguments: { address: importedAddress } }).catch(() => {});
  }
  await adapter.close().catch(() => {});
}
