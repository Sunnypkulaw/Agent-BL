/**
 * x402 Settlement — AgentBL
 *
 * Handles the on-chain settlement side of x402 payments.
 * When the White Agent pays for premium intel:
 * 1. The payment proof goes to the x402 facilitator
 * 2. On settlement success, the chain emits PaymentEvidenceLogged
 * 3. This module provides the on-chain record-keeping layer
 *
 * Uses the existing Injective Testnet deployment where AgentBLRWA
 * already lives. The PaymentOracle contract (new) records x402 payment
 * evidence on the same chain.
 */

import crypto from 'node:crypto';
import { x402Network, x402PayTo, x402Usdc } from './config.js';

/**
 * Generate a deterministic payment receipt for offline demo mode.
 * In production, this would be the actual transaction hash from
 * the facilitator settlement.
 *
 * @param {object} params
 * @param {string} params.serviceId - x402 service purchased
 * @param {number} params.amountUSDC - Amount paid in USDC
 * @param {string} [params.paymentRef] - External payment reference
 * @returns {{ txHash: string, receipt: object }}
 */
export function generatePaymentReceipt({ serviceId, amountUSDC, paymentRef }) {
  const timestamp = new Date().toISOString();
  const nonce = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = JSON.stringify({ serviceId, amountUSDC, paymentRef, timestamp, nonce });

  const txHash = `0x${crypto.createHash('sha256').update(payload).digest('hex')}`;

  return {
    txHash,
    receipt: {
      network: x402Network(),
      token: x402Usdc(),
      payTo: x402PayTo(),
      amountUSDC,
      amountMicrousd: Math.floor(amountUSDC * 1_000_000),
      serviceId,
      paymentRef: paymentRef || txHash,
      timestamp
    }
  };
}

/**
 * Build the on-chain PaymentEvidence payload for the PaymentOracle contract.
 * Matches the shape of PaymentEvidenceLogged event.
 *
 * @param {object} params
 * @returns {{ requestId: number, payer: string, serviceId: string, amountMicrousd: number, paymentRef: string, responseHash: string }}
 */
export function buildPaymentEvidence({ requestId, payer, serviceId, amountUSDC, paymentRef, responseData }) {
  const responseHash = responseData
    ? `0x${crypto.createHash('sha256').update(JSON.stringify(responseData)).digest('hex')}`
    : `0x${'00'.repeat(32)}`;

  return {
    requestId: requestId || Math.floor(Date.now() / 1000) % 1_000_000,
    payer: payer || '0x0000000000000000000000000000000000000000',
    serviceId,
    amountMicrousd: Math.floor(amountUSDC * 1_000_000),
    paymentRef: paymentRef || `x402:${serviceId}:${Date.now()}`,
    responseHash
  };
}

/**
 * Record payment evidence for the on-chain PaymentOracle.
 * In the offline demo, this generates deterministic hashes.
 * In production, this calls the Injective chain.
 */
export async function recordPaymentEvidence({ serviceId, amountUSDC, responseData }) {
  const { txHash, receipt } = generatePaymentReceipt({ serviceId, amountUSDC });
  const evidence = buildPaymentEvidence({
    serviceId,
    amountUSDC,
    paymentRef: txHash,
    responseData
  });

  return {
    ok: true,
    payment: {
      txHash,
      receipt,
      evidence,
      // In production: real Injective tx hash
      // For demo: deterministic hash that maps to the PaymentOracle event
      onChainEvent: 'PaymentEvidenceLogged',
      contractNote: 'PaymentOracle.sol — deploy on Injective Testnet for real on-chain audit trail'
    }
  };
}
