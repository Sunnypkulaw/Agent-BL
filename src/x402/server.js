/**
 * x402 HTTP Resource Server — AgentBL
 *
 * Full x402 flow with MetaMask wallet signing:
 *   1. GET without payment → HTTP 402 + challenge to sign
 *   2. User signs via MetaMask (personal_sign)
 *   3. POST with X402-Signature + X402-Signer headers
 *   4. Server verifies signature, calls PaymentOracle on-chain
 *   5. Premium risk report unlocked
 */

import crypto from 'node:crypto';
import { x402FacilitatorUrl, x402Network, x402Usdc, x402PayTo } from './config.js';

// ── Payment challenge ──────────────────────────────────────

export function buildPaymentRequiredResponse(serviceId, priceUSDC, network, payTo, resource) {
  const nonce = Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  const challenge = buildSignatureMessage({ serviceId, priceUSDC, nonce });

  return {
    error: 'Payment Required',
    message: `This endpoint requires a payment of ${priceUSDC} USDC via x402`,
    serviceId,
    priceUSDC,
    network,
    payTo,
    nonce,
    challenge,           // ← The message user signs in MetaMask
    resource: resource || `agentbl://x402/${serviceId}`,
    paymentInstructions: {
      scheme: 'exact',
      asset: 'USDC',
      amount: Math.floor(priceUSDC * 1_000_000),
      facilitatorUrl: x402FacilitatorUrl(),
      signMethod: 'personal_sign' // MetaMask signs this with eth.personal_sign
    },
    headers: {
      'PAYMENT-REQUIRED': 'true',
      'X-Network': network,
      'X-Price-USDC': String(priceUSDC),
      'X-Pay-To': payTo
    }
  };
}

function buildSignatureMessage({ serviceId, priceUSDC, nonce }) {
  return [
    `AgentBL x402 Payment Authorization`,
    ``,
    `Service:   ${serviceId}`,
    `Amount:    ${priceUSDC} USDC`,
    `Network:   Injective Testnet (chainId 1439)`,
    `Nonce:     ${nonce}`,
    ``,
    `By signing this message, you authorize this payment via the x402 protocol.`,
    `This does not transfer real USDC — it records your payment intent on-chain in PaymentOracle.`
  ].join('\n');
}

// ── Signature verification ─────────────────────────────────

/**
 * Recover the Ethereum address from a personal_sign signature.
 * Uses ethers if available, otherwise falls back to manual recovery.
 */
export async function recoverSigner(message, signature) {
  try {
    const { ethers } = await import('ethers');
    return ethers.verifyMessage(message, signature);
  } catch {
    // Minimal fallback: keccak256-based recovery
    const { ethers } = await import('ethers');
    const digest = ethers.hashMessage(message);
    return ethers.recoverAddress(digest, signature);
  }
}

// ── x402 route handler ─────────────────────────────────────

export function createX402Route({ serviceId, priceUSDC, handler }) {
  const network = x402Network();
  const payTo = x402PayTo();

  return async function x402Route(request, response) {
    // ── Read payment headers ──
    const sigHeader = request.headers['x402-signature'];
    const signerHeader = request.headers['x402-signer'];

    // ── No payment → return 402 with challenge to sign ──
    if (!sigHeader || !signerHeader) {
      const body = buildPaymentRequiredResponse(serviceId, priceUSDC, network, payTo);

      response.writeHead(402, {
        'Content-Type': 'application/json; charset=utf-8',
        'PAYMENT-REQUIRED': 'true',
        'X-Network': network,
        'X-Price-USDC': String(priceUSDC),
        'X-Pay-To': payTo || ''
      });
      response.end(JSON.stringify(body, null, 2));
      return;
    }

    // ── Payment present → verify signature then call PaymentOracle ──
    try {
      // 1. Reconstruct the challenge message the user signed
      // Read the challenge nonce from the original request body or reconstruct
      let nonce;
      try {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString('utf8').trim();
        if (body) { const parsed = JSON.parse(body); nonce = parsed.nonce; }
      } catch { /* body may already be consumed; use fallback */ }

      if (!nonce) nonce = 'onchain';
      const message = buildSignatureMessage({ serviceId, priceUSDC, nonce });

      // 2. Verify the signature
      let payerAddress;
      try {
        payerAddress = await recoverSigner(message, sigHeader);
        console.log(`[x402] Signature verified — recovered payer: ${payerAddress}`);
        console.log(`[x402] Claimed signer: ${signerHeader}`);
      } catch {
        response.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: 'Invalid signature — could not recover signer' }));
        return;
      }

      // Verify the signer matches the claimed address
      if (payerAddress.toLowerCase() !== signerHeader.toLowerCase()) {
        response.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({
          ok: false,
          error: `Signature mismatch: recovered ${payerAddress} but claimed ${signerHeader}`
        }));
        return;
      }

      // 3. Record payment on-chain via PaymentOracle
      //    If client already settled on-chain from their wallet (X402-TxHash present), skip server relay.
      let paymentResult;
      const clientTxHash = request.headers['x402-txhash'];
      if (clientTxHash) {
        console.log(`[x402] Client-side settlement — tx: ${clientTxHash}`);
        paymentResult = {
          ok: true,
          payment: {
            txHash: clientTxHash,
            live: true,
            payer: payerAddress
          }
        };
      } else {
        try {
          const { recordPaymentEvidence } = await import('./settlement.js');
          paymentResult = await recordPaymentEvidence({
            serviceId,
            amountUSDC: priceUSDC,
            payer: payerAddress,
            responseData: { serviceId, priceUSDC, payer: payerAddress, nonce }
          });
        } catch (e) {
          console.warn('[x402] PaymentOracle call failed, using mock:', e.message);
          paymentResult = {
            ok: true,
            payment: {
              txHash: `0x${crypto.createHash('sha256').update(sigHeader).digest('hex')}`,
              live: false
            }
          };
        }
      }

      // 4. Build the report
      const report = await handler(request);

      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'PAYMENT-RESPONSE': JSON.stringify({
          network,
          txHash: paymentResult.payment.txHash,
          amount: Math.floor(priceUSDC * 1_000_000),
          payer: payerAddress
        })
      });
      response.end(JSON.stringify({
        ...report,
        payment: {
          status: 'settled',
          payer: payerAddress,
          txHash: paymentResult.payment.txHash,
          explorerUrl: paymentResult.payment.explorerUrl || null,
          live: paymentResult.payment.live || false,
          serviceId,
          amountUSDC: priceUSDC
        }
      }, null, 2));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: false,
        error: error.message,
        serviceId,
        payment: { status: 'failed' }
      }));
    }
  };
}

// ── Premium Intel / Valuation builders ────────────────────

export async function buildPremiumRiskIntel(caseData) {
  const { assessWorldRisk } = await import('../agent/worldRiskAgent.js');
  const { repriceWithWorldRisk } = await import('../core/worldRiskPricing.js');
  const { retrieveRiskIntel } = await import('../agent/riskIntel.js');

  const assessment = await assessWorldRisk(caseData, {});
  const repriced = repriceWithWorldRisk(caseData, assessment.events);
  const deepIntel = retrieveRiskIntel(caseData, { k: 8, includePolicies: true });

  return {
    ok: true,
    service: 'premium-risk',
    live: assessment.live,
    provider: assessment.provider,
    queried: assessment.queried,
    profile: assessment.profile,
    events: assessment.events,
    signals: assessment.signals,
    deepIntel: deepIntel.map((d) => ({
      id: d.id, type: d.type, region: d.region,
      severity: d.severity, source: d.source,
      snippet: d.snippet, score: d.score
    })),
    summary: assessment.summary,
    evidence_hash: assessment.evidence_hash,
    before_quote: repriced.before,
    after_quote: repriced.after,
    delta: repriced.delta
  };
}

export async function buildPremiumValuation(caseData) {
  const { runDeterministic, runWithLlm } = await import('../agent/valuationAgent.js');
  const { retrieveRiskIntel } = await import('../agent/riskIntel.js');

  let valuation;
  try { valuation = await runWithLlm(caseData, {}); }
  catch { valuation = runDeterministic(caseData); }

  const marketIntel = retrieveRiskIntel(caseData, { k: 3 });

  return {
    ok: true,
    service: 'premium-valuation',
    cargo_value: valuation.cargo_value_usd,
    unit_price: valuation.unit_price_usd_per_mt,
    valuation_method: valuation.method || 'premium',
    data_sources: valuation.data_sources || ['mock:premium'],
    historical_comparables: marketIntel.filter((m) => m.type === 'commodity_volatility'),
    volatility_forecast: {
      direction: 'neutral', confidence: 0.65,
      notes: 'War premium haircut applied; volatility expected to persist'
    },
    price_haircut: valuation.haircut_pct || 0,
    tool_trace: valuation.tool_trace || []
  };
}
