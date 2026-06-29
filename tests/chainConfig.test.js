import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import chainConfig from '../scripts/lib/chain-config.cjs';

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';

function fixture() {
  return {
    schema: chainConfig.SCHEMA,
    defaultNetwork: 'injective-testnet',
    networks: {
      'injective-testnet': {
        network: 'injective_testnet', chainId: '0x59F', chainIdDecimal: 1439,
        rpcUrls: ['https://testnet-rpc.example'], explorerBase: 'https://testnet-explorer.example',
        contracts: { AgentBLRWA: ADDRESS_A }, abis: { AgentBLRWA: [{ name: 'testnetFn' }] }, deployments: {}
      },
      'injective-mainnet': {
        network: 'injective_mainnet', chainId: '0x6F0', chainIdDecimal: 1776,
        rpcUrls: ['https://mainnet-rpc.example'], explorerBase: 'https://mainnet-explorer.example',
        contracts: { AgentBLRWA: ADDRESS_B }, abis: { AgentBLRWA: [{ name: 'mainnetFn' }] }, deployments: {}
      }
    }
  };
}

test('WEB3-19: resolves address, RPC, explorer and ABI from either configured network', () => {
  const testnet = chainConfig.resolveNetworkConfig(fixture());
  const mainnet = chainConfig.resolveNetworkConfig(fixture(), 'injective-mainnet');
  assert.equal(testnet.contracts.AgentBLRWA, ADDRESS_A);
  assert.equal(testnet.rpcUrls[0], 'https://testnet-rpc.example');
  assert.equal(testnet.explorerBase, 'https://testnet-explorer.example');
  assert.equal(testnet.abi[0].name, 'testnetFn');
  assert.equal(mainnet.contracts.AgentBLRWA, ADDRESS_B);
  assert.equal(mainnet.rpcUrls[0], 'https://mainnet-rpc.example');
  assert.equal(mainnet.explorerBase, 'https://mainnet-explorer.example');
  assert.equal(mainnet.abi[0].name, 'mainnetFn');
});

test('WEB3-19: deployment merge updates one network without overwriting another', () => {
  const merged = chainConfig.mergeNetworkConfig(fixture(), 'injective-testnet', {
    contracts: { RiskPricingOracle: ADDRESS_B },
    abis: { RiskPricingOracle: [{ name: 'updatePricing' }] }
  });
  assert.equal(merged.networks['injective-testnet'].contracts.RiskPricingOracle, ADDRESS_B);
  assert.equal(merged.networks['injective-mainnet'].contracts.AgentBLRWA, ADDRESS_B);
  assert.equal(merged.networks['injective-mainnet'].abis.AgentBLRWA[0].name, 'mainnetFn');
});

test('WEB3-19: legacy flat config migrates without losing deployment data', () => {
  const migrated = chainConfig.migrateLegacy({
    network: 'injective_testnet', chainId: '0x59F', chainIdDecimal: 1439,
    rpcUrls: ['https://rpc.example'], explorerBase: 'https://explorer.example',
    contracts: { AgentBLRWA: ADDRESS_A }, abi: [{ name: 'tokenize' }], deployTx: `0x${'ab'.repeat(32)}`
  });
  const active = chainConfig.resolveNetworkConfig(migrated);
  assert.equal(migrated.schema, chainConfig.SCHEMA);
  assert.equal(active.contracts.AgentBLRWA, ADDRESS_A);
  assert.equal(active.abi[0].name, 'tokenize');
});

test('WEB3-19: public config is v2 with testnet default and official mainnet metadata', async () => {
  const actual = JSON.parse(await fs.readFile('public/chain-config.json', 'utf8'));
  const migrated = chainConfig.migrateLegacy(actual);
  const testnet = chainConfig.resolveNetworkConfig(migrated, 'injective-testnet');
  const mainnet = chainConfig.resolveNetworkConfig(migrated, 'injective-mainnet');
  assert.equal(migrated.defaultNetwork, 'injective-testnet');
  assert.equal(testnet.chainIdDecimal, 1439);
  assert.equal(mainnet.chainIdDecimal, 1776);
  assert.equal(testnet.accessModel, 'permissionless');
  assert.equal(mainnet.accessModel, 'compliance-gated');
});

test('WEB3-19: rejects mismatched hexadecimal and decimal chain IDs', () => {
  const invalid = fixture();
  invalid.networks['injective-testnet'].chainIdDecimal = 1;
  assert.throws(() => chainConfig.assertRegistry(invalid), /chain ID mismatch/u);
});
