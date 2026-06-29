import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  authorizeMcpWrite,
  MCP_MAX_WRITE_USDC,
  MCP_PINNED_NETWORK,
  McpWritePolicyError
} from '../src/mcp/security.js';

const config = JSON.parse(await fs.readFile('public/chain-config.json', 'utf8'));
const target = config.contracts.RiskPricingOracle;
const base = {
  operation: 'pricing_update',
  network: MCP_PINNED_NETWORK,
  contract: target,
  amount_usdc: 0
};

test('MCP-10: dry-run is safe without approval', () => {
  const result = authorizeMcpWrite({ ...base, dry_run: true });
  assert.equal(result.authorized, false);
  assert.equal(result.reason, 'dry_run');
});

test('MCP-10: real write requires explicit human approval', () => {
  assert.throws(
    () => authorizeMcpWrite({ ...base, dry_run: false }),
    (error) => error instanceof McpWritePolicyError && error.code === 'human_approval_required'
  );
});

test('MCP-10: wrong network, excessive amount and unknown contract are rejected', () => {
  assert.throws(
    () => authorizeMcpWrite({ ...base, network: 'eip155:1' }),
    (error) => error.code === 'network_not_pinned'
  );
  assert.throws(
    () => authorizeMcpWrite({ ...base, operation: 'x402_payment', amount_usdc: MCP_MAX_WRITE_USDC + 0.001 }),
    (error) => error.code === 'amount_limit_exceeded'
  );
  assert.throws(
    () => authorizeMcpWrite({ ...base, contract: '0x0000000000000000000000000000000000000001' }),
    (error) => error.code === 'contract_not_allowlisted'
  );
});

test('MCP-10: approved, pinned and allowlisted write passes', () => {
  const previous = process.env.MCP_HUMAN_APPROVAL_TOKEN;
  process.env.MCP_HUMAN_APPROVAL_TOKEN = 'host-only-test-approval';
  try {
    const result = authorizeMcpWrite({
      ...base,
      dry_run: false,
      approved: true,
      approval_token: 'host-only-test-approval'
    });
    assert.equal(result.authorized, true);
    assert.equal(result.contract, target.toLowerCase());
  } finally {
    if (previous === undefined) delete process.env.MCP_HUMAN_APPROVAL_TOKEN;
    else process.env.MCP_HUMAN_APPROVAL_TOKEN = previous;
  }
});

test('MCP-10: model-controlled approval cannot replace the out-of-band channel', () => {
  const previous = process.env.MCP_HUMAN_APPROVAL_TOKEN;
  delete process.env.MCP_HUMAN_APPROVAL_TOKEN;
  try {
    assert.throws(
      () => authorizeMcpWrite({ ...base, dry_run: false, approved: true }),
      (error) => error.code === 'approval_channel_not_configured'
    );
  } finally {
    if (previous !== undefined) process.env.MCP_HUMAN_APPROVAL_TOKEN = previous;
  }
});

test('MCP-10: raw EVM smoke rejects every non-allowlisted selector', () => {
  assert.throws(
    () => authorizeMcpWrite({
      ...base,
      operation: 'raw_evm_smoke',
      contract: config.contracts.AgentBLRWA,
      calldata: '0xdeadbeef',
      dry_run: true
    }),
    (error) => error.code === 'calldata_not_allowlisted'
  );
});
