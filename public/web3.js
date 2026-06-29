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
let _config = null;
let _session = null; // { provider, signer, address }
let _cachedProvider = null; // detected EIP-1193 provider

/** Auto-detect the active EIP-1193 provider. Supports MetaMask, OKX, Trust, Bitget, Rabby, etc. */
export function getEthereumProvider() {
  if (_cachedProvider) return _cachedProvider;
  if (typeof window === 'undefined') return null;
  // Prefer wallet-specific namespaces (e.g. OKX → window.okxwallet), fall back to window.ethereum.
  _cachedProvider = window.okxwallet?.request ? window.okxwallet
    : window.trustwallet?.request ? window.trustwallet
    : window.bitkeep?.request ? window.bitkeep
    : window.bitget?.request ? window.bitget
    : window.rabby?.request ? window.rabby
    : window.tokenpocket?.request ? window.tokenpocket
    : window.ethereum?.request ? window.ethereum
    : null;
  return _cachedProvider;
}

/** Lazy-load ethers v6 from a CDN (cached). */
export async function loadEthers() {
  if (_ethers) return _ethers;
  let lastErr;
  for (const url of ETHERS_CDNS) {
    try {
      _ethers = await import(/* @vite-ignore */ url);
      return _ethers;
    } catch (err) { lastErr = err; }
  }
  throw new Error('Failed to load ethers from CDN: ' + (lastErr?.message ?? 'unknown'));
}

/** Load /chain-config.json (cached). Never throws — returns null on failure. */
export async function loadChainConfig() {
  if (_config) return _config;
  try {
    const res = await fetch('/chain-config.json', { cache: 'no-store' });
    if (!res.ok) return null;
    _config = await res.json();
    return _config;
  } catch { return null; }
}

/** Return the chain preset for the configured network (falls back to injective_testnet). */
function getPreset(cfg) {
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
  return !!getEthereumProvider();
}

export function isWalletConnected() {
  return Boolean(_session?.address);
}

export function connectedAddress() {
  return _session?.address ?? null;
}

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/** Ensure the wallet is on the target chain (from chain-config.json), adding the network if unknown (EIP-3085). */
async function ensureTargetChain() {
  const cfg = await loadChainConfig();
  const preset = getPreset(cfg);
  const targetHex = cfg?.chainId || '0x59F'; // default: Injective Testnet

  const eth = getEthereumProvider();
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
 * Connect wallet (MetaMask / OKX / any EIP-1193 provider), ensure target chain, cache signer.
 * @returns {Promise<{address:string}>}
 * @throws {Error} with .code: NO_WALLET | REJECTED | NETWORK
 */
export async function connectWallet() {
  const eth = getEthereumProvider();
  if (!eth) throw err('NO_WALLET', '未检测到浏览器钱包（请安装 MetaMask 或 OKX 钱包）');
  const ethers = await loadEthers();
  try {
    await eth.request({ method: 'eth_requestAccounts' });
  } catch (e) {
    if (e?.code === 4001) throw err('REJECTED', '用户拒绝了连接请求');
    throw e;
  }
  try {
    await ensureTargetChain();
  } catch (e) {
    if (e?.code === 4001) throw err('REJECTED', '用户拒绝了网络切换');
    throw err('NETWORK', '无法切换到目标网络：' + (e?.message ?? ''));
  }
  const provider = new ethers.BrowserProvider(eth);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  _session = { provider, signer, address };

  // Re-create the session if the user changes account/network mid-demo.
  if (!eth._agentblWired) {
    eth._agentblWired = true;
    eth.on?.('accountsChanged', () => { _session = null; });
    eth.on?.('chainChanged', () => { _session = null; });
  }
  return { address };
}

/**
 * Disconnect the wallet: drop the cached signer session and, when the provider
 * supports it (EIP-2255), ask it to revoke this site's eth_accounts permission
 * so a later "connect" re-prompts instead of silently re-attaching. Best-effort:
 * the local session is always cleared even if the provider can't revoke.
 * @returns {Promise<{revoked:boolean}>}
 */
export async function disconnect() {
  const eth = getEthereumProvider();
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
  _session = null;
  return { revoked };
}

async function getContract(write = false) {
  const cfg = await loadChainConfig();
  const address = cfg?.contracts?.AgentBLRWA;
  const hasAbi = Array.isArray(cfg?.abi) && cfg.abi.length > 0;
  console.log('[mint] chain-config:', { network: cfg?.network, address: address?.slice(0,10)+'…', abiLen: cfg?.abi?.length, hasAbi, session: !!_session });
  if (!isAddress(address)) throw err('NO_CONTRACT', 'AgentBLRWA 尚未部署（chain-config 无地址）');
  if (!_session) throw err('NO_SESSION', '钱包未连接');
  const ethers = await loadEthers();
  console.log('[mint] signer address:', await _session.signer.getAddress());
  console.log('[mint] provider network:', await _session.provider.getNetwork());
  return new ethers.Contract(address, cfg.abi, write ? _session.signer : _session.provider);
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
  const pubProvider = new ethers.JsonRpcProvider('https://testnet.sentry.chain.json-rpc.injective.network');
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
  const pubProvider = new ethers.JsonRpcProvider('https://testnet.sentry.chain.json-rpc.injective.network');
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
