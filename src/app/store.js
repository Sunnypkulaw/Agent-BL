import crypto from 'node:crypto';
import { STATE_BY_PRICING_ACTION } from '../core/pricingSchema.js';

// In-memory data store for the AgentBL backend.
// Satisfies hackathon requirements for mock persistence without an external DB.

export const storeState = {
  pools: new Map(),
  investments: []
};

export function resetStore() {
  storeState.pools.clear();
  storeState.investments = [];
}

export function createPool(poolId, caseData, quote, options = {}) {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const status = options.status
    ?? STATE_BY_PRICING_ACTION[quote.pricing_action]
    ?? 'Open';
  storeState.pools.set(poolId, {
    poolId,
    caseData,
    quote,
    status,
    subscribedUsd: 0,
    targetUsd: quote.requested_cash_usd,
    createdAt,
    quoteUpdatedAt: options.quoteUpdatedAt ?? createdAt,
    complianceStatus: options.complianceStatus ?? 'CLEARED',
    investorEligible: options.investorEligible ?? true
  });
  return storeState.pools.get(poolId);
}

export function subscribeToPool(walletAddress, poolId, amountUsd, options = {}) {
  const pool = storeState.pools.get(poolId);
  if (!pool) throw new Error('Pool not found');
  if (pool.status !== 'Open') throw new Error(`Cannot subscribe to pool in status: ${pool.status}`);
  if (amountUsd <= 0) throw new Error('Subscription amount must be greater than 0');
  if (pool.subscribedUsd + amountUsd > pool.targetUsd) {
    throw new Error('Subscription exceeds target amount');
  }

  pool.subscribedUsd += amountUsd;
  
  if (pool.subscribedUsd >= pool.targetUsd) {
    pool.status = 'Funded';
  }

  const txHash = '0x' + crypto.randomBytes(32).toString('hex');
  const tokenCount = amountUsd / (pool.quote.final_issue_price_usd || 1);
  const normalizedWalletAddress = String(walletAddress ?? '').toLowerCase();

  const investment = {
    txHash,
    walletAddress: normalizedWalletAddress,
    poolId,
    amountUsd,
    tokenCount,
    price: pool.quote.final_issue_price_usd,
    yieldBps: pool.quote.implied_gross_yield_bps,
    riskLevel: pool.quote.risk_level,
    label: pool.caseData?.bill_of_lading?.cargo || poolId,
    source: options.source ? structuredClone(options.source) : null,
    timestamp: new Date().toISOString()
  };

  storeState.investments.push(investment);
  return { txHash, investment, poolStatus: pool.status };
}
