/**
 * X402-15: one real Injective Testnet x402 purchase + PaymentOracle attestation.
 * Fail-closed: no Demo fallback, fake tx hash, mainnet, or secret logging.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ethers } from 'ethers';
import { createInjectiveClient, parsePaymentResponseHeader } from '@injectivelabs/x402/client';
import { injectivePaymentMiddleware } from '@injectivelabs/x402/middleware';
import { buildPremiumRiskIntel } from '../src/x402/endpoints.js';
import { loadX402Config, validateFacilitatorSupport } from '../src/x402/config.js';
import { createPaidReportEnvelope, hashReportSnapshot } from '../src/x402/paidReport.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/u;
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

async function loadDotEnv() {
  let source;
  try {
    source = await fs.readFile(path.join(root, '.env'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`X402-15 requires ${name}`);
  return value;
}

function normalizePrivateKey(value) {
  const trimmed = value.trim();
  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/u.test(normalized)) {
    throw new Error('X402 buyer private key must be exactly 32 bytes of hexadecimal data');
  }
  return normalized;
}

function explorer(base, type, value) {
  return `${base}/${type}/${value}`;
}

const explorerApi = 'https://testnet.blockscout-api.injective.network/api/v2';

async function waitForExplorerTransaction(txHash, options = {}) {
  const attempts = options.attempts ?? 45;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(`${explorerApi}/transactions/${txHash}`);
    if (response.ok) {
      const transaction = await response.json();
      if (transaction.status === 'ok') return transaction;
      if (transaction.status === 'error') throw new Error(`Transaction reverted: ${txHash}`);
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for Blockscout transaction: ${txHash}`);
}

function assertExplorerPayment(transaction, { payer, payTo, asset, amount }) {
  assert.equal(transaction.status, 'ok', 'USDC settlement transaction failed');
  assert.equal(transaction.to?.hash?.toLowerCase(), asset.toLowerCase(), 'Settlement target is not USDC');
  const parameters = Object.fromEntries(
    (transaction.decoded_input?.parameters ?? []).map((entry) => [entry.name, entry.value])
  );
  assert.equal(parameters.from?.toLowerCase(), payer.toLowerCase(), 'USDC transfer payer mismatch');
  assert.equal(parameters.to?.toLowerCase(), payTo.toLowerCase(), 'USDC transfer recipient mismatch');
  assert.equal(BigInt(parameters.value), amount, 'USDC transfer amount mismatch');
  const transfer = transaction.token_transfers?.find((entry) =>
    entry.token?.address_hash?.toLowerCase() === asset.toLowerCase()
      && entry.from?.hash?.toLowerCase() === payer.toLowerCase()
      && entry.to?.hash?.toLowerCase() === payTo.toLowerCase()
      && BigInt(entry.total?.value ?? -1) === amount
  );
  assert.ok(transfer, 'Settlement transaction lacks the expected USDC Transfer');
}

await loadDotEnv();
if (process.env.X402_LIVE_CONFIRM !== 'injective-testnet') {
  throw new Error('Refusing live spend: set X402_LIVE_CONFIRM=injective-testnet for this testnet run');
}

const privateKey = normalizePrivateKey(process.env.X402_BUYER_PRIVATE_KEY?.trim()
  || process.env.WHITE_AGENT_PRIVATE_KEY?.trim()
  || required('DEPLOYER_PRIVATE_KEY'));
const rpcUrl = process.env.X402_RPC_URL?.trim()
  || process.env.INJECTIVE_RPC_URL?.trim()
  || 'https://k8s.testnet.json-rpc.injective.network';
const provider = new ethers.JsonRpcProvider(rpcUrl);
const buyer = new ethers.Wallet(privateKey, provider);
const configuredPayTo = process.env.X402_PAY_TO?.trim();
const payTo = configuredPayTo
  || (process.env.X402_ALLOW_SELF_PAYMENT === 'true' ? buyer.address : null);
if (!payTo) {
  throw new Error('Set X402_PAY_TO, or explicitly set X402_ALLOW_SELF_PAYMENT=true');
}

const config = loadX402Config(process.env, {
  mode: 'live',
  network: 'eip155:1439',
  facilitatorUrl: required('X402_FACILITATOR_URL'),
  payTo,
  allowInsecureTestnet: process.env.X402_ALLOW_INSECURE_TESTNET === 'true'
});
assert.equal(config.chainId, 1439, 'Live smoke is testnet-only');
const support = await validateFacilitatorSupport(config);
assert.equal(support.ok, true);

const network = await provider.getNetwork();
assert.equal(network.chainId, 1439n, 'RPC is not Injective EVM Testnet');
const usdc = new ethers.Contract(config.asset, ERC20_ABI, provider);
const recoveryPaymentTx = process.env.X402_RECOVER_PAYMENT_TX?.trim();
const [injBefore, usdcBefore] = await Promise.all([
  provider.getBalance(buyer.address),
  usdc.balanceOf(buyer.address)
]);
const amount = BigInt(process.env.X402_LIVE_AMOUNT_ATOMIC ?? '1000');
if (amount <= 0n) throw new Error('X402_LIVE_AMOUNT_ATOMIC must be positive');
if (!recoveryPaymentTx && usdcBefore < amount) {
  throw new Error(`Insufficient testnet USDC: need ${ethers.formatUnits(amount, 6)}, have ${ethers.formatUnits(usdcBefore, 6)}`);
}
if (injBefore === 0n) throw new Error('Buyer/deployer has no testnet INJ for the oracle attestation');

const chainConfig = JSON.parse(await fs.readFile(path.join(root, 'public', 'chain-config.json'), 'utf8'));
const oracleAddress = chainConfig.contracts?.PaymentOracle;
const oracleAbi = chainConfig.paymentOracle?.abi;
if (!ethers.isAddress(oracleAddress) || !Array.isArray(oracleAbi)) {
  throw new Error('PaymentOracle deployment is missing from public/chain-config.json');
}
const oracleInterface = new ethers.Interface(oracleAbi);
if (!oracleInterface.hasFunction('attestPayment')) {
  throw new Error('Configured PaymentOracle uses the old ABI; deploy the hardened X402-9 contract first');
}
if ((await provider.getCode(oracleAddress)) === '0x') throw new Error('PaymentOracle address has no bytecode');

const caseData = JSON.parse(await fs.readFile(
  path.join(root, 'data', 'cases', 'copper-sg-shanghai.case.json'),
  'utf8'
));

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(injectivePaymentMiddleware({
  'POST /api/x402/live/risk-report': {
    description: 'AgentBL five-dimensional AI risk report',
    mimeType: 'application/json',
    accepts: [{
      network: config.network,
      asset: config.asset,
      amount: amount.toString(),
      payTo: config.payTo,
      maxTimeoutSeconds: config.ttlSeconds
    }]
  }
}, {
  facilitatorUrl: config.facilitatorUrl,
  settlementPolicy: 'before'
}));
app.post('/api/x402/live/risk-report', async (request, response, next) => {
  try {
    const report = await buildPremiumRiskIntel(caseData);
    response.json({ ...report, x402: request.x402 });
  } catch (error) {
    next(error);
  }
});

const server = await new Promise((resolve, reject) => {
  const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  listening.once('error', reject);
});

let evidence;
try {
  const endpoint = `http://127.0.0.1:${server.address().port}/api/x402/live/risk-report`;
  const request = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ case_id: caseData.case_id })
  };
  let body;
  let paymentReceipt;
  if (recoveryPaymentTx) {
    assert.match(recoveryPaymentTx, TX_HASH_RE, 'X402_RECOVER_PAYMENT_TX must be a transaction hash');
    const report = await buildPremiumRiskIntel(caseData);
    body = {
      ...report,
      x402: {
        payer: buyer.address,
        network: config.network,
        amount: amount.toString(),
        asset: config.asset,
        txHash: recoveryPaymentTx
      }
    };
    paymentReceipt = {
      success: true,
      transaction: recoveryPaymentTx,
      network: config.network,
      payer: buyer.address
    };
  } else {
    const unpaid = await fetch(endpoint, request);
    assert.equal(unpaid.status, 402);
    assert.ok(unpaid.headers.get('PAYMENT-REQUIRED'), 'Missing PAYMENT-REQUIRED challenge');

    const client = createInjectiveClient({
      privateKey,
      rpcUrl,
      preferredNetworks: ['eip155:1439']
    });
    const paid = await client.fetch(endpoint, request);
    body = await paid.json();
    if (!paid.ok) throw new Error(`Paid request failed (${paid.status}): ${body.message ?? body.error ?? 'unknown'}`);
    paymentReceipt = parsePaymentResponseHeader(paid);
    assert.equal(paymentReceipt?.success, true, 'Missing successful PAYMENT-RESPONSE');
  }

  assert.match(paymentReceipt.transaction, TX_HASH_RE);
  assert.equal(paymentReceipt.network, config.network);
  assert.equal(paymentReceipt.payer.toLowerCase(), buyer.address.toLowerCase());

  const paymentTransaction = await waitForExplorerTransaction(paymentReceipt.transaction);
  assertExplorerPayment(paymentTransaction, {
    payer: buyer.address,
    payTo: config.payTo,
    asset: config.asset,
    amount
  });
  const settledAt = new Date(paymentTransaction.timestamp).toISOString();
  const envelope = createPaidReportEnvelope({
    kind: body.kind,
    case_id: body.case_id,
    payer: buyer.address,
    payee: config.payTo,
    network: config.network,
    asset: config.asset,
    amount: amount.toString(),
    payment_tx: paymentReceipt.transaction,
    settled_at: settledAt,
    data_snapshot: body,
    model_provider: body.provider ?? 'agentbl-risk-agent',
    evidence_hash: body.evidence_hash ?? hashReportSnapshot(body)
  }, { ttlSeconds: 3_600 });

  const receiptId = `0x${envelope.report_id.slice(4)}`;
  const caseIdHash = ethers.sha256(ethers.toUtf8Bytes(envelope.case_id));
  const oracle = new ethers.Contract(oracleAddress, oracleAbi, buyer);
  assert.equal(await oracle.hasAttestation(receiptId), false, 'Unexpected existing receipt id');
  const attestationTx = await oracle.attestPayment(
    receiptId,
    envelope.report_hash,
    caseIdHash,
    paymentReceipt.transaction,
    buyer.address,
    config.asset,
    amount
  );
  const attestationReceipt = await waitForExplorerTransaction(attestationTx.hash);
  assert.equal(attestationReceipt.status, 'ok', 'PaymentOracle attestation reverted');
  const attestedEvents = await oracle.queryFilter(
    oracle.filters.PaymentAttested(receiptId),
    attestationReceipt.block_number,
    attestationReceipt.block_number
  );
  const attestedEvent = attestedEvents.find((event) => event.transactionHash === attestationTx.hash);
  assert.ok(attestedEvent, 'PaymentAttested event missing');
  assert.equal(attestedEvent.args.reportHash, envelope.report_hash);
  assert.equal(attestedEvent.args.paymentTxHash, paymentReceipt.transaction);

  const stored = await oracle.getAttestation(receiptId);
  assert.equal(stored.reportHash, envelope.report_hash);
  assert.equal(stored.caseIdHash, caseIdHash);
  assert.equal(stored.paymentTxHash, paymentReceipt.transaction);
  assert.equal(stored.amount, amount);

  const usdcAfter = await usdc.balanceOf(buyer.address);
  evidence = {
    schema: 'agentbl-x402-live-smoke-v1',
    verified_at: new Date().toISOString(),
    mode: 'live',
    network: config.network,
    chain_id: config.chainId,
    facilitator_url: config.facilitatorUrl,
    facilitator_signer: support.signer,
    payer: buyer.address,
    payee: config.payTo,
    self_payment: buyer.address.toLowerCase() === config.payTo.toLowerCase(),
    asset: config.asset,
    amount_atomic: amount.toString(),
    amount_usdc: ethers.formatUnits(amount, 6),
    usdc_balance_before: ethers.formatUnits(usdcBefore, 6),
    usdc_balance_after: ethers.formatUnits(usdcAfter, 6),
    inj_balance_before: ethers.formatEther(injBefore),
    report_id: envelope.report_id,
    report_hash: envelope.report_hash,
    case_id: envelope.case_id,
    case_id_hash: caseIdHash,
    payment_tx: paymentReceipt.transaction,
    payment_block: paymentTransaction.block_number,
    payment_explorer: explorer(config.explorerUrl, 'tx', paymentReceipt.transaction),
    payment_settled_at: settledAt,
    payment_oracle: oracleAddress,
    payment_oracle_explorer: explorer(config.explorerUrl, 'address', oracleAddress),
    attestation_tx: attestationTx.hash,
    attestation_block: attestationReceipt.block_number,
    attestation_explorer: explorer(config.explorerUrl, 'tx', attestationTx.hash),
    event: 'PaymentAttested'
  };
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const evidencePath = path.join(root, 'docs', 'evidence', 'x402-live-smoke.json');
await fs.mkdir(path.dirname(evidencePath), { recursive: true });
await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

console.log('X402-15 PASS - real Injective Testnet payment and PaymentAttested event verified');
console.log(`  report:      ${evidence.report_id}`);
console.log(`  amount:      ${evidence.amount_usdc} USDC`);
console.log(`  payment:     ${evidence.payment_explorer}`);
console.log(`  attestation: ${evidence.attestation_explorer}`);
console.log(`  evidence:    ${path.relative(root, evidencePath)}`);
