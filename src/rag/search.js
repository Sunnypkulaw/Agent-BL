// TradeShield RAG Search Engine
// Dual-mode: static knowledge base (28 deep entries) + real-time risk-intel feed
// Supports keyword-weighted scoring over both sources

import { KNOWLEDGE_BASE } from './knowledgeBase.js';

// ---- Risk-intel feed loader (lazy) ----
let _feedCache = null;

function loadFeed() {
  if (_feedCache) return _feedCache;
  try {
    // In Node.js, we read the file synchronously on first use.
    // In the browser (via API), the feed is searched server-side.
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await_fs_read();
      if (!fs) return [];
      const path = await_fs_path();
      if (!path) return [];
      const feedPath = path.join(path.dirname(import.meta.url), '../../data/risk-intel/feed.json');
      // Fall back to a try/catch with dynamic import
    }
  } catch {
    // In non-Node environments, skip feed search
  }
  return _feedCache || [];
}

// We use a different approach: the search functions accept an optional feed array
// that the server can pass in when calling from Node.js

let _feedDocuments = null;

async function ensureFeed() {
  if (_feedDocuments) return;
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const feedPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../data/risk-intel/feed.json'
    );
    const raw = await fs.readFile(feedPath, 'utf8');
    const data = JSON.parse(raw);
    _feedDocuments = data.documents || [];
  } catch {
    _feedDocuments = [];
  }
}

/**
 * Search the risk-intel real-time feed.
 *
 * @param {string} query - Search query
 * @param {Object} [options]
 * @returns {Promise<Array<Object>>}
 */
export async function searchFeed(query, { categories, limit = 5 } = {}) {
  await ensureFeed();
  return syncSearchFeed(query, { categories, limit });
}

function syncSearchFeed(query, { categories, limit = 5 } = {}) {
  const docs = _feedDocuments || [];
  if (docs.length === 0) return [];

  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return [];

  const severityOrder = { critical: 3, warning: 2, info: 1 };

  const scored = docs
    .filter(doc => !categories || categories.length === 0 || categories.includes(doc.type))
    .map(doc => {
      let score = 0;
      const text = (doc.text || '').toLowerCase();
      const tags = (doc.tags || []).map(t => t.toLowerCase());
      const type = doc.type.replace(/_/g, ' ').toLowerCase();
      const region = (doc.region || '').toLowerCase();
      const commodity = (doc.commodity || '').toLowerCase();

      for (const token of tokens) {
        if (tags.some(k => k === token)) score += 12;
        else if (tags.some(k => k.includes(token))) score += 8;
        else if (type.includes(token) || token.includes(type)) score += 6;
        else if (region.includes(token)) score += 5;
        else if (commodity.includes(token)) score += 4;
        else if (text.includes(token)) score += 3;
      }

      return {
        id: doc.id,
        category: doc.type,
        title: doc.text.slice(0, 80) + (doc.text.length > 80 ? '...' : ''),
        summary: doc.text,
        detail: doc.text,
        severity: doc.severity,
        region: doc.region,
        date: doc.period,
        source: doc.source,
        keywords: doc.tags || [],
        _score: score,
        _source: 'feed',
        _matchedTokens: tokens.filter(t => text.includes(t) || tags.some(k => k.includes(t)))
      };
    })
    .filter(s => s._score >= 1);

  scored.sort((a, b) => {
    const scoreDiff = b._score - a._score;
    if (scoreDiff !== 0) return scoreDiff;
    return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
  });

  return scored.slice(0, limit);
}

/**
 * Search the risk intelligence knowledge base.
 *
 * @param {string} query - Natural language search query
 * @param {Object} [options]
 * @param {string[]} [options.categories] - Filter by risk categories
 * @param {number} [options.limit=5] - Maximum number of results
 * @param {number} [options.minScore=1] - Minimum relevance score to include
 * @param {boolean} [options.includeFeed=true] - Include real-time feed results
 * @returns {Array<Object>} Matched entries with scores and match details
 */
export function searchKnowledgeBase(query, { categories, limit = 5, minScore = 1, includeFeed = true } = {}) {
  // Normalize query: lowercase, remove punctuation, split into tokens
  const rawTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (rawTokens.length === 0) return [];

  // Deduplicate tokens
  const tokens = [...new Set(rawTokens)];

  // Pre-filter by category if specified
  let entries = KNOWLEDGE_BASE;
  if (categories && categories.length > 0) {
    entries = entries.filter(e => categories.includes(e.category));
  }

  // Score each entry
  const severityOrder = { critical: 3, warning: 2, info: 1 };

  const scored = entries.map(entry => {
    const lowerTitle = entry.title.toLowerCase();
    const lowerSummary = entry.summary.toLowerCase();
    const lowerDetail = entry.detail.toLowerCase();
    const lowerKeywords = entry.keywords.map(k => k.toLowerCase());
    const lowerCategory = entry.category.replace(/_/g, ' ').toLowerCase();
    const lowerRegion = entry.region.toLowerCase();
    const lowerSeverity = entry.severity.toLowerCase();

    let score = 0;
    const matchedTokens = [];
    const matchBreakdown = [];

    for (const token of tokens) {
      let tokenScore = 0;

      // Exact keyword match (highest weight, the keywords are curated)
      if (lowerKeywords.some(k => k === token)) {
        tokenScore += 12;
        matchedTokens.push(token);
        matchBreakdown.push({ token, type: 'exact_keyword', score: 12 });
      }
      // Partial keyword match
      else if (lowerKeywords.some(k => k.includes(token) || token.includes(k))) {
        tokenScore += 8;
        matchBreakdown.push({ token, type: 'partial_keyword', score: 8 });
      }
      // Title match (very strong signal)
      else if (lowerTitle.includes(token)) {
        tokenScore += 10;
        matchBreakdown.push({ token, type: 'title', score: 10 });
      }
      // Summary match
      else if (lowerSummary.includes(token)) {
        tokenScore += 5;
        matchBreakdown.push({ token, type: 'summary', score: 5 });
      }
      // Category match (e.g. "war" matches "war_risk")
      else if (lowerCategory.includes(token)) {
        tokenScore += 4;
        matchBreakdown.push({ token, type: 'category', score: 4 });
      }
      // Region match (e.g. "Indian Ocean")
      else if (lowerRegion.includes(token)) {
        tokenScore += 3;
        matchBreakdown.push({ token, type: 'region', score: 3 });
      }
      // Detail match (lowest signal per token, but detailed text may match many tokens)
      else if (lowerDetail.includes(token)) {
        tokenScore += 2;
        matchBreakdown.push({ token, type: 'detail', score: 2 });
      }

      // Severity keyword match
      if (lowerSeverity === token) {
        tokenScore += 3;
        matchBreakdown.push({ token, type: 'severity', score: 3 });
      }

      score += tokenScore;
    }

    // Route relevance boost: bonus for entries relevant to the queried route
    if (entry.relevance && entry.relevance.routes) {
      for (const route of entry.relevance.routes) {
        if (tokens.some(t => route.toLowerCase().includes(t))) {
          score += 4;
          matchBreakdown.push({ type: 'route_boost', score: 4 });
          break;
        }
      }
    }

    // Commodity relevance boost
    if (entry.relevance && entry.relevance.commodities) {
      if (entry.relevance.commodities.includes('copper') || entry.relevance.commodities.includes('all')) {
        if (tokens.some(t => ['copper', 'cathode', 'metal'].includes(t))) {
          score += 3;
          matchBreakdown.push({ type: 'commodity_boost', score: 3 });
        }
      }
    }

    return {
      id: entry.id,
      category: entry.category,
      title: entry.title,
      summary: entry.summary,
      detail: entry.detail,
      severity: entry.severity,
      region: entry.region,
      date: entry.date,
      source: entry.source,
      keywords: entry.keywords,
      relevance: entry.relevance,
      _score: score,
      _matchedTokens: [...new Set(matchedTokens)],
      _matchBreakdown: matchBreakdown
    };
  });

  // Filter by minimum relevance threshold
  const filtered = scored.filter(s => s._score >= minScore);

  // Sort: score descending, then severity descending (critical first) as tiebreaker
  filtered.sort((a, b) => {
    const scoreDiff = b._score - a._score;
    if (scoreDiff !== 0) return scoreDiff;
    return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
  });

  let kbResults = filtered.slice(0, limit);

  // Merge feed results if requested
  if (includeFeed) {
    const feedResults = syncSearchFeed(query, { categories, limit: Math.max(2, Math.floor(limit / 2)) });
    // Interleave: feed results come first (more timely), then KB results
    // But only if feed results have reasonable scores
    const highScoreFeed = feedResults.filter(f => f._score >= 3);
    const merged = [...highScoreFeed, ...kbResults];
    // Re-sort and de-duplicate by id
    const seen = new Set();
    const deduped = [];
    for (const item of merged) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        deduped.push(item);
      }
    }
    deduped.sort((a, b) => {
      const scoreDiff = b._score - a._score;
      if (scoreDiff !== 0) return scoreDiff;
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });
    return deduped.slice(0, limit);
  }

  return kbResults;
}

/**
 * Search limited to a specific route. Convenience wrapper.
 *
 * @param {string} route - Route string, e.g. "Shanghai->Hamburg"
 * @param {Object} [options] - Same options as searchKnowledgeBase
 * @returns {Array<Object>}
 */
export function searchByRoute(route, options = {}) {
  const routeQuery = route.replace(/->/g, ' ').replace(/>/g, ' ');
  return searchKnowledgeBase(routeQuery, options);
}

/**
 * Search for risks affecting a specific commodity.
 *
 * @param {string} commodity - Commodity name, e.g. "copper"
 * @param {Object} [options] - Same options as searchKnowledgeBase
 * @returns {Array<Object>}
 */
export function searchByCommodity(commodity, options = {}) {
  return searchKnowledgeBase(commodity, options);
}

/**
 * Full risk intelligence report for a trade case.
 * Runs multiple queries covering all risk dimensions and aggregates results.
 *
 * @param {Object} tradeCase - TradeCase object with bill_of_lading, market, shipment_events
 * @returns {Object} Aggregated results by category
 */
export function fullRiskSweep(tradeCase) {
  const bl = tradeCase.bill_of_lading || {};
  const market = tradeCase.market || {};

  const route = `${bl.port_of_loading || 'Shanghai'} ${bl.port_of_discharge || 'Hamburg'}`;
  const cargo = bl.cargo || 'copper';
  const commodity = market.commodity || 'Copper';

  const queries = [
    { label: 'route_and_weather', query: `${route} shipping route weather risk`, categories: ['severe_weather'], limit: 3 },
    { label: 'war_and_sanctions', query: `${route} war sanction risk`, categories: ['war_risk', 'sanction_risk'], limit: 4 },
    { label: 'port_congestion', query: `${bl.port_of_loading} ${bl.port_of_discharge} port congestion`, categories: ['port_congestion'], limit: 3 },
    { label: 'commodity_price', query: `${commodity} ${cargo} price volatility`, categories: ['commodity_volatility'], limit: 3 },
    { label: 'fx_risk', query: 'USD CNY EUR exchange rate volatility trade finance', categories: ['fx_volatility'], limit: 2 },
    { label: 'buyer_risk', query: `${bl.port_of_discharge || 'Hamburg'} importer credit risk`, categories: ['buyer_country_risk'], limit: 3 }
  ];

  const results = {};
  for (const { label, query, categories: cats, limit: lim } of queries) {
    results[label] = searchKnowledgeBase(query, { categories: cats, limit: lim });
  }

  return {
    case_id: tradeCase.case_id,
    route: `${bl.port_of_loading || 'Shanghai'} → ${bl.port_of_discharge || 'Hamburg'}`,
    cargo: `${bl.quantity_mt || '?'} MT ${cargo}`,
    search_time: new Date().toISOString(),
    results,
    total_matches: Object.values(results).reduce((sum, arr) => sum + arr.length, 0),
    summary: summarizeSweep(results)
  };
}

function summarizeSweep(results) {
  const criticals = [];
  const warnings = [];

  for (const [category, entries] of Object.entries(results)) {
    for (const entry of entries) {
      if (entry.severity === 'critical') criticals.push(entry.title);
      if (entry.severity === 'warning') warnings.push(entry.title);
    }
  }

  return {
    critical_count: criticals.length,
    warning_count: warnings.length,
    top_critical: criticals.slice(0, 3),
    top_warnings: warnings.slice(0, 3),
    overall_assessment: criticals.length > 0
      ? 'HIGH RISK: Critical risk factors detected. Recommend risk discount on issue price and margin call trigger.'
      : warnings.length > 2
        ? 'ELEVATED RISK: Multiple warning-level factors. Consider pricing discount and enhanced monitoring.'
        : 'MODERATE RISK: Standard risk factors present. Normal pricing and monitoring recommended.'
  };
}
