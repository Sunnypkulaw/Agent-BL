import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chainConfig from '../../scripts/lib/chain-config.cjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const MCP_PINNED_NETWORK = 'eip155:1439';
export const MCP_MAX_WRITE_USDC = 0.005;
export const MCP_ALLOWED_WRITE_OPERATIONS = Object.freeze([
  'pricing_update',
  'x402_payment',
  'raw_evm_smoke'
]);
export const MCP_RAW_EVM_SELECTORS = Object.freeze({
  // AgentBLRWA.nextPoolId(): controlled calldata-bearing read smoke only.
  raw_evm_smoke: Object.freeze(['0x18e56131'])
});

export class McpWritePolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'McpWritePolicyError';
    this.code = code;
  }
}

function readChainConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(rootDir, 'public', 'chain-config.json'), 'utf8'));
    return chainConfig.resolveNetworkConfig(raw, 'injective-testnet');
  } catch {
    return {};
  }
}

export function configuredWriteAllowlist() {
  const config = readChainConfig();
  const values = [
    ...Object.values(config.contracts ?? {}),
    config.paymentOracle?.address
  ];
  return new Set(values
    .filter((value) => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/u.test(value))
    .map((value) => value.toLowerCase()));
}

function assertAmount(amountUSDC) {
  const amount = Number(amountUSDC ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new McpWritePolicyError('invalid_amount', 'Write amount must be a finite non-negative USDC value');
  }
  if (amount > MCP_MAX_WRITE_USDC) {
    throw new McpWritePolicyError(
      'amount_limit_exceeded',
      `Write amount ${amount} USDC exceeds the MCP cap of ${MCP_MAX_WRITE_USDC} USDC`
    );
  }
  return amount;
}

function assertRawEvmSelector(operation, calldata) {
  const allowed = MCP_RAW_EVM_SELECTORS[operation];
  if (!allowed) return null;
  const selector = String(calldata ?? '').slice(0, 10).toLowerCase();
  if (!/^0x[0-9a-f]{8}$/u.test(selector) || !allowed.includes(selector)) {
    throw new McpWritePolicyError(
      'calldata_not_allowlisted',
      `Raw EVM selector is not allowlisted for ${operation}`
    );
  }
  return selector;
}

function assertHumanApproval(request) {
  if (request.approved !== true) {
    throw new McpWritePolicyError(
      'human_approval_required',
      'A real MCP chain write requires approved=true from the human caller'
    );
  }
  const expected = process.env.MCP_HUMAN_APPROVAL_TOKEN?.trim();
  if (!expected) {
    throw new McpWritePolicyError(
      'approval_channel_not_configured',
      'Real MCP writes require an out-of-band MCP_HUMAN_APPROVAL_TOKEN'
    );
  }
  const supplied = String(request.approval_token ?? '');
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) {
    throw new McpWritePolicyError(
      'invalid_human_approval',
      'The out-of-band human approval token is missing or invalid'
    );
  }
}

/**
 * MCP-10 fail-closed policy. Model/document text is never consulted here:
 * authorization is derived only from explicit structured fields and local config.
 */
export function authorizeMcpWrite(request = {}) {
  const operation = String(request.operation ?? '');
  if (!MCP_ALLOWED_WRITE_OPERATIONS.includes(operation)) {
    throw new McpWritePolicyError('operation_not_allowed', `Write operation is not allowlisted: ${operation || '(missing)'}`);
  }
  if (request.network !== MCP_PINNED_NETWORK) {
    throw new McpWritePolicyError(
      'network_not_pinned',
      `MCP writes are pinned to ${MCP_PINNED_NETWORK}; received ${request.network ?? '(missing)'}`
    );
  }

  const amountUSDC = assertAmount(request.amount_usdc);
  const contract = String(request.contract ?? '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/u.test(contract) || !configuredWriteAllowlist().has(contract)) {
    throw new McpWritePolicyError('contract_not_allowlisted', 'Target contract is not in public/chain-config.json');
  }
  const selector = assertRawEvmSelector(operation, request.calldata);

  const dryRun = request.dry_run !== false;
  if (dryRun) {
    return {
      authorized: false,
      dry_run: true,
      operation,
      network: request.network,
      contract,
      amount_usdc: amountUSDC,
      selector,
      reason: 'dry_run'
    };
  }
  assertHumanApproval(request);

  return {
    authorized: true,
    dry_run: false,
    operation,
    network: request.network,
    contract,
    amount_usdc: amountUSDC,
    selector,
    reason: 'explicit_human_approval'
  };
}
