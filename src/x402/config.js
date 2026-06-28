import path from 'node:path';
import { SupportedResponseSchema } from '@injectivelabs/x402/schemas';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/u;
const ATOMIC_AMOUNT_RE = /^[1-9][0-9]*$/u;

export const X402_NETWORKS = Object.freeze({
  'eip155:1776': Object.freeze({
    chainId: 1776,
    label: 'Injective Mainnet',
    asset: '0xa00C59fF5a080D2b954d0c75e46E22a0c371235a',
    decimals: 6,
    explorerUrl: 'https://blockscout.injective.network'
  }),
  'eip155:1439': Object.freeze({
    chainId: 1439,
    label: 'Injective Testnet',
    asset: '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d',
    decimals: 6,
    explorerUrl: 'https://testnet.blockscout.injective.network'
  })
});

export const X402_MODES = Object.freeze(['demo', 'live']);
export const DEMO_PAY_TO = '0x1111111111111111111111111111111111111439';

export const DEFAULT_X402_ENDPOINTS = Object.freeze([
  Object.freeze({
    id: 'advanced-risk-intelligence',
    method: 'POST',
    path: '/api/x402/intelligence/risk',
    description: 'Advanced AI trade and shipment risk intelligence',
    mimeType: 'application/json',
    priceEnv: 'X402_PRICE_RISK_ATOMIC',
    defaultAmount: '50000'
  }),
  Object.freeze({
    id: 'advanced-valuation',
    method: 'POST',
    path: '/api/x402/intelligence/valuation',
    description: 'Advanced AI collateral valuation and comparable pricing',
    mimeType: 'application/json',
    priceEnv: 'X402_PRICE_VALUATION_ATOMIC',
    defaultAmount: '100000'
  }),
  Object.freeze({
    id: 'x402-smoke',
    method: 'GET',
    path: '/api/x402/smoke',
    description: 'Low-cost x402 integration smoke test',
    mimeType: 'application/json',
    priceEnv: 'X402_PRICE_SMOKE_ATOMIC',
    defaultAmount: '1000'
  })
]);

export class X402ConfigError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'X402ConfigError';
    this.code = 'x402_config_invalid';
    this.details = details;
  }
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  throw new X402ConfigError(`Expected a boolean value, received: ${String(value)}`);
}

function parseInteger(value, name, { min, max }) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new X402ConfigError(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function normalizeAddress(value, name) {
  if (typeof value !== 'string' || !ADDRESS_RE.test(value)) {
    throw new X402ConfigError(`${name} must be a 20-byte 0x-prefixed EVM address`);
  }
  return value;
}

function normalizeAtomicAmount(value, name) {
  const normalized = String(value ?? '');
  if (!ATOMIC_AMOUNT_RE.test(normalized)) {
    throw new X402ConfigError(`${name} must be a positive integer in USDC atomic units (no decimal point)`);
  }
  return normalized;
}

function normalizeFacilitatorUrl(value, { mode, network, allowInsecureTestnet }) {
  if (!value) {
    if (mode === 'live') throw new X402ConfigError('X402_FACILITATOR_URL is required in live mode');
    return null;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new X402ConfigError('X402_FACILITATOR_URL must be an absolute HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new X402ConfigError('X402_FACILITATOR_URL must use HTTP or HTTPS');
  }
  if (mode === 'live' && url.protocol !== 'https:') {
    const permittedTestnetException = network === 'eip155:1439' && allowInsecureTestnet;
    if (!permittedTestnetException) {
      throw new X402ConfigError('Live facilitator must use HTTPS; insecure HTTP is testnet opt-in only');
    }
  }
  return url.toString().replace(/\/$/u, '');
}

function buildEndpoints(env, network, asset, payTo, ttlSeconds) {
  return DEFAULT_X402_ENDPOINTS.map((endpoint) => ({
    id: endpoint.id,
    method: endpoint.method,
    path: endpoint.path,
    description: endpoint.description,
    mimeType: endpoint.mimeType,
    amount: normalizeAtomicAmount(env[endpoint.priceEnv] ?? endpoint.defaultAmount, endpoint.priceEnv),
    network,
    asset,
    payTo,
    maxTimeoutSeconds: ttlSeconds
  }));
}

export function loadX402Config(env = process.env, options = {}) {
  const mode = String(options.mode ?? env.X402_MODE ?? 'demo').toLowerCase();
  if (!X402_MODES.includes(mode)) {
    throw new X402ConfigError(`X402_MODE must be one of: ${X402_MODES.join(', ')}`);
  }

  const network = options.network ?? env.X402_NETWORK ?? 'eip155:1439';
  const networkConfig = X402_NETWORKS[network];
  if (!networkConfig) {
    throw new X402ConfigError(`Unsupported X402_NETWORK: ${network}. Expected eip155:1776 or eip155:1439`);
  }

  const decimals = parseInteger(options.decimals ?? env.X402_ASSET_DECIMALS ?? networkConfig.decimals, 'X402_ASSET_DECIMALS', { min: 0, max: 18 });
  if (decimals !== networkConfig.decimals) {
    throw new X402ConfigError(`Injective USDC uses ${networkConfig.decimals} decimals on ${network}`);
  }

  const asset = normalizeAddress(options.asset ?? env.X402_ASSET ?? networkConfig.asset, 'X402_ASSET');
  if (asset.toLowerCase() !== networkConfig.asset.toLowerCase()) {
    throw new X402ConfigError(`X402_ASSET must be canonical USDC for ${network}: ${networkConfig.asset}`);
  }

  const payToInput = options.payTo ?? env.X402_PAY_TO ?? (mode === 'demo' ? DEMO_PAY_TO : undefined);
  if (!payToInput) throw new X402ConfigError('X402_PAY_TO is required in live mode');
  const payTo = normalizeAddress(payToInput, 'X402_PAY_TO');
  if (mode === 'live' && /^0x0{40}$/iu.test(payTo)) {
    throw new X402ConfigError('X402_PAY_TO cannot be the zero address in live mode');
  }

  const ttlSeconds = parseInteger(options.ttlSeconds ?? env.X402_TTL_SECONDS ?? 60, 'X402_TTL_SECONDS', { min: 10, max: 300 });
  const requestTimeoutMs = parseInteger(options.requestTimeoutMs ?? env.X402_REQUEST_TIMEOUT_MS ?? 10_000, 'X402_REQUEST_TIMEOUT_MS', { min: 100, max: 60_000 });
  const maxAttempts = parseInteger(options.maxAttempts ?? env.X402_MAX_ATTEMPTS ?? 3, 'X402_MAX_ATTEMPTS', { min: 1, max: 5 });
  const allowInsecureTestnet = parseBoolean(options.allowInsecureTestnet ?? env.X402_ALLOW_INSECURE_TESTNET, false);
  const facilitatorUrl = normalizeFacilitatorUrl(options.facilitatorUrl ?? env.X402_FACILITATOR_URL, {
    mode,
    network,
    allowInsecureTestnet
  });
  const receiptStorePath = options.receiptStorePath ?? env.X402_RECEIPT_STORE_PATH ?? path.resolve('data/runtime/x402-receipts.json');

  const config = {
    mode,
    live: mode === 'live',
    network,
    chainId: networkConfig.chainId,
    networkLabel: networkConfig.label,
    asset,
    assetSymbol: 'USDC',
    assetDecimals: decimals,
    payTo,
    facilitatorUrl,
    allowInsecureTestnet,
    ttlSeconds,
    requestTimeoutMs,
    maxAttempts,
    receiptStorePath,
    explorerUrl: networkConfig.explorerUrl
  };
  config.endpoints = buildEndpoints(env, network, asset, payTo, ttlSeconds);
  return config;
}

export function routeMapFromConfig(config) {
  return Object.fromEntries(config.endpoints.map((endpoint) => [`${endpoint.method} ${endpoint.path}`, endpoint]));
}

export function formatUsdcAtomic(amount, decimals = 6) {
  const atomic = normalizeAtomicAmount(amount, 'amount');
  const padded = atomic.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/u, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

export async function validateFacilitatorSupport(config, options = {}) {
  if (config.mode === 'demo') {
    return { ok: true, skipped: true, reason: 'demo_mode' };
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new X402ConfigError('A fetch implementation is required for live facilitator validation');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  let response;
  try {
    response = await fetchImpl(`${config.facilitatorUrl}/supported`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal
    });
  } catch (error) {
    throw new X402ConfigError(`Facilitator /supported request failed: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new X402ConfigError(`Facilitator /supported returned HTTP ${response.status}`);
  }

  let body;
  try {
    body = SupportedResponseSchema.parse(await response.json());
  } catch (error) {
    throw new X402ConfigError(`Facilitator /supported returned an invalid response: ${error.message}`);
  }
  const kind = body.kinds.find((entry) => entry.x402Version === 2 && entry.scheme === 'exact' && entry.network === config.network);
  if (!kind) {
    throw new X402ConfigError(`Facilitator does not advertise exact/V2 support for ${config.network}`);
  }
  const assets = Array.isArray(kind.extra?.supportedAssets) ? kind.extra.supportedAssets : [];
  const supportedAsset = assets.find((entry) =>
    typeof entry?.address === 'string' && entry.address.toLowerCase() === config.asset.toLowerCase()
  );
  if (!supportedAsset) throw new X402ConfigError(`Facilitator does not advertise configured USDC ${config.asset}`);
  if (supportedAsset.decimals !== config.assetDecimals || supportedAsset.assetTransferMethod !== 'eip3009') {
    throw new X402ConfigError('Facilitator USDC metadata must declare 6 decimals and eip3009');
  }
  return { ok: true, skipped: false, kind, signer: body.signers?.[config.network]?.[0] ?? null };
}

