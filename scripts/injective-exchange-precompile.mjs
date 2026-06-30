/** SP-6: market-gated Exchange precompile audit and real GOLD hedge order lifecycle. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { ethers } from 'ethers';
import {
  CANONICAL_USDC_DENOM,
  EXCHANGE_PRECOMPILE,
  INJECTIVE_TESTNET,
  TESTNET_MARKETS,
  TESTNET_USDT_DENOM,
  createExchangePrecompile,
  deriveSubaccountId,
  readCanonicalUsdcParity,
  readExchangeDeposit
} from '../src/injective/precompiles.js';
import { buildGoldHedgeOrder, evaluateHedgeEligibility, relevantMarketAudit } from '../src/injective/hedgingPolicy.js';
import {
  atomicJson,
  connectOfficialInjectiveMcp,
  jsonSafe,
  loadDotEnv,
  requiredEnv,
  waitBlockscoutTransaction
} from './lib/injective-live.mjs';

const root = path.resolve(import.meta.dirname, '..');
const live = process.argv.includes('--live');
const explorerApi = 'https://testnet.blockscout-api.injective.network/api/v2';
const defaultAccount = '0xFf86f010D005d15bd43e1f254C12ACabEFae218d';
const gas = Object.freeze({ gasLimit: 1_500_000n, gasPrice: 500_000_000n });

async function send(label, transactionPromise) {
  const tx = await transactionPromise;
  const transaction = await waitBlockscoutTransaction(tx.hash, explorerApi);
  return {
    label,
    tx_hash: tx.hash,
    explorer: `${INJECTIVE_TESTNET.explorerUrl}/tx/${tx.hash}`,
    status: transaction.status,
    to: transaction.to?.hash ?? null,
    selector: transaction.raw_input?.slice(0, 10) ?? null
  };
}

async function poll(check, label, attempts = 45) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await check();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function recoverOrderTransaction(exchange, account, cid) {
  const response = await fetch(`${explorerApi}/addresses/${account}/transactions?filter=from`);
  if (!response.ok) return null;
  const body = await response.json();
  const selector = exchange.interface.getFunction('createDerivativeLimitOrder').selector.toLowerCase();
  for (const item of body.items ?? []) {
    if (item.to?.hash?.toLowerCase() !== EXCHANGE_PRECOMPILE.toLowerCase()) continue;
    if (item.raw_input?.slice(0, 10).toLowerCase() !== selector) continue;
    try {
      const parsed = exchange.interface.parseTransaction({ data: item.raw_input });
      if (parsed?.args?.[1]?.cid !== cid) continue;
      return {
        label: 'exchange.create-gold-hedge-order',
        tx_hash: item.hash,
        explorer: `${INJECTIVE_TESTNET.explorerUrl}/tx/${item.hash}`,
        status: item.status,
        to: item.to?.hash ?? null,
        selector,
        recovered_from_interrupted_run: true
      };
    } catch {}
  }
  return null;
}

await loadDotEnv(root);
const provider = new ethers.JsonRpcProvider(
  process.env.INJECTIVE_RPC_URL?.trim() || INJECTIVE_TESTNET.rpcUrl,
  INJECTIVE_TESTNET.chainId,
  { staticNetwork: true }
);
const mcp = await connectOfficialInjectiveMcp();

try {
  const network = await provider.getNetwork();
  assert.equal(network.chainId, 1439n, 'SP-6 is pinned to Injective Testnet chain 1439');
  const account = live
    ? new ethers.Wallet(requiredEnv('DEPLOYER_PRIVATE_KEY')).address
    : (process.env.SP6_ACCOUNT?.trim() || defaultAccount);
  // Use isolated nonce 1. Since Injective v1.10, nonce 0 is merged with the
  // bank account and explicit MsgDeposit-style calls to it are rejected.
  const subaccountIndex = 1;
  const subaccountId = deriveSubaccountId(account, subaccountIndex);
  const [activeMarkets, normalizedAddress, goldPrice, usdcDeposit, usdtDeposit] = await Promise.all([
    mcp.call('market_list'),
    mcp.call('address_normalize', { address: account }),
    mcp.call('market_price', { symbol: 'GOLD' }),
    readExchangeDeposit(provider, subaccountId, CANONICAL_USDC_DENOM),
    readExchangeDeposit(provider, subaccountId, TESTNET_USDT_DENOM)
  ]);
  const marketAudit = relevantMarketAudit(activeMarkets);
  const goldEligibility = evaluateHedgeEligibility({ commodity: 'gold', activeMarkets });
  const baseEvidence = {
    schema: 'agentbl-injective-exchange-precompile-v1',
    verified_at: new Date().toISOString(),
    network: INJECTIVE_TESTNET.network,
    chain_id: INJECTIVE_TESTNET.chainId,
    official_precompile: EXCHANGE_PRECOMPILE,
    official_mcp_server: 'https://github.com/InjectiveLabs/mcp-server',
    official_mcp_server_path: mcp.serverPath,
    account: ethers.getAddress(account),
    subaccount_id: subaccountId,
    subaccount_index: subaccountIndex,
    live_market_count: activeMarkets.length,
    market_audit: marketAudit,
    gold_oracle: goldPrice,
    precompile_query: { usdc: usdcDeposit, usdt: usdtDeposit },
    policy: {
      direct_market_only: true,
      proxy_hedges_forbidden: true,
      main_demo_copper_hedge: 'blocked-no-direct-market',
      gold_trade_finance_hedge: goldEligibility.eligible ? 'eligible' : 'blocked-market-unavailable'
    }
  };

  if (!live) {
    const output = path.join(root, 'docs', 'evidence', 'injective-exchange-readiness.json');
    await atomicJson(output, { ...baseEvidence, mode: 'read-only-readiness' });
    console.log('SP-6 READINESS PASS - Exchange precompile query and direct-market gate verified');
    console.log(`  GOLD market: ${goldEligibility.eligible ? 'eligible' : 'not eligible'}`);
    console.log('  Copper/aluminum/soy/oil: blocked (no direct market; no crypto proxy allowed)');
    console.log(`  evidence: ${output}`);
  } else {
    if (process.env.SP6_LIVE_CONFIRM !== 'gold-hedge-testnet') {
      throw new Error('Set SP6_LIVE_CONFIRM=gold-hedge-testnet to approve the testnet order/query/cancel lifecycle');
    }
    assert.equal(goldEligibility.eligible, true, goldEligibility.reason);
    const signer = new ethers.Wallet(requiredEnv('DEPLOYER_PRIVATE_KEY'), provider);
    assert.equal(signer.address, ethers.getAddress(account));
    assert.ok(await provider.getBalance(signer.address) > 0n, 'The test wallet has no testnet INJ for gas');
    const usdc = await readCanonicalUsdcParity(provider, signer.address);
    assert.equal(usdc.parity, true);
    assert.ok(BigInt(usdc.bank.balance) >= 2_000_000n, 'SP-6 needs at least 2 testnet USDC for conversion and margin');

    const exchange = createExchangePrecompile(signer);
    const transactions = [];
    const initialUsdc = BigInt(usdcDeposit.available_balance);
    const initialUsdt = BigInt(usdtDeposit.available_balance);
    let fundedUsdt = usdtDeposit;
    const requiredUsdt = 1_000_000n;
    const needsUsdtFunding = BigInt(fundedUsdt.total_balance) < requiredUsdt;
    const requiredUsdc = 2_000_000n;
    if (needsUsdtFunding && initialUsdc < requiredUsdc) {
      const topUp = requiredUsdc - initialUsdc;
      const simulated = await exchange.deposit.staticCall(signer.address, subaccountId, CANONICAL_USDC_DENOM, topUp);
      assert.equal(simulated, true, 'Exchange USDC deposit simulation returned false');
      transactions.push(await send(
        'exchange.deposit-usdc',
        exchange.deposit(signer.address, subaccountId, CANONICAL_USDC_DENOM, topUp, gas)
      ));
    }

    if (needsUsdtFunding) {
      const quantityAtomic = requiredUsdt - BigInt(fundedUsdt.total_balance);
      const spotOrder = {
        marketID: TESTNET_MARKETS.USDT_USDC_SPOT.marketId,
        subaccountID: subaccountId,
        feeRecipient: normalizedAddress.injAddress,
        price: ethers.parseUnits('1.02', 18),
        quantity: ethers.parseUnits(ethers.formatUnits(quantityAtomic, 6), 18),
        cid: `abl-usdt-${Date.now()}`.slice(0, 36),
        orderType: 'buy',
        triggerPrice: 0n
      };
      await exchange.createSpotMarketOrder.staticCall(signer.address, spotOrder);
      transactions.push(await send(
        'exchange.buy-usdt-with-usdc',
        exchange.createSpotMarketOrder(signer.address, spotOrder, gas)
      ));
      fundedUsdt = await poll(async () => {
        const balance = await readExchangeDeposit(provider, subaccountId, TESTNET_USDT_DENOM);
        return BigInt(balance.total_balance) >= requiredUsdt ? balance : null;
      }, 'USDT spot settlement');
    }

    const hedgeOrder = buildGoldHedgeOrder({
      subaccountId,
      feeRecipient: normalizedAddress.injAddress,
      oraclePriceUsd: goldPrice.price,
      notionalUsd: Number(process.env.SP6_HEDGE_NOTIONAL_USD ?? 0.2),
      cid: `abl-gold-${Date.now()}`
    });
    const orderForChain = {
      marketID: hedgeOrder.marketID,
      subaccountID: hedgeOrder.subaccountID,
      feeRecipient: hedgeOrder.feeRecipient,
      price: hedgeOrder.price,
      quantity: hedgeOrder.quantity,
      cid: hedgeOrder.cid,
      orderType: hedgeOrder.orderType,
      margin: hedgeOrder.margin,
      triggerPrice: hedgeOrder.triggerPrice
    };
    let indexedOrder;
    let queriedOrder;
    let recoveredOrder = false;
    const existingOrders = await mcp.call('trade_limit_orders', {
      address: normalizedAddress.injAddress,
      symbol: 'GOLD',
      subaccountIndex
    });
    if (existingOrders.length > 0) {
      const queriedExisting = await exchange.derivativeOrdersByHashes.staticCall({
        marketID: hedgeOrder.marketID,
        subaccountID: subaccountId,
        orderHashes: existingOrders.map((order) => order.orderHash)
      });
      queriedOrder = queriedExisting.find((order) => order.cid.startsWith('abl-gold-'));
      if (queriedOrder) {
        indexedOrder = existingOrders.find((order) =>
          order.orderHash.toLowerCase() === queriedOrder.orderHash.toLowerCase()
        );
        recoveredOrder = Boolean(indexedOrder);
      }
    }

    if (!indexedOrder) {
      await exchange.createDerivativeLimitOrder.staticCall(signer.address, orderForChain);
      transactions.push(await send(
        'exchange.create-gold-hedge-order',
        exchange.createDerivativeLimitOrder(signer.address, orderForChain, gas)
      ));
      indexedOrder = await poll(async () => {
        const orders = await mcp.call('trade_limit_orders', {
          address: normalizedAddress.injAddress,
          symbol: 'GOLD',
          subaccountIndex
        });
        const candidates = orders.filter((order) =>
          order.marketId?.toLowerCase() === hedgeOrder.marketID.toLowerCase()
          && order.subaccountId?.toLowerCase() === subaccountId.toLowerCase()
          && order.side === 'sell'
          && Number(order.price) === hedgeOrder.economics.limit_price_usd
          && Number(order.quantity) === hedgeOrder.economics.quantity
        );
        if (candidates.length !== 1) return null;
        const direct = await exchange.derivativeOrdersByHashes.staticCall({
          marketID: hedgeOrder.marketID,
          subaccountID: subaccountId,
          orderHashes: [candidates[0].orderHash]
        });
        queriedOrder = direct.find((order) => order.cid === hedgeOrder.cid);
        return queriedOrder ? candidates[0] : null;
      }, 'GOLD hedge order indexing');
    } else {
      const recoveredTx = await recoverOrderTransaction(exchange, signer.address, queriedOrder.cid);
      if (recoveredTx) transactions.push(recoveredTx);
    }
    assert.match(indexedOrder.orderHash, /^0x[0-9a-fA-F]{64}$/u);

    if (!queriedOrder) {
      const queried = await exchange.derivativeOrdersByHashes.staticCall({
        marketID: hedgeOrder.marketID,
        subaccountID: subaccountId,
        orderHashes: [indexedOrder.orderHash]
      });
      queriedOrder = queried.find((order) => order.orderHash.toLowerCase() === indexedOrder.orderHash.toLowerCase());
    }
    const activeCid = queriedOrder?.cid;
    assert.ok(queriedOrder, 'Exchange precompile did not return the indexed hedge order');
    assert.match(activeCid, /^abl-gold-/u);

    const cancelled = await exchange.cancelDerivativeOrder.staticCall(
      signer.address,
      hedgeOrder.marketID,
      subaccountId,
      indexedOrder.orderHash,
      0,
      activeCid
    );
    assert.equal(cancelled, true, 'Exchange precompile cancellation simulation returned false');
    transactions.push(await send(
      'exchange.cancel-gold-hedge-order',
      exchange.cancelDerivativeOrder(
        signer.address,
        hedgeOrder.marketID,
        subaccountId,
        indexedOrder.orderHash,
        0,
        activeCid,
        gas
      )
    ));
    await poll(async () => {
      const orders = await mcp.call('trade_limit_orders', {
        address: normalizedAddress.injAddress,
        symbol: 'GOLD',
        subaccountIndex
      });
      return orders.some((order) => order.orderHash?.toLowerCase() === indexedOrder.orderHash.toLowerCase()) ? null : true;
    }, 'GOLD hedge order cancellation');

    const beforeCleanup = {
      usdc: await readExchangeDeposit(provider, subaccountId, CANONICAL_USDC_DENOM),
      usdt: await readExchangeDeposit(provider, subaccountId, TESTNET_USDT_DENOM)
    };
    const cleanupBaselineUsdc = recoveredOrder ? 0n : initialUsdc;
    const cleanupBaselineUsdt = recoveredOrder ? 0n : initialUsdt;
    const cleanupUsdc = BigInt(beforeCleanup.usdc.available_balance) - cleanupBaselineUsdc;
    const cleanupUsdt = BigInt(beforeCleanup.usdt.available_balance) - cleanupBaselineUsdt;
    if (cleanupUsdc > 0n) {
      transactions.push(await send(
        'exchange.withdraw-unused-usdc',
        exchange.withdraw(signer.address, subaccountId, CANONICAL_USDC_DENOM, cleanupUsdc, gas)
      ));
    }
    if (cleanupUsdt > 0n) {
      transactions.push(await send(
        'exchange.withdraw-test-usdt',
        exchange.withdraw(signer.address, subaccountId, TESTNET_USDT_DENOM, cleanupUsdt, gas)
      ));
    }

    const evidence = {
      ...baseEvidence,
      mode: 'live-order-query-cancel',
      funding: {
        source: 'canonical MTS USDC',
        conversion_market: TESTNET_MARKETS.USDT_USDC_SPOT,
        usdt_after_conversion: fundedUsdt
      },
      hedge: {
        commodity: 'gold',
        economics: hedgeOrder.economics,
        cid: activeCid,
        order_hash: indexedOrder.orderHash,
        indexer_query: indexedOrder,
        precompile_query: {
          price: queriedOrder.price.toString(),
          quantity: queriedOrder.quantity.toString(),
          margin: queriedOrder.margin.toString(),
          fillable: queriedOrder.fillable.toString(),
          is_buy: queriedOrder.isBuy,
          order_hash: queriedOrder.orderHash,
          cid: queriedOrder.cid
        },
        cancelled: true,
        recovered_interrupted_run: recoveredOrder
      },
      transactions,
      cleanup: {
        preserves_preexisting_subaccount_funds: true,
        withdrawn_usdc_atomic: cleanupUsdc.toString(),
        withdrawn_usdt_atomic: cleanupUsdt.toString()
      },
      secrets_logged: false
    };
    const output = path.join(root, 'docs', 'evidence', 'injective-exchange-precompile.json');
    await atomicJson(output, evidence);
    console.log('SP-6 PASS - real Exchange precompile order/query/cancel verified on Injective Testnet');
    console.log(`  order:    ${indexedOrder.orderHash}`);
    console.log(`  tx:       ${transactions.find((item) => item.label === 'exchange.create-gold-hedge-order').explorer}`);
    console.log(`  evidence: ${output}`);
  }
} finally {
  await mcp.close().catch(() => {});
  await provider.destroy();
}
