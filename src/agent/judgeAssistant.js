// Judge Q&A assistant (AI-12).
//
// A grounded question-answering helper for the demo rehearsal: it answers the
// questions a hackathon judge is most likely to ask about the protocol —
// "is this principal-protected?", "how does the AI decide the price?", "why
// discount to 0.80?", "what happens when risk rises?", "what goes on-chain?",
// "how is the collateral verified?".
//
// Two design rules, both straight from docs/PRD.md §13 (risk mitigations):
//   1. Deterministic-first. Every answer is built from REAL engine numbers
//      (quoteFromCase / compareSpeeds) and REAL retrieved risk-intel citations
//      (riskIntel.js), so the assistant can never contradict the pricing engine
//      and always runs offline for the demo.
//   2. The LLM only *rephrases*. An optional OpenAI-compatible model can polish
//      the wording, but it is given the grounded answer as context and falls
//      back to it on any error — exactly like the valuation agent (AI-9).

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compareSpeeds, quoteFromCase } from '../core/pricingEngine.js';
import { retrieveByQuery, retrieveRiskIntel } from './riskIntel.js';
import { chatCompletion, isConfigured, resolveProvider } from './llm/openaiCompatClient.js';

const COPPER_CASE_URL = new URL('../../data/cases/copper-sg-shanghai.case.json', import.meta.url);

function loadDefaultCase() {
  try {
    return JSON.parse(fs.readFileSync(fileURLToPath(COPPER_CASE_URL), 'utf8'));
  } catch {
    return null;
  }
}

const DEFAULT_CASE = loadDefaultCase();

const usd = (n) => 'USD ' + Math.round(Number(n)).toLocaleString('en-US');
const price = (q) => q.final_issue_price_usd.toFixed(2);
const yieldPct = (q) => (q.implied_gross_yield_bps / 100).toFixed(1);
const sharePct = (q) => (q.exporter_profit_share_bps / 100).toFixed(0);

/** Escalate a case to a war-crisis stress so the assistant can cite the pause. */
function escalate(caseData) {
  const stressed = structuredClone(caseData);
  stressed.macro_risk_events = [
    ...(stressed.macro_risk_events ?? []).map((e) =>
      e.type === 'war_risk' || e.type === 'commodity_volatility' ? { ...e, severity: 'critical' } : e
    ),
    { date: '2026-06-09', type: 'war_risk', region: 'Middle East / Strait of Hormuz', severity: 'critical', description: 'Strait closed; extreme war premium.' }
  ];
  return stressed;
}

/**
 * Pre-compute every number an answer might cite, from the real pricing engine.
 * Pure / offline.
 */
export function buildContext(caseData = DEFAULT_CASE) {
  const comparison = compareSpeeds(caseData);
  const bySpeed = Object.fromEntries(comparison.quotes.map((q) => [q.payout_speed, q]));
  const headline = comparison.recommended_quote;
  const stressed = quoteFromCase(escalate(caseData), { payout_speed: headline.payout_speed });
  const caseIntel = retrieveRiskIntel(caseData, { k: 4 });

  return {
    caseData,
    comparison,
    fast: bySpeed.FAST,
    balanced: bySpeed.BALANCED,
    lowCost: bySpeed.LOW_COST,
    headline,
    stressed,
    caseIntel,
    numbers: {
      collateral_usd: headline.ai_verified_collateral_value_usd,
      max_safe_redemption_usd: headline.max_safe_redemption_exposure_usd,
      gross_profit_usd: headline.exporter_gross_profit_usd,
      requested_cash_usd: headline.requested_cash_usd,
      fast_issue_price: bySpeed.FAST.final_issue_price_usd,
      low_cost_issue_price: bySpeed.LOW_COST.final_issue_price_usd,
      risk_level: headline.risk_level,
      risk_score_bps: headline.risk_score_bps,
      stressed_action: stressed.pricing_action
    }
  };
}

function citeTag(doc) {
  return `[${doc.id}] (${doc.source})`;
}

// --- canonical judge intents -------------------------------------------------
// Each intent: keywords for routing, a retrieval query for citations, and an
// answer() that templates the grounded response from real engine numbers.
const INTENTS = [
  {
    id: 'not-guaranteed',
    label: 'Is this principal-protected / a guaranteed return?',
    keywords: ['guarantee', 'guaranteed', 'principal', 'protected', 'protection', 'safe', 'risk-free', 'risk free', 'capital', 'lose', 'loss', '保本', 'guarantor'],
    retrieval: 'is the 1.00 target redemption a guaranteed principal protection',
    answer: (ctx, docs) =>
      `No — and we are deliberate about that. 1 RWA = 1.00 USD is a TARGET redemption value, not guaranteed principal. `
      + `An investor's return comes from buying at a discount (FAST issues at ${price(ctx.fast)} for a ${yieldPct(ctx.fast)}% gross upside to the 1.00 target) `
      + `AND from the trade actually repaying. Real redemption depends on importer payment, cargo settlement and insurance coverage. `
      + `This demo uses permissioned mock investors and does no real fundraising. ${cites(docs)}`
  },
  {
    id: 'how-priced',
    label: 'How does the AI decide the RWA issue price?',
    keywords: ['how', 'decide', 'model', 'formula', 'calculate', 'determine', 'pricing', 'price the', 'methodology', 'compute'],
    retrieval: 'how is the RWA discount priced as a share of exporter profit',
    answer: (ctx, docs) =>
      `The discount the investor earns IS the exporter's financing cost, priced as a share of the exporter's VERIFIED trade profit `
      + `P = invoice − cost-of-goods = ${usd(ctx.numbers.gross_profit_usd)}. Payout speed sets a base share (FAST 50% / BALANCED 33% / LOW_COST 20%), `
      + `trade risk adds to it, then issue_price = cash / (cash + share × P). For this case FAST gives up ~${sharePct(ctx.fast)}% of margin → ${price(ctx.fast)}, `
      + `LOW_COST ~${sharePct(ctx.lowCost)}% → ${price(ctx.lowCost)}. Two guardrails sit on top: AI-verified collateral floors the price, and a share above 85% pauses the offering. ${cites(docs)}`
  },
  {
    id: 'why-discount',
    label: 'Why discount to ~0.80 instead of selling at 1.00?',
    keywords: ['why', 'discount', '0.80', '0.8', 'cheap', 'cheaper', 'below', 'less than', 'fire sale', 'lower price', 'so low', 'undervalued'],
    retrieval: 'why is the issue price a discount, speed versus financing cost trade-off',
    answer: (ctx, docs) =>
      `It is a speed-vs-cost trade-off the exporter chooses, not a fire sale. FAST advances cash now but gives up ~${sharePct(ctx.fast)}% of trade margin → ${price(ctx.fast)} `
      + `(investor ${yieldPct(ctx.fast)}% upside). LOW_COST keeps ~${sharePct(ctx.lowCost)}% of margin → ${price(ctx.lowCost)} (investor ${yieldPct(ctx.lowCost)}% upside) but releases cash slower. `
      + `Selling at 1.00 would mean zero compensation for the investor's time and risk. Risk widens the discount further — ${ctx.headline.risk_discount_bps}bps on this ${ctx.numbers.risk_level} case. ${cites(docs)}`
  },
  {
    id: 'risk-rises',
    label: 'What happens when risk rises in transit?',
    keywords: ['risk rise', 'risk rises', 'risk goes up', 'in transit', 'reprice', 'repriced', 'pause', 'paused', 'war', 'weather', 'escalat', 'default', 'something goes wrong', 'happens if'],
    retrieval: 'risk escalates in transit reprice pause collateral coverage guardrail',
    answer: (ctx, docs) =>
      `The AI re-scores risk and the RiskPricingOracle acts on it. Price decomposes as base − urgency − risk = indicative, floored by collateral. `
      + `As risk rises the risk discount grows and the price falls (REPRICE_DOWN → the pool's Repriced state). If risk hits CRITICAL or the profit share blows past 85%, the AI PAUSES: `
      + `escalate this case to a Hormuz war crisis and it scores ${ctx.stressed.risk_score_bps}bps → ${ctx.stressed.pricing_action}. `
      + `Throughout, collateral coverage caps redemption exposure at ${usd(ctx.numbers.max_safe_redemption_usd)} so the pool can never over-issue. ${cites(docs)}`
  },
  {
    id: 'on-chain',
    label: 'What goes on-chain and what can the contracts do?',
    keywords: ['on-chain', 'on chain', 'onchain', 'contract', 'oracle', 'blockchain', 'hash', 'evidence', 'token', 'smart contract', 'solidity', 'event', 'emit'],
    retrieval: 'quote hash evidence hash oracle on-chain pricing update offering states',
    answer: (ctx, docs) =>
      `Each quote emits two hashes: evidence_hash anchors the INPUTS (valuation, risk score, document checks) and quote_hash anchors the TERMS (price, supply, action). `
      + `RiskPricingOracle.updatePricing(poolId, issuePrice, riskLevel, action, evidenceHash) writes the AI decision on-chain; RWAOfferingPool runs createOffering → subscribe → settle/pause. `
      + `The lifecycle is Created → Priced → Open → Subscribed → Funded → InTransit → (Repriced | Paused | Frozen) → Repaid → Redeemed. `
      + `For this offering quote_hash = ${ctx.headline.quote_hash.slice(0, 18)}… and evidence_hash = ${ctx.headline.evidence_hash.slice(0, 18)}… ${cites(docs)}`
  },
  {
    id: 'collateral',
    label: 'How is the cargo / collateral value verified?',
    keywords: ['collateral', 'verify', 'verified', 'valuation', 'cargo value', 'worth', 'over-value', 'overvalue', 'inflated', 'real value', 'how much', 'haircut', 'ltv'],
    retrieval: 'AI verified collateral conservative floor coverage limit valuation haircut',
    answer: (ctx, docs) =>
      `Collateral is a conservative floor, not the headline price: min(declared invoice, quantity × landed market price, insured value) minus a volatility haircut for war-premium highs `
      + `→ AI-verified ${usd(ctx.numbers.collateral_usd)}. We only let target redemption exposure reach collateral × coverage limit = ${usd(ctx.numbers.max_safe_redemption_usd)}, `
      + `so an over-stated cargo can never back an over-sized issue. Document consistency across eBL / invoice / insurance feeds the risk discount whenever fields disagree. ${cites(docs)}`
  }
];

const GENERAL_INTENT = {
  id: 'general',
  label: 'General risk-intelligence lookup',
  retrieval: null,
  answer: (ctx, docs) =>
    `Grounding this against TradeShield's risk intel: ${docs.map((d) => `${d.id} — ${d.snippet}`).join(' ')} `
    + `In short: the RWA discount is priced as a share of the exporter's verified profit, 1.00 is a target (not guaranteed) redemption value, `
    + `and rising risk reprices or pauses the offering on-chain.`
};

function cites(docs) {
  if (!docs || docs.length === 0) return '';
  return `Sources: ${docs.map(citeTag).join(', ')}.`;
}

/** Route a free-text question to the best-matching intent (keyword overlap). */
export function routeIntent(question) {
  const q = String(question ?? '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const intent of INTENTS) {
    let score = 0;
    for (const kw of intent.keywords) {
      if (q.includes(kw)) score += kw.includes(' ') ? 2 : 1; // phrase hits weigh more
    }
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return best ?? GENERAL_INTENT;
}

/** Build the LLM polish prompt (the model only rephrases the grounded answer). */
function buildLlmMessages(question, grounded, docs) {
  return [
    {
      role: 'system',
      content:
        `You are TradeShield's hackathon Q&A assistant answering a judge. Rephrase the GROUNDED ANSWER clearly and concisely (<= 120 words). `
        + `Rules: use ONLY facts in the grounded answer; keep every citation tag like [MRI-...] or [POL-...]; never claim returns are guaranteed — `
        + `always preserve the "target redemption value, not guaranteed" nuance when present. Do not invent numbers.`
    },
    {
      role: 'user',
      content: `JUDGE QUESTION: ${question}\n\nGROUNDED ANSWER:\n${grounded}\n\nCITATION IDS: ${docs.map((d) => d.id).join(', ') || 'none'}`
    }
  ];
}

/**
 * Answer one judge question, grounded in real engine numbers + retrieved intel.
 * @param {string} question
 * @param {object} [options] { caseData, env, useLlm }
 *   useLlm defaults to false (deterministic-first); set true to let a configured
 *   LLM rephrase the grounded answer, with automatic deterministic fallback.
 * @returns {{question, intent_id, intent_label, answer, grounded_answer, citations, provider, numbers}}
 */
export async function answerJudgeQuestion(question, options = {}) {
  const caseData = options.caseData ?? DEFAULT_CASE;
  const env = options.env ?? process.env;
  const useLlm = options.useLlm ?? false;
  const chat = options.chat ?? chatCompletion;

  const ctx = buildContext(caseData);
  const intent = routeIntent(question);
  const docs = intent.retrieval
    ? retrieveByQuery(intent.retrieval, { k: 2 })
    : retrieveByQuery(question, { k: 3 });
  const grounded = intent.answer(ctx, docs);

  let answer = grounded;
  let provider = 'deterministic';
  if (useLlm && isConfigured(env)) {
    try {
      const message = await chat({ messages: buildLlmMessages(question, grounded, docs), temperature: 0.2 }, env);
      const text = (message?.content ?? '').trim();
      if (text) {
        answer = text;
        provider = resolveProvider(env)?.provider ?? 'llm';
      }
    } catch {
      // keep the grounded deterministic answer on any LLM error
      answer = grounded;
      provider = 'deterministic-fallback';
    }
  }

  return {
    question,
    intent_id: intent.id,
    intent_label: intent.label,
    answer,
    grounded_answer: grounded,
    citations: docs.map((d) => ({ id: d.id, source: d.source, type: d.type })),
    provider,
    numbers: ctx.numbers
  };
}

// The canonical questions a judge is most likely to ask (one per intent).
export const JUDGE_QUESTIONS = [
  'Is this a principal-protected, guaranteed-return product?',
  'How does the AI actually decide the RWA issue price?',
  'Why is the RWA discounted to around 0.80 instead of selling at 1.00?',
  'What happens to investors when risk rises while the cargo is in transit?',
  'What does the AI write on-chain, and what can the smart contracts do?',
  'How do you verify the cargo is really worth the stated collateral value?'
];

/**
 * Run the full judge-rehearsal Q&A set. Used by `npm run qa` and the AI-12 test.
 * @param {object} [options] { caseData, env, useLlm }
 */
export async function runJudgeRehearsal(options = {}) {
  const answers = [];
  for (const q of JUDGE_QUESTIONS) {
    answers.push(await answerJudgeQuestion(q, options));
  }
  return answers;
}
