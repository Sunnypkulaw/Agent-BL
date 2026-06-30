// Browser web3 integration for AgentBL.
//
// Target: Injective Testnet (inEVM, chainId 1439)
//
// Reads /chain-config.json at runtime to determine the target network.
// Wallet connection auto-detects the chain and prompts the user to switch.
//
// ethers v6 is loaded lazily from a CDN (only when the user connects a wallet).

import { priceToE6, riskLevelToUint8, actionToUint8 } from './format.js';
import { pushPricingToOracle } from './api.js';

const ETHERS_CDNS = [
  'https://esm.sh/ethers@6.13.4',
  'https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm'
];
const COSMOS_STARGATE_CDNS = [
  'https://esm.sh/@cosmjs/stargate@0.33.1?bundle',
  'https://cdn.jsdelivr.net/npm/@cosmjs/stargate@0.33.1/+esm'
];

// --- Chain presets ---
const CHAIN_PRESETS = {
  injective_testnet: {
    chainName: 'Injective Testnet (inEVM)',
    nativeCurrency: { name: 'INJ', symbol: 'INJ', decimals: 18 },
    rpcUrls: [
      'https://k8s.testnet.json-rpc.injective.network',
      'https://testnet.sentry.chain.json-rpc.injective.network'
    ],
    blockExplorerUrls: ['https://testnet.blockscout.injective.network'],
    faucetUrl: 'https://testnet.faucet.injective.network/'
  }
};

// --- module-level caches ---
let _ethers = null;
let _cosmosStargate = null;
let _registry = null;
let _config = null;
let _activeNetworkKey = null;
let _session = null; // { kind, walletType, provider, signer, address }
let _cachedProvider = null; // selected EIP-1193 provider

function injectedEvmProviders() {
  if (typeof window === 'undefined') return null;
  const primary = window.ethereum;
  const candidates = [
    ...(Array.isArray(primary?.providers) ? primary.providers : []),
    primary,
    window.okxwallet,
    window.trustwallet,
    window.bitkeep,
    window.bitget,
    window.rabby,
    window.tokenpocket
  ];
  return [...new Set(candidates.filter((provider) => provider?.request))];
}

export function walletAvailability() {
  const providers = injectedEvmProviders() ?? [];
  return {
    metamask: providers.some((provider) => provider.isMetaMask && !provider.isRabby) || providers.length > 0,
    keplr: typeof window !== 'undefined' && Boolean(window.keplr?.enable),
    leap: typeof window !== 'undefined' && Boolean(window.leap?.enable)
  };
}

function providerForWallet(walletType) {
  if (typeof window === 'undefined') return null;
  if (walletType === 'keplr') return window.keplr?.enable ? window.keplr : null;
  if (walletType === 'leap') return window.leap?.enable ? window.leap : null;
  const providers = injectedEvmProviders() ?? [];
  return providers.find((provider) => provider.isMetaMask && !provider.isRabby) ?? providers[0] ?? null;
}

/** Return the selected EIP-1193 provider; only MetaMask uses this path. */
export function getEthereumProvider() {
  if (_session?.kind === 'evm') return _session.provider;
  if (_cachedProvider) return _cachedProvider;
  _cachedProvider = providerForWallet('metamask');
  return _cachedProvider;
}

/** Lazy-load ethers v6 from a CDN (cached). */
export async function loadEthers() {
  if (_ethers) return _ethers;
  if (typeof globalThis !== 'undefined' && globalThis._mockEthers) return globalThis._mockEthers;
  let lastErr;
  for (const url of ETHERS_CDNS) {
    try {
      _ethers = await import(/* @vite-ignore */ url);
      return _ethers;
    } catch (err) { lastErr = err; }
  }
  throw new Error('Failed to load ethers from CDN: ' + (lastErr?.message ?? 'unknown'));
}

async function loadCosmosStargate() {
  if (_cosmosStargate) return _cosmosStargate;
  let lastError;
  for (const url of COSMOS_STARGATE_CDNS) {
    try {
      _cosmosStargate = await import(/* @vite-ignore */ url);
      return _cosmosStargate;
    } catch (error) { lastError = error; }
  }
  throw err('SDK_LOAD', `Failed to load Cosmos signing SDK: ${lastError?.message ?? 'unknown'}`);
}

export function resolveBrowserChainConfig(registry, requestedNetwork) {
  if (registry?.schema !== 'agentbl-chain-config-v2' || !registry.networks) {
    return registry;
  }
  const key = requestedNetwork || registry.defaultNetwork;
  const network = registry.networks[key];
  if (!network) throw err('NETWORK_CONFIG', `Unknown configured network: ${key}`);
  const abis = network.abis ?? {};
  return {
    ...network,
    key,
    defaultNetwork: registry.defaultNetwork,
    abi: abis.AgentBLRWA ?? [],
    paymentOracle: network.paymentOracle ?? (network.contracts?.PaymentOracle ? {
      address: network.contracts.PaymentOracle,
      ...(network.deployments?.PaymentOracle ?? {}),
      abi: abis.PaymentOracle ?? []
    } : null)
  };
}

/** Load /chain-config.json and resolve the active network without discarding the registry. */
export async function loadChainConfig(requestedNetwork) {
  const key = requestedNetwork || _activeNetworkKey;
  if (_config && (!key || _config.key === key)) return _config;
  try {
    if (!_registry) {
      const res = await fetch('/chain-config.json', { cache: 'no-store' });
      if (!res.ok) return null;
      _registry = await res.json();
    }
    _activeNetworkKey = key || _registry.defaultNetwork || 'injective-testnet';
    _config = resolveBrowserChainConfig(_registry, _activeNetworkKey);
    return _config;
  } catch { return null; }
}

export async function configuredNetworks() {
  await loadChainConfig();
  return Object.entries(_registry?.networks ?? {}).map(([key, value]) => ({
    key,
    displayName: value.displayName ?? key,
    chainId: value.chainId,
    deployed: Object.values(value.contracts ?? {}).some(isAddress)
  }));
}

export async function selectNetwork(networkKey) {
  if (_session) throw err('WALLET_CONNECTED', 'Disconnect the wallet before switching application networks');
  _activeNetworkKey = networkKey;
  _config = null;
  return loadChainConfig(networkKey);
}

/** Return the chain preset for the configured network (falls back to injective_testnet). */
function getPreset(cfg) {
  if (cfg?.rpcUrls?.length) {
    return {
      chainName: cfg.displayName,
      nativeCurrency: cfg.nativeCurrency,
      rpcUrls: cfg.rpcUrls,
      blockExplorerUrls: [cfg.explorerBase]
    };
  }
  const net = cfg?.network || 'injective_testnet';
  return CHAIN_PRESETS[net] || CHAIN_PRESETS.injective_testnet;
}

const isAddress = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);

/** True when a real contract address is configured (deploy script has run). */
export async function isRealChainConfigured() {
  const cfg = await loadChainConfig();
  return Boolean(cfg && isAddress(cfg.contracts?.AgentBLRWA));
}

export function hasInjectedWallet() {
  return Object.values(walletAvailability()).some(Boolean);
}

export function isWalletConnected() {
  return Boolean(_session?.address);
}

export function connectedAddress() {
  return _session?.address ?? null;
}

export function connectedWalletType() {
  return _session?.walletType ?? null;
}

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/**
 * Attempt silent reconnection using saved wallet type (for MetaMask: eth_accounts; for Keplr/Leap: restore native signer).
 * @returns {Promise<{address:string,walletType:string,kind:string}|null>} session info or null if no saved wallet or silent reconnect fails
 */
export async function restoreWalletSession() {
  let savedType;
  try { savedType = window.localStorage?.getItem('agentbl.walletType'); } catch { /* */ }
  if (!savedType) return null;

  const wallet = providerForWallet(savedType);
  if (!wallet) return null;

  const cfg = await loadChainConfig();

  try {
    if (savedType === 'keplr' || savedType === 'leap') {
      const cosmosChainId = cfg?.cosmosChainId;
      if (!cosmosChainId) return null;
      const signer = wallet.getOfflineSigner(cosmosChainId);
      const accounts = await signer.getAccounts();
      if (!accounts[0]?.address) return null;
      _session = {
        kind: 'cosmos', walletType: savedType, provider: wallet, signer,
        address: accounts[0].address, cosmosChainId
      };
      if (typeof window !== 'undefined' && !window._agentblCosmosWalletWired) {
        window._agentblCosmosWalletWired = true;
        window.addEventListener('keplr_keystorechange', () => clearWalletSession('account'));
        window.addEventListener('leap_keystorechange', () => clearWalletSession('account'));
      }
    } else {
      const accounts = await wallet.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) return null;
      const ethers = await loadEthers();
      _cachedProvider = wallet;
      const provider = new ethers.BrowserProvider(wallet);
      const signer = await provider.getSigner();
      _session = { kind: 'evm', walletType: 'metamask', provider: wallet, browserProvider: provider, signer, address: await signer.getAddress() };
      if (!wallet._agentblWired) {
        wallet._agentblWired = true;
        wallet.on?.('accountsChanged', () => clearWalletSession('account'));
        wallet.on?.('chainChanged', () => clearWalletSession('network'));
      }
    }
    emitWalletChange('restored');
    return { address: _session.address, walletType: _session.walletType, kind: _session.kind };
  } catch {
    return null;
  }
}

/** Ensure the wallet is on the target chain (from chain-config.json), adding the network if unknown (EIP-3085). */
async function ensureTargetChain(eth) {
  const cfg = await loadChainConfig();
  const preset = getPreset(cfg);
  const targetHex = cfg?.chainId || '0x59F'; // default: Injective Testnet

  const current = await eth.request({ method: 'eth_chainId' });
  if (current === targetHex) return;

  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetHex }] });
  } catch (switchErr) {
    if (switchErr?.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: targetHex,
          chainName: preset.chainName,
          nativeCurrency: preset.nativeCurrency,
          rpcUrls: preset.rpcUrls,
          blockExplorerUrls: preset.blockExplorerUrls
        }]
      });
    } else {
      throw switchErr;
    }
  }
}

/**
 * Connect one explicit wallet. MetaMask signs EVM calls; Keplr/Leap use their
 * Cosmos-native Injective signer and never masquerade as window.ethereum.
 * @returns {Promise<{address:string,walletType:string,kind:string}>}
 * @throws {Error} with .code: NO_WALLET | REJECTED | NETWORK
 */
export async function connectWallet(walletType = 'metamask') {
  const wallet = providerForWallet(walletType);
  if (!wallet) throw err('NO_WALLET', `${walletType} wallet extension was not detected`);
  const cfg = await loadChainConfig();

  if (walletType === 'keplr' || walletType === 'leap') {
    const cosmosChainId = cfg?.cosmosChainId;
    if (!cosmosChainId) throw err('NETWORK_CONFIG', 'Cosmos chain ID is missing from chain-config');
    try {
      await wallet.enable(cosmosChainId);
      const signer = wallet.getOfflineSigner(cosmosChainId);
      const accounts = await signer.getAccounts();
      if (!accounts[0]?.address) throw err('NO_ACCOUNT', `${walletType} returned no Injective account`);
      _session = {
        kind: 'cosmos', walletType, provider: wallet, signer,
        address: accounts[0].address, cosmosChainId
      };
    } catch (error) {
      if (error?.code === 4001 || /reject|denied/iu.test(error?.message ?? '')) {
        throw err('REJECTED', `User rejected the ${walletType} connection`);
      }
      throw error;
    }
    if (typeof window !== 'undefined' && !window._agentblCosmosWalletWired) {
      window._agentblCosmosWalletWired = true;
      window.addEventListener('keplr_keystorechange', () => clearWalletSession('account'));
      window.addEventListener('leap_keystorechange', () => clearWalletSession('account'));
    }
  } else {
    const ethers = await loadEthers();
    try {
      await wallet.request({ method: 'eth_requestAccounts' });
      await ensureTargetChain(wallet);
    } catch (error) {
      if (error?.code === 4001) throw err('REJECTED', 'User rejected the wallet or network request');
      throw err('NETWORK', `Unable to connect to the configured network: ${error?.message ?? error}`);
    }
    _cachedProvider = wallet;
    const provider = new ethers.BrowserProvider(wallet);
    const signer = await provider.getSigner();
    _session = { kind: 'evm', walletType: 'metamask', provider: wallet, browserProvider: provider, signer, address: await signer.getAddress() };
    if (!wallet._agentblWired) {
      wallet._agentblWired = true;
      wallet.on?.('accountsChanged', () => clearWalletSession('account'));
      wallet.on?.('chainChanged', () => clearWalletSession('network'));
    }
  }

  try { window.localStorage?.setItem('agentbl.walletType', walletType); } catch { /* storage optional */ }
  emitWalletChange('connected');
  return { address: _session.address, walletType: _session.walletType, kind: _session.kind };
}

function emitWalletChange(reason) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  const detail = { reason, address: _session?.address ?? null, walletType: _session?.walletType ?? null };
  const EventConstructor = window.CustomEvent ?? globalThis.CustomEvent;
  if (EventConstructor) window.dispatchEvent(new EventConstructor('agentbl:walletchange', { detail }));
}

function clearWalletSession(reason) {
  _session = null;
  emitWalletChange(reason);
}

export function __resetWeb3ForTests() {
  _ethers = null;
  _cosmosStargate = null;
  _registry = null;
  _config = null;
  _activeNetworkKey = null;
  _session = null;
  _cachedProvider = null;
}

/**
 * Disconnect the wallet: drop the cached signer session and, when the provider
 * supports it (EIP-2255), ask it to revoke this site's eth_accounts permission
 * so a later "connect" re-prompts instead of silently re-attaching. Best-effort:
 * the local session is always cleared even if the provider can't revoke.
 * @returns {Promise<{revoked:boolean}>}
 */
export async function disconnect() {
  const eth = _session?.kind === 'evm' ? _session.provider : null;
  let revoked = false;
  if (eth?.request) {
    try {
      await eth.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
      revoked = true;
    } catch {
      // Provider doesn't support revoking (or the user dismissed it) — the local
      // session is still cleared below; the wallet just stays authorized.
    }
  }
  clearWalletSession('disconnected');
  try { window.localStorage?.removeItem('agentbl.walletType'); } catch { /* storage optional */ }
  return { revoked };
}

async function getContract(write = false) {
  const cfg = await loadChainConfig();
  const address = cfg?.contracts?.AgentBLRWA;
  const hasAbi = Array.isArray(cfg?.abi) && cfg.abi.length > 0;
  console.log('[mint] chain-config:', { network: cfg?.network, address: address?.slice(0,10)+'…', abiLen: cfg?.abi?.length, hasAbi, session: !!_session });
  if (!isAddress(address)) throw err('NO_CONTRACT', 'AgentBLRWA 尚未部署（chain-config 无地址）');
  if (!_session) throw err('NO_SESSION', '钱包未连接');
  if (_session.kind !== 'evm') {
    throw err('EVM_WALLET_REQUIRED', 'This EVM contract action requires MetaMask; Keplr/Leap remain available for native Injective transactions');
  }
  const ethers = await loadEthers();
  console.log('[mint] signer address:', await _session.signer.getAddress());
  console.log('[mint] provider network:', await _session.browserProvider.getNetwork());
  return new ethers.Contract(address, cfg.abi, write ? _session.signer : _session.browserProvider);
}

function explorerTx(cfg, hash) {
  const base = cfg?.explorerBase;
  if (!base) return null;
  // Injective explorer uses /tx/ path like Etherscan
  return `${base}/tx/${hash}`;
}

/**
 * Build the on-chain tokenize() arguments from a PricingQuote + financing.
 */
export function mintArgsFromQuote(quote, financingUsd) {
  return {
    blId: quote.bl_id ?? quote.case_id ?? 'EBL-DEMO',
    issuePriceE6: BigInt(priceToE6(quote.final_issue_price_usd)),
    tokenSupply: BigInt(Math.max(1, Math.round(quote.recommended_token_supply || 0))),
    financingUsd: BigInt(Math.max(0, Math.round(financingUsd || 0))),
    collateralValueUsd: BigInt(Math.max(0, Math.round(quote.ai_verified_collateral_value_usd || 0))),
    riskScoreBps: Math.max(0, Math.round(quote.risk_score_bps || 0)),
    riskLevel: riskLevelToUint8(quote.risk_level),
    quoteHash: quote.quote_hash,
    evidenceHash: quote.evidence_hash
  };
}

/** Tokens the merchant would receive (floor(financing / issue price)), capped by supply. */
export function mintedTokensFor(quote, financingUsd) {
  const price = Number(quote.final_issue_price_usd) || 1;
  const raw = Math.floor((Number(financingUsd) || 0) / price);
  return Math.min(raw, Math.round(quote.recommended_token_supply || raw));
}

/**
 * Mint on real chain: submit tx, return pending result immediately,
 * then poll a public RPC in background to confirm.
 *
 * Returns { mode:'chain_pending', txHash, ... } right after tx is sent.
 * Calls onConfirmed(confirmedResult) when receipt arrives.
 *
 * @param {Function} [onConfirmed] — receives final result with poolId/blockNumber
 */
export async function mintOnChain(quote, financingUsd, onConfirmed) {
  const cfg = await loadChainConfig();
  const contract = await getContract(true);
  const a = mintArgsFromQuote(quote, financingUsd);
  let tx;
  try {
    tx = await contract.tokenize(
      a.blId, a.issuePriceE6, a.tokenSupply, a.financingUsd,
      a.collateralValueUsd, a.riskScoreBps, a.riskLevel, a.quoteHash, a.evidenceHash
    );
  } catch (e) {
    console.error('[mint] tokenize FAILED:', e);
    if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) throw err('REJECTED', '用户在钱包中拒绝了交易');
    throw e;
  }
  console.log('[mint] tx sent:', tx.hash);

  const pending = {
    mode: 'chain_pending',
    txHash: tx.hash,
    poolId: null,
    mintedAmount: mintedTokensFor(quote, financingUsd),
    issuePriceE6: Number(a.issuePriceE6),
    explorerUrl: explorerTx(cfg, tx.hash),
    address: _session?.address ?? null,
    blockNumber: null
  };

  // Background: poll public RPC every 3s until confirmed (max 2min)
  pollForReceipt(tx.hash, contract, quote, financingUsd, a, cfg, onConfirmed);

  return pending;
}

async function pollForReceipt(txHash, contract, quote, financingUsd, a, cfg, onConfirmed) {
  const ethers = await loadEthers();
  const pubProvider = new ethers.JsonRpcProvider(cfg.rpcUrls?.[0]);
  const deadline = Date.now() + 120000;

  const poll = async () => {
    try {
      const receipt = await pubProvider.getTransactionReceipt(txHash);
      if (receipt && receipt.blockNumber) {
        console.log('[mint] confirmed via poll — block:', receipt.blockNumber);
        let poolId = null, mintedAmount = null;
        for (const log of receipt.logs ?? []) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed?.name === 'Tokenized') {
              poolId = parsed.args.poolId;
              mintedAmount = parsed.args.mintedAmount;
            }
          } catch { /* not our event */ }
        }
        const confirmed = {
          mode: 'chain',
          txHash,
          poolId: poolId != null ? poolId.toString() : null,
          mintedAmount: mintedAmount != null ? Number(mintedAmount) : mintedTokensFor(quote, financingUsd),
          issuePriceE6: Number(a.issuePriceE6),
          explorerUrl: explorerTx(cfg, txHash),
          address: _session?.address ?? null,
          blockNumber: receipt.blockNumber
        };
        if (onConfirmed) onConfirmed(confirmed);
        return;
      }
    } catch (e) {
      // RPC hiccup, retry
    }
    if (Date.now() < deadline) {
      setTimeout(poll, 3000);
    } else {
      console.warn('[mint] poll timed out — tx:', txHash);
    }
  };

  setTimeout(poll, 2000); // start after 2s
}

/** Best-effort on-chain reprice for View ②'s in-transit events (non-blocking). */
export async function repriceOnChain(poolId, newQuote, reason) {
  const cfg = await loadChainConfig();
  const contract = await getContract(true);
  const tx = await contract.reprice(
    BigInt(poolId),
    BigInt(priceToE6(newQuote.final_issue_price_usd)),
    actionToUint8(newQuote.pricing_action),
    Math.max(0, Math.round(newQuote.risk_score_bps || 0)),
    riskLevelToUint8(newQuote.risk_level),
    newQuote.evidence_hash,
    String(reason || 'in-transit risk event').slice(0, 120)
  );
  // Fire and forget — don't block on tx.wait()
  console.log('[reprice] tx sent:', tx.hash);
  return { txHash: tx.hash, explorerUrl: explorerTx(cfg, tx.hash) };
}

/** Read a pool's RWA balance for an address (returns Number). */
export async function readBalance(poolId, address) {
  const contract = await getContract(false);
  const bal = await contract.balanceOf(BigInt(poolId), address);
  return Number(bal);
}

export async function protocolDeploymentInfo() {
  const cfg = await loadChainConfig();
  return {
    networkKey: cfg.key,
    displayName: cfg.displayName,
    accessModel: cfg.accessModel,
    explorerBase: cfg.explorerBase,
    contracts: Object.fromEntries(Object.entries(cfg.contracts ?? {}).filter(([, address]) => isAddress(address)))
  };
}

// Injective's public EVM RPC rejects eth_getLogs ranges larger than 10,000
// blocks. Keep each request at 10,000 blocks (9,999 block distance) and scan
// newest-first so callers that only need recent events can stop early.
const GET_LOGS_BLOCKS_PER_REQUEST = 10_000;

export async function queryFilterInChunks(contract, filter, fromBlock, toBlock, { limit = Infinity } = {}) {
  const start = Math.max(0, Math.trunc(Number(fromBlock)));
  const end = Math.max(0, Math.trunc(Number(toBlock)));
  const parsedLimit = Number(limit);
  const eventLimit = Number.isFinite(parsedLimit) ? Math.max(0, Math.trunc(parsedLimit)) : Infinity;
  if (end < start || eventLimit === 0) return [];

  const events = [];
  let chunkTo = end;
  while (chunkTo >= start) {
    const chunkFrom = Math.max(start, chunkTo - GET_LOGS_BLOCKS_PER_REQUEST + 1);
    const chunkEvents = await contract.queryFilter(filter, chunkFrom, chunkTo);
    events.unshift(...chunkEvents);
    if (events.length >= eventLimit || chunkFrom === start) break;
    chunkTo = chunkFrom - 1;
  }

  return Number.isFinite(eventLimit) ? events.slice(-eventLimit) : events;
}

/** Read the latest real PricingUpdated events through the configured public RPC. */
export async function readPricingUpdatedEvents(limit = 5) {
  const cfg = await loadChainConfig();
  const address = cfg.contracts?.RiskPricingOracle;
  const abi = cfg.abis?.RiskPricingOracle;
  if (!isAddress(address) || !Array.isArray(abi)) throw err('NO_CONTRACT', 'RiskPricingOracle deployment is missing');
  const ethers = await loadEthers();
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrls[0], cfg.chainIdDecimal);
  const contract = new ethers.Contract(address, abi, provider);
  const latest = await provider.getBlockNumber();
  const deployedBlock = Number(cfg.deployments?.RiskPricingOracle?.blockNumber ?? 0);
  const fromBlock = Math.max(deployedBlock || 0, latest - 25_000);
  const eventLimit = Math.max(1, Math.min(20, Number(limit) || 5));
  const events = await queryFilterInChunks(
    contract,
    contract.filters.PricingUpdated(),
    fromBlock,
    latest,
    { limit: eventLimit }
  );
  return events.reverse().map((event) => ({
    poolId: event.args.poolId.toString(),
    issuePriceE6: event.args.issuePrice.toString(),
    issuePriceUsd: Number(event.args.issuePrice) / 1_000_000,
    riskLevel: Number(event.args.riskLevel),
    action: Number(event.args.action),
    evidenceHash: event.args.evidenceHash,
    quoteHash: event.args.quoteHash,
    updater: event.args.updater,
    blockNumber: event.blockNumber,
    txHash: event.transactionHash,
    explorerUrl: explorerTx(cfg, event.transactionHash)
  }));
}

/** Send a minimal real self-transfer to prove the selected wallet can sign on Injective. */
export async function verifyWalletOnChain() {
  if (!_session) throw err('NO_SESSION', 'Connect a wallet first');
  const cfg = await loadChainConfig();
  if (_session.kind === 'evm') {
    const tx = await _session.signer.sendTransaction({ to: _session.address, value: 0n });
    const receipt = await tx.wait();
    return {
      walletType: _session.walletType,
      kind: 'evm',
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: explorerTx(cfg, tx.hash)
    };
  }

  const { SigningStargateClient, GasPrice, calculateFee } = await loadCosmosStargate();
  const gasPrice = GasPrice.fromString('500000000inj');
  const client = await SigningStargateClient.connectWithSigner(cfg.cosmosRpcUrl, _session.signer, { gasPrice });
  try {
    const result = await client.sendTokens(
      _session.address,
      _session.address,
      [{ denom: 'inj', amount: '1' }],
      calculateFee(90_000, gasPrice),
      `AgentBL ${_session.walletType} verification`
    );
    if (result.code !== 0) throw err('TX_FAILED', result.rawLog || `Cosmos transaction failed with code ${result.code}`);
    return {
      walletType: _session.walletType,
      kind: 'cosmos',
      txHash: result.transactionHash,
      blockNumber: result.height,
      explorerUrl: `${cfg.cosmosExplorerTxBase ?? ''}${result.transactionHash}` || null
    };
  } finally {
    client.disconnect();
  }
}

/**
 * Simulated mint fallback: a tx-shaped result from the existing
 * push_pricing_to_oracle MCP tool, so the View renders identically when no
 * wallet / no deployed contract is available.
 */
export async function simulatedMint(caseId, quote, financingUsd) {
  let tx = {};
  try {
    const res = await pushPricingToOracle(caseId, quote);
    tx = res.result ?? res ?? {};
  } catch { /* offline / endpoint missing — synthesize below */ }
  return {
    mode: 'sim',
    txHash: tx.tx_hash ?? ('0x' + 'sim'.padEnd(64, '0')),
    poolId: 'sim',
    mintedAmount: mintedTokensFor(quote, financingUsd),
    issuePriceE6: priceToE6(quote.final_issue_price_usd),
    explorerUrl: null,
    address: tx.from ?? null,
    blockNumber: tx.block_number ?? null,
    gasUsed: tx.gas_used ?? null
  };
}

/**
 * Call PaymentOracle.logPaymentEvidence() directly from the connected wallet.
 * Returns pending result immediately; polls public RPC for confirmation.
 */
export async function logX402PaymentOnChain({ payer, serviceId, amountMicrousd, paymentRef, responseHash, quoteHash, evidenceHash, pricingAction }, onConfirmed) {
  const cfg = await loadChainConfig();
  const address = cfg?.contracts?.PaymentOracle;
  const abi = cfg?.paymentOracle?.abi;
  if (!isAddress(address) || !abi) throw err('NO_CONTRACT', 'PaymentOracle 未部署');

  if (!_session) throw err('NO_SESSION', '钱包未连接');
  if (_session.kind !== 'evm') throw err('EVM_WALLET_REQUIRED', 'PaymentOracle requires the MetaMask EVM path');

  const ethers = await loadEthers();
  const oracle = new ethers.Contract(address, abi, _session.signer);

  let tx;
  try {
    tx = await oracle.logPaymentEvidence(
      payer, serviceId, BigInt(amountMicrousd), paymentRef,
      responseHash, quoteHash, evidenceHash, pricingAction
    );
  } catch (e) {
    if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) throw err('REJECTED', '用户在钱包中拒绝了交易');
    throw e;
  }
  console.log('[x402] tx sent:', tx.hash);

  // Background poll for confirmation
  const pubProvider = new ethers.JsonRpcProvider(cfg.rpcUrls?.[0]);
  const deadline = Date.now() + 120000;
  const poll = async () => {
    try {
      const receipt = await pubProvider.getTransactionReceipt(tx.hash);
      if (receipt && receipt.blockNumber) {
        console.log('[x402] confirmed via poll — block:', receipt.blockNumber);
        if (onConfirmed) onConfirmed({ txHash: tx.hash, explorerUrl: explorerTx(cfg, tx.hash), blockNumber: receipt.blockNumber });
        return;
      }
    } catch { /* retry */ }
    if (Date.now() < deadline) setTimeout(poll, 3000);
  };
  setTimeout(poll, 2000);

  return { txHash: tx.hash, explorerUrl: explorerTx(cfg, tx.hash), blockNumber: null };
}

/** Read a hardened PaymentOracle attestation by rpt_<sha256> or bytes32 id. */
export async function readX402PaymentAttestation(reportOrReceiptId) {
  const cfg = await loadChainConfig();
  const address = cfg?.contracts?.PaymentOracle;
  const abi = cfg?.paymentOracle?.abi;
  if (!isAddress(address) || !abi) throw err('NO_CONTRACT', 'PaymentOracle is not deployed');

  const receiptId = String(reportOrReceiptId).startsWith('rpt_')
    ? `0x${String(reportOrReceiptId).slice(4)}`
    : String(reportOrReceiptId);
  if (!/^0x[0-9a-fA-F]{64}$/.test(receiptId)) {
    throw err('INVALID_RECEIPT', 'Expected rpt_<sha256> or a bytes32 receipt id');
  }

  const ethers = await loadEthers();
  const provider = new ethers.JsonRpcProvider(getPreset(cfg).rpcUrls[0]);
  const oracle = new ethers.Contract(address, abi, provider);
  if (typeof oracle.getAttestation !== 'function') {
    throw err('OUTDATED_CONTRACT', 'Configured PaymentOracle predates PaymentAttested; redeploy it');
  }
  const stored = await oracle.getAttestation(receiptId);
  const events = await oracle.queryFilter(oracle.filters.PaymentAttested(receiptId));
  const event = events.at(-1);
  return {
    receiptId,
    reportHash: stored.reportHash,
    caseIdHash: stored.caseIdHash,
    paymentTxHash: stored.paymentTxHash,
    payer: stored.payer,
    asset: stored.asset,
    amount: stored.amount.toString(),
    attestor: stored.attestor,
    timestamp: Number(stored.timestamp),
    attestationTxHash: event?.transactionHash ?? null,
    explorerUrl: event?.transactionHash ? explorerTx(cfg, event.transactionHash) : null
  };
}
