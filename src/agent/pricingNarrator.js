// AI demo narrator (BE-10).
//
// Produces the final-demo narrative — RWA issue price, investor yield, risk
// factors and the on-chain action — for the recommended payout speed. Same two
// rules as the judge assistant (AI-12) and valuation agent (AI-9):
//   1. Deterministic-first: every number comes from the real pricing engine.
//   2. The LLM only rephrases, and falls back to the grounded text on ANY error,
//      so `npm run demo` always works (offline or if the provider is down).

import { chatCompletion, isConfigured, resolveProvider } from './llm/openaiCompatClient.js';

const usd = (n) => 'USD ' + Math.round(Number(n)).toLocaleString('en-US');

/** Build the deterministic demo narrative from a compareSpeeds() result. Pure. */
export function buildPricingNarrative(comparison) {
  const rec = comparison.recommended_quote;
  const yieldPct = (rec.implied_gross_yield_bps / 100).toFixed(1);
  const sharePct = (rec.exporter_profit_share_bps / 100).toFixed(0);
  return (
    `TradeShield's AI priced this eBL-backed RWA at ${rec.final_issue_price_usd.toFixed(2)} per token versus a 1.00 ` +
    `target redemption value — a ${yieldPct}% gross upside for investors — on the exporter's ${rec.payout_speed} payout choice, ` +
    `which gives up about ${sharePct}% of ${usd(rec.exporter_gross_profit_usd)} verified trade profit. ` +
    `Current trade risk is ${rec.risk_level} (${rec.risk_score_bps}bps): ${rec.risk_factors.join('; ')}. ` +
    `AI on-chain action: ${rec.pricing_action}. Target redemption is a target, not a guarantee.`
  );
}

function buildMessages(narrative, rec) {
  return [
    {
      role: 'system',
      content:
        `You are TradeShield's demo narrator. Rephrase the GROUNDED NARRATIVE into a punchy 2-3 sentence spoken demo line (<= 80 words) for a hackathon judge. `
        + `Use ONLY the facts given; do not invent numbers; never say returns are guaranteed; keep the "target redemption, not guaranteed" nuance.`
    },
    {
      role: 'user',
      content:
        `GROUNDED NARRATIVE:\n${narrative}\n\n`
        + `KEY NUMBERS: issue ${rec.final_issue_price_usd.toFixed(2)}, investor yield ${(rec.implied_gross_yield_bps / 100).toFixed(1)}%, `
        + `risk ${rec.risk_level} (${rec.risk_score_bps}bps), action ${rec.pricing_action}.`
    }
  ];
}

/**
 * Narrate the pricing for the recommended payout speed.
 * @param {object} comparison compareSpeeds() result
 * @param {object} [options] { env, useLlm, chat }
 * @returns {Promise<{text:string, provider:string, grounded:string}>}
 */
export async function narratePricing(comparison, options = {}) {
  const env = options.env ?? process.env;
  const useLlm = options.useLlm ?? false;
  const chat = options.chat ?? chatCompletion;
  const grounded = buildPricingNarrative(comparison);

  if (useLlm && isConfigured(env)) {
    try {
      const message = await chat(
        { messages: buildMessages(grounded, comparison.recommended_quote), temperature: 0.3, timeoutMs: 20000 },
        env
      );
      const text = (message?.content ?? '').trim();
      if (text) return { text, provider: resolveProvider(env)?.provider ?? 'llm', grounded };
    } catch {
      return { text: grounded, provider: 'deterministic-fallback', grounded };
    }
  }
  return { text: grounded, provider: 'deterministic', grounded };
}
