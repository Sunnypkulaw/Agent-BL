import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import {
  BANK_ABI,
  BANK_PRECOMPILE,
  CANONICAL_USDC_DENOM,
  EXCHANGE_ABI,
  EXCHANGE_PRECOMPILE,
  TESTNET_MARKETS,
  deriveSubaccountId
} from '../src/injective/precompiles.js';
import { buildGoldHedgeOrder, evaluateHedgeEligibility, relevantMarketAudit } from '../src/injective/hedgingPolicy.js';

const account = '0xFf86f010D005d15bd43e1f254C12ACabEFae218d';

test('SP-5 uses the official Bank precompile and canonical MTS USDC denom', () => {
  assert.equal(BANK_PRECOMPILE, '0x0000000000000000000000000000000000000064');
  assert.match(CANONICAL_USDC_DENOM, /^erc20:0x[0-9a-fA-F]{40}$/u);
  const bank = new ethers.Interface(BANK_ABI);
  const data = bank.encodeFunctionData('transfer', [account, account, 1n]);
  assert.equal(data.slice(0, 10), bank.getFunction('transfer').selector);
});

test('SP-6 uses the official Exchange precompile and deterministic subaccounts', () => {
  assert.equal(EXCHANGE_PRECOMPILE, '0x0000000000000000000000000000000000000065');
  assert.equal(
    deriveSubaccountId(account),
    '0xff86f010d005d15bd43e1f254c12acabefae218d000000000000000000000000'
  );
  assert.equal(deriveSubaccountId(account, 1).slice(-24), '000000000000000000000001');
  assert.throws(() => deriveSubaccountId(account, 256), /0 to 255/u);
  const exchange = new ethers.Interface(EXCHANGE_ABI);
  assert.equal(exchange.getFunction('subaccountDeposit').selector.length, 10);
  assert.equal(exchange.getFunction('createDerivativeLimitOrder').selector.length, 10);
});

test('SP-6 rejects fake proxy hedges and only approves an exact live commodity market', () => {
  const gold = TESTNET_MARKETS.GOLD_USDT_PERP;
  const activeMarkets = [{ ...gold, symbol: 'GOLD' }];
  assert.equal(evaluateHedgeEligibility({ commodity: 'copper', activeMarkets }).eligible, false);
  assert.equal(evaluateHedgeEligibility({ commodity: 'BTC', activeMarkets }).eligible, false);
  const eligible = evaluateHedgeEligibility({ commodity: 'gold', activeMarkets });
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.market.marketId, gold.marketId);
  const audit = relevantMarketAudit(activeMarkets);
  assert.equal(audit.filter((item) => item.eligible).length, 1);
});

test('SP-6 builds a bounded post-only GOLD short order in 18-decimal API format', () => {
  const order = buildGoldHedgeOrder({
    subaccountId: deriveSubaccountId(account),
    feeRecipient: 'inj1l7r0qyxsqhg4h4p7ruj5cy4v40h6ugvdymdxve',
    oraclePriceUsd: 1860.94,
    notionalUsd: 0.2,
    cid: 'agentbl-test-hedge'
  });
  assert.equal(order.orderType, 'sellPostOnly');
  assert.equal(order.quantity, ethers.parseUnits('0.0001', 18));
  assert.equal(order.price % ethers.parseUnits('0.1', 18), 0n);
  assert.ok(order.margin >= ethers.parseUnits('0.1', 18));
  assert.equal(order.economics.direction, 'short');
});
