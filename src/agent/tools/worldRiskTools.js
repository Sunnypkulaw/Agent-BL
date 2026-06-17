// World-risk data tools — real-world signals for a cargo, fetched through xAPI.
//
// Each tool wraps one or two xAPI actions (Twitter/X, Google News, realtime web,
// prediction-market-via-search), NORMALIZES the response into a small flat array,
// and falls back to deterministic offline fixtures (data/world-intel/feed.json)
// when xAPI is unavailable — so the whole world-risk agent runs offline for the
// demo, exactly like src/agent/tools/copperValuationTools.js.
//
// Every tool returns { source, live, items }:
//   - source: a human label of where the data came from (xAPI action id or fixture)
//   - live:   true if it came from a real xAPI call, false if it's an offline fixture
//   - items:  normalized array (tweets / news / prediction markets)

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { executeAction, isXapiConfigured } from '../xapi/xapiClient.js';

const FEED_URL = new URL('../../../data/world-intel/feed.json', import.meta.url);

function loadFixtures() {
  try {
    return JSON.parse(fs.readFileSync(fileURLToPath(FEED_URL), 'utf8'));
  } catch {
    return { tweets: [], official_tweets: {}, news: [], prediction_markets: [] };
  }
}

const FIXTURES = loadFixtures();

/** Can we attempt a live call? (a key is set, or a fake executor is injected) */
function canCallLive(env, execute) {
  return Boolean(execute) || isXapiConfigured(env);
}

function tokens(query) {
  return String(query ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length > 3);
}

/** Loose keyword match against an item's tags + text; returns all if nothing matches. */
function filterByQuery(items, query, textOf) {
  const qs = tokens(query);
  if (qs.length === 0) return items;
  const hits = items.filter((it) => {
    const hay = `${(it.tags ?? []).join(' ')} ${textOf(it)}`.toLowerCase();
    return qs.some((t) => hay.includes(t));
  });
  return hits.length ? hits : items;
}

function firstArray(...candidates) {
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

// ── normalizers (tolerant of upstream shape variations) ──────────────────────

function normalizeTweet(t = {}) {
  const screen = t.author?.screen_name ?? t.screen_name ?? t.user?.screen_name ?? null;
  const id = t.id ?? t.id_str ?? t.rest_id ?? null;
  return {
    id,
    text: t.full_text ?? t.text ?? '',
    author: screen,
    author_name: t.author?.name ?? t.user?.name ?? null,
    created_at: t.created_at ?? null,
    favorite_count: t.favorite_count ?? t.favoriteCount ?? 0,
    retweet_count: t.retweet_count ?? t.retweetCount ?? 0,
    views_count: t.views_count ?? t.viewCount ?? 0,
    url: t.url ?? (screen && id ? `https://x.com/${screen}/status/${id}` : null),
    tags: t.tags ?? []
  };
}

function normalizeNews(n = {}) {
  return {
    title: n.title ?? '',
    source: n.source ?? null,
    date: n.date ?? null,
    link: n.link ?? n.url ?? null,
    snippet: n.snippet ?? n.description ?? '',
    tags: n.tags ?? []
  };
}

function normalizeOrganic(o = {}) {
  return {
    title: o.title ?? '',
    link: o.link ?? o.url ?? null,
    snippet: o.snippet ?? o.description ?? '',
    date: o.date ?? null,
    tags: o.tags ?? []
  };
}

// ── tools ────────────────────────────────────────────────────────────────────

/** Search recent tweets/X posts (twitter.search_timeline). */
export async function searchTweets(query, { env = process.env, count = 12, execute } = {}) {
  if (canCallLive(env, execute)) {
    try {
      const data = await executeAction('twitter.search_timeline', { raw_query: query, count }, { env, execute });
      const raw = firstArray(data?.tweets, data?.timeline, data?.results, data?.data, data);
      const items = raw.map(normalizeTweet).filter((t) => t.text);
      if (items.length) return { source: 'xAPI:twitter.search_timeline', live: true, items };
    } catch (error) {
      return fixtureTweets(query, `offline-fixture (xAPI error: ${error.message})`);
    }
  }
  return fixtureTweets(query);
}

function fixtureTweets(query, sourceNote) {
  const items = filterByQuery((FIXTURES.tweets ?? []).map(normalizeTweet), query, (t) => t.text);
  return { source: sourceNote ?? 'offline-fixture:tweets', live: false, items };
}

/** Get a specific official/institution account's recent tweets (resolve handle -> id -> tweets). */
export async function getOfficialTweets(screenName, { env = process.env, count = 5, execute } = {}) {
  if (canCallLive(env, execute)) {
    try {
      const user = await executeAction('twitter.user_by_screen_name', { screen_name: screenName }, { env, execute });
      const userId = user?.rest_id ?? user?.id ?? user?.user_id ?? user?.data?.rest_id;
      if (userId) {
        const data = await executeAction('twitter.user_tweets', { user_id: String(userId), count }, { env, execute });
        const raw = firstArray(data?.tweets, data?.timeline, data?.results, data?.data, data);
        const items = raw.map(normalizeTweet).filter((t) => t.text);
        if (items.length) return { source: `xAPI:twitter.user_tweets(@${screenName})`, live: true, items };
      }
    } catch (error) {
      return fixtureOfficial(screenName, `offline-fixture (xAPI error: ${error.message})`);
    }
  }
  return fixtureOfficial(screenName);
}

function fixtureOfficial(screenName, sourceNote) {
  const raw = (FIXTURES.official_tweets ?? {})[screenName] ?? [];
  return { source: sourceNote ?? `offline-fixture:official(@${screenName})`, live: false, items: raw.map(normalizeTweet) };
}

/** Search Google News (web.search.news). tbs e.g. "qdr:d" (past 24h). */
export async function searchNews(query, { env = process.env, tbs = 'qdr:d', execute } = {}) {
  if (canCallLive(env, execute)) {
    try {
      const data = await executeAction('web.search.news', { q: query, tbs }, { env, execute });
      const items = firstArray(data?.news, data?.results, data).map(normalizeNews).filter((n) => n.title);
      if (items.length) return { source: 'xAPI:web.search.news', live: true, items };
    } catch (error) {
      return fixtureNews(query, `offline-fixture (xAPI error: ${error.message})`);
    }
  }
  return fixtureNews(query);
}

function fixtureNews(query, sourceNote) {
  const items = filterByQuery((FIXTURES.news ?? []).map(normalizeNews), query, (n) => `${n.title} ${n.snippet}`);
  return { source: sourceNote ?? 'offline-fixture:news', live: false, items };
}

/** Realtime web search (web.search.realtime). timeRange e.g. "day". */
export async function searchRealtime(query, { env = process.env, timeRange = 'day', num = 10, execute } = {}) {
  if (canCallLive(env, execute)) {
    try {
      const data = await executeAction('web.search.realtime', { q: query, timeRange, num }, { env, execute });
      const items = firstArray(data?.organic, data?.results, data).map(normalizeOrganic).filter((o) => o.title);
      if (items.length) return { source: 'xAPI:web.search.realtime', live: true, items };
    } catch (error) {
      return { source: `offline-fixture (xAPI error: ${error.message})`, live: false, items: [] };
    }
  }
  return { source: 'offline-fixture:realtime', live: false, items: [] };
}

const PCT_RE = /(\d{1,3}(?:\.\d+)?)\s*%/;

/** Parse an implied probability (0-1) out of a text snippet, or null. */
function parseImpliedProb(text = '') {
  const m = PCT_RE.exec(text);
  if (m) {
    const pct = Number(m[1]);
    if (Number.isFinite(pct) && pct >= 0 && pct <= 100) return Math.round(pct) / 100;
  }
  return null;
}

/**
 * Prediction-market odds for a geopolitical question. xAPI has no dedicated
 * Polymarket action, so live mode searches the web for the market via xAPI
 * (web.search.realtime) and parses the implied probability; offline uses the
 * curated Polymarket snapshot fixtures.
 */
export async function getPredictionMarket(query, { env = process.env, execute } = {}) {
  if (canCallLive(env, execute)) {
    try {
      const data = await executeAction('web.search.realtime', { q: `Polymarket ${query} odds probability`, timeRange: 'week', num: 8 }, { env, execute });
      const organic = firstArray(data?.organic, data?.results, data).map(normalizeOrganic);
      const items = organic
        .map((o) => {
          const prob = parseImpliedProb(`${o.title} ${o.snippet}`);
          return prob == null ? null : { market: o.title, platform: 'web/prediction-market', implied_prob: prob, snippet: o.snippet, link: o.link };
        })
        .filter(Boolean);
      if (items.length) return { source: 'xAPI:web.search.realtime(prediction-market)', live: true, items };
    } catch (error) {
      return fixturePredictions(query, `offline-fixture (xAPI error: ${error.message})`);
    }
  }
  return fixturePredictions(query);
}

function fixturePredictions(query, sourceNote) {
  const items = filterByQuery(
    (FIXTURES.prediction_markets ?? []).map((m) => ({
      market: m.market,
      platform: m.platform,
      question: m.question,
      implied_prob: m.implied_prob,
      volume_usd: m.volume_usd,
      link: m.link,
      tags: m.tags
    })),
    query,
    (m) => `${m.market} ${m.question}`
  );
  return { source: sourceNote ?? 'offline-fixture:prediction-markets', live: false, items };
}
