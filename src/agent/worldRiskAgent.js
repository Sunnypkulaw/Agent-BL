// World-risk intelligence agent (xAPI-powered).
//
// Goal: judge the REAL-WORLD risk to a specific cargo by pulling live signals
// through xAPI — international situation (X/Twitter + Google News), officials'
// statements (specific handles), and prediction-market odds (Polymarket-style) —
// then DETERMINISTICALLY map them into structured `macro_risk_events` in the
// exact vocabulary the pricing engine already understands (src/core/pricingEngine
// scoreRisk). Those events feed quoteFromCase, so live world risk visibly moves
// the RWA issue price (or trips PAUSE).
//
// Design mirrors valuationAgent.js: deterministic-first (the LLM, if any, only
// writes prose — it never sets the risk numbers), with an injectable `execute`
// seam and an offline fixture fallback so the demo always runs with no key.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isXapiConfigured } from './xapi/xapiClient.js';
import {
  searchTweets,
  getOfficialTweets,
  searchNews,
  getPredictionMarket
} from './tools/worldRiskTools.js';

const WATCHLIST_URL = new URL('../../data/world-intel/watchlist.json', import.meta.url);

function loadWatchlist() {
  try {
    return JSON.parse(fs.readFileSync(fileURLToPath(WATCHLIST_URL), 'utf8'));
  } catch {
    return { official_handles: [], query_templates: {}, region_keywords: {}, commodity_aliases: {} };
  }
}

const WATCHLIST = loadWatchlist();

const SEVERITY_RANK = { info: 0, warning: 1, critical: 2 };
const RANK_SEVERITY = ['info', 'warning', 'critical'];
function maxSeverity(a, b) {
  return RANK_SEVERITY[Math.max(SEVERITY_RANK[a] ?? 0, SEVERITY_RANK[b] ?? 0)];
}

// Keyword -> macro_risk_event.type. Types match scoreRisk's MACRO_RISK_BPS table.
// Patterns allow plurals/inflections (sanctions, prices, attacks) but keep word
// boundaries so "war" does NOT match "warning"/"warranty".
const TYPE_RULES = [
  { type: 'war_risk', re: /\b(wars?|missiles?|attacks?|conflicts?|escalat\w*|blockad\w*|closures?|closed|straits?|naval|hostilit\w*|airstrikes?|drones?)\b/i, region: 'route' },
  { type: 'sanction_risk', re: /\b(sanctions?|embargo\w*|ofac|export bans?|export controls?|blacklist\w*|asset freezes?)\b/i, region: 'global' },
  { type: 'commodity_volatility', re: /\b(prices?|record|all-time|surges?|spikes?|soar\w*|rall(?:y|ies)|plunge\w*|volatil\w*|supply shocks?|whipsaw\w*)\b/i, region: 'global', commodityGated: true },
  { type: 'port_congestion', re: /\b(ports?|berths?|terminals?|congestion|backlogs?|queues?|dwell)\b/i, region: 'discharge' },
  { type: 'severe_weather', re: /\b(typhoons?|hurricanes?|cyclones?|storms?|floods?|gale\w*|severe weather)\b/i, region: 'route' },
  { type: 'fx_volatility', re: /\b(currenc\w*|devalu\w*|exchange rates?|forex|fx|won|yuan|rupee|lira)\b/i, region: 'global' },
  { type: 'buyer_country_risk', re: /\b(defaults?|bankrupt\w*|insolven\w*|payment risk|credit downgrades?|nonpayment|non-payment)\b/i, region: 'buyer' }
];

function intensity(text) {
  if (/\b(closures?|closed|blockad\w*|shut\w*|halt\w*|wars?|attacks?|record|all-time|defaults?|insolven\w*|invalid|void)\b/i.test(text)) return 'critical';
  if (/\b(surges?|spikes?|soar\w*|threats?|risks?|escalat\w*|warn\w*|delays?|volatil\w*|congestion|exclusion\w*|shorten\w*|reroute\w*)\b/i.test(text)) return 'warning';
  return 'info';
}

function lc(value) {
  return String(value ?? '').toLowerCase();
}

/** Build the monitoring profile (queries, regions, officials) from a trade case. */
export function buildQueryProfile(caseData = {}) {
  const bl = caseData.bill_of_lading ?? {};
  const cargo = caseData.cargo ?? {};
  const commodity = cargo.commodity ?? caseData.market?.commodity ?? bl.cargo ?? 'commodity';
  const load = bl.port_of_loading ?? null;
  const discharge = (bl.port_of_discharge ?? '').split('(')[0].trim() || null;

  // Chokepoint exposure: scan existing macro events + route text for region keywords.
  const haystack = [
    ...(caseData.macro_risk_events ?? []).map((e) => `${e.region} ${e.description}`),
    bl.port_of_loading, bl.port_of_discharge, bl.route
  ].map(lc).join(' ');
  let exposedRegion = null;
  for (const [key, words] of Object.entries(WATCHLIST.region_keywords ?? {})) {
    if (words.some((w) => haystack.includes(lc(w)))) { exposedRegion = key; break; }
  }
  const hormuzExposed = exposedRegion === 'hormuz';
  const routeRegion = hormuzExposed
    ? 'Middle East / Strait of Hormuz'
    : (load && discharge ? `${load} → ${discharge}` : (load || discharge || 'route'));
  const regionTerm = hormuzExposed ? 'Strait of Hormuz' : (load || routeRegion);

  const commodityKey = Object.keys(WATCHLIST.commodity_aliases ?? {}).find((k) => lc(commodity).includes(k));
  const commodityTerms = (WATCHLIST.commodity_aliases?.[commodityKey] ?? [lc(commodity)]).filter(Boolean);

  const t = WATCHLIST.query_templates ?? {};
  const fill = (tpl) => String(tpl ?? '')
    .replaceAll('{region}', regionTerm)
    .replaceAll('{commodity}', commodity)
    .replaceAll('{discharge_port}', discharge ?? regionTerm);

  return {
    commodity,
    commodityTerms,
    load,
    discharge,
    routeRegion,
    regionTerm,
    hormuzExposed,
    counterparties: [bl.shipper, bl.consignee, bl.notify_party].filter(Boolean),
    officials: (WATCHLIST.official_handles ?? []).slice(0, 2),
    queries: {
      war_route: fill(t.war_route) || `${regionTerm} shipping war risk`,
      commodity_vol: fill(t.commodity_vol) || `${commodity} price volatility`,
      sanction: fill(t.sanction) || `${commodity} sanctions ${regionTerm}`,
      port: fill(t.port) || `${discharge ?? regionTerm} port congestion`,
      prediction: hormuzExposed ? 'Strait of Hormuz closure conflict' : `${commodity} ${regionTerm} disruption`
    }
  };
}

function regionFor(rule, profile) {
  switch (rule.region) {
    case 'route': return profile.routeRegion;
    case 'discharge': return profile.discharge ?? profile.routeRegion;
    case 'buyer': return profile.counterparties[1] ?? profile.counterparties[0] ?? 'buyer';
    default: return 'Global';
  }
}

function mentionsCommodity(text, profile) {
  const hay = lc(text);
  return profile.commodityTerms.some((term) => hay.includes(lc(term))) || /\b(commodit|metal|energy)\b/i.test(text);
}

function classifyMarket(text) {
  if (/\b(closure|closed|war|conflict|strait|hormuz|blockade|missile|naval)\b/i.test(text)) return 'war_risk';
  if (/\b(sanction|embargo|export ban|ofac)\b/i.test(text)) return 'sanction_risk';
  if (/\b(price|copper|oil|brent|metal|commodity|\$\d)\b/i.test(text)) return 'commodity_volatility';
  return 'war_risk';
}

function severityFromProb(prob) {
  if (prob >= 0.4) return 'critical';
  if (prob >= 0.2) return 'warning';
  return 'info';
}

function clip(text, n = 160) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * Deterministically convert collected signals into structured macro_risk_events.
 * Pure function — same signals always produce the same events.
 * @param {object} signals { tweets, officials, news, prediction_markets }
 * @param {object} profile  from buildQueryProfile
 * @returns {Array} macro_risk_events ({ date, type, region, severity, description, source, evidence, signal_count })
 */
export function scoreWorldSignals(signals = {}, profile = {}) {
  const buckets = new Map(); // type -> { severity, evidence:Set, count }
  const add = (type, severity, evidence) => {
    const b = buckets.get(type) ?? { severity: 'info', evidence: [], count: 0 };
    b.severity = maxSeverity(b.severity, severity);
    b.count += 1;
    if (evidence && b.evidence.length < 3 && !b.evidence.includes(evidence)) b.evidence.push(evidence);
    buckets.set(type, b);
  };

  const textSignals = [
    ...(signals.tweets ?? []).map((t) => ({ text: t.text, src: t.author ? `@${t.author}` : 'tweet' })),
    ...(signals.officials ?? []).map((t) => ({ text: t.text, src: t.author ? `@${t.author}` : 'official' })),
    ...(signals.news ?? []).map((n) => ({ text: `${n.title}. ${n.snippet}`, src: n.source ?? 'news' }))
  ];

  for (const sig of textSignals) {
    if (!sig.text) continue;
    const sev = intensity(sig.text);
    for (const rule of TYPE_RULES) {
      if (!rule.re.test(sig.text)) continue;
      if (rule.commodityGated && !mentionsCommodity(sig.text, profile)) continue;
      add(rule.type, sev, `${sig.src}: ${clip(sig.text)}`);
    }
  }

  // Prediction-market odds: map to a type and let the implied probability set severity.
  for (const m of signals.prediction_markets ?? []) {
    if (typeof m.implied_prob !== 'number') continue;
    const type = classifyMarket(`${m.market} ${m.question ?? ''}`);
    const sev = severityFromProb(m.implied_prob);
    add(type, sev, `${m.platform ?? 'prediction market'}: ${Math.round(m.implied_prob * 100)}% — ${clip(m.market, 90)}`);
  }

  const date = profile.asOf ?? '2026-06-08';
  const events = [];
  for (const [type, b] of buckets) {
    const rule = TYPE_RULES.find((r) => r.type === type) ?? { region: 'global' };
    const region = regionFor(rule, profile);
    events.push({
      date,
      type,
      region,
      severity: b.severity,
      description: `Live world-risk signal: ${type.replace(/_/g, ' ')} (${b.severity}) for ${profile.commodity} on ${region}, from ${b.count} source(s) via xAPI.`,
      source: 'xAPI/world-intel',
      evidence: b.evidence,
      signal_count: b.count
    });
  }
  // Stable order: severity desc, then type.
  events.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.type.localeCompare(b.type));
  return events;
}

function hashEvidence(payload) {
  return '0x' + crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function buildSummary(events, profile, live) {
  if (events.length === 0) {
    return `No elevated real-world risk signals detected for ${profile.commodity} on ${profile.routeRegion}.`;
  }
  const top = events.slice(0, 3).map((e) => `${e.type.replace(/_/g, ' ')} (${e.severity})`).join(', ');
  const mode = live ? 'Live xAPI signals' : 'Offline fixture signals';
  return `${mode} for ${profile.commodity} on ${profile.routeRegion}: ${top}. `
    + `${events.length} world-risk event(s) folded into the cargo's risk score.`;
}

/**
 * Assess real-world risk for a cargo via xAPI and return structured events.
 * @param {object} caseData a TradeShield case
 * @param {object} [opts] { env, execute, forceFallback }
 *   - execute: injectable xAPI executor (tests) — see xapiClient.executeAction
 *   - forceFallback: skip live calls, use offline fixtures
 * @returns {Promise<{events, signals, summary, provider, live, evidence_hash, queried}>}
 */
export async function assessWorldRisk(caseData, opts = {}) {
  const { env = process.env, execute, forceFallback = false } = opts;
  const profile = buildQueryProfile(caseData);
  profile.asOf = caseData.market?.as_of ?? '2026-06-08';

  const toolOpts = forceFallback ? { env: {} } : { env, execute };

  // Fan out: route/war tweets, officials, commodity news, prediction-market odds.
  const settled = await Promise.allSettled([
    searchTweets(profile.queries.war_route, toolOpts),
    searchNews(profile.queries.commodity_vol, toolOpts),
    getPredictionMarket(profile.queries.prediction, toolOpts),
    ...profile.officials.map((h) => getOfficialTweets(h.screen_name, toolOpts))
  ]);
  const results = settled.map((s) => (s.status === 'fulfilled' ? s.value : { source: 'error', live: false, items: [] }));

  const [tweetsRes, newsRes, predRes, ...officialRes] = results;
  const signals = {
    tweets: tweetsRes.items ?? [],
    news: newsRes.items ?? [],
    prediction_markets: predRes.items ?? [],
    officials: officialRes.flatMap((r) => r.items ?? [])
  };
  const sources = {
    tweets: tweetsRes.source,
    news: newsRes.source,
    prediction_markets: predRes.source,
    officials: officialRes.map((r) => r.source)
  };

  const live = results.some((r) => r.live === true);
  const events = scoreWorldSignals(signals, profile);
  const summary = buildSummary(events, profile, live);
  const evidence_hash = hashEvidence({
    case_id: caseData.case_id,
    queries: profile.queries,
    events: events.map((e) => ({ type: e.type, severity: e.severity, region: e.region, n: e.signal_count }))
  });

  return {
    events,
    signals,
    sources,
    summary,
    provider: live ? 'xapi-live' : (isXapiConfigured(env) || execute ? 'xapi-empty->fixtures' : 'offline-fixtures'),
    live,
    evidence_hash,
    queried: profile.queries,
    profile: { commodity: profile.commodity, route_region: profile.routeRegion, hormuz_exposed: profile.hormuzExposed }
  };
}
