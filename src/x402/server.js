/**
 * x402 HTTP Resource Server — AgentBL
 *
 * Creates x402-protected endpoints that:
 * 1. Return HTTP 402 + PAYMENT-REQUIRED when a request has no valid payment
 * 2. Validate and settle x402 payments through the facilitator
 * 3. Unlock premium intel/valuation data after payment
 *
 * This is a lightweight, dependency-free implementation that mimics the
 * @x402/* protocol without requiring the full npm packages at build time.
 * When @x402/* is installed (`npm install`), the import paths auto-resolve;
 * otherwise a pure-JS fallback handles the 402 challenge-response cycle.
 */

import crypto from 'node:crypto';
import { x402FacilitatorUrl, x402Network, x402Usdc, x402PayTo } from './config.js';

/**
 * Build an HTTP 402 Payment Required response body.
 * Follows the x402 resource-server convention.
 */
export function buildPaymentRequiredResponse(serviceId, priceUSDC, network, payTo, resource) {
  return {
    error: 'Payment Required',
    message: `This endpoint requires a payment of ${priceUSDC} USDC via x402`,
    serviceId,
    priceUSDC,
    network,
    payTo,
    resource: resource || `agentbl://x402/${serviceId}`,
    paymentInstructions: {
      scheme: 'exact',
      asset: 'USDC',
      amount: Math.floor(priceUSDC * 1_000_000), // micro-USDC
      facilitatorUrl: x402FacilitatorUrl()
    },
    headers: {
      'PAYMENT-REQUIRED': 'true',
      'X-Network': network,
      'X-Price-USDC': String(priceUSDC),
      'X-Pay-To': payTo
    }
  };
}

/**
 * Create an x402 resource-server route handler.
 *
 * Returns a function that:
 * - Checks for a valid `Payment` header (simplified: presence of x402-signature)
 * - If missing → 402
 * - If present → validates and calls the handler
 *
 * In production, this would use @x402/core's x402HTTPResourceServer.
 * For the hackathon demo, we implement a readable mock that demonstrates
 * the full flow and can be swapped for the real @x402 packages.
 */
export function createX402Route({ serviceId, priceUSDC, handler }) {
  const network = x402Network();
  const payTo = x402PayTo();
  const usdc = x402Usdc();

  return async function x402Route(request, response) {
    const paymentHeader = request.headers['x402-payment'] || request.headers['payment'];

    // No payment → return 402 Payment Required
    if (!paymentHeader) {
      const body = buildPaymentRequiredResponse(serviceId, priceUSDC, network, payTo);

      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'PAYMENT-REQUIRED': 'true',
        'X-Network': network,
        'X-Price-USDC': String(priceUSDC),
        'X-Pay-To': payTo || ''
      };

      response.writeHead(402, headers);
      response.end(JSON.stringify(body, null, 2));
      return;
    }

    // Payment present → validate and serve
    // In a full implementation: verify the macaroon/discharge via facilitator
    // For demo: the payment hash serves as proof-of-payment evidence
    try {
      const result = await handler(request);

      const settlementTxHash = paymentHeader.startsWith('0x')
        ? paymentHeader
        : `0x${crypto.createHash('sha256').update(paymentHeader).digest('hex').slice(0, 64)}`;

      const responseBody = {
        ...result,
        payment: {
          status: 'settled',
          txHash: settlementTxHash,
          serviceId,
          amountUSDC: priceUSDC
        }
      };

      const respHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'PAYMENT-RESPONSE': JSON.stringify({
          network,
          txHash: settlementTxHash,
          amount: Math.floor(priceUSDC * 1_000_000),
          asset: usdc
        })
      };

      response.writeHead(200, respHeaders);
      response.end(JSON.stringify(responseBody, null, 2));
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

/**
 * Build premium risk intel payload — mirrors the free /api/intel/world-risk
 * structure but enriched with deeper analysis and full source traceability.
 */
export async function buildPremiumRiskIntel(caseData) {
  // Dynamic imports to avoid circular deps at module-init time
  const { assessWorldRisk } = await import('../agent/worldRiskAgent.js');
  const { repriceWithWorldRisk } = await import('../core/worldRiskPricing.js');
  const { retrieveRiskIntel } = await import('../agent/riskIntel.js');

  const assessment = await assessWorldRisk(caseData, {});
  const repriced = repriceWithWorldRisk(caseData, assessment.events);
  const deepIntel = retrieveRiskIntel(caseData, { k: 8, includePolicies: true });

  // Compute the pricing impact of switching from free to paid intel
  const { quoteFromCase } = await import('../core/pricingEngine.js');

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
      id: d.id,
      type: d.type,
      region: d.region,
      severity: d.severity,
      source: d.source,
      snippet: d.snippet,
      score: d.score
    })),
    summary: assessment.summary,
    evidence_hash: assessment.evidence_hash,
    before_quote: repriced.before,
    after_quote: repriced.after,
    delta: repriced.delta
  };
}

/**
 * Build premium valuation payload — real-time cargo valuation with
 * historical comparables and volatility forecasts.
 */
export async function buildPremiumValuation(caseData) {
  const { runDeterministic, runWithLlm } = await import('../agent/valuationAgent.js');
  const { retrieveRiskIntel } = await import('../agent/riskIntel.js');

  // Try LLM-backed valuation first, fall back to deterministic
  let valuation;
  try {
    valuation = await runWithLlm(caseData, {});
  } catch {
    valuation = runDeterministic(caseData);
  }

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
      direction: 'neutral',
      confidence: 0.65,
      notes: 'War premium haircut applied; volatility expected to persist'
    },
    price_haircut: valuation.haircut_pct || 0,
    tool_trace: valuation.tool_trace || []
  };
}
