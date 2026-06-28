/**
 * x402 Settlement — AgentBL
 *
 * Records x402 payment evidence on-chain via PaymentOracle.logPaymentEvidence().
 *
 * When DEPLOYER_PRIVATE_KEY is configured in .env:
 *   1. Builds the PaymentEvidence payload
 *   2. Signs and sends logPaymentEvidence() tx to Injective Testnet
 *   3. Returns the REAL on-chain tx hash
 *
 * When key is NOT configured:
 *   Falls back to deterministic mock hashes (offline demo mode).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { x402Network, x402PayTo, x402Usdc } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

// Load .env if not already loaded (dotenv may not be installed)
try {
  const dotenvPath = path.join(rootDir, 'node_modules', 'dotenv', 'config.js');
  if (fs.existsSync(dotenvPath)) {
    await import(dotenvPath);
  } else {
    // Fallback: manual .env parser
    try {
      const envContent = fs.readFileSync(path.join(rootDir, '.env'), 'utf8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key && !process.env[key]) process.env[key] = value;
      }
    } catch { /* no .env file */ }
  }
} catch { /* ignore */ }

// ── Chain / wallet helpers ─────────────────────────────────

let _provider = null;
let _wallet = null;
let _paymentOracle = null;

function loadChainConfig() {
  const configPath = path.join(rootDir, 'public', 'chain-config.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
}

function hasChainConfig() {
  const cfg = loadChainConfig();
  return Boolean(cfg?.contracts?.PaymentOracle && cfg?.paymentOracle?.abi);
}

async function getChainProvider() {
  if (_provider) return _provider;
  const { ethers } = await import('ethers');
  const rpcUrl = process.env.INJECTIVE_RPC_URL
    || 'https://testnet.sentry.chain.json-rpc.injective.network';
  _provider = new ethers.JsonRpcProvider(rpcUrl);
  return _provider;
}

async function getSigner() {
  if (_wallet) return _wallet;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) return null;

  const provider = await getChainProvider();
  const { ethers } = await import('ethers');
  _wallet = new ethers.Wallet(privateKey.trim(), provider);
  return _wallet;
}

async function getPaymentOracleContract() {
  if (_paymentOracle) return _paymentOracle;
  const cfg = loadChainConfig();
  if (!cfg?.contracts?.PaymentOracle || !cfg?.paymentOracle?.abi) return null;

  const signer = await getSigner();
  if (!signer) return null;

  const { ethers } = await import('ethers');
  _paymentOracle = new ethers.Contract(cfg.contracts.PaymentOracle, cfg.paymentOracle.abi, signer);
  return _paymentOracle;
}

// ── Payment receipt builders ───────────────────────────────

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

// ── Main: record payment evidence ──────────────────────────

/**
 * Record payment evidence — if chain is available, call PaymentOracle.logPaymentEvidence()
 * on Injective Testnet. Otherwise, generate deterministic mock hashes.
 *
 * @returns {Promise<{ok: boolean, payment: object}>}
 */
export async function recordPaymentEvidence({ serviceId, amountUSDC, responseData, payer: givenPayer }) {
  const evidence = buildPaymentEvidence({ serviceId, amountUSDC, responseData, payer: givenPayer });

  // ── Try on-chain first ──
  try {
    const oracle = await getPaymentOracleContract();
    if (oracle) {
      // Use given payer address (from MetaMask signature), or fall back to deployer
      const payer = givenPayer || (await (await getSigner()).getAddress());

      console.log(`[PaymentOracle] Submitting logPaymentEvidence on-chain…`);
      console.log(`  givenPayer (from MetaMask): ${givenPayer || '(not provided)'}`);
      console.log(`  Payer (resolved):  ${payer}`);
      console.log(`  Service:  ${serviceId}`);
      console.log(`  Amount:   ${evidence.amountMicrousd} micro-USDC`);

      const tx = await oracle.logPaymentEvidence(
        payer,
        serviceId,
        evidence.amountMicrousd,
        evidence.paymentRef,
        evidence.responseHash,
        evidence.responseHash, // quoteHash = responseHash (same payload in MVP)
        evidence.responseHash, // evidenceHash = responseHash
        'OPEN'                 // pricingAction
      );

      console.log(`  Tx sent:  ${tx.hash}`);
      console.log(`  Waiting for confirmation…`);

      const receipt = await tx.wait();
      const chainId = process.env.INJECTIVE_RPC_URL?.includes('injective') ? 1439 : 1439;
      const explorerBase = 'https://testnet.blockscout.injective.network';

      return {
        ok: true,
        payment: {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          explorerUrl: `${explorerBase}/tx/${receipt.hash}`,
          receipt: {
            network: x402Network(),
            token: x402Usdc(),
            payTo: x402PayTo(),
            amountUSDC,
            amountMicrousd: evidence.amountMicrousd,
            serviceId,
            paymentRef: evidence.paymentRef,
            timestamp: new Date().toISOString()
          },
          evidence,
          onChainEvent: 'PaymentEvidenceLogged',
          live: true
        }
      };
    }
  } catch (err) {
    console.warn(`[PaymentOracle] On-chain call failed, falling back to mock:`, err.message);
  }

  // ── Fallback: offline mock ──
  const { txHash } = generatePaymentReceipt({ serviceId, amountUSDC });
  return {
    ok: true,
    payment: {
      txHash,
      receipt: {
        network: x402Network(),
        token: x402Usdc(),
        payTo: x402PayTo(),
        amountUSDC,
        amountMicrousd: evidence.amountMicrousd,
        serviceId,
        paymentRef: txHash,
        timestamp: new Date().toISOString()
      },
      evidence,
      onChainEvent: 'PaymentEvidenceLogged',
      live: false
    }
  };
}
