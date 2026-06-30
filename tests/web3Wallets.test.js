import assert from 'node:assert/strict';
import test from 'node:test';
import {
  __resetWeb3ForTests,
  connectWallet,
  connectedAddress,
  connectedWalletType,
  disconnect,
  queryFilterInChunks,
  resolveBrowserChainConfig,
  restoreWalletSession,
  walletAvailability
} from '../public/web3.js';

test('WEB3-20: event reads stay within the Injective eth_getLogs block limit', async () => {
  const calls = [];
  const available = [
    { blockNumber: 110_000 },
    { blockNumber: 114_000 },
    { blockNumber: 124_999 }
  ];
  const contract = {
    async queryFilter(_filter, fromBlock, toBlock) {
      calls.push([fromBlock, toBlock]);
      assert.ok(toBlock - fromBlock <= 9_999);
      return available.filter((event) => event.blockNumber >= fromBlock && event.blockNumber <= toBlock);
    }
  };

  const events = await queryFilterInChunks(contract, {}, 100_000, 125_000, { limit: 3 });

  assert.deepEqual(calls, [[115_001, 125_000], [105_001, 115_000]]);
  assert.deepEqual(events.map((event) => event.blockNumber), [110_000, 114_000, 124_999]);
});

const registry = {
  schema: 'agentbl-chain-config-v2',
  defaultNetwork: 'injective-testnet',
  networks: {
    'injective-testnet': {
      key: 'injective-testnet', network: 'injective_testnet', displayName: 'Injective EVM Testnet',
      chainId: '0x59F', chainIdDecimal: 1439, cosmosChainId: 'injective-888',
      rpcUrls: ['https://rpc.example'], cosmosRpcUrl: 'https://cosmos.example',
      explorerBase: 'https://explorer.example', contracts: {}, abis: {}
    }
  }
};

function cosmosWallet(address) {
  const calls = [];
  const signer = { async getAccounts() { return [{ address }]; } };
  return {
    calls,
    async enable(chainId) { calls.push(['enable', chainId]); },
    getOfflineSigner(chainId) { calls.push(['signer', chainId]); return signer; }
  };
}

function installWindow({ keplr, leap, ethereum } = {}) {
  const listeners = new Map();
  globalThis.window = {
    keplr, leap, ethereum,
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatchEvent() {},
    localStorage: { setItem() {}, removeItem() {} }
  };
  globalThis.fetch = async () => ({ ok: true, async json() { return registry; } });
}

test.afterEach(() => {
  __resetWeb3ForTests();
  delete globalThis.window;
  delete globalThis.fetch;
});

test('WEB3-18: detects MetaMask, Keplr and Leap independently', () => {
  installWindow({
    ethereum: { request() {}, isMetaMask: true },
    keplr: cosmosWallet('inj1keplr'),
    leap: cosmosWallet('inj1leap')
  });
  assert.deepEqual(walletAvailability(), { metamask: true, keplr: true, leap: true });
});

for (const [walletType, address] of [['keplr', 'inj1keplraddress'], ['leap', 'inj1leapaddress']]) {
  test(`WEB3-18: ${walletType} connects through the native injective-888 signer`, async () => {
    const wallet = cosmosWallet(address);
    installWindow({ [walletType]: wallet });
    const connected = await connectWallet(walletType);
    assert.equal(connected.kind, 'cosmos');
    assert.equal(connectedAddress(), address);
    assert.equal(connectedWalletType(), walletType);
    assert.deepEqual(wallet.calls, [['enable', 'injective-888'], ['signer', 'injective-888']]);
    await disconnect();
    assert.equal(connectedAddress(), null);
  });
}

test('WEB3-19: browser resolver switches network-specific contract ABI without flattening registry', () => {
  const mainnet = {
    ...registry,
    networks: {
      ...registry.networks,
      'injective-mainnet': {
        network: 'injective_mainnet', chainId: '0x6F0', chainIdDecimal: 1776,
        rpcUrls: ['https://mainnet.example'], explorerBase: 'https://mainnet-explorer.example',
        contracts: { AgentBLRWA: '0x1111111111111111111111111111111111111111' },
        abis: { AgentBLRWA: [{ name: 'mainnetOnly' }] }
      }
    }
  };
  const selected = resolveBrowserChainConfig(mainnet, 'injective-mainnet');
  assert.equal(selected.chainIdDecimal, 1776);
  assert.equal(selected.abi[0].name, 'mainnetOnly');
  assert.ok(mainnet.networks['injective-testnet']);
});

test('WEB3-18: MetaMask network switching (wallet_switchEthereumChain)', async () => {
  const calls = [];
  const mockEthers = {
    BrowserProvider: class {
      async getSigner() { return { async getAddress() { return '0xMetaMaskAddr'; } }; }
    }
  };
  const eth = {
    isMetaMask: true,
    async request({ method, params }) {
      calls.push([method, params]);
      if (method === 'eth_requestAccounts') return ['0xMetaMaskAddr'];
      if (method === 'eth_chainId') return '0x1';
      if (method === 'wallet_switchEthereumChain') return;
    },
    on() {}
  };
  installWindow({ ethereum: eth });
  globalThis._mockEthers = mockEthers;
  await connectWallet('metamask');
  assert.ok(calls.some(([m]) => m === 'wallet_switchEthereumChain'));
  delete globalThis._mockEthers;
});

test('WEB3-18: MetaMask signing rejection (ACTION_REJECTED)', async () => {
  const mockEthers = {
    BrowserProvider: class {
      async getSigner() { return { async getAddress() { return '0xAddr'; } }; }
    }
  };
  const eth = {
    isMetaMask: true,
    async request({ method }) {
      if (method === 'eth_requestAccounts') return ['0xAddr'];
      if (method === 'eth_chainId') return '0x59F';
      if (method === 'eth_sendTransaction') { const e = new Error('rejected'); e.code = 4001; throw e; }
    },
    on() {}
  };
  installWindow({ ethereum: eth });
  globalThis._mockEthers = mockEthers;
  await connectWallet('metamask');
  try {
    await eth.request({ method: 'eth_sendTransaction', params: [{}] });
    assert.fail('should reject');
  } catch (e) {
    assert.equal(e.code, 4001);
  }
  delete globalThis._mockEthers;
});

test('WEB3-18: MetaMask permission revocation (wallet_revokePermissions)', async () => {
  const calls = [];
  const mockEthers = {
    BrowserProvider: class {
      async getSigner() { return { async getAddress() { return '0xAddr'; } }; }
    }
  };
  const eth = {
    isMetaMask: true,
    async request({ method, params }) {
      calls.push([method, params]);
      if (method === 'eth_requestAccounts') return ['0xAddr'];
      if (method === 'eth_chainId') return '0x59F';
      if (method === 'wallet_revokePermissions') return null;
    },
    on() {}
  };
  installWindow({ ethereum: eth });
  globalThis._mockEthers = mockEthers;
  await connectWallet('metamask');
  await disconnect();
  assert.ok(calls.some(([m, p]) => m === 'wallet_revokePermissions' && p?.[0]?.eth_accounts));
  delete globalThis._mockEthers;
});

test('WEB3-18: restoreWalletSession for MetaMask using eth_accounts', async () => {
  const mockEthers = {
    BrowserProvider: class {
      async getSigner() { return { async getAddress() { return '0xRestored'; } }; }
    }
  };
  const eth = {
    isMetaMask: true,
    async request({ method }) {
      if (method === 'eth_accounts') return ['0xRestored'];
    },
    on() {}
  };
  globalThis.window = {
    ethereum: eth,
    addEventListener() {}, dispatchEvent() {},
    localStorage: { getItem: () => 'metamask', setItem() {}, removeItem() {} }
  };
  globalThis.fetch = async () => ({ ok: true, async json() { return registry; } });
  globalThis._mockEthers = mockEthers;
  const restored = await restoreWalletSession();
  assert.equal(restored?.address, '0xRestored');
  assert.equal(restored?.walletType, 'metamask');
  delete globalThis._mockEthers;
});

test('WEB3-18: restoreWalletSession for Keplr restores native signer', async () => {
  const keplr = cosmosWallet('inj1restored');
  globalThis.window = {
    keplr,
    addEventListener() {}, dispatchEvent() {},
    localStorage: { getItem: () => 'keplr', setItem() {}, removeItem() {} }
  };
  globalThis.fetch = async () => ({ ok: true, async json() { return registry; } });
  const restored = await restoreWalletSession();
  assert.equal(restored?.address, 'inj1restored');
  assert.equal(restored?.walletType, 'keplr');
  assert.equal(restored?.kind, 'cosmos');
  __resetWeb3ForTests();
  delete globalThis.window; delete globalThis.fetch;
});
