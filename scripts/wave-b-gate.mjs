/** Gate B live evidence linker.
 * Existing x402 payment -> PaymentAttested(reportHash) -> PricingUpdated
 * (evidenceHash=reportHash) -> RWAOfferingPool final quote.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ethers } from 'ethers';
import { quoteFromCase } from '../src/core/pricingEngine.js';

const root = path.resolve(import.meta.dirname, '..');
const explorer = 'https://testnet.blockscout.injective.network';
const explorerApi = 'https://testnet.blockscout-api.injective.network/api/v2';

async function loadDotEnv() {
  let source;
  try { source = await fs.readFile(path.join(root, '.env'), 'utf8'); } catch { return; }
  for (const raw of source.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

async function explorerJson(route) {
  const response = await fetch(`${explorerApi}${route}`);
  if (!response.ok) throw new Error(`Blockscout ${route} returned ${response.status}`);
  return response.json();
}

async function nextAccountNonce(address) {
  const page = await explorerJson(`/addresses/${address}/transactions?filter=from`);
  const latest = page.items?.[0];
  return latest ? Number(latest.nonce) + 1 : 0;
}

async function waitTransaction(txHash) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(`${explorerApi}/transactions/${txHash}`);
    if (response.ok) {
      const transaction = await response.json();
      if (transaction.status === 'ok') return transaction;
      if (transaction.status === 'error') throw new Error(`Transaction reverted: ${txHash}`);
    } else if (response.status !== 404) {
      throw new Error(`Blockscout transaction lookup returned ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for ${txHash}`);
}

async function decodedEvents(txHash, contractInterface) {
  const { items } = await explorerJson(`/transactions/${txHash}/logs`);
  return items.flatMap((item) => {
    try {
      const parsed = contractInterface.parseLog({
        topics: item.topics.filter(Boolean),
        data: item.data
      });
      return [{ name: parsed.name, args: parsed.args, address: item.address.hash }];
    } catch {
      return [];
    }
  });
}

async function send(label, promise, contractInterface) {
  const transaction = await promise;
  console.log(`  ${label}: ${transaction.hash}`);
  const mined = await waitTransaction(transaction.hash);
  const events = await decodedEvents(transaction.hash, contractInterface);
  return {
    label,
    txHash: transaction.hash,
    blockNumber: mined.block_number,
    explorer: `${explorer}/tx/${transaction.hash}`,
    events
  };
}

function serializable(value) {
  return JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));
}

await loadDotEnv();
const privateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
if (!privateKey) throw new Error('DEPLOYER_PRIVATE_KEY is required');

const chain = JSON.parse(await fs.readFile(path.join(root, 'public', 'chain-config.json'), 'utf8'));
assert.equal(chain.chainIdDecimal, 1439);
const addresses = chain.contracts;
for (const name of ['PaymentOracle', 'EBLRegistry', 'RWAOfferingPool', 'RiskPricingOracle']) {
  assert.ok(ethers.isAddress(addresses[name]), `${name} deployment missing`);
}

const x402 = JSON.parse(await fs.readFile(path.join(root, 'docs', 'evidence', 'x402-live-smoke.json'), 'utf8'));
const caseData = JSON.parse(await fs.readFile(path.join(root, 'data', 'cases', 'copper-sg-shanghai.case.json'), 'utf8'));
const quote = quoteFromCase(caseData);
assert.equal(quote.case_id, x402.case_id);

const paymentTx = await explorerJson(`/transactions/${x402.payment_tx}`);
assert.equal(paymentTx.status, 'ok');
const paymentOracleInterface = new ethers.Interface(chain.paymentOracle.abi);
const attestationEvents = await decodedEvents(x402.attestation_tx, paymentOracleInterface);
const attested = attestationEvents.find((event) => event.name === 'PaymentAttested');
assert.ok(attested, 'PaymentAttested event not found');
assert.equal(attested.args.reportHash.toLowerCase(), x402.report_hash.toLowerCase());
assert.equal(attested.args.paymentTxHash.toLowerCase(), x402.payment_tx.toLowerCase());

const rpc = process.env.INJECTIVE_RPC_URL?.trim() || 'https://k8s.testnet.json-rpc.injective.network';
const provider = new ethers.JsonRpcProvider(rpc, 1439);
const wallet = new ethers.Wallet(privateKey, provider);
let nonce = await nextAccountNonce(wallet.address);
const transactionOverrides = () => ({
  gasLimit: 1_000_000n,
  gasPrice: 500_000_000n,
  chainId: 1439,
  nonce: nonce++
});
const abis = chain.protocol.abis;
const registryInterface = new ethers.Interface(abis.EBLRegistry);
const poolInterface = new ethers.Interface(abis.RWAOfferingPool);
const oracleInterface = new ethers.Interface(abis.RiskPricingOracle);
const registry = new ethers.Contract(addresses.EBLRegistry, abis.EBLRegistry, wallet);
const pool = new ethers.Contract(addresses.RWAOfferingPool, abis.RWAOfferingPool, wallet);
const oracle = new ethers.Contract(addresses.RiskPricingOracle, abis.RiskPricingOracle, wallet);

const transactions = [];
const metadataHash = ethers.sha256(ethers.toUtf8Bytes(JSON.stringify({
  case_id: x402.case_id,
  payment_tx: x402.payment_tx,
  report_hash: x402.report_hash
})));
const bill = caseData.bill_of_lading;
const cargoHash = ethers.sha256(ethers.toUtf8Bytes(JSON.stringify({
  carrier: bill.carrier ?? null,
  vessel: bill.vessel,
  voyage: bill.voyage ?? bill.voyage_number ?? '',
  cargo: bill.cargo,
  quantity_mt: bill.quantity_mt,
  case_id: caseData.case_id
})));
const v2Metadata = {
  vessel: bill.vessel ?? '',
  voyage: bill.voyage ?? bill.voyage_number ?? '',
  portOfLoading: bill.port_of_loading ?? '',
  portOfDischarge: bill.port_of_discharge ?? '',
  cargo: bill.cargo,
  quantity: BigInt(Math.round(bill.quantity_mt)),
  quantityUnit: 'MT',
  hsCode: caseData.commercial_invoice?.hs_code ?? caseData.cargo?.hs_code ?? '740311',
  declaredValueUsdE6: BigInt(Math.round(bill.declared_value_usd * 1_000_000)),
  incoterms: bill.incoterms ?? caseData.commercial_invoice?.incoterms ?? 'CIF',
  mletr: true,
  eucp: true,
  dcsa: true
};
const mint = await send(
  'mint eBL V2 commitment',
  registry.mintEBLV2(cargoHash, metadataHash, wallet.address, v2Metadata, transactionOverrides()),
  registryInterface
);
transactions.push(mint);
const minted = mint.events.find((event) => event.name === 'EBLMinted');
assert.ok(minted);
const eblId = Number(minted.args.eblId);

transactions.push(await send('pledge eBL', registry.pledge(eblId, addresses.RWAOfferingPool, transactionOverrides()), registryInterface));
const issuePriceE6 = Math.round(quote.final_issue_price_usd * 1_000_000);
const supply = BigInt(Math.round(quote.recommended_token_supply));
const createdTx = await send(
  'create RWA offering',
  pool.createOffering(eblId, supply, issuePriceE6, 1_000_000n, transactionOverrides()),
  poolInterface
);
transactions.push(createdTx);
const created = createdTx.events.find((event) => event.name === 'OfferingCreated');
assert.ok(created);
const poolId = Number(created.args.poolId);

const pricingTx = await send(
  'bind paid report to PricingUpdated',
  oracle.updatePricing(
    poolId,
    issuePriceE6,
    1,
    0,
    x402.report_hash,
    quote.quote_hash,
    transactionOverrides()
  ),
  oracleInterface
);
transactions.push(pricingTx);
const pricing = pricingTx.events.find((event) => event.name === 'PricingUpdated');
assert.ok(pricing, 'PricingUpdated event not found');
assert.equal(pricing.args.evidenceHash.toLowerCase(), x402.report_hash.toLowerCase());
assert.equal(pricing.args.quoteHash.toLowerCase(), quote.quote_hash.toLowerCase());
assert.equal(Number(pricing.args.issuePrice), issuePriceE6);

const evidence = {
  schema: 'agentbl-wave-b-gate-v1',
  verified_at: new Date().toISOString(),
  network: 'eip155:1439',
  trace: [
    'USDC payment transaction',
    'PaidReportEnvelope commitment',
    'PaymentAttested',
    'PricingUpdated',
    'RWA offering quote'
  ],
  payment: {
    tx: x402.payment_tx,
    explorer: x402.payment_explorer,
    asset: x402.asset,
    amount_atomic: x402.amount_atomic,
    amount_usdc: x402.amount_usdc,
    status: paymentTx.status
  },
  paidReportEnvelope: {
    report_id: x402.report_id,
    report_hash: x402.report_hash,
    case_id: x402.case_id,
    payment_tx: x402.payment_tx,
    network: x402.network,
    asset: x402.asset,
    amount: x402.amount_atomic,
    settled_at: x402.payment_settled_at,
    data_snapshot: 'redacted: committed by report_hash',
    validation: 'Runtime envelope passed assertPaidReportEnvelope during X402-15 live smoke'
  },
  paymentAttested: {
    contract: addresses.PaymentOracle,
    tx: x402.attestation_tx,
    explorer: x402.attestation_explorer,
    report_hash: attested.args.reportHash,
    payment_tx: attested.args.paymentTxHash,
    event: 'PaymentAttested'
  },
  pricingUpdated: {
    contract: addresses.RiskPricingOracle,
    tx: pricingTx.txHash,
    explorer: pricingTx.explorer,
    pool_id: poolId,
    evidence_hash: pricing.args.evidenceHash,
    quote_hash: pricing.args.quoteHash,
    issue_price_e6: pricing.args.issuePrice,
    event: 'PricingUpdated'
  },
  offering: {
    contract: addresses.RWAOfferingPool,
    pool_id: poolId,
    ebl_id: eblId,
    final_issue_price_usd: quote.final_issue_price_usd,
    final_issue_price_e6: issuePriceE6,
    risk_level: quote.risk_level,
    pricing_action: quote.pricing_action,
    quote_hash: quote.quote_hash
  },
  transactions
};

const output = path.join(root, 'docs', 'evidence', 'wave-b-gate.json');
await fs.writeFile(output, `${JSON.stringify(serializable(evidence), null, 2)}\n`, 'utf8');
console.log(`Gate B PASS: payment -> report -> attestation -> pricing -> $${quote.final_issue_price_usd.toFixed(2)} RWA quote`);
console.log(`Evidence: ${output}`);
