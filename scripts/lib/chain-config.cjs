const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = 'agentbl-chain-config-v2';
const DEFAULT_NETWORK = 'injective-testnet';

const NETWORK_DEFAULTS = Object.freeze({
  'injective-testnet': Object.freeze({
    network: 'injective_testnet',
    displayName: 'Injective EVM Testnet',
    chainId: '0x59F',
    chainIdDecimal: 1439,
    cosmosChainId: 'injective-888',
    rpcUrls: ['https://k8s.testnet.json-rpc.injective.network/'],
    wsUrls: ['wss://k8s.testnet.ws.injective.network/'],
    cosmosRpcUrl: 'https://testnet.sentry.tm.injective.network:443',
    cosmosExplorerTxBase: 'https://testnet.explorer.injective.network/transaction/',
    explorerBase: 'https://testnet.blockscout.injective.network',
    explorerApi: 'https://testnet.blockscout-api.injective.network/api',
    faucetUrl: 'https://testnet.faucet.injective.network/',
    nativeCurrency: { name: 'Injective', symbol: 'INJ', decimals: 18 },
    accessModel: 'permissionless'
  }),
  'injective-mainnet': Object.freeze({
    network: 'injective_mainnet',
    displayName: 'Injective EVM Mainnet',
    chainId: '0x6F0',
    chainIdDecimal: 1776,
    cosmosChainId: 'injective-1',
    rpcUrls: ['https://sentry.evm-rpc.injective.network/'],
    wsUrls: ['wss://sentry.evm-ws.injective.network'],
    cosmosRpcUrl: 'https://sentry.tm.injective.network:443',
    cosmosExplorerTxBase: 'https://explorer.injective.network/transaction/',
    explorerBase: 'https://blockscout.injective.network',
    explorerApi: 'https://blockscout-api.injective.network/api',
    faucetUrl: null,
    nativeCurrency: { name: 'Injective', symbol: 'INJ', decimals: 18 },
    accessModel: 'compliance-gated'
  })
});

function networkKey(value) {
  if (!value) return DEFAULT_NETWORK;
  return String(value).replaceAll('_', '-').toLowerCase();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseNetwork(key) {
  const preset = NETWORK_DEFAULTS[key];
  if (!preset) throw new Error(`Unknown network key: ${key}`);
  return { ...clone(preset), contracts: {}, abis: {}, deployments: {} };
}

function migrateLegacy(raw = {}) {
  if (raw.schema === SCHEMA && raw.networks && typeof raw.networks === 'object') {
    const registry = clone(raw);
    for (const [key, value] of Object.entries(registry.networks)) {
      registry.networks[key] = {
        ...(NETWORK_DEFAULTS[key] ? baseNetwork(key) : {}),
        ...value,
        contracts: { ...(value.contracts || {}) },
        abis: { ...(value.abis || {}) },
        deployments: { ...(value.deployments || {}) }
      };
    }
    return registry;
  }
  const key = networkKey(raw.network || DEFAULT_NETWORK);
  const current = {
    ...baseNetwork(key),
    ...clone(raw),
    contracts: { ...(raw.contracts || {}) },
    abis: {
      ...(raw.protocol?.abis || {}),
      ...(Array.isArray(raw.abi) ? { AgentBLRWA: raw.abi } : {}),
      ...(Array.isArray(raw.paymentOracle?.abi) ? { PaymentOracle: raw.paymentOracle.abi } : {})
    },
    deployments: {
      ...(raw.deployTx ? { AgentBLRWA: { address: raw.contracts?.AgentBLRWA, deployTx: raw.deployTx, deployedAt: raw.deployedAt } } : {}),
      ...(raw.paymentOracle ? { PaymentOracle: clone(raw.paymentOracle) } : {})
    }
  };
  delete current.abi;
  delete current.defaultNetwork;
  delete current.networks;
  return {
    schema: SCHEMA,
    defaultNetwork: key,
    networks: {
      [key]: current,
      ...(key === 'injective-testnet' ? { 'injective-mainnet': baseNetwork('injective-mainnet') } : {})
    }
  };
}

function assertRegistry(raw) {
  const registry = migrateLegacy(raw);
  if (registry.schema !== SCHEMA) throw new Error(`chain config schema must be ${SCHEMA}`);
  if (!registry.networks?.[registry.defaultNetwork]) throw new Error('defaultNetwork must reference a configured network');
  for (const [key, value] of Object.entries(registry.networks)) {
    if (!/^0x[0-9a-fA-F]+$/u.test(value.chainId || '')) throw new Error(`${key}.chainId must be hexadecimal`);
    if (!Number.isSafeInteger(value.chainIdDecimal) || value.chainIdDecimal <= 0) {
      throw new Error(`${key}.chainIdDecimal must be a positive integer`);
    }
    if (Number.parseInt(value.chainId, 16) !== value.chainIdDecimal) throw new Error(`${key} chain ID mismatch`);
    if (!Array.isArray(value.rpcUrls) || value.rpcUrls.length === 0) throw new Error(`${key}.rpcUrls is required`);
    if (typeof value.explorerBase !== 'string' || !value.explorerBase.startsWith('https://')) {
      throw new Error(`${key}.explorerBase must use HTTPS`);
    }
    if (!value.contracts || !value.abis) throw new Error(`${key} contracts and abis maps are required`);
  }
  return registry;
}

function resolveNetworkConfig(raw, requestedNetwork) {
  const registry = assertRegistry(raw);
  const key = networkKey(requestedNetwork || registry.defaultNetwork);
  const value = registry.networks[key];
  if (!value) throw new Error(`Network is not configured: ${key}`);
  const contracts = { ...(value.contracts || {}) };
  const abis = { ...(value.abis || {}) };
  return {
    ...clone(value),
    key,
    defaultNetwork: registry.defaultNetwork,
    contracts,
    abis,
    abi: abis.AgentBLRWA || [],
    paymentOracle: value.paymentOracle || (contracts.PaymentOracle ? {
      address: contracts.PaymentOracle,
      ...(value.deployments?.PaymentOracle || {}),
      abi: abis.PaymentOracle || []
    } : null)
  };
}

function mergeNetworkConfig(raw, requestedNetwork, patch) {
  const registry = migrateLegacy(raw);
  const key = networkKey(requestedNetwork);
  const previous = registry.networks[key] || baseNetwork(key);
  registry.networks[key] = {
    ...previous,
    ...clone(patch),
    contracts: { ...(previous.contracts || {}), ...(patch.contracts || {}) },
    abis: { ...(previous.abis || {}), ...(patch.abis || {}) },
    deployments: { ...(previous.deployments || {}), ...(patch.deployments || {}) }
  };
  registry.schema = SCHEMA;
  registry.defaultNetwork ||= key;
  return assertRegistry(registry);
}

function readRegistry(file) {
  try { return migrateLegacy(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch { return { schema: SCHEMA, defaultNetwork: DEFAULT_NETWORK, networks: { [DEFAULT_NETWORK]: baseNetwork(DEFAULT_NETWORK), 'injective-mainnet': baseNetwork('injective-mainnet') } }; }
}

function atomicWriteRegistry(file, registry) {
  const checked = assertRegistry(registry);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(checked, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

module.exports = {
  SCHEMA,
  DEFAULT_NETWORK,
  NETWORK_DEFAULTS,
  networkKey,
  migrateLegacy,
  assertRegistry,
  resolveNetworkConfig,
  mergeNetworkConfig,
  readRegistry,
  atomicWriteRegistry
};
