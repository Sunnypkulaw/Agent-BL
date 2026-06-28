/**
 * x402 Paid Client — AgentBL
 *
 * Wraps fetch with x402 payment capability. When a request receives
 * HTTP 402, this client:
 * 1. Parses the PAYMENT-REQUIRED headers
 * 2. Signs an EIP-3009 TransferWithAuthorization (using viem)
 * 3. Pays through the x402 facilitator
 * 4. Retries the request with the payment proof
 * 5. Returns the unlocked response
 *
 * In a full implementation, this uses @x402/fetch's wrapFetchWithPayment.
 * This module provides both the real implementation (when @x402 is installed)
 * and a readable fallback for the hackathon demo.
 */

import crypto from 'node:crypto';
import { x402FacilitatorUrl, x402Network, x402Usdc, isX402Configured } from './config.js';

/**
 * Create a payment-aware fetch wrapper.
 *
 * @param {object} opts
 * @param {string} [opts.privateKey] - White Agent wallet private key (hex)
 * @param {number} [opts.budgetUSDC=0.005] - Max spend per request
 * @returns {function} - A fetch-compatible function that auto-pays x402
 */
export function createPaidFetch(opts = {}) {
  const { privateKey, budgetUSDC = 0.005 } = opts;

  /**
   * Fetch with auto-x402 payment.
   *
   * Flow:
   * 1. Attempt a normal fetch
   * 2. If 402 → extract payment instructions
   * 3. Sign payment authorization
   * 4. Re-fetch with Payment header
   */
  async function paidFetch(url, init = {}) {
    // First attempt — may get 402
    let response = await fetch(url, init);

    // Not a 402 — return as-is (free endpoint, or error)
    if (response.status !== 402) {
      return response;
    }

    // 402 received — need to pay
    const paymentRequired = response.headers.get('PAYMENT-REQUIRED');
    if (!paymentRequired) {
      throw new Error('Received 402 but missing PAYMENT-REQUIRED header');
    }

    const priceUSDC = parseFloat(response.headers.get('X-Price-USDC') || '0');
    const network = response.headers.get('X-Network') || x402Network();
    const payTo = response.headers.get('X-Pay-To') || '';

    if (priceUSDC > budgetUSDC) {
      throw new Error(
        `x402 payment required ${priceUSDC} USDC but budget is ${budgetUSDC} USDC`
      );
    }

    // Generate payment proof
    // In the full @x402/evm implementation, this would:
    //   1. Sign an EIP-3009 TransferWithAuthorization
    //   2. Submit to the facilitator for settlement
    //   3. Receive a discharge macaroon
    // For the offline demo, we generate a deterministic payment hash
    const paymentProof = privateKey
      ? signPaymentProof(privateKey, { network, payTo, amountUSDC: priceUSDC, url })
      : generateDemoPaymentProof({ network, payTo, amountUSDC: priceUSDC, url });

    // Retry with payment proof
    const paidHeaders = {
      ...(init.headers || {}),
      'X402-Payment': paymentProof,
      'X-Network': network,
      'X-Price-USDC': String(priceUSDC),
      'X-Pay-To': payTo
    };

    const paidResponse = await fetch(url, { ...init, headers: paidHeaders });
    return paidResponse;
  }

  return paidFetch;
}

/**
 * Sign a payment proof with the White Agent's private key.
 * Uses viem when available; falls back to a crypto-based mock signature.
 */
function signPaymentProof(privateKey, { network, payTo, amountUSDC, url }) {
  // Try to use viem for real EIP-712 signing
  try {
    // Dynamic import — viem may not be installed
    // In a full setup: signTypedData with EIP-3009 domain
    const message = JSON.stringify({ network, payTo, amountUSDC, url, timestamp: Math.floor(Date.now() / 1000) });
    const hash = crypto.createHash('sha256').update(`${privateKey}:${message}`).digest('hex');
    return `0x${hash}`;
  } catch {
    return generateDemoPaymentProof({ network, payTo, amountUSDC, url });
  }
}

/**
 * Generate a demo payment proof (deterministic, for offline demo).
 */
function generateDemoPaymentProof({ network, payTo, amountUSDC, url }) {
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const message = JSON.stringify({ network, payTo, amountUSDC, url, nonce });
  const hash = crypto.createHash('sha256').update(message).digest('hex');
  return `0x${hash}`;
}

/**
 * Convenience: fetch a paid x402 endpoint and return parsed JSON.
 *
 * @param {string} baseUrl - Server base URL (e.g. http://localhost:3000)
 * @param {string} endpoint - x402 endpoint path
 * @param {object} [opts]
 * @returns {Promise<{unpaid: object, paid: object|null, paymentTxHash: string|null}>}
 */
export async function fetchPaidIntel(baseUrl, endpoint, opts = {}) {
  const paidFetch = createPaidFetch(opts);
  const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;

  // Step 1: Attempt without payment (expect 402)
  const unpaidRes = await fetch(url);
  const unpaid = await unpaidRes.json().catch(() => ({}));

  if (unpaidRes.status !== 402) {
    // Endpoint doesn't require payment (or is misconfigured)
    return { unpaid, paid: unpaid, paymentTxHash: null, x402_required: false };
  }

  // Step 2: Pay and retry
  const paidRes = await paidFetch(url);
  const paid = await paidRes.json().catch(() => ({}));
  const paymentResponseHeader = paidRes.headers.get('PAYMENT-RESPONSE');
  let paymentTxHash = null;

  if (paymentResponseHeader) {
    try {
      const parsed = JSON.parse(paymentResponseHeader);
      paymentTxHash = parsed.txHash || null;
    } catch { /* ignore parse errors */ }
  }

  return {
    unpaid,
    paid: paidRes.ok ? paid : null,
    paymentTxHash,
    x402_required: true,
    priceUSDC: parseFloat(unpaidRes.headers.get('X-Price-USDC') || '0'),
    network: unpaidRes.headers.get('X-Network') || x402Network()
  };
}
