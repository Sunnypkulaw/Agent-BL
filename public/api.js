// Thin API client for the TradeShield harness backend. Every pricing call goes
// through the SAME endpoints the contract mock and CLI demo use, so the frontend
// shows real engine output — never hard-coded numbers.

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body?.error || body?.message || `${url} → ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = body?.details;
    throw err;
  }
  return body;
}

function postJson(url, payload) {
  return fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {})
  });
}

/** FE-7: curated case catalog. Falls back to the single demo case if /api/cases is absent. */
export async function getCases() {
  try {
    const data = await fetchJson('/api/cases');
    if (Array.isArray(data?.cases) && data.cases.length) return data.cases;
  } catch { /* fall through */ }
  const demo = await fetchJson('/api/demo-data');
  const bl = demo.bill_of_lading ?? {};
  return [{
    case_id: demo.case_id,
    label: `${bl.cargo ?? 'Trade case'} · ${bl.port_of_loading ?? '?'} → ${bl.port_of_discharge ?? '?'}`,
    route: `${bl.port_of_loading ?? '?'} → ${bl.port_of_discharge ?? '?'}`,
    cargo: bl.cargo ?? null,
    risk_hint: null,
    case: demo
  }];
}

/** BE-3: all three payout-speed quotes + a recommendation for a case. */
export function compareSpeeds(caseData) {
  return postJson('/api/pricing/quote', { case: caseData, compare: true });
}

/** BE-4: full RWA offering lifecycle. Pass speed, subscription, and in-transit events. */
export function simulateOffering(caseData, { payout_speed, subscription_usd, events } = {}) {
  return postJson('/api/offering/simulate', {
    case: caseData,
    payout_speed,
    subscription_usd,
    events: events && events.length ? events : undefined
  });
}

/** BE-8: on-chain RiskPricingOracle.updatePricing payload (issue price + hashes). */
export function oracleUpdate(caseData, { payout_speed, pool_id } = {}) {
  return postJson('/api/oracle/pricing-update', { case: caseData, payout_speed, pool_id });
}

/** MCP-5: mock/real push of the quote to the oracle — returns a tx + PricingUpdated event. */
export function pushPricingToOracle(caseId, quote) {
  return postJson('/api/mcp/call', {
    tool: 'push_pricing_to_oracle',
    params: { case_id: caseId, pricing_quote: quote }
  });
}

/** RAG: knowledge-base search over the macro risk-intel feed. */
export function ragSearch(query, categories) {
  return postJson('/api/rag/search', { query, categories });
}

/** RAG-2: pre-baked judge Q&A pairs. */
export async function getJudgeQA() {
  const data = await fetchJson('/api/rag/judge-qa');
  return data.pairs ?? [];
}

/** RAG: full sourced risk sweep for a case (route/weather/war/port/price/fx/buyer). */
export function riskSweep(caseData) {
  return postJson('/api/rag/risk-sweep', caseData);
}

/** INTEL: live real-world risk via xAPI (tweets / officials / news / prediction markets)
 *  → structured events + signals + before/after re-priced quote. Offline-safe (fixtures w/o key). */
export function worldRisk(caseData) {
  return postJson('/api/intel/world-risk', { case: caseData });
}
