import { ethers } from 'ethers';
import { TESTNET_MARKETS, TESTNET_USDT_DENOM } from './precompiles.js';

const DIRECT_HEDGE_MARKETS = Object.freeze({
  gold: Object.freeze({
    commodity: 'gold',
    symbol: 'GOLD',
    ...TESTNET_MARKETS.GOLD_USDT_PERP,
    initialMarginRatio: 0.195,
    economicBasis: 'A short GOLD perpetual offsets a fall in recoverable gold-cargo collateral value during the financing window.'
  })
});

const NORMALIZED_COMMODITIES = Object.freeze({
  au: 'gold',
  gold: 'gold',
  copper: 'copper',
  cu: 'copper',
  aluminium: 'aluminum',
  aluminum: 'aluminum',
  soy: 'soybean',
  soybean: 'soybean',
  oil: 'oil',
  crude: 'oil'
});

function normalizeCommodity(value) {
  return NORMALIZED_COMMODITIES[String(value ?? '').trim().toLowerCase()] ?? String(value ?? '').trim().toLowerCase();
}

export function evaluateHedgeEligibility({ commodity, network = 'eip155:1439', activeMarkets = [] }) {
  const normalized = normalizeCommodity(commodity);
  if (network !== 'eip155:1439') {
    return { eligible: false, commodity: normalized, reason: 'Hedge execution is pinned to Injective Testnet (eip155:1439).' };
  }
  const policy = DIRECT_HEDGE_MARKETS[normalized];
  if (!policy) {
    return {
      eligible: false,
      commodity: normalized,
      reason: `No direct ${normalized || 'commodity'} market is approved; correlated crypto proxies are forbidden.`
    };
  }
  const live = activeMarkets.find((market) =>
    String(market.marketId ?? '').toLowerCase() === policy.marketId.toLowerCase()
    && String(market.ticker ?? '').toUpperCase() === policy.ticker.toUpperCase()
    && String(market.quoteDenom ?? '').toLowerCase() === policy.quoteDenom.toLowerCase()
  );
  if (!live) {
    return {
      eligible: false,
      commodity: normalized,
      reason: `The approved ${policy.ticker} market is not active with the expected quote denom.`
    };
  }
  return { eligible: true, commodity: normalized, market: policy, live_market: live };
}

function floorToTick(value, tick) {
  return Math.floor((value + Number.EPSILON) / tick) * tick;
}

function ceilToTick(value, tick) {
  return Math.ceil((value - Number.EPSILON) / tick) * tick;
}

export function buildGoldHedgeOrder({
  subaccountId,
  oraclePriceUsd,
  notionalUsd = 0.2,
  priceBuffer = 0.05,
  feeRecipient,
  cid = `agentbl-gold-${Date.now()}`
}) {
  const price = Number(oraclePriceUsd);
  const notional = Number(notionalUsd);
  if (!/^0x[0-9a-f]{64}$/u.test(String(subaccountId ?? '').toLowerCase())) {
    throw new TypeError('subaccountId must be a 32-byte hex string');
  }
  if (!Number.isFinite(price) || price <= 0) throw new RangeError('oraclePriceUsd must be positive');
  if (!Number.isFinite(notional) || notional <= 0) throw new RangeError('notionalUsd must be positive');
  if (!/^inj1[0-9a-z]{38}$/u.test(String(feeRecipient ?? ''))) {
    throw new TypeError('feeRecipient must be an Injective bech32 account');
  }
  if (!Number.isFinite(priceBuffer) || priceBuffer <= 0 || priceBuffer > 0.25) {
    throw new RangeError('priceBuffer must be in (0, 0.25]');
  }
  const market = DIRECT_HEDGE_MARKETS.gold;
  const quantityTick = Number(market.minQuantity);
  const priceTick = Number(market.priceTick);
  const quantity = Math.max(quantityTick, floorToTick(notional / price, quantityTick));
  const limitPrice = ceilToTick(price * (1 + priceBuffer), priceTick);
  const marginUsd = Math.max(0.1, limitPrice * quantity * market.initialMarginRatio * 1.25);
  return {
    marketID: market.marketId,
    subaccountID: subaccountId,
    feeRecipient,
    price: ethers.parseUnits(limitPrice.toFixed(1), 18),
    quantity: ethers.parseUnits(quantity.toFixed(4), 18),
    cid: cid.slice(0, 36),
    orderType: 'sellPostOnly',
    margin: ethers.parseUnits(marginUsd.toFixed(6), 18),
    triggerPrice: 0n,
    economics: {
      direction: 'short',
      oracle_price_usd: price,
      limit_price_usd: limitPrice,
      quantity,
      notional_usd: limitPrice * quantity,
      margin_usd: marginUsd,
      quote_denom: TESTNET_USDT_DENOM,
      basis: market.economicBasis
    }
  };
}

export function relevantMarketAudit(activeMarkets = []) {
  const commodities = ['copper', 'aluminum', 'soybean', 'oil', 'gold'];
  return commodities.map((commodity) => evaluateHedgeEligibility({ commodity, activeMarkets }));
}
