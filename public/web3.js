// Browser web3 integration for TradeShield View ① (Tokenize / Mint RWA).
//
// Strategy (confirmed with the team): mint on REAL Sepolia via MetaMask when a
// wallet is connected AND public/chain-config.json carries a deployed
// TradeShieldRWA address; otherwise fall back to a high-fidelity SIMULATED
// transaction (the existing push_pricing_to_oracle MCP tool) so the demo never
// breaks offline / pre-deploy.
//
// ethers v6 is loaded lazily from a CDN (only when the user connects a wallet),
// keeping the rest of the dashboard dependency-free and offline-capable.

import { priceToE6, riskLevelToUint8, actionToUint8 } from './format.js';
import { pushPricingToOracle } from './api.js';

const ETHERS_CDNS = [
  'https://esm.sh/ethers@6.13.4',
  'https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm'
];

const SEPOLIA = { hex: '0xaa36a7', decimal: 11155111n };

// --- module-level caches ----------------------------------------------------
let _ethers = null;
let _config = null;
let _session = null; // { provider, signer, address }

/** Lazy-load ethers v6 from a CDN (cached). Tries mirrors in order. */
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

const isAddress = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);

/** True when a real contract address is configured (deploy script has run). */
export async function isRealChainConfigured() {
  const cfg = await loadChainConfig();
  return Boolean(cfg && isAddress(cfg.contracts?.TradeShieldRWA));
}

export function hasInjectedWallet() {
  return typeof window !== 'undefined' && !!window.ethereum;
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

/** Ensure the wallet is on Sepolia, adding the network if unknown (EIP-3085). */
async function ensureSepolia() {
  const eth = window.ethereum;
  const current = await eth.request({ method: 'eth_chainId' });
  if (current === SEPOLIA.hex) return;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA.hex }] });
  } catch (switchErr) {
    if (switchErr?.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: SEPOLIA.hex,
          chainName: 'Sepolia test network',
          nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
          blockExplorerUrls: ['https://sepolia.etherscan.io']
        }]
      });
    } else {
      throw switchErr;
    }
  }
}

/**
 * Connect MetaMask, ensure Sepolia, cache a signer session.
 * @returns {Promise<{address:string}>}
 * @throws {Error} with .code: NO_WALLET | REJECTED | NETWORK
 */
export async function connectWallet() {
  if (!hasInjectedWallet()) throw err('NO_WALLET', '未检测到浏览器钱包（请安装 MetaMask）');
  const ethers = await loadEthers();
  const eth = window.ethereum;
  try {
    await eth.request({ method: 'eth_requestAccounts' });
  } catch (e) {
    if (e?.code === 4001) throw err('REJECTED', '用户拒绝了连接请求');
    throw e;
  }
  try {
    await ensureSepolia();
  } catch (e) {
    if (e?.code === 4001) throw err('REJECTED', '用户拒绝了网络切换');
    throw err('NETWORK', '无法切换到 Sepolia 测试网：' + (e?.message ?? ''));
  }
  const provider = new ethers.BrowserProvider(eth);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  _session = { provider, signer, address };

  // Re-create the session if the user changes account/network mid-demo.
  if (!eth._tradeshieldWired) {
    eth._tradeshieldWired = true;
    eth.on?.('accountsChanged', () => { _session = null; });
    eth.on?.('chainChanged', () => { _session = null; });
  }
  return { address };
}

async function getContract(write = false) {
  const cfg = await loadChainConfig();
  const address = cfg?.contracts?.TradeShieldRWA;
  if (!isAddress(address)) throw err('NO_CONTRACT', 'TradeShieldRWA 尚未部署（chain-config 无地址）');
  if (!_session) throw err('NO_SESSION', '钱包未连接');
  const ethers = await loadEthers();
  return new ethers.Contract(address, cfg.abi, write ? _session.signer : _session.provider);
}

function explorerTx(cfg, hash) {
  return cfg?.explorerBase ? `${cfg.explorerBase}/tx/${hash}` : null;
}

/**
 * Build the on-chain tokenize() arguments from a PricingQuote + financing.
 * Shared by the real and (for parity) the display path.
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
 * Mint on real Sepolia: call tokenize(), wait, parse the Tokenized event.
 * @returns {Promise<{mode:'chain', txHash, poolId, mintedAmount, issuePriceE6, explorerUrl, address, blockNumber}>}
 * @throws {Error} with .code REJECTED on user cancel; others bubble up.
 */
export async function mintOnChain(quote, financingUsd) {
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
    if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) throw err('REJECTED', '用户在钱包中拒绝了交易');
    throw e;
  }
  const receipt = await tx.wait();

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

  return {
    mode: 'chain',
    txHash: tx.hash,
    poolId: poolId != null ? poolId.toString() : null,
    mintedAmount: mintedAmount != null ? Number(mintedAmount) : mintedTokensFor(quote, financingUsd),
    issuePriceE6: Number(a.issuePriceE6),
    explorerUrl: explorerTx(cfg, tx.hash),
    address: _session.address,
    blockNumber: receipt.blockNumber
  };
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
  await tx.wait();
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
