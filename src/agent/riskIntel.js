// RAG risk-intelligence retriever (AI-11).
//
// A deliberately small, dependency-free retriever over a mock macro risk feed
// (data/risk-intel/feed.json) plus TradeShield policy notes. It is the "R" in a
// RAG loop: given a trade case (or a free-text question), it returns the most
// relevant risk-intel snippets with sources, which the pricing engine cites in
// its evidence graph and the Judge Q&A assistant uses to ground answers.
//
// Scoring is transparent token/field overlap (no embeddings) so it runs offline
// and deterministically for the demo. The corpus is loaded synchronously once.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FEED_URL = new URL('../../data/risk-intel/feed.json', import.meta.url);

function loadCorpus() {
  try {
    const raw = fs.readFileSync(fileURLToPath(FEED_URL), 'utf8');
    return JSON.parse(raw).documents ?? [];
  } catch {
    return [];
  }
}

const CORPUS = loadCorpus();

/** All risk-intel documents (for inspection / custom corpora in tests). */
export function getRiskCorpus() {
  return CORPUS;
}

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'is', 'are', 'with', 'risk', 'price']);

function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function regionTokens(region) {
  return tokenize(region).filter((t) => t.length > 3);
}

/** Build a retrieval query profile from a trade case. */
function caseQuery(caseData = {}) {
  const macro = caseData.macro_risk_events ?? [];
  const types = new Set(macro.map((e) => e.type));
  const regions = macro.flatMap((e) => regionTokens(e.region));
  const commodity = (caseData.cargo?.commodity ?? caseData.market?.commodity ?? caseData.bill_of_lading?.cargo ?? '').toLowerCase();
  const terms = new Set([
    ...tokenize(commodity),
    ...regions,
    ...macro.flatMap((e) => tokenize(e.description))
  ]);
  return { types, regions, commodity, terms };
}

function scoreDoc(doc, q) {
  let score = 0;
  const tags = new Set((doc.tags ?? []).map((t) => t.toLowerCase()));

  if (q.types?.has?.(doc.type)) score += 3;
  if (q.commodity && (doc.commodity === q.commodity || (doc.commodity && q.commodity.includes(doc.commodity)) || (doc.commodity && doc.commodity.includes(q.commodity.split(' ')[0])))) {
    score += 3;
  }
  for (const r of q.regions ?? []) {
    if (regionTokens(doc.region).includes(r)) score += 2;
  }
  for (const term of q.terms ?? []) {
    if (tags.has(term)) score += 1.5;
  }
  // light text overlap
  const docTokens = new Set(tokenize(doc.text));
  for (const term of q.terms ?? []) {
    if (docTokens.has(term)) score += 0.25;
  }
  // severity nudge so critical intel sorts above info on ties
  score += { critical: 0.3, warning: 0.15, info: 0 }[doc.severity] ?? 0;
  return score;
}

function pack(doc, score) {
  return {
    id: doc.id,
    type: doc.type,
    region: doc.region,
    severity: doc.severity,
    source: doc.source,
    snippet: doc.text,
    score: Math.round(score * 100) / 100
  };
}

/**
 * Retrieve the most relevant risk-intel for a trade case.
 * @param {object} caseData
 * @param {object} [opts] { k=4, corpus, includePolicies=false }
 */
export function retrieveRiskIntel(caseData, opts = {}) {
  const { k = 4, corpus = CORPUS, includePolicies = false } = opts;
  const q = caseQuery(caseData);
  return corpus
    .filter((doc) => includePolicies || doc.type !== 'policy')
    .map((doc) => ({ doc, score: scoreDoc(doc, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => pack(x.doc, x.score));
}

/**
 * Retrieve by free-text question (for the Judge Q&A assistant). Searches tags +
 * text and includes policy notes.
 * @param {string} query
 * @param {object} [opts] { k=3, corpus }
 */
export function retrieveByQuery(query, opts = {}) {
  const { k = 3, corpus = CORPUS } = opts;
  const terms = new Set(tokenize(query));
  const q = { types: new Set(), regions: [], commodity: '', terms };
  return corpus
    .map((doc) => ({ doc, score: scoreDoc(doc, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => pack(x.doc, x.score));
}

/**
 * Retrieval eval: precision@k for a small labeled set. Used by the AI-11 test
 * to guard that relevant intel keeps surfacing as the corpus evolves.
 * @returns {{ cases:Array, mean_precision:number }}
 */
export function evaluateRetrieval(corpus = CORPUS) {
  const labeled = [
    {
      name: 'copper-hormuz',
      caseData: {
        cargo: { commodity: 'Copper Cathode' },
        macro_risk_events: [
          { type: 'war_risk', region: 'Middle East / Strait of Hormuz' },
          { type: 'commodity_volatility', region: 'Global' }
        ]
      },
      relevant: ['MRI-HORMUZ-WAR-2026-06', 'MRI-COPPER-VOL-2026-06']
    },
    {
      name: 'crude-hormuz',
      caseData: {
        cargo: { commodity: 'Crude Oil' },
        macro_risk_events: [
          { type: 'war_risk', region: 'Middle East / Strait of Hormuz' },
          { type: 'commodity_volatility', region: 'Global' },
          { type: 'fx_volatility', region: 'South Korea (KRW)' }
        ]
      },
      relevant: ['MRI-HORMUZ-WAR-2026-06', 'MRI-BRENT-2026-06', 'MRI-KRW-FX-2026-06']
    }
  ];

  const cases = labeled.map((c) => {
    const k = c.relevant.length;
    const retrieved = retrieveRiskIntel(c.caseData, { k, corpus }).map((m) => m.id);
    const hits = retrieved.filter((id) => c.relevant.includes(id)).length;
    return { name: c.name, k, retrieved, precision: hits / k };
  });
  const meanPrecision = cases.reduce((s, c) => s + c.precision, 0) / cases.length;
  return { cases, mean_precision: Math.round(meanPrecision * 100) / 100 };
}
