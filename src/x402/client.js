import { x402Network } from './config.js';

export class X402ClientError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'X402ClientError';
    this.code = code;
    this.recoverable = options.recoverable ?? true;
    this.cause = options.cause;
  }
}

function demoModeDefault(env = process.env) {
  return env.DEMO_MODE !== 'false' && env.X402_MODE !== 'live';
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: init.signal ?? controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new X402ClientError('X402_TIMEOUT', `x402 request timed out after ${timeoutMs}ms`, { cause: error });
    }
    throw new X402ClientError('X402_NETWORK_ERROR', `x402 request failed: ${error.message}`, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

async function parseChallenge(response) {
  let body = {};
  try {
    body = await response.clone().json();
  } catch {
    // A useful error is emitted below when the challenge is incomplete.
  }
  if (!body.challenge || !body.nonce) {
    throw new X402ClientError(
      'X402_CHALLENGE_UNSUPPORTED',
      'The 402 response does not contain a signable AgentBL challenge'
    );
  }
  const amount = Number(body.priceUSDC ?? response.headers.get('X-Price-USDC'));
  const network = body.network ?? response.headers.get('X-Network') ?? x402Network();
  const payTo = body.payTo ?? response.headers.get('X-Pay-To') ?? null;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new X402ClientError('X402_PRICE_INVALID', 'The 402 response contains an invalid price', { recoverable: false });
  }
  return { body, amount, network, payTo };
}

async function resolveSigner(options) {
  if (options.signer) {
    const address = options.signerAddress
      ?? options.signer.address
      ?? await options.signer.getAddress?.();
    const signMessage = options.signer.signMessage?.bind(options.signer);
    if (!address || typeof signMessage !== 'function') {
      throw new X402ClientError('X402_SIGNER_INVALID', 'Signer must expose an address and signMessage(message)');
    }
    return { address, signMessage, ephemeral: false };
  }

  const { ethers } = await import('ethers');
  if (options.privateKey) {
    try {
      const wallet = new ethers.Wallet(options.privateKey.trim());
      return { address: wallet.address, signMessage: wallet.signMessage.bind(wallet), ephemeral: false };
    } catch (error) {
      throw new X402ClientError('X402_PRIVATE_KEY_INVALID', 'Configured x402 signer key is invalid', {
        recoverable: false,
        cause: error
      });
    }
  }
  if (options.demoMode) {
    const wallet = ethers.Wallet.createRandom();
    return { address: wallet.address, signMessage: wallet.signMessage.bind(wallet), ephemeral: true };
  }
  throw new X402ClientError(
    'X402_SIGNER_REQUIRED',
    'Live x402 purchase requires WHITE_AGENT_PRIVATE_KEY or an injected wallet signer'
  );
}

/** USDC settles with 6 decimals; convert a USDC face amount to atomic units. */
function toAtomicUsdc(amountUSDC) {
  return BigInt(Math.round(Number(amountUSDC) * 1_000_000));
}

/**
 * Map a failed paid retry response into a recoverable client error code so the
 * caller can show a clear, actionable hint instead of a raw HTTP body.
 */
export function classifyPaidFailure(status, body = {}) {
  const message = String(body?.error ?? body?.message ?? '').trim();
  if (/insufficient|balance|funds/iu.test(message)) {
    return {
      code: 'X402_INSUFFICIENT_BALANCE',
      message: message || 'The signer does not hold enough USDC to settle this payment',
      recoverable: true
    };
  }
  if (status === 401 || /signature|signer/iu.test(message)) {
    return {
      code: 'X402_SIGNATURE_REJECTED',
      message: message || 'The payment signature was rejected by the resource server',
      recoverable: true
    };
  }
  if (/timeout|timed out/iu.test(message)) {
    return { code: 'X402_TIMEOUT', message: message || 'Settlement timed out', recoverable: true };
  }
  return {
    code: 'X402_SETTLEMENT_FAILED',
    message: message || `Payment settlement failed (HTTP ${status})`,
    recoverable: true
  };
}

function mergePaidBody(init, challenge, payload) {
  let original = {};
  if (typeof init.body === 'string' && init.body.trim()) {
    try { original = JSON.parse(init.body); } catch { original = {}; }
  } else if (init.body && typeof init.body === 'object' && !(init.body instanceof Uint8Array)) {
    original = init.body;
  }
  return JSON.stringify({ ...original, ...(payload ?? {}), nonce: challenge.body.nonce });
}

/**
 * Create a fetch-compatible AgentBL x402 client. The first request receives a
 * 402 challenge; an injected wallet/CLI signer signs it; the second request is
 * retried with the signature. Private keys are used locally and never sent.
 */
export function createPaidFetch(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const budgetUSDC = options.budgetUSDC ?? 0.005;
  const allowedNetworks = new Set(options.allowedNetworks ?? ['eip155:1439', 'eip155:1776']);
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');

  return async function paidFetch(url, init = {}) {
    const unpaid = await fetchWithTimeout(fetchImpl, url, init, timeoutMs);
    if (unpaid.status !== 402) return unpaid;
    const challenge = await parseChallenge(unpaid);
    options.onChallenge?.(challenge, unpaid);

    if (challenge.amount > budgetUSDC) {
      throw new X402ClientError(
        'X402_BUDGET_EXCEEDED',
        `Payment ${challenge.amount} USDC exceeds budget ${budgetUSDC} USDC`
      );
    }
    if (!allowedNetworks.has(challenge.network)) {
      throw new X402ClientError('X402_WRONG_NETWORK', `Refusing x402 payment on ${challenge.network}`);
    }

    const signer = await resolveSigner({
      ...options,
      demoMode: options.demoMode ?? demoModeDefault(options.env)
    });

    // Optional pre-flight balance guard: when the caller can read the signer's
    // on-chain USDC balance, refuse to sign a payment the wallet cannot cover so
    // the user gets a top-up hint instead of a failed settlement after signing.
    if (typeof options.balanceOf === 'function') {
      const requiredAtomic = toAtomicUsdc(challenge.amount);
      let balanceAtomic;
      try {
        balanceAtomic = BigInt(await options.balanceOf(signer.address));
      } catch (error) {
        throw new X402ClientError('X402_BALANCE_CHECK_FAILED', `Could not read USDC balance: ${error.message}`, { cause: error });
      }
      if (balanceAtomic < requiredAtomic) {
        throw new X402ClientError(
          'X402_INSUFFICIENT_BALANCE',
          `Signer ${signer.address} holds ${balanceAtomic} atomic USDC but ${requiredAtomic} is required`
        );
      }
    }

    let signature;
    try {
      signature = await signer.signMessage(challenge.body.challenge);
    } catch (error) {
      const rejected = error?.code === 4001 || error?.code === 'ACTION_REJECTED' || error?.code === 'REJECTED';
      throw new X402ClientError(
        rejected ? 'X402_SIGNATURE_CANCELLED' : 'X402_SIGNATURE_FAILED',
        rejected ? 'The x402 signature request was cancelled' : `Could not sign x402 challenge: ${error.message}`,
        { cause: error }
      );
    }

    const headers = new Headers(init.headers ?? {});
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    headers.set('X402-Signature', signature);
    headers.set('X402-Signer', signer.address);
    const paidInit = {
      ...init,
      method: options.retryMethod ?? 'POST',
      headers,
      body: mergePaidBody(init, challenge, options.payload)
    };
    const paid = await fetchWithTimeout(fetchImpl, url, paidInit, timeoutMs);
    options.onPayment?.({ challenge, signer: signer.address, ephemeral: signer.ephemeral, response: paid });
    return paid;
  };
}

function parsePaymentResponse(header) {
  if (!header) return null;
  try {
    return JSON.parse(header);
  } catch {
    try {
      return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
}

export async function fetchPaidIntel(baseUrl, endpoint, options = {}) {
  let capturedChallenge = null;
  let paymentMeta = null;
  const paidFetch = createPaidFetch({
    ...options,
    payload: options.caseData ? { case: options.caseData } : options.payload,
    onChallenge: (challenge, response) => {
      capturedChallenge = { challenge, response };
      options.onChallenge?.(challenge, response);
    },
    onPayment: (meta) => {
      paymentMeta = meta;
      options.onPayment?.(meta);
    }
  });
  const url = `${baseUrl.replace(/\/$/u, '')}${endpoint}`;
  const response = await paidFetch(url, { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!capturedChallenge) {
    return { unpaid: body, paid: body, paymentTxHash: null, payment: null, x402_required: false };
  }
  const receipt = parsePaymentResponse(response.headers.get('PAYMENT-RESPONSE'));
  return {
    unpaid: capturedChallenge.challenge.body,
    paid: response.ok ? body : null,
    error: response.ok ? null : body,
    failure: response.ok ? null : classifyPaidFailure(response.status, body),
    paymentTxHash: receipt?.txHash ?? receipt?.transaction ?? body?.payment?.txHash ?? null,
    payment: body?.payment ?? receipt,
    x402_required: true,
    priceUSDC: capturedChallenge.challenge.amount,
    network: capturedChallenge.challenge.network,
    signer: paymentMeta?.signer ?? null,
    demoSigner: paymentMeta?.ephemeral === true
  };
}
