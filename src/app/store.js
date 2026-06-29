import crypto from 'node:crypto';

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

export function createPool(poolId, caseData, quote) {
  storeState.pools.set(poolId, {
    poolId,
    caseData,
    quote,
    status: 'Open',
    subscribedUsd: 0,
    targetUsd: quote.requested_cash_usd,
    createdAt: new Date().toISOString()
  });
  return storeState.pools.get(poolId);
}

export function subscribeToPool(walletAddress, poolId, amountUsd) {
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

  const investment = {
    txHash,
    walletAddress,
    poolId,
    amountUsd,
    tokenCount,
    price: pool.quote.final_issue_price_usd,
    yieldBps: pool.quote.implied_gross_yield_bps,
    riskLevel: pool.quote.risk_level,
    label: pool.caseData?.bill_of_lading?.cargo || poolId,
    timestamp: new Date().toISOString()
  };

  storeState.investments.push(investment);
  return { txHash, investment, poolStatus: pool.status };
}
