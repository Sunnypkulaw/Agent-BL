// TradeShield View ② — Voyage tracking + live RWA pricing + in-transit events.
//
// A ship moves along the route on a VIRTUAL clock (departure -> ETA). Below it,
// the live RWA price + financing progress + AI risk events (with sources) update
// in real time, and "emergency event" buttons inject in-transit risk that makes
// the AI reprice (or pause) the offering — the price visibly moves.
//
// Self-contained: reads the shared store and drives the existing pricing
// endpoints. The event buttons are a pure pricing demo (no wallet interaction).
// UI chrome is bilingual via i18n.js.

import { state, selectedQuote, liveQuote } from './store.js';
import { $, el, clear, toast } from './dom.js';
import * as f from './format.js';
import * as api from './api.js';
import { t } from './i18n.js';

const PLAY_MS = 60000; // wall-clock ms to play the full voyage (0 -> 100%)

// In-transit event presets. Labels/descriptions are built via t() at use time so
// they follow the current language. Risk type/severity drive the AI reprice.
const EVENTS = [
  { key: 'typhoon', tone: 'warn', labelKey: 'ev_typhoon_label', build: () => [
    { category: 'macro', type: 'severe_weather', region: 'East China Sea', severity: 'warning',
      description: t('ev_typhoon_desc'), source: 'mock-weather-feed (typhoon advisory)' }
  ] },
  { key: 'hormuz', tone: 'crit', labelKey: 'ev_hormuz_label', build: () => [
    { category: 'macro', type: 'war_risk', region: 'Middle East / Strait of Hormuz', severity: 'critical',
      description: t('ev_hormuz_desc1'), source: 'mock-geopolitical-feed (GDELT-style)' },
    { category: 'macro', type: 'commodity_volatility', region: 'Global', severity: 'critical',
      description: t('ev_hormuz_desc2'), source: 'mock-LME-desk' }
  ] },
  { key: 'deviation', tone: 'warn', labelKey: 'ev_deviation_label', build: () => [
    { category: 'shipment', type: 'route_deviation', severity: 'warning',
      description: t('ev_deviation_desc'), source: 'carrier ops bulletin (demo)' }
  ] },
  { key: 'insurance', tone: 'crit', labelKey: 'ev_insurance_label', build: () => [
    { category: 'shipment', type: 'insurance_invalid', severity: 'critical',
      description: t('ev_insurance_desc'), source: 'mock-marine-underwriting-bulletin' }
  ] }
];

// --- module state -----------------------------------------------------------
const clock = { raf: 0, playing: true, progress: 0, last: 0, caseId: null };
let depDate = null, etaDate = null;
let lastShownPrice = null;
let pausedFill = null; // frozen subscription fill (0..1) while the offering is paused
const appliedKeys = new Set();
const sweepCache = new Map();      // caseId -> sweep results array
const baselineCache = new Map();   // `${caseId}|${speed}` -> offering
const worldRiskCache = new Map();  // caseId -> /api/intel/world-risk assessment
let worldRiskApplied = false;      // whether live world-risk events are folded into pricing
let worldRiskEvents = [];          // those events, tagged category:'macro' for the offering sim
let lastAssessment = null;         // last world-risk assessment (re-rendered on lang toggle / apply)
let wired = false;

// ===========================================================================
// Public API (called by app.js)
// ===========================================================================
export function initVoyage() {
  if (wired) return;
  wired = true;
  $('#voyage-play').addEventListener('click', togglePlay);
  $('#voyage-scrub').addEventListener('input', (e) => {
    clock.progress = Number(e.target.value) / 1000;
    updateShip();
    updateFinancing();
  });
  $('#event-reset').addEventListener('click', resetVoyage);
  $('#rag-search-btn').addEventListener('click', runRagSearch);
  $('#rag-query').addEventListener('keydown', (e) => { if (e.key === 'Enter') runRagSearch(); });
  $('#wr-fetch').addEventListener('click', () => fetchWorldRisk(true));
  $('#wr-apply').addEventListener('click', applyWorldRisk);
}

export function renderVoyage() {
  const quote = liveQuote();
  if (!quote || !state.caseData) return;
  const bl = state.caseData.bill_of_lading ?? {};

  if (clock.caseId !== state.caseId) {
    clock.caseId = state.caseId;
    appliedKeys.clear();
    lastShownPrice = null;
    pausedFill = null;
    depDate = f.parseDate(bl.shipped_on_board || bl.issue_date);
    etaDate = f.parseDate(bl.eta);
    clock.progress = initialProgress();
    worldRiskApplied = false;
    worldRiskEvents = [];
  }

  // Refresh injected-event display objects to the current language (no re-quote;
  // pricing depends on event type/severity, not the localized description).
  if (appliedKeys.size || worldRiskApplied) rebuildEventObjects();

  renderRoute(bl);
  updateShip();
  renderLive(quote);
  renderEventButtons();
  renderCallout();
  $('#event-reset').hidden = !state.voyageInjected;

  refreshLifecycle();
  refreshRiskFeed();
  refreshWorldRisk();
}

export function startVoyageClock() {
  cancelAnimationFrame(clock.raf);
  clock.last = performance.now();
  const tick = (ts) => {
    const dt = ts - clock.last;
    clock.last = ts;
    if (clock.playing && clock.progress < 1) {
      clock.progress = Math.min(1, clock.progress + dt / PLAY_MS);
      updateShip();
      updateFinancing();
    }
    clock.raf = requestAnimationFrame(tick);
  };
  clock.raf = requestAnimationFrame(tick);
}

export function stopVoyageClock() {
  cancelAnimationFrame(clock.raf);
  clock.raf = 0;
}

// ===========================================================================
// Voyage tracker
// ===========================================================================
function initialProgress() {
  if (!depDate || !etaDate) return 0.15;
  const dates = [...(state.caseData.shipment_events ?? []), ...(state.caseData.macro_risk_events ?? [])]
    .map((e) => +f.parseDate(e.date)).filter(Number.isFinite);
  const now = dates.length ? Math.max(...dates) : (+depDate + (+etaDate - +depDate) * 0.15);
  return Math.max(0.06, Math.min(0.9, f.voyageProgress(depDate, etaDate, now)));
}

function renderRoute(bl) {
  $('#dep-port').textContent = bl.port_of_loading || '—';
  $('#dep-date').textContent = f.fmtDate(depDate);
  $('#arr-port').textContent = bl.port_of_discharge || '—';
  $('#arr-date').textContent = f.fmtDate(etaDate);
  const voyageNo = bl.voyage_no ? t('voyage_voyage_no', { no: bl.voyage_no }) : '';
  const carrier = bl.carrier ? ` · ${bl.carrier}` : '';
  $('#voyage-sub').innerHTML = t('voyage_sub_vessel', { vessel: bl.vessel || '—', voyage: voyageNo, carrier });
}

function waypoint(p, load, disch) {
  if (p <= 0.02) return t('wp_at_load', { load });
  if (p < 0.15) return t('wp_leaving', { load });
  if (p < 0.45) return t('wp_scs');
  if (p < 0.72) return t('wp_open');
  if (p < 0.97) return t('wp_approaching', { disch });
  return t('wp_arrived', { disch });
}

function updateShip() {
  const p = clock.progress;
  const bl = state.caseData?.bill_of_lading ?? {};
  const ship = $('#ship');
  if (ship) ship.style.left = (2 + p * 96) + '%';
  const fill = $('#rail-progress');
  if (fill) fill.style.width = (p * 100) + '%';

  const when = f.fmtDateTime(f.dateAtProgress(depDate, etaDate, p));
  const where = waypoint(p, bl.port_of_loading || '—', bl.port_of_discharge || '—');
  const tip = $('#ship-tooltip');
  if (tip) tip.textContent = `${when} · ${where}`;
  const scrub = $('#voyage-scrub');
  if (scrub && document.activeElement !== scrub) scrub.value = String(Math.round(p * 1000));
  const note = $('#voyage-eta-note');
  if (note) note.textContent = p >= 1 ? t('eta_arrived') : t('eta_current', { when, pct: Math.round(p * 100) });
}

function togglePlay() {
  clock.playing = !clock.playing;
  clock.last = performance.now();
  $('#voyage-play').textContent = clock.playing ? t('pause_label') : t('play_label');
}

// ===========================================================================
// Live pricing + financing progress
// ===========================================================================
function renderLive(quote) {
  const priceEl = $('#live-price');
  const p = quote.final_issue_price_usd;
  if (lastShownPrice != null && Math.abs(p - lastShownPrice) > 1e-6) {
    const dir = p < lastShownPrice ? 'flash-down' : 'flash-up';
    priceEl.classList.remove('flash-down', 'flash-up');
    void priceEl.offsetWidth;
    priceEl.classList.add(dir);
    setTimeout(() => priceEl.classList.remove(dir), 1200);
  }
  priceEl.textContent = `$${f.price(p)}`;
  lastShownPrice = p;

  const act = f.actionMeta(quote.pricing_action);
  const actEl = $('#live-action');
  actEl.textContent = `${act.icon} ${act.label}`;
  actEl.className = `badge tone-${act.tone}`;
  $('#live-yield').innerHTML = `<strong>${f.bpsToPct(quote.implied_gross_yield_bps)}</strong> ${t('live_upside')}`;

  const riskEl = $('#live-risk');
  riskEl.textContent = quote.risk_level;
  riskEl.className = `badge tone-${f.riskTone(quote.risk_level)}`;
  $('#live-riskbps').textContent = `${f.int(quote.risk_score_bps)} bps`;

  updateFinancing();
}

function updateFinancing() {
  const quote = liveQuote();
  if (!quote) return;
  const paused = ['PAUSE_OFFERING', 'FREEZE_POOL', 'TRIGGER_LIQUIDATION'].includes(quote.pricing_action);
  const target = quote.expected_cash_to_exporter_usd || quote.requested_cash_usd || 0;
  let fill;
  if (paused) {
    // The AI paused the offering — FREEZE subscription where it stood (the ship
    // keeps sailing, but no new capital is taken in).
    if (pausedFill == null) pausedFill = Math.min(1, 0.12 + clock.progress * 0.9);
    fill = pausedFill;
  } else {
    pausedFill = null;
    fill = Math.min(1, 0.12 + clock.progress * 0.9);
  }
  const raised = Math.round(target * fill);
  const bar = $('#fin-bar');
  if (bar) {
    bar.style.width = (fill * 100) + '%';
    bar.className = `fin-bar${paused ? ' paused' : ''}`;
  }
  const label = $('#fin-label');
  if (label) label.textContent = `${f.usdCompact(raised)} / ${f.usdCompact(target)} · ${Math.round(fill * 100)}%${paused ? t('fin_paused') : ''}`;
}

// ===========================================================================
// In-transit emergency events
// ===========================================================================
function rebuildEventObjects() {
  state.voyageEvents = [];
  for (const k of appliedKeys) {
    const def = EVENTS.find((e) => e.key === k);
    if (def) state.voyageEvents.push(...def.build());
  }
  if (worldRiskApplied && worldRiskEvents.length) state.voyageEvents.push(...worldRiskEvents);
  state.voyageInjected = state.voyageEvents.length > 0;
}

function renderEventButtons() {
  const box = $('#event-btns');
  clear(box);
  for (const ev of EVENTS) {
    const on = appliedKeys.has(ev.key);
    box.append(el('button', {
      class: `event-btn tone-${ev.tone}${on ? ' active' : ''}`,
      onclick: () => toggleEvent(ev.key)
    }, t(ev.labelKey), on ? el('span', { class: 'event-on', text: '✓' }) : null));
  }
}

async function toggleEvent(key) {
  if (appliedKeys.has(key)) appliedKeys.delete(key); else appliedKeys.add(key);
  rebuildEventObjects();

  try {
    if (state.voyageInjected) {
      state.voyageOffering = await api.simulateOffering(state.caseData, {
        payout_speed: state.speed,
        events: state.voyageEvents
      });
    } else {
      state.voyageOffering = null;
    }
  } catch (e) {
    toast(t('t_reprice_fail', { msg: e.message }), true);
    return;
  }

  renderEventButtons();
  renderLive(liveQuote());
  renderCallout();
  refreshLifecycle();
  refreshRiskFeed();
  $('#event-reset').hidden = !state.voyageInjected;
}

function resetVoyage() {
  appliedKeys.clear();
  worldRiskApplied = false;
  worldRiskEvents = [];
  state.voyageEvents = [];
  state.voyageInjected = false;
  state.voyageOffering = null;
  renderEventButtons();
  renderLive(liveQuote());
  renderCallout();
  refreshLifecycle();
  refreshRiskFeed();
  if (lastAssessment) renderWorldRisk(lastAssessment);
  $('#event-reset').hidden = true;
}

function renderCallout() {
  const box = $('#voyage-callout');
  const off = state.voyageOffering;
  if (!state.voyageInjected || !off?.initial_quote || !off?.final_quote) { box.hidden = true; return; }
  const initial = off.initial_quote, finalQ = off.final_quote;
  const paused = off.final_state === 'Paused' || off.final_state === 'Frozen' || off.final_state === 'Liquidation';
  const dropped = finalQ.final_issue_price_usd < initial.final_issue_price_usd;
  box.hidden = false;
  box.className = `lc-callout tone-${paused ? 'crit' : dropped ? 'warn' : 'info'}`;
  box.textContent = paused
    ? t('co_paused', { level: finalQ.risk_level, hash: f.shortHash(finalQ.evidence_hash) })
    : dropped
      ? t('co_repriced', {
          level: finalQ.risk_level,
          a: f.price(initial.final_issue_price_usd),
          b: f.price(finalQ.final_issue_price_usd),
          y: f.bpsToPct(finalQ.implied_gross_yield_bps)
        })
      : t('co_held', { level: finalQ.risk_level, p: f.price(finalQ.final_issue_price_usd) });
}

// ===========================================================================
// Lifecycle stepper + timeline
// ===========================================================================
async function getOffering() {
  if (state.voyageInjected && state.voyageOffering) return state.voyageOffering;
  const key = `${state.caseId}|${state.speed}`;
  if (baselineCache.has(key)) return baselineCache.get(key);
  const off = await api.simulateOffering(state.caseData, { payout_speed: state.speed });
  baselineCache.set(key, off);
  return off;
}

async function refreshLifecycle() {
  const tl = $('#timeline');
  const lifecycleBox = $('#lifecycle');
  let offering;
  try { offering = await getOffering(); }
  catch (e) { tl.innerHTML = `<li class="error">${t('lc_fail', { msg: e.message })}</li>`; return; }

  const reached = new Set(offering.steps.map((s) => s.state));
  const endState = offering.final_state;

  clear(lifecycleBox);
  const seq = f.LIFECYCLE.filter((s) => {
    if (s === 'Repriced') return reached.has('Repriced');
    if (s === 'Paused') return reached.has('Paused') || endState === 'Paused';
    return true;
  });
  seq.forEach((s, i) => {
    const on = reached.has(s) || s === endState;
    const isEnd = s === endState;
    if (i > 0) lifecycleBox.append(el('span', { class: `lc-link${on ? ' on' : ''}` }));
    lifecycleBox.append(el('div', {
      class: `lc-node tone-${on ? f.stateTone(s) : 'muted'}${on ? ' on' : ''}${isEnd ? ' end' : ''}`
    },
      el('span', { class: 'lc-dot' }),
      el('span', { class: 'lc-name', text: s })
    ));
  });

  clear(tl);
  for (const step of offering.steps) {
    tl.append(el('li', { class: `tl-item tone-${f.stateTone(step.state)}` },
      el('div', { class: 'tl-marker' }),
      el('div', { class: 'tl-body' },
        el('div', { class: 'tl-head' },
          el('span', { class: `badge sm tone-${f.stateTone(step.state)}`, text: step.state }),
          el('span', { class: 'tl-actor', text: step.actor })
        ),
        el('div', { class: 'tl-event', text: step.event })
      )
    ));
  }
}

// ===========================================================================
// AI risk feed (with sources)
// ===========================================================================
async function refreshRiskFeed() {
  const box = $('#risk-feed');
  const items = [];

  for (const e of state.voyageEvents) {
    items.push({
      injected: true, severity: e.severity, category: e.type, region: e.region,
      title: e.description, source: e.source || 'in-transit simulation', date: t('feed_injected_date')
    });
  }
  for (const e of state.caseData.macro_risk_events ?? []) {
    items.push({
      severity: e.severity, category: e.type, region: e.region,
      title: e.description, date: e.date,
      source: state.caseData.market?.source || 'case macro feed'
    });
  }

  let sweep = sweepCache.get(state.caseId);
  if (!sweep) {
    try {
      const res = await api.riskSweep(state.caseData);
      sweep = Object.values(res.results ?? {}).flat();
      sweepCache.set(state.caseId, sweep);
    } catch { sweep = []; }
  }
  const seen = new Set();
  for (const m of sweep) {
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    items.push({ severity: m.severity, category: m.category, region: m.region, title: m.title || m.summary, source: m.source, date: m.date });
  }

  clear(box);
  if (!items.length) { box.innerHTML = `<p class="muted">${t('feed_none')}</p>`; return; }
  const order = { critical: 0, warning: 1, info: 2 };
  items.sort((a, b) => (a.injected ? -1 : 0) - (b.injected ? -1 : 0) || (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

  for (const it of items.slice(0, 12)) {
    box.append(el('div', { class: `feed-item tone-${sevTone(it.severity)}${it.injected ? ' injected' : ''}` },
      el('div', { class: 'feed-head' },
        el('span', { class: `badge sm tone-${sevTone(it.severity)}`, text: (it.severity || 'info').toUpperCase() }),
        el('span', { class: 'feed-cat', text: (it.category || '').replace(/_/g, ' ') }),
        it.region ? el('span', { class: 'feed-region', text: it.region }) : null,
        it.injected ? el('span', { class: 'feed-new', text: t('feed_new') }) : null
      ),
      el('p', { class: 'feed-text', text: it.title || '' }),
      el('div', { class: 'feed-foot' },
        el('span', { class: 'feed-source', text: t('feed_source') + (it.source || '—') }),
        it.date ? el('span', { class: 'feed-date', text: it.date }) : null
      )
    ));
  }
}

function sevTone(sev) {
  return { critical: 'crit', warning: 'warn', info: 'info' }[String(sev).toLowerCase()] ?? 'info';
}

// ===========================================================================
// RAG search
// ===========================================================================
async function runRagSearch() {
  const query = $('#rag-query').value.trim();
  if (!query) return;
  const box = $('#rag-results');
  box.innerHTML = `<p class="muted">${t('rag_searching')}</p>`;
  try {
    const data = await api.ragSearch(query);
    clear(box);
    if (!data.matches?.length) { box.innerHTML = `<p class="muted">${t('rag_none', { q: query })}</p>`; return; }
    box.append(el('p', { class: 'results-count', text: t('rag_hits', { n: data.match_count }) }));
    for (const m of data.matches) {
      box.append(el('div', { class: `rag-entry tone-${sevTone(m.severity)}` },
        el('div', { class: 'rag-entry-head' },
          el('span', { class: `badge sm tone-${sevTone(m.severity)}`, text: (m.severity || 'info').toUpperCase() }),
          el('span', { class: 'rag-cat', text: m.category || '' }),
          m._score ? el('span', { class: 'rag-score', text: `score ${m._score}` }) : null
        ),
        el('h4', { text: m.title || m.id || 'intel' }),
        el('p', { text: m.summary || '' }),
        el('p', { class: 'rag-meta', text: [m.source, m.region, m.date].filter(Boolean).join(' · ') })
      ));
    }
  } catch (e) {
    box.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

// ===========================================================================
// Live world risk (xAPI): real signals -> risk events -> live re-pricing
// ===========================================================================
async function fetchWorldRisk(force = false) {
  if (!state.caseData) return;
  const id = state.caseId;
  if (!force && worldRiskCache.has(id)) { renderWorldRisk(worldRiskCache.get(id)); return; }
  $('#wr-body').innerHTML = `<p class="muted">${t('wr_loading')}</p>`;
  try {
    const res = await api.worldRisk(state.caseData);
    worldRiskCache.set(id, res);
    if (state.caseId === id) renderWorldRisk(res);
  } catch (e) {
    $('#wr-body').innerHTML = `<p class="error">${t('wr_fetch_fail', { msg: e.message })}</p>`;
  }
}

function refreshWorldRisk() {
  if (worldRiskCache.has(state.caseId)) renderWorldRisk(worldRiskCache.get(state.caseId));
  else fetchWorldRisk(false);
}

function wrSigItem(text, source) {
  return el('div', { class: 'wr-sig-item' },
    el('p', { class: 'wr-sig-text', text }),
    source ? el('span', { class: 'wr-source', text: t('feed_source') + source }) : null
  );
}

function wrSigGroup(titleKey, items) {
  if (!items.length) return null;
  return el('div', { class: 'wr-sig-group' },
    el('div', { class: 'wr-sig-grouphead' },
      el('span', { class: 'wr-sig-title', text: t(titleKey) }),
      el('span', { class: 'wr-sig-count', text: String(items.length) })
    ),
    ...items
  );
}

function renderWorldRisk(res) {
  lastAssessment = res;

  const mode = $('#wr-mode');
  if (mode) {
    mode.textContent = res.live ? t('wr_live') : t('wr_offline');
    mode.className = `wr-mode ${res.live ? 'live' : 'offline'}`;
  }

  const hasEvents = Array.isArray(res.events) && res.events.length > 0;
  const applyBtn = $('#wr-apply');
  if (applyBtn) {
    applyBtn.hidden = !hasEvents;
    applyBtn.disabled = worldRiskApplied;
    applyBtn.textContent = worldRiskApplied ? t('wr_applied') : t('wr_apply');
  }

  const body = $('#wr-body');
  clear(body);

  // 1) live re-pricing impact (before -> after)
  const before = res.before_quote, after = res.after_quote;
  if (before && after) {
    const aMeta = f.actionMeta(after.pricing_action);
    const bMeta = f.actionMeta(before.pricing_action);
    body.append(el('div', { class: `wr-impact tone-${aMeta.tone}` },
      el('span', { class: 'wr-impact-head', text: t('wr_impact_head') }),
      el('div', { class: 'wr-impact-row' },
        el('div', { class: 'wr-side' },
          el('span', { class: 'wr-side-label', text: t('wr_before') }),
          el('span', { class: 'wr-side-price', text: `$${f.price(before.final_issue_price_usd)}` }),
          el('span', { class: `badge sm tone-${f.riskTone(before.risk_level)}`, text: `${f.int(before.risk_score_bps)}bps` }),
          el('span', { class: `badge sm tone-${bMeta.tone}`, text: bMeta.label })
        ),
        el('span', { class: 'wr-arrow', text: '→' }),
        el('div', { class: 'wr-side' },
          el('span', { class: 'wr-side-label', text: t('wr_after') }),
          el('span', { class: 'wr-side-price strong', text: `$${f.price(after.final_issue_price_usd)}` }),
          el('span', { class: `badge sm tone-${f.riskTone(after.risk_level)}`, text: `${f.int(after.risk_score_bps)}bps` }),
          el('span', { class: `badge sm tone-${aMeta.tone}`, text: `${aMeta.icon} ${aMeta.label}` })
        )
      )
    ));
  }

  // 2) AI summary
  if (res.summary) body.append(el('p', { class: 'wr-summary', text: res.summary }));

  // 3) derived risk events
  const events = res.events ?? [];
  if (events.length) {
    body.append(el('h4', { class: 'wr-subhead', text: t('wr_events_head') }));
    const evWrap = el('div', { class: 'wr-events' });
    for (const e of events) {
      evWrap.append(el('div', { class: `wr-ev tone-${sevTone(e.severity)}` },
        el('span', { class: `badge sm tone-${sevTone(e.severity)}`, text: (e.severity || 'info').toUpperCase() }),
        el('span', { class: 'wr-ev-type', text: (e.type || '').replace(/_/g, ' ') }),
        e.region ? el('span', { class: 'wr-ev-region', text: e.region }) : null,
        (e.evidence && e.evidence[0]) ? el('span', { class: 'wr-ev-cite', text: e.evidence[0] }) : null
      ));
    }
    body.append(evWrap);
  } else {
    body.append(el('p', { class: 'muted', text: t('wr_none') }));
  }

  // 4) captured live signals (with sources)
  const s = res.signals ?? {};
  const tweetItems = (s.tweets ?? []).slice(0, 3).map((x) => wrSigItem(`@${x.author ?? '?'}: ${x.text ?? ''}`, x.author ? `x.com/${x.author}` : null));
  const offItems = (s.officials ?? []).slice(0, 2).map((x) => wrSigItem(`@${x.author ?? '?'}: ${x.text ?? ''}`, x.author ? `x.com/${x.author}` : null));
  const newsItems = (s.news ?? []).slice(0, 3).map((x) => wrSigItem(x.title ?? '', [x.source, x.date].filter(Boolean).join(' · ')));
  const mktItems = (s.prediction_markets ?? []).slice(0, 3).map((x) => wrSigItem(`${Math.round((x.implied_prob ?? 0) * 100)}% — ${x.market ?? x.question ?? ''}`, x.platform ?? 'prediction market'));
  const groups = [
    wrSigGroup('wr_sig_markets', mktItems),
    wrSigGroup('wr_sig_tweets', tweetItems),
    wrSigGroup('wr_sig_officials', offItems),
    wrSigGroup('wr_sig_news', newsItems)
  ].filter(Boolean);
  if (groups.length) {
    body.append(el('h4', { class: 'wr-subhead', text: t('wr_signals_head') }));
    body.append(el('div', { class: 'wr-signals' }, ...groups));
  }
}

async function applyWorldRisk() {
  if (!lastAssessment?.events?.length) return;
  worldRiskApplied = true;
  worldRiskEvents = lastAssessment.events.map((e) => ({
    category: 'macro', type: e.type, severity: e.severity, region: e.region,
    description: e.description, source: e.source || 'xAPI/world-intel'
  }));
  rebuildEventObjects();
  try {
    state.voyageOffering = state.voyageInjected
      ? await api.simulateOffering(state.caseData, { payout_speed: state.speed, events: state.voyageEvents })
      : null;
  } catch (e) {
    worldRiskApplied = false;
    rebuildEventObjects();
    toast(t('t_reprice_fail', { msg: e.message }), true);
    return;
  }
  renderEventButtons();
  renderLive(liveQuote());
  renderCallout();
  refreshLifecycle();
  refreshRiskFeed();
  $('#event-reset').hidden = !state.voyageInjected;
  renderWorldRisk(lastAssessment);
}
