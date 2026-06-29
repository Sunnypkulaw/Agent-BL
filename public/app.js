// AgentBL dashboard — router + marketplace + View ① (Tokenize / Mint).
//
// Three views share one selected trade case + one live PricingQuote (store.js):
//   View ⓪ "Investment Marketplace" — a Taobao-like, investor-facing shelf of
//           eBL-backed RWA deal stickers with voyage + funding progress.
//   View ① "Pricing & Mint" — AI cargo valuation + route risk (with sources &
//           scores), the AI pricing waterfall, and a financing→mint module that
//           tokenizes the eBL into RWA on Injective Testnet (or a simulated fallback).
//   View ② "Voyage Risk" — lives in voyage.js.
// UI chrome is bilingual via i18n.js; the engine's own prose stays as returned.

import { state, selectedQuote } from './store.js';
import { $, el, clear, toast, setBusy } from './dom.js';
import * as f from './format.js';
import * as api from './api.js';
import * as web3 from './web3.js';
import { t, tData, toggleLang, onLangChange, applyStaticI18n } from './i18n.js';
import { initVoyage, renderVoyage, startVoyageClock, stopVoyageClock } from './voyage.js';
import { initPopupAssistant } from './popup-assistant.js';
import { getDeepSeekClient } from './llm-client.js';

const PAUSED_ACTIONS = new Set(['PAUSE_OFFERING', 'FREEZE_POOL', 'TRIGGER_LIQUIDATION']);
const MARKET_PLAY_MS = 90000;
const marketClock = { timer: 0, startedAt: 0 };

/** Resolve the human-readable network name from chain-config. */
const NETWORK_LABELS = { injective_testnet: 'Injective Testnet' };
let _cachedNetworkName = null;
async function networkName() {
  if (_cachedNetworkName) return _cachedNetworkName;
  try {
    const cfg = await web3.loadChainConfig();
    _cachedNetworkName = NETWORK_LABELS[cfg?.network] || cfg?.network || 'Injective Testnet';
  } catch { _cachedNetworkName = 'Injective Testnet'; }
  return _cachedNetworkName;
}

// ---- Category filter state ----
state.categoryFilter = 'all';
state.searchQuery = '';

/** Map cargo names to category keys. */
const CATEGORY_MAP = {
  energy_chemical: ['crude', 'oil', 'refined', 'rubber', 'petroleum', 'chemical'],
  metal: ['copper', 'iron', 'aluminum', 'aluminium', 'steel'],
  ore: ['ore', 'concentrate']
};

function getCaseCategory(caseItem) {
  const bl = caseItem.case?.bill_of_lading ?? {};
  const cargo = (bl.cargo || caseItem.cargo || '').toLowerCase();
  const cats = [];
  if (CATEGORY_MAP.ore.some(k => cargo.includes(k.toLowerCase()))) cats.push('ore');
  if (CATEGORY_MAP.metal.some(k => cargo.includes(k.toLowerCase()))) cats.push('metal');
  if (CATEGORY_MAP.energy_chemical.some(k => cargo.includes(k.toLowerCase()))) cats.push('energy_chemical');
  return cats.length ? cats : ['all'];
}

/** Return cases filtered by current category + search query + AI match. */
function visibleCases() {
  let cases = state.cases;

  // AI-matched IDs from natural-language filtering.
  if (state._aiMatchedIds) {
    cases = cases.filter(c => state._aiMatchedIds.has(c.case_id));
  }

  // Category filter
  if (state.categoryFilter !== 'all') {
    cases = cases.filter(c => {
      const cats = getCaseCategory(c);
      return cats.includes(state.categoryFilter);
    });
  }

  // Keyword search (skip when AI filter is active — AI already understands intent)
  if (!state._aiMatchedIds && state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    cases = cases.filter(c => {
      const bl = c.case?.bill_of_lading ?? {};
      const searchable = [
        c.label, c.cargo, c.route, c.risk_hint, c.case_id,
        bl.cargo, bl.port_of_loading, bl.port_of_discharge,
        bl.bl_id, bl.vessel_name
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }

  return cases;
}

// ===========================================================================
// Boot
// ===========================================================================
async function boot() {
  applyStaticI18n();
  wireStaticHandlers();
  await loadDemoRuntimeMode();
  initVoyage();
  initPopupAssistant();
  onLangChange(onLangChanged);
  reflectChainStatus();
  refreshWalletUi();
  refreshLangBtn();

  try {
    state.cases = await api.getCases();
  } catch (e) {
    toast(t('t_load_cases_fail', { msg: e.message }), true);
    return;
  }
  renderCaseSelector();
  renderSpeedSelector();
  await selectCase(state.cases[0]?.case_id);
  setView('market');
  warmMarketQuotes();
}

async function loadDemoRuntimeMode() {
  try {
    const response = await fetch('/api/demo/mode');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load runtime mode');
    state.demoMode = data.demoMode;
    state.liveAvailable = data.liveAvailable;
    state.modeGeneration = data.generation;
  } catch {
    state.demoMode = true;
    state.liveAvailable = false;
  }
  refreshDemoModeUi();
}

function refreshDemoModeUi() {
  const banner = $('#demo-banner');
  const copy = $('#demo-mode-copy');
  const toggle = $('#mode-toggle-btn');
  const reset = $('#demo-reset-btn');
  const livePill = $('#live-pill');
  if (banner) banner.classList.toggle('live-mode', !state.demoMode);
  if (copy) copy.textContent = state.demoMode
    ? 'DEMO MODE · No wallet required · Simulated receipts are not chain transactions'
    : 'LIVE MODE · Real wallet, USDC and on-chain transactions';
  if (toggle) {
    toggle.textContent = state.demoMode ? 'Switch to Live' : 'Switch to Demo';
    toggle.title = state.liveAvailable || !state.demoMode
      ? ''
      : 'Configure X402_MODE=live, X402_FACILITATOR_URL and X402_PAY_TO first';
  }
  if (reset) reset.disabled = !state.demoMode;
  if (livePill) {
    livePill.innerHTML = `<span class="dot"></span> ${state.demoMode ? 'DEMO' : 'LIVE'}`;
    livePill.classList.toggle('demo', state.demoMode);
  }
  const smoke = $('#x402-smoke-btn');
  if (smoke) smoke.disabled = !state.demoMode;
}

async function onModeToggle() {
  const target = state.demoMode ? 'live' : 'demo';
  try {
    const response = await fetch('/api/demo/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: target })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Could not switch to ${target}`);
    state.demoMode = data.demoMode;
    state.liveAvailable = data.liveAvailable;
    state.modeGeneration = data.generation;
    refreshDemoModeUi();
    toast(`Switched to ${target.toUpperCase()} mode`);
  } catch (error) {
    toast(error.message, true);
  }
}

async function onDemoReset() {
  try {
    const response = await fetch('/api/demo/reset', { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Demo reset failed');
    state.modeGeneration = data.generation;
    state.marketComparisons = {};
    state.marketSubscriptionResult = null;
    state.mint = null;
    state.poolId = null;
    state.voyageInjected = false;
    state.voyageOffering = null;
    state.voyageEvents = [];
    renderX402FlowReset();
    await selectCase(state.cases[0]?.case_id);
    setView('market');
    toast('Demo state reset');
  } catch (error) {
    toast(error.message, true);
  }
}

// Re-apply text + re-render the active view when the language changes.
function onLangChanged() {
  applyStaticI18n();
  refreshLangBtn();
  reflectChainStatus();
  refreshWalletUi();
  highlightCategoryBtn();
  renderCaseSelector();
  renderSpeedSelector();
  highlightCase();
  highlightSpeed();
  renderMarket();
  renderViewMint();
  if (state.view === 'voyage') renderVoyage();
  if (state.view === 'intel') renderIntelMarket();
}

// ===========================================================================
// Controller — shared selection / routing
// ===========================================================================
async function selectCase(caseId) {
  const entry = state.cases.find((c) => c.case_id === caseId);
  if (!entry) return;
  state.caseId = caseId;
  state.caseData = entry.case;
  state.financingUsd = null;
  state.mint = null;
  state.poolId = null;
  state.voyageInjected = false;
  state.voyageOffering = null;
  state.voyageEvents = [];
  highlightCase();
  setBusy(true);
  try {
    state.comparison = await getCaseComparison(entry);
    state.speed = state.comparison.recommended_payout_speed
      ?? state.comparison.quotes?.[0]?.payout_speed ?? 'BALANCED';
    highlightSpeed();
    const q = selectedQuote();
    state.financingUsd = Math.round(q?.requested_cash_usd ?? q?.expected_cash_to_exporter_usd ?? 0);
    state.marketSubscriptionUsd = defaultMarketSubscription(q);
    state.marketSubscriptionResult = null;
    renderMarket();
    renderViewMint();
    if (state.view === 'voyage') renderVoyage();
  } catch (e) {
    toast(t('t_pricing_fail', { msg: e.message }), true);
  } finally {
    setBusy(false);
  }
}

function selectSpeed(speed) {
  if (!state.comparison?.quotes?.some((q) => q.payout_speed === speed)) return;
  state.speed = speed;
  highlightSpeed();
  state.voyageInjected = false;
  state.voyageOffering = null;
  state.voyageEvents = [];
  renderViewMint();
  renderMarket();
  if (state.view === 'voyage') renderVoyage();
}

function setView(name) {
  state.view = name;
  document.querySelectorAll('#nav .nav-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $('#view-market').hidden = name !== 'market';
  $('#view-mint').hidden = name !== 'mint';
  
  if (name === 'market') { renderMarket(); startMarketClock(); }
  else { stopMarketClock(); stopVoyageClock(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function openDealDetailModal(caseId) {
  if (caseId) {
    await selectCase(caseId);
  }
  const modal = $('#deal-detail-modal');
  if (modal) {
    stopMarketClock();
    renderVoyage();
    startVoyageClock();
    renderIntelMarket();
    modal.showModal();
  }
}

function closeDealDetailModal() {
  const modal = $('#deal-detail-modal');
  if (modal) modal.close();
  stopVoyageClock();
  startMarketClock();
}

// Add event listener for dialog close
document.addEventListener('DOMContentLoaded', () => {
  const modal = $('#deal-detail-modal');
  if (modal) {
    modal.addEventListener('close', () => {
      closeDealDetailModal();
    });
  }
});


function renderViewMint() {
  const quote = selectedQuote();
  if (!quote) return;
  renderDealStrip(quote);
  renderHeroPrice(quote);
  renderValuation(quote);
  renderWaterfall(quote);
  renderExporterCards();
  renderMintModule(quote);
}

// ===========================================================================
// View ⓪ — Investor marketplace
// ===========================================================================
async function getCaseComparison(entry, forceUpdate = false) {
  if (!entry?.case_id) throw new Error('Missing case id');
  const cached = state.marketComparisons[entry.case_id];
  if (!forceUpdate && cached?.comparison) return cached.comparison;
  if (!forceUpdate && cached?.promise) return cached.promise;

  const minAcceptablePrice = $('#pref-min-price') ? Number($('#pref-min-price').value) : undefined;
  const promise = api.compareSpeeds(entry.case, { min_acceptable_issue_price: minAcceptablePrice })
    .then((comparison) => {
      state.marketComparisons[entry.case_id] = { comparison };
      return comparison;
    })
    .catch((error) => {
      state.marketComparisons[entry.case_id] = { error };
      throw error;
    });
  state.marketComparisons[entry.case_id] = { promise };
  return promise;
}

function warmMarketQuotes() {
  if (!state.cases.length) return;
  state.marketLoading = true;
  renderMarket();
  Promise.allSettled(state.cases.map((entry) => getCaseComparison(entry)))
    .finally(() => {
      state.marketLoading = false;
      renderMarket();
    });
}

function cachedComparison(caseId) {
  return state.marketComparisons[caseId]?.comparison ?? null;
}

function recommendedQuote(comparison) {
  const quotes = comparison?.quotes ?? [];
  const speed = comparison?.recommended_payout_speed;
  return quotes.find((q) => q.payout_speed === speed) ?? quotes[0] ?? null;
}

function defaultMarketSubscription(quote) {
  const target = Number(quote?.expected_cash_to_exporter_usd ?? quote?.requested_cash_usd ?? 0);
  if (!Number.isFinite(target) || target <= 0) return 100000;
  return Math.max(50000, Math.round((target * 0.08) / 10000) * 10000);
}

function renderMarket() {
  const grid = $('#market-grid');
  if (!grid) return;
  const cases = sortMarketCases(visibleCases());
  renderMarketStats(cases);
  renderMarketSummary(cases);
  renderMarketGrid(cases);
  renderMarketDetail();
  updateMarketProgressVisuals();
}

function sortMarketCases(cases) {
  const riskRank = { LOW: 0, MEDIUM: 1, HIGH: 2, WARNING: 2, CRITICAL: 3 };
  const etaOf = (c) => +(f.parseDate(c.case?.bill_of_lading?.eta) ?? 0) || Number.MAX_SAFE_INTEGER;
  const quoteOf = (c) => recommendedQuote(cachedComparison(c.case_id));
  const fundingOf = (c) => marketFunding(c, quoteOf(c)).fill;
  const riskOf = (c) => riskRank[quoteOf(c)?.risk_level ?? c.risk_hint] ?? 9;
  const list = [...cases];
  list.sort((a, b) => {
    if (state.marketSort === 'yield_desc') {
      return (quoteOf(b)?.implied_gross_yield_bps ?? -1) - (quoteOf(a)?.implied_gross_yield_bps ?? -1);
    }
    if (state.marketSort === 'risk_asc') return riskOf(a) - riskOf(b) || etaOf(a) - etaOf(b);
    if (state.marketSort === 'funding_desc') return fundingOf(b) - fundingOf(a);
    if (state.marketSort === 'eta_asc') return etaOf(a) - etaOf(b);
    return (a.order ?? 99) - (b.order ?? 99) || a.case_id.localeCompare(b.case_id);
  });
  return list;
}

function renderMarketStats(cases) {
  const box = $('#market-stats');
  if (!box) return;
  clear(box);
  const quotes = cases.map((c) => recommendedQuote(cachedComparison(c.case_id))).filter(Boolean);
  const target = quotes.reduce((sum, q) => sum + Number(q.expected_cash_to_exporter_usd ?? q.requested_cash_usd ?? 0), 0);
  const avgYield = quotes.length
    ? quotes.reduce((sum, q) => sum + Number(q.implied_gross_yield_bps ?? 0), 0) / quotes.length
    : null;
  const open = quotes.filter((q) => !PAUSED_ACTIONS.has(q.pricing_action)).length;
  box.append(
    marketStat(t('market_stat_deals'), String(cases.length)),
    marketStat(t('market_stat_target'), f.usdCompact(target)),
    marketStat(t('market_stat_yield'), avgYield == null ? '—' : f.bpsToPct(avgYield)),
    marketStat(t('market_stat_open'), `${open}/${quotes.length || cases.length}`)
  );
}

function marketStat(label, value) {
  return el('div', { class: 'market-stat' },
    el('span', { text: label }),
    el('strong', { text: value })
  );
}

function renderMarketSummary(cases) {
  const box = $('#market-summary');
  if (!box) return;
  clear(box);
  const selected = state.cases.find((c) => c.case_id === state.caseId);
  const quote = selectedQuote();
  box.append(
    el('div', { class: 'market-summary-line' },
      el('span', { text: t('market_summary_visible') }),
      el('strong', { text: String(cases.length) })
    ),
    el('div', { class: 'market-summary-line' },
      el('span', { text: t('market_summary_selected') }),
      el('strong', { text: selected ? shortLabel(selected) : '—' })
    ),
    el('div', { class: 'market-summary-line' },
      el('span', { text: t('market_summary_price') }),
      el('strong', { text: quote ? `$${f.price(quote.final_issue_price_usd)}` : '—' })
    )
  );
}

function renderMarketGrid(cases) {
  const grid = $('#market-grid');
  const count = $('#market-count');
  clear(grid);
  if (count) count.textContent = t('market_count', { n: cases.length });

  if (!cases.length) {
    grid.append(el('div', { class: 'market-empty', text: t('market_empty') }));
    return;
  }

  for (const entry of cases) {
    const comparison = cachedComparison(entry.case_id);
    if (!comparison && !state.marketComparisons[entry.case_id]?.promise) {
      getCaseComparison(entry)
        .then(() => { if (state.view === 'market') renderMarket(); })
        .catch(() => { if (state.view === 'market') renderMarket(); });
    }
    grid.append(renderMarketCard(entry, comparison));
  }
}

function renderMarketCard(entry, comparison) {
  const quote = recommendedQuote(comparison);
  const bl = entry.case?.bill_of_lading ?? {};
  const active = entry.case_id === state.caseId;
  const risk = quote?.risk_level ?? entry.risk_hint ?? '—';
  const tone = f.riskTone(risk);
  const funding = marketFunding(entry, quote);
  const progress = marketVoyageProgress(entry.case);
  const qty = cargoQuantity(bl);
  const act = quote ? f.actionMeta(quote.pricing_action) : null;
  const paused = quote && PAUSED_ACTIONS.has(quote.pricing_action);

  let cargoType = 'alu'; // fallback
  const cId = (entry.case_id || '').toLowerCase();
  const cName = (bl.cargo || entry.cargo || '').toLowerCase();
  const match = (kw) => cId.includes(kw) || cName.includes(kw);

  if (match('copper') || match('cuconc') || match('-cu-') || match('铜')) cargoType = 'copper';
  else if (match('crude') || match('refined') || match('-oil-') || match('oil') || match('petroleum') || match('油')) cargoType = 'oil';
  else if (match('ironore') || match('iron ore') || match('铁')) cargoType = 'ore';
  else if (match('rubber') || match('橡胶')) cargoType = 'rubber';
  else if (match('soybean') || match('-soy-') || match('大豆')) cargoType = 'soybean';
  else if (match('alu') || match('铝')) cargoType = 'alu';

  const imgSrc = `/img/cargo/${cargoType}.jpg`;

  return el('article', {
    class: `market-card tone-${tone}${active ? ' active' : ''}${paused ? ' paused' : ''}`,
    'data-case': entry.case_id,
    onclick: (event) => {
      if (event.target.closest('button, input, select, a')) return;
      selectMarketCase(entry.case_id);
    }
  },
    el('div', { class: 'market-card-hero', style: `background-image: url('${imgSrc}');` },
      el('div', { class: 'market-card-top' },
        el('span', { class: `badge tone-${tone}`, text: f.riskLabel(risk) }),
        act ? el('span', { class: `badge sm tone-${act.tone}`, text: act.label }) : el('span', { class: 'badge sm tone-muted', text: t('market_loading') })
      )
    ),
    el('h3', { class: 'market-card-title', text: tData(bl.cargo || entry.cargo || shortLabel(entry)) }),
    el('p', { class: 'market-card-route', text: `${tData(bl.port_of_loading) || '?'} → ${tData(bl.port_of_discharge) || '?'}` }),
    el('div', { class: 'market-price-row' },
      el('div', {},
        el('span', { class: 'metric-label', text: t('market_issue_price') }),
        el('strong', { class: 'market-price', text: quote ? `$${f.price(quote.final_issue_price_usd)}` : '—' })
      ),
      el('div', { class: 'market-yield' },
        el('strong', { text: quote ? f.bpsToPct(quote.implied_gross_yield_bps) : '—' }),
        el('span', { text: t('market_upside') })
      )
    ),
    el('div', { class: 'market-card-facts' },
      fact(t('market_fact_ebl'), bl.bl_id || bl.bl_no || '—'),
      fact(t('market_fact_vessel'), bl.vessel || '—'),
      fact(t('market_fact_qty'), qty || '—'),
      fact(t('market_fact_target'), quote ? f.usdCompact(quote.expected_cash_to_exporter_usd ?? quote.requested_cash_usd) : '—')
    ),
    renderMarketVoyage(bl, progress),
    renderMarketFunding(funding, paused),
    el('div', { class: 'market-card-actions' },
      el('button', { class: 'btn sm market-subscribe-shortcut', onclick: () => selectMarketCase(entry.case_id) }, t('market_card_subscribe')),
      el('button', { class: 'btn ghost sm', onclick: () => { selectMarketCase(entry.case_id).then(() => openDealDetailModal(entry.case_id)); } }, t('market_card_track'))
    )
  );
}

function fact(label, value) {
  return el('div', { class: 'market-fact' },
    el('span', { text: label }),
    el('strong', { text: value })
  );
}

function renderMarketVoyage(bl, progress) {
  return el('div', { class: 'market-voyage' },
    el('div', { class: 'market-port-row' },
      el('span', { text: tData(bl.port_of_loading) || 'Departure' }),
      el('span', { text: tData(bl.port_of_discharge) || 'Arrival' })
    ),
    el('div', { class: 'market-voyage-track' },
      el('div', { class: 'market-voyage-fill', style: `width:${Math.round(progress * 100)}%` }),
      el('span', { class: 'market-ship', style: `left:${2 + progress * 96}%`, text: '🚢' })
    ),
    el('div', { class: 'market-voyage-note', text: marketVoyageNote(bl, progress) })
  );
}

function renderMarketFunding(funding, paused) {
  return el('div', { class: 'market-funding' },
    el('div', { class: 'market-funding-head' },
      el('span', { text: t('market_funding') }),
      el('strong', { text: `${f.usdCompact(funding.raised)} / ${f.usdCompact(funding.target)} · ${Math.round(funding.fill * 100)}%${paused ? t('fin_paused') : ''}` })
    ),
    el('div', { class: 'market-funding-track' },
      el('div', { class: `market-funding-fill${paused ? ' paused' : ''}`, style: `width:${Math.round(funding.fill * 100)}%` })
    )
  );
}

async function selectMarketCase(caseId) {
  await selectCase(caseId);
  renderMarket();
  $('#market-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderMarketDetail() {
  const box = $('#market-detail');
  if (!box) return;
  clear(box);
  const entry = state.cases.find((c) => c.case_id === state.caseId);
  const quote = selectedQuote();
  const bl = state.caseData?.bill_of_lading ?? {};
  if (!entry || !quote) {
    box.append(el('div', { class: 'market-detail-empty', text: t('market_detail_loading') }));
    return;
  }

  const paused = PAUSED_ACTIONS.has(quote.pricing_action);
  const act = f.actionMeta(quote.pricing_action);
  const amount = state.marketSubscriptionUsd ?? defaultMarketSubscription(quote);
  state.marketSubscriptionUsd = amount;

  box.append(
    el('div', { class: 'market-detail-head' },
      el('span', { class: 'metric-label', text: t('market_detail_label') }),
      el('h2', { text: shortLabel(entry) }),
      el('p', { text: `${tData(bl.cargo || entry.cargo || 'Trade cargo')} · ${tData(bl.port_of_loading) || '?'} → ${tData(bl.port_of_discharge) || '?'}` })
    ),
    el('div', { class: 'market-detail-price' },
      el('div', {},
        el('span', { class: 'metric-label', text: t('market_issue_price') }),
        el('strong', { text: `$${f.price(quote.final_issue_price_usd)}` })
      ),
      el('span', { class: `badge tone-${act.tone}`, text: `${act.icon} ${act.label}` })
    ),
    el('div', { class: 'market-detail-kpis' },
      miniKv(t('market_detail_upside'), f.bpsToPct(quote.implied_gross_yield_bps), 'gain'),
      miniKv(t('market_detail_risk'), `${f.riskLabel(quote.risk_level)} · ${f.int(quote.risk_score_bps)} bps`),
      miniKv(t('market_detail_collateral'), f.usdCompact(quote.ai_verified_collateral_value_usd)),
      miniKv(t('market_detail_eta'), f.fmtDate(bl.eta))
    ),
    el('label', { class: 'control-label', for: 'market-subscription', text: t('market_subscription_label') }),
    el('div', { class: 'market-subscribe-row' },
      el('input', {
        id: 'market-subscription', type: 'number', min: '0', step: '10000', inputmode: 'numeric',
        value: String(amount), disabled: paused,
        oninput: (event) => {
          state.marketSubscriptionUsd = Number(event.target.value) || 0;
          state.marketSubscriptionResult = null;
          renderMarketSubscribeReadout(quote);
        }
      }),
      el('button', {
        id: 'market-subscribe-btn',
        class: 'btn',
        disabled: paused,
        onclick: onMarketSubscribe
      }, paused ? t('market_paused_btn') : t('market_subscribe_btn'))
    ),
    el('div', { id: 'market-subscribe-readout', class: 'market-subscribe-readout' }),
    el('div', { class: 'market-detail-actions' },
      el('button', { class: 'btn ghost sm', onclick: () => setView('mint') }, t('market_open_pricing')),
      el('button', { class: 'btn ghost sm', onclick: () => openDealDetailModal(state.caseId) }, t('market_open_voyage'))
    )
  );

  renderMarketSubscribeReadout(quote);
}

function renderMarketSubscribeReadout(quote) {
  const box = $('#market-subscribe-readout');
  if (!box || !quote) return;
  clear(box);
  const amount = Number(state.marketSubscriptionUsd) || 0;
  const tokens = quote.final_issue_price_usd > 0 ? Math.floor(amount / quote.final_issue_price_usd) : 0;
  const redemption = tokens;
  box.append(
    el('div', { class: 'market-readout-line' }, t('market_readout_receive') + ' ',
      el('strong', { text: f.int(tokens) }),
      ` RWA · ${t('market_readout_target')} ${f.usd(redemption)}`
    ),
    el('div', { class: 'readout-grid market-readout-grid' },
      miniKv(t('mr_price'), `$${f.price(quote.final_issue_price_usd)}`),
      miniKv(t('mr_invest'), f.usd(amount)),
      miniKv(t('mr_redeem'), f.usd(redemption), 'gain'),
      miniKv(t('mr_upside'), f.usd(Math.max(0, redemption - amount)), 'gain')
    )
  );
  if (state.marketSubscriptionResult) {
    const result = state.marketSubscriptionResult;
    box.append(el('div', { class: `market-subscribe-result tone-${f.stateTone(result.final_state)}` },
      el('span', { class: `badge sm tone-${f.stateTone(result.final_state)}`, text: result.final_state }),
      el('span', { text: t('market_subscribe_result', { n: result.steps?.length ?? 0 }) })
    ));
  } else {
    box.append(el('p', { class: 'sub-foot muted', text: t('market_readout_foot') }));
  }
}

async function onMarketSubscribe() {
  const quote = selectedQuote();
  if (!quote || PAUSED_ACTIONS.has(quote.pricing_action)) return;
  const amount = Number(state.marketSubscriptionUsd) || 0;
  if (amount <= 0) { toast(t('market_need_amount'), true); return; }

  const btn = $('#market-subscribe-btn');
  const old = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = t('market_subscribing'); }
  try {
    state.marketSubscriptionResult = await api.simulateOffering(state.caseData, {
      payout_speed: state.speed,
      subscription_usd: amount
    });
    renderMarketDetail();
    toast(t('market_subscribed_toast'));
  } catch (e) {
    toast(t('market_subscribe_fail', { msg: e.message || e }), true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = old || t('market_subscribe_btn'); }
  }
}

function cargoQuantity(bl) {
  if (bl.quantity_mt) return `${f.int(bl.quantity_mt)} MT`;
  if (bl.quantity_bbl) return `${f.int(bl.quantity_bbl)} bbl`;
  return bl.containers || '';
}

function initialMarketProgress(caseData) {
  const bl = caseData?.bill_of_lading ?? {};
  const dep = f.parseDate(bl.shipped_on_board || bl.issue_date);
  const eta = f.parseDate(bl.eta);
  if (!dep || !eta) return 0.15;
  const dates = [...(caseData.shipment_events ?? []), ...(caseData.macro_risk_events ?? [])]
    .map((e) => +f.parseDate(e.date)).filter(Number.isFinite);
  const now = dates.length ? Math.max(...dates) : (+dep + (+eta - +dep) * 0.18);
  return Math.max(0.06, Math.min(0.88, f.voyageProgress(dep, eta, now)));
}

function marketVoyageProgress(caseData) {
  const started = marketClock.startedAt || performance.now();
  const extra = Math.max(0, performance.now() - started) / MARKET_PLAY_MS;
  return Math.max(0.04, Math.min(1, initialMarketProgress(caseData) + extra * 0.52));
}

function marketVoyageNote(bl, progress) {
  const pct = Math.round(progress * 100);
  const disch = bl.port_of_discharge || 'destination';
  const eta = f.fmtDate(bl.eta);
  return progress >= 1 ? t('market_arrived', { disch }) : t('market_voyage_note', { pct, disch, eta });
}

function marketFunding(entry, quote) {
  const target = Number(quote?.expected_cash_to_exporter_usd ?? quote?.requested_cash_usd ?? entry.case?.financing?.requested_cash_usd ?? 0);
  const progress = marketVoyageProgress(entry.case);
  const paused = quote && PAUSED_ACTIONS.has(quote.pricing_action);
  const fill = Math.min(paused ? 0.72 : 0.97, 0.18 + progress * (paused ? 0.54 : 0.76));
  return {
    target,
    fill,
    raised: Math.round(target * fill)
  };
}

function updateMarketProgressVisuals() {
  if (state.view !== 'market') return;
  for (const card of document.querySelectorAll('.market-card[data-case]')) {
    const entry = state.cases.find((c) => c.case_id === card.dataset.case);
    if (!entry) continue;
    const quote = recommendedQuote(cachedComparison(entry.case_id));
    const bl = entry.case?.bill_of_lading ?? {};
    const progress = marketVoyageProgress(entry.case);
    const funding = marketFunding(entry, quote);
    const paused = quote && PAUSED_ACTIONS.has(quote.pricing_action);
    $('.market-voyage-fill', card)?.style.setProperty('width', `${Math.round(progress * 100)}%`);
    $('.market-ship', card)?.style.setProperty('left', `${2 + progress * 96}%`);
    const note = $('.market-voyage-note', card);
    if (note) note.textContent = marketVoyageNote(bl, progress);
    $('.market-funding-fill', card)?.style.setProperty('width', `${Math.round(funding.fill * 100)}%`);
    const fundingHead = $('.market-funding-head strong', card);
    if (fundingHead) {
      fundingHead.textContent = `${f.usdCompact(funding.raised)} / ${f.usdCompact(funding.target)} · ${Math.round(funding.fill * 100)}%${paused ? t('fin_paused') : ''}`;
    }
  }
}

function startMarketClock() {
  if (marketClock.timer) return;
  marketClock.startedAt = performance.now();
  marketClock.timer = setInterval(updateMarketProgressVisuals, 1000);
}

function stopMarketClock() {
  clearInterval(marketClock.timer);
  marketClock.timer = 0;
}

// ===========================================================================
// Selectors (case + speed)
// ===========================================================================
function renderCaseSelector() {
  const box = $('#case-select');
  clear(box);
  const cases = visibleCases();
  if (cases.length === 0) {
    box.append(el('span', { class: 'case-empty', text: t('no_case_match') }));
    return;
  }

  const select = el('select', {
    class: 'case-dropdown',
    'aria-label': t('case_select_aria'),
    onchange: (event) => selectCase(event.target.value)
  });
  for (const c of cases) {
    const risk = c.risk_hint ? ` · ${f.riskLabel(c.risk_hint)}` : '';
    select.append(el('option', { value: c.case_id, text: shortLabel(c) + risk }));
  }
  box.append(select);
  highlightCase();
}

function shortLabel(c) {
  const bl = c.case?.bill_of_lading ?? {};
  const cargo = shortCargoName(tData(bl.cargo || c.cargo || c.case_id));
  const load = tData(bl.port_of_loading);
  const disch = tData(bl.port_of_discharge);
  return load && disch ? `${cargo} · ${load} → ${disch}` : cargo;
}

function shortCargoName(value) {
  const text = String(value || 'Trade case').replace(/\s*\([^)]*\)/g, '').trim();
  return text.length > 34 ? text.slice(0, 31).trimEnd() + '…' : text;
}

function renderSpeedSelector() {
  const box = $('#speed-select');
  clear(box);
  for (const speed of ['FAST', 'BALANCED', 'LOW_COST']) {
    const meta = f.SPEED_META[speed];
    box.append(el('button', {
      class: 'seg-btn', role: 'tab', 'data-speed': speed,
      onclick: () => selectSpeed(speed)
    },
      el('span', { class: 'seg-main', text: meta.label }),
      el('span', { class: 'seg-hint', text: t('speed_' + speed + '_sub') })
    ));
  }
}

function highlightCase() {
  const select = $('#case-select .case-dropdown');
  if (select && state.caseId) select.value = state.caseId;
  document.querySelectorAll('#case-select .seg-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.case === state.caseId));
}

function highlightSpeed() {
  const rec = state.comparison?.recommended_payout_speed;
  document.querySelectorAll('#speed-select .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.speed === state.speed);
    b.classList.toggle('recommended', b.dataset.speed === rec);
  });
}

// ===========================================================================
// Category filter
// ===========================================================================
function onCategoryClick(cat) {
  state.categoryFilter = cat;
  highlightCategoryBtn();
  renderCaseSelector();
  renderMarket();
  const visible = visibleCases();
  if (visible.length && !visible.find(c => c.case_id === state.caseId)) {
    selectCase(visible[0].case_id);
  }
}

function highlightCategoryBtn() {
  document.querySelectorAll('#category-filter .cat-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.cat === state.categoryFilter));
}

// ===========================================================================
// Search + AI natural language filter
// ===========================================================================
let searchDebounce = null;
function onSearchInput() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.searchQuery = $('#search-input')?.value || '';
    state._aiMatchedIds = null; // clear AI filter on manual input
    renderCaseSelector();
    renderMarket();
    const visible = visibleCases();
    if (visible.length && !visible.find(c => c.case_id === state.caseId)) {
      selectCase(visible[0].case_id);
    }
  }, 300);
}

async function onAiSearch() {
  const query = ($('#search-input')?.value || '').trim();
  if (!query) { toast(t('ai_empty_query'), true); return; }

  const btn = $('#ai-search-btn');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('ai_searching');

  try {
    const caseList = state.cases.map(c => ({
      id: c.case_id,
      label: c.label || c.case_id,
      cargo: c.cargo || '',
      route: c.route || '',
      risk: c.risk_hint || ''
    }));

    const tools = [{
      name: 'filter_eBLs',
      description: 'Return matching electronic bill-of-lading case IDs based on the investor natural-language preference.',
      parameters: {
        type: 'object',
        properties: {
          matched_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Matched case IDs sorted by relevance'
          },
          reasoning: {
            type: 'string',
            description: 'Brief English explanation of why these cases match, under 20 words'
          }
        },
        required: ['matched_ids']
      }
    }];

    const client = getDeepSeekClient();
    const messages = [
      { role: 'system', content: `You are an eBL investment-filter assistant. Select the best matching cases from the list below based on the user's natural-language preference.

Available cases:
${caseList.map(c => `- ID: ${c.id} | Cargo: ${c.cargo} | Route: ${c.route} | Risk: ${c.risk} | Label: ${c.label}`).join('\n')}

Use the filter_eBLs tool. Match risk appetite, cargo type, route, ports, speed, or other preferences. If the request is broad, return several good matches. Keep reasoning in English.` },
      { role: 'user', content: query }
    ];

    const result = await client.chat(messages, tools);

    if (result.tool_calls && result.tool_calls.length > 0) {
      const args = result.tool_calls[0].arguments;
      const matchedIds = args.matched_ids || [];
      const reasoning = args.reasoning || '';

      if (matchedIds.length > 0) {
        state.searchQuery = query;
        state._aiMatchedIds = new Set(matchedIds);
        renderCaseSelector();
        renderMarket();
        const visible = visibleCases();
        if (visible.length > 0) {
          selectCase(visible[0].case_id);
        }
        toast(t('ai_match_toast', { reasoning, n: matchedIds.length }));
      } else {
        toast(t('ai_no_match'), true);
      }
    } else if (result.content) {
      // No tool call — fallback to keyword
      state.searchQuery = query;
      renderCaseSelector();
      renderMarket();
      const visible = visibleCases();
      if (visible.length > 0) {
        selectCase(visible[0].case_id);
        toast(t('keyword_match_toast', { n: visible.length }));
      } else {
        toast(t('ai_no_match'), true);
      }
    }
  } catch (e) {
    // Fallback to keyword search
    state.searchQuery = query;
    renderCaseSelector();
    renderMarket();
    const visible = visibleCases();
    if (visible.length > 0) {
      selectCase(visible[0].case_id);
      toast(t('keyword_ai_unavailable_toast', { n: visible.length }));
    } else {
      toast(t('ai_error', { msg: e.message }), true);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

// ===========================================================================
// Hero + deal strip
// ===========================================================================
function renderDealStrip(quote) {
  const bl = state.caseData?.bill_of_lading ?? {};
  const strip = $('#deal-strip');
  clear(strip);
  const qty = bl.quantity_mt ? `${f.int(bl.quantity_mt)} MT` : (bl.quantity_bbl ? `${f.int(bl.quantity_bbl)} bbl` : '');
  const pills = [
    [t('ds_route'), bl.port_of_loading && bl.port_of_discharge ? `${tData(bl.port_of_loading)} → ${tData(bl.port_of_discharge)}` : '—'],
    [t('ds_cargo'), bl.cargo ? `${tData(bl.cargo)}${qty ? ` · ${qty}` : ''}` : '—'],
    [t('ds_ebl'), bl.bl_id ? `${bl.bl_id}${bl.ebl_platform ? ` · ${bl.ebl_platform}` : ''}` : '—'],
    [t('ds_declared'), bl.declared_value_usd ? f.usd(bl.declared_value_usd) : '—'],
    [t('ds_collateral'), f.usd(quote.ai_verified_collateral_value_usd)]
  ];
  for (const [k, v] of pills) {
    strip.append(el('span', { class: 'deal-pill' },
      el('span', { class: 'deal-pill-k', text: k }),
      el('span', { class: 'deal-pill-v', text: v })));
  }
}

function renderHeroPrice(quote) {
  const act = f.actionMeta(quote.pricing_action);
  const box = $('#hero-price');
  clear(box);
  box.append(
    el('span', { class: 'metric-label', text: t('hp_label') }),
    el('div', { class: 'hero-price-val' },
      el('span', { class: 'currency', text: '$' }),
      el('span', { id: 'hero-price-num', text: f.price(quote.final_issue_price_usd) })
    ),
    el('div', { class: 'hero-price-meta' },
      el('span', { class: `badge tone-${act.tone}`, text: `${act.icon} ${act.label}` }),
      el('span', { class: 'hero-yield', html: `<strong>${f.bpsToPct(quote.implied_gross_yield_bps)}</strong> ${t('hp_upside')}` })
    ),
    el('div', { class: 'hero-target', html: t('hp_redeem', { speed: f.SPEED_META[quote.payout_speed].label }) })
  );
}

// ===========================================================================
// View ① — AI cargo valuation + route risk (with sources & scores)
// ===========================================================================
function renderValuation(quote) {
  const caseData = state.caseData ?? {};
  const bl = caseData.bill_of_lading ?? {};
  const ins = caseData.insurance ?? {};
  $('#mint-collateral').textContent = f.usd(quote.ai_verified_collateral_value_usd);

  const rows = $('#collateral-rows');
  clear(rows);
  const kv = (k, v) => el('div', { class: 'cr-row' },
    el('span', { class: 'cr-k', text: k }), el('span', { class: 'cr-v', text: v }));
  rows.append(
    kv(t('val_declared'), bl.declared_value_usd ? f.usd(bl.declared_value_usd) : '—'),
    kv(t('val_insured'), ins.insured_value_usd ? f.usd(ins.insured_value_usd) : '—'),
    kv(t('val_safe_exposure'), f.usd(quote.max_safe_redemption_exposure_usd)),
    kv(t('val_supply'), f.int(quote.recommended_token_supply))
  );

  const dimsBox = $('#risk-dims');
  clear(dimsBox);
  for (const d of f.rollupRiskDimensions(quote.risk_factors)) {
    const tone = d.active ? f.bpsTone(d.bps) : 'muted';
    dimsBox.append(el('div', {
      class: `risk-dim tone-${tone}${d.active ? ' active' : ''}`,
      title: d.factors.join('\n') || ''
    },
      el('span', { class: 'risk-dim-icon', text: d.icon }),
      el('div', { class: 'risk-dim-body' },
        el('span', { class: 'risk-dim-label', text: d.label }),
        el('span', { class: 'risk-dim-bps', text: !d.active ? t('risk_clear') : d.bps > 0 ? `+${d.bps} bps` : 'flagged' })
      )
    ));
  }
  const total = $('#risk-total');
  total.textContent = `${f.int(quote.risk_score_bps)} bps · ${f.riskLabel(quote.risk_level)}`;
  total.className = `risk-total tone-${f.riskTone(quote.risk_level)}`;

  const citeBox = $('#intel-cites');
  clear(citeBox);
  const cites = f.intelCitations(quote);
  if (cites.length) {
    citeBox.append(el('span', { class: 'cite-head', text: t('risk_cite_head') }));
    for (const c of cites) citeBox.append(el('span', { class: 'cite', text: c }));
  }

  const srcBox = $('#risk-sources');
  clear(srcBox);
  for (const s of f.riskSources(quote, caseData, t)) {
    srcBox.append(el('div', { class: 'source-row' },
      el('span', { class: 'source-tag', text: s.tag }),
      el('span', { class: 'source-detail', text: s.detail })));
  }
}

// ===========================================================================
// View ① — AI Pricing Console waterfall
// ===========================================================================
function renderWaterfall(quote) {
  const wf = $('#waterfall');
  clear(wf);

  const base = quote.base_issue_price_usd;
  const urg = quote.urgency_discount_bps / 10000;
  const risk = quote.risk_discount_bps / 10000;
  const speedPrice = base - urg;
  const indicative = quote.indicative_issue_price_usd;
  const final = quote.final_issue_price_usd;
  const lifted = quote.binding_constraint === 'COLLATERAL' && final > indicative + 1e-6;

  const lo = Math.max(0.4, Math.floor((Math.min(indicative, final, base) - 0.06) * 20) / 20);
  const hi = 1.0;
  const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

  const cols = [
    { kind: 'target', label: t('wf_target'), value: 1.0, top: 1.0, bottom: lo, note: t('wf_note_redemption') },
    { kind: 'base', label: t('wf_base'), value: base, top: base, bottom: lo, note: t('wf_note_anchor') },
    { kind: 'down', label: t('wf_urgency'), value: -urg, top: base, bottom: speedPrice, note: `${f.SPEED_META[quote.payout_speed].label} · −${quote.urgency_discount_bps} bps` },
    { kind: 'down', label: t('wf_risk'), value: -risk, top: speedPrice, bottom: indicative, note: `${f.riskLabel(quote.risk_level)} · −${quote.risk_discount_bps} bps` },
    { kind: 'mid', label: t('wf_indicative'), value: indicative, top: indicative, bottom: lo, note: t('wf_note_profit') }
  ];
  if (lifted) {
    cols.push({ kind: 'up', label: t('wf_floor'), value: final - indicative, top: final, bottom: indicative, note: t('wf_note_floor') });
  }
  cols.push({ kind: 'final', label: t('wf_final'), value: final, top: final, bottom: lo, note: t('wf_final_note', { pct: f.bpsToPct(quote.implied_gross_yield_bps) }) });

  const chart = el('div', { class: 'wf-chart' });
  const colsRow = el('div', { class: 'wf-cols' });
  const labelsRow = el('div', { class: 'wf-labels' });
  colsRow.append(el('div', { class: 'wf-target-line', style: `bottom:${pos(1.0)}%` },
    el('span', { class: 'wf-axis-tag', text: t('wf_axis_target') })));

  for (const c of cols) {
    const isDown = c.kind === 'down';
    const isUp = c.kind === 'up';
    const barBottom = pos(Math.min(c.top, c.bottom));
    const barHeight = Math.abs(pos(c.top) - pos(c.bottom));
    const valueText = (isDown || isUp)
      ? `${isDown ? '−' : '+'}${f.price(Math.abs(c.value))}`
      : `$${f.price(c.value)}`;
    const bar = el('div', { class: `wf-bar wf-${c.kind}`, style: `bottom:${barBottom}%; height:${Math.max(barHeight, 0.6)}%` });
    colsRow.append(el('div', { class: `wf-col wf-col-${c.kind}` },
      el('div', { class: 'wf-track' }, bar,
        el('span', { class: 'wf-val', style: `bottom:${pos(c.top)}%`, text: valueText })
      )
    ));
    labelsRow.append(el('div', { class: `wf-col-label wf-col-${c.kind}` },
      el('span', { class: 'wf-col-name', text: c.label }),
      el('span', { class: 'wf-col-note', text: c.note })
    ));
  }
  chart.append(colsRow, labelsRow);
  wf.append(chart);
  wf.append(el('p', { class: 'wf-axis-foot', text: t('wf_axis_foot', { lo: f.price(lo), bc: quote.binding_constraint }) }));
  $('#console-explain').textContent = quote.exporter_explanation || '';
}

// ===========================================================================
// View ① — Exporter speed cards
// ===========================================================================
function renderExporterCards() {
  const box = $('#speed-cards');
  clear(box);
  const quotes = state.comparison?.quotes ?? [];
  const rec = state.comparison?.recommended_payout_speed;
  for (const q of quotes) {
    const meta = f.SPEED_META[q.payout_speed];
    const act = f.actionMeta(q.pricing_action);
    const isActive = q.payout_speed === state.speed;
    box.append(el('button', {
      class: `speed-card${isActive ? ' active' : ''}`, 'data-speed': q.payout_speed,
      onclick: () => selectSpeed(q.payout_speed)
    },
      el('div', { class: 'speed-card-head' },
        el('div', {},
          el('span', { class: 'speed-card-title', text: meta.label }),
          el('span', { class: 'speed-card-sub', text: t('speed_' + q.payout_speed + '_sub') })
        ),
        q.payout_speed === rec ? el('span', { class: 'rec-badge', text: t('ec_aipick') }) : null
      ),
      el('div', { class: 'speed-card-price' },
        el('span', { class: 'big', text: `$${f.price(q.final_issue_price_usd)}` }),
        el('span', { class: 'unit', text: t('unit_per_token') })
      ),
      el('div', { class: 'speed-card-rows' },
        kvRow(t('ec_cash'), f.usd(q.expected_cash_to_exporter_usd)),
        kvRow(t('ec_cost'), f.usd(q.financing_cost_usd), 'cost'),
        kvRow(t('ec_share'), f.bpsToPct(q.exporter_profit_share_bps), shareTone(q)),
        kvRow(t('ec_net'), f.usd(q.exporter_net_profit_usd), 'gain')
      ),
      el('div', { class: 'speed-card-foot' },
        el('span', { class: `badge sm tone-${act.tone}`, text: act.label })
      )
    ));
  }
}
function kvRow(k, v, tone) {
  return el('div', { class: 'kvrow' },
    el('span', { class: 'kvrow-k', text: k }),
    el('span', { class: `kvrow-v${tone ? ' ' + tone : ''}`, text: v }));
}
function shareTone(q) {
  const pct = q.exporter_profit_share_bps / 100;
  return pct > 65 ? 'cost' : pct > 50 ? 'warn-text' : '';
}

// ===========================================================================
// View ① — Financing + Mint RWA on-chain
// ===========================================================================
function renderMintModule(quote) {
  $('#quote-hash').textContent = f.shortHash(quote.quote_hash, 14, 8);
  $('#quote-hash').title = quote.quote_hash || '';
  $('#evidence-hash').textContent = f.shortHash(quote.evidence_hash, 14, 8);
  $('#evidence-hash').title = quote.evidence_hash || '';

  const input = $('#mint-financing');
  input.value = state.financingUsd ?? Math.round(quote.requested_cash_usd || 0);
  const paused = PAUSED_ACTIONS.has(quote.pricing_action);
  input.disabled = paused;
  $('#mint-btn').disabled = paused;
  renderMintReadout(quote);

  if (state.mint) renderMintResult(state.mint, quote);
  else $('#mint-result').innerHTML = `<p class="muted">${t('mint_hint')}</p>`;
}

function renderMintReadout(quote) {
  const box = $('#mint-readout');
  const paused = PAUSED_ACTIONS.has(quote.pricing_action);
  if (paused) {
    box.innerHTML = `<span class="sub-paused">${t('mr_paused', { action: f.actionMeta(quote.pricing_action).label })}</span>`;
    return;
  }
  const financing = Number($('#mint-financing').value) || 0;
  state.financingUsd = financing;
  const tokens = web3.mintedTokensFor(quote, financing);
  const cost = tokens * quote.final_issue_price_usd;
  const redemption = tokens * 1.0;
  clear(box);
  box.append(
    el('div', { class: 'readout-line' }, t('mr_receive_pre') + ' ',
      el('strong', { text: f.int(tokens) }),
      ' ' + t('mr_receive_post', { price: f.price(quote.final_issue_price_usd) })),
    el('div', { class: 'readout-grid' },
      miniKv(t('mr_price'), `$${f.price(quote.final_issue_price_usd)}`),
      miniKv(t('mr_invest'), f.usd(cost)),
      miniKv(t('mr_redeem'), f.usd(redemption), 'gain'),
      miniKv(t('mr_upside'), f.bpsToPct(quote.implied_gross_yield_bps), 'gain')
    ),
    el('div', { class: 'sub-foot muted', text: t('mr_foot') })
  );
}
function miniKv(k, v, tone) {
  return el('div', { class: 'mini-kv' },
    el('span', { class: 'mini-kv-k', text: k }),
    el('span', { class: `mini-kv-v${tone ? ' ' + tone : ''}`, text: v }));
}

async function onMint() {
  const quote = selectedQuote();
  if (!quote || PAUSED_ACTIONS.has(quote.pricing_action)) return;
  const financing = Number($('#mint-financing').value) || 0;
  if (financing <= 0) { toast(t('t_need_financing'), true); return; }
  state.financingUsd = financing;

  const btn = $('#mint-btn');
  btn.disabled = true;
  btn.textContent = t('minting');

  try {
    const realConfigured = await web3.isRealChainConfigured();
    let res;
    if (realConfigured) {
      if (!web3.isWalletConnected()) {
        try { await doConnect(); }
        catch (e) {
          if (e.code === 'NO_WALLET') { res = await fallbackSim(quote, financing, t('t_no_wallet_detected')); }
          else throw e;
        }
      }
      if (!res) {
        try {
          // Fire: tx sent → pending UI. Confirm: background poll → update UI.
          res = await web3.mintOnChain(quote, financing, (confirmed) => {
            state.mint = confirmed;
            state.poolId = confirmed.poolId && confirmed.poolId !== 'sim' ? confirmed.poolId : state.poolId;
            renderMintResult(confirmed, quote);
            console.log('[mint] UI updated — block:', confirmed.blockNumber);
          });
        } catch (e) {
          if (e.code === 'REJECTED') { toast(t('t_cancel_mint'), true); return; }
          res = await fallbackSim(quote, financing, t('t_chain_call_failed', { msg: e.message || '' }));
        }
      }
    } else {
      res = await web3.simulatedMint(state.caseId, quote, financing);
    }

    state.mint = res;
    state.poolId = res.poolId && res.poolId !== 'sim' ? res.poolId : state.poolId;
    renderMintResult(res, quote);
    if (res.mode === 'chain') toast(t('t_minted_chain', { n: f.int(res.mintedAmount), network: await networkName() }));
    else if (res.mode === 'chain_pending') toast('⛓ 交易已提交，等待链上确认…');
    else toast(t('t_minted_sim', { n: f.int(res.mintedAmount) }));
  } catch (e) {
    toast(t('t_mint_fail', { msg: e.message || e }), true);
  } finally {
    btn.disabled = PAUSED_ACTIONS.has(quote.pricing_action);
    btn.textContent = t('mint_btn');
  }
}

async function fallbackSim(quote, financing, note) {
  if (note) toast(note, true);
  return web3.simulatedMint(state.caseId, quote, financing);
}

function renderMintResult(res, quote) {
  const box = $('#mint-result');
  clear(box);
  const chain = res.mode === 'chain' || res.mode === 'chain_pending';
  const pending = res.mode === 'chain_pending';
  box.append(
    el('div', { class: 'mint-result-head' },
      el('span', { class: `badge ${chain ? 'tone-ok' : 'tone-warn'}`, text: pending ? '⛓ 已提交 · 确认中' : chain ? t('res_chain', { network: _cachedNetworkName || 'Testnet' }) : t('res_sim') }),
      el('span', { class: 'mint-minted' }, t('res_minted_pre') + ' ', el('strong', { text: f.int(res.mintedAmount) }), ' ' + t('res_unit_rwa'))
    ),
    el('div', { class: 'mint-result-rows' },
      mintRow(t('res_price'), `$${f.price(quote.final_issue_price_usd)} ${t('unit_per_token')}`),
      mintRow('tx_hash', f.shortHash(res.txHash, 12, 10), chain && res.explorerUrl ? res.explorerUrl : null),
      res.poolId ? mintRow('poolId', String(res.poolId)) : null,
      res.blockNumber ? mintRow('block', `#${f.int(res.blockNumber)}`) : (pending ? mintRow('block', '⏳ 确认中…') : null)
    )
  );
  if (chain && res.poolId) {
    const balRow = mintRow(t('res_balance'), t('res_reading'));
    box.append(balRow);
    web3.readBalance(res.poolId, res.address)
      .then((bal) => { balRow.querySelector('.mint-row-v').textContent = f.int(bal); })
      .catch(() => { balRow.querySelector('.mint-row-v').textContent = '—'; });
  } else if (pending) {
    box.append(el('p', { class: 'sub-foot', style: 'color:#D29922', text: '⏳ 交易已广播，正在后台轮询链上确认（每 3 秒）…' }));
  } else {
    box.append(el('p', { class: 'sub-foot muted', text: t('res_sim_foot') }));
  }
}
function mintRow(k, v, href) {
  return el('div', { class: 'mint-row' },
    el('span', { class: 'mint-row-k', text: k }),
    href
      ? el('a', { class: 'mint-row-v etherscan-link', href, target: '_blank', rel: 'noopener' }, v + ' ↗')
      : el('span', { class: 'mint-row-v', text: v }));
}

// ===========================================================================
// Wallet + chain status + language
// ===========================================================================
async function reflectChainStatus() {
  const elx = $('#chain-status');
  if (!elx) return;
  const real = await web3.isRealChainConfigured();
  const net = await networkName();
  elx.textContent = real ? t('chain_deployed', { network: net }) : t('chain_not_deployed');
  elx.className = `chain-status tone-${real ? 'ok' : 'muted'}`;
}

function refreshWalletUi() {
  const btn = $('#wallet-btn');
  if (!btn) return;
  const addr = web3.connectedAddress();
  if (addr) {
    btn.textContent = `🦊 ${addr.slice(0, 6)}…${addr.slice(-4)}`;
    btn.classList.add('connected');
  } else {
    btn.textContent = t('wallet_connect');
    btn.classList.remove('connected');
  }
}

function refreshLangBtn() {
  const btn = $('#lang-btn');
  if (btn) btn.textContent = t('lang_switch_to');
}

async function doConnect() {
  const { address } = await web3.connectWallet();
  state.wallet = { address };
  refreshWalletUi();
  const net = await networkName();
  toast(t('t_wallet_connected', { network: net }));
  return address;
}

async function onWalletClick() {
  try {
    await doConnect();
  } catch (e) {
    if (e.code === 'NO_WALLET') toast(t('t_no_wallet_sim'), true);
    else if (e.code === 'REJECTED') toast(t('t_connect_cancel'), true);
    else toast(t('t_connect_fail', { msg: e.message || e }), true);
  }
}

// ===========================================================================
// VIEW ③ — x402 Intel Market rendering
// ===========================================================================

let x402Services = [];
let x402Configured = false;
let x402Network = 'eip155:1439';

async function loadX402Config() {
  try {
    const res = await fetch('/api/x402/config');
    const data = await res.json();
    if (data.ok) {
      x402Services = data.services;
      x402Configured = data.configured;
      x402Network = data.network;
    }
  } catch {
    x402Services = [];
    x402Configured = false;
  }
}

function renderIntelMarket() {
  loadX402Config().then(() => {
    // Re-apply static i18n to the x402 view after it's shown
    applyStaticI18n(document.getElementById('view-intel'));
    renderX402StatusBar();
    renderX402ServiceList();
    renderX402FlowReset();
    wireX402Handlers();
  });
}

function renderX402StatusBar() {
  const el = $('#x402-status-bar');
  if (!el) return;
  const badgeClass = x402Configured ? 'badge green' : 'badge';
  const badgeText = x402Configured ? t('x402_ready') : t('x402_demo_mode');
  el.innerHTML = [
    `<div class="stat"><span class="stat-val">${x402Services.length}</span><span class="stat-label">${t('x402_paid_services')}</span></div>`,
    `<div class="stat"><span class="stat-val ${x402Configured ? 'green' : ''}">${badgeText}</span><span class="stat-label">${t('x402_network_label', { network: x402Network })}</span></div>`,
    `<div class="stat"><span class="stat-val">0.001–0.002</span><span class="stat-label">${t('x402_price_range')}</span></div>`
  ].join('');
}

function renderX402ServiceList() {
  const el = $('#x402-service-list');
  if (!el) return;
  if (!x402Services.length) {
    el.innerHTML = `<p class="muted">${t('x402_loading')}</p>`;
    return;
  }
  el.innerHTML = x402Services.map((s, i) => [
    `<div class="x402-service-item" style="margin-bottom:12px;padding:10px;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer;" data-idx="${i}">`,
    `<div style="display:flex;justify-content:space-between;align-items:center;">`,
    `<strong style="font-size:14px;">${s.title}</strong>`,
    `<span class="badge" style="background:#1F6FEB22;color:#1F6FEB;font-size:11px;">${s.priceUSDC} USDC</span>`,
    `</div>`,
    `<p class="muted" style="font-size:12px;margin:4px 0 0;">${s.description}</p>`,
    `<span class="badge" style="font-size:10px;margin-top:4px;display:inline-block;">${s.status}</span>`,
    `</div>`
  ].join(''));
}

function renderX402FlowReset() {
  const steps = ['challenge', 'pay', 'settle', 'unlock'];
  for (const s of steps) {
    const el = $(`#status-${s}`);
    if (el) { el.textContent = '—'; el.className = 'x402-step-status'; }
  }
  const card = $('#x402-payment-card');
  if (card) card.hidden = true;
  const impact = $('#x402-pricing-impact');
  if (impact) impact.hidden = true;
  const log = $('#x402-log');
  if (log) log.innerHTML = '';
}

function setX402Step(stepId, status, text) {
  const el = $(`#status-${stepId}`);
  if (!el) return;
  el.textContent = text || status;
  el.className = `x402-step-status x402-step-${status}`;
}

function updateX402PaymentCard(data) {
  const card = $('#x402-payment-card');
  if (!card) return;
  card.hidden = false;
  const tx = $('#x402-txhash');
  if (tx && data.payment?.txHash) tx.textContent = data.payment.txHash.slice(0, 42) + '…';
  const svc = $('#x402-service');
  if (svc && data.payment?.receipt?.serviceId) svc.textContent = data.payment.receipt.serviceId;
  const amt = $('#x402-amount');
  if (amt && data.payment?.receipt?.amountUSDC !== undefined) amt.textContent = data.payment.receipt.amountUSDC + ' USDC';
  const rh = $('#x402-resphash');
  if (rh && data.payment?.evidence?.responseHash) rh.textContent = data.payment.evidence.responseHash.slice(0, 42) + '…';
}

function updateX402PricingImpact(data) {
  const impact = $('#x402-pricing-impact');
  if (!impact || !data.intel_preview) return;
  impact.hidden = false;
  const before = data.intel_preview.before_price;
  const after = data.intel_preview.after_price;
  const delta = data.intel_preview.price_delta;
  if (before !== undefined) $('#x402-price-before').textContent = '$' + before.toFixed(3);
  if (after !== undefined) $('#x402-price-after').textContent = '$' + after.toFixed(3);
  if (delta !== undefined) {
    const deltaNote = $('#x402-delta-note');
    if (deltaNote) {
      const dir = delta < 0 ? t('x402_price_drop') : delta > 0 ? t('x402_price_rise') : t('x402_price_nochange');
      deltaNote.innerHTML = `<span class="${delta !== 0 ? 'badge red' : 'badge'}">${dir} — ${t('x402_delta', { delta: (delta >= 0 ? '+' : '') + '$' + delta.toFixed(3) })}</span>`;
    }
  }
}

async function runX402Smoke() {
  // Legacy: no-wallet demo mode — calls /api/x402/smoke directly
  const log = $('#x402-log');
  if (!log) return;
  log.innerHTML = `<p class="muted">${t('x402_running')}</p>`;
  renderX402FlowReset();

  try {
    setX402Step('challenge', 'active', t('x402_challenge_status'));
    log.innerHTML += `<p>• <span style="color:#D6336C;">${t('x402_challenge_log')}</span></p>`;

    setTimeout(() => setX402Step('pay', 'active', t('x402_signing_status')), 500);
    log.innerHTML += `<p>• <span style="color:#D6336C;">${t('x402_signing_log')}</span></p>`;

    setTimeout(() => setX402Step('settle', 'active', t('x402_settling_status')), 1000);
    log.innerHTML += `<p>• <span style="color:#1F6FEB;">${t('x402_settlement_log')}</span></p>`;

    const res = await fetch('/api/x402/smoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ locale: 'en' })
    });
    const data = await res.json();

    if (data.ok) {
      setX402Step('pay', 'done', t('x402_signed'));
      setX402Step('settle', 'done', t('x402_settled'));
      setX402Step('unlock', 'done', t('x402_unlocked'));
      updateX402PaymentCard(data);
      updateX402PricingImpact(data);
      log.innerHTML += `<p>• <span style="color:#2EA043;">${t('x402_unlocked_log', { events: data.intel_preview?.events_count || 0, intel: data.intel_preview?.deep_intel_count || 0 })}</span></p>`;
      if (data.payment?.txHash) {
        const isLive = data.payment.live;
        const liveLabel = isLive ? '⛓️ On-chain' : '🔬 Mock hash (not on chain)';
        const liveColor = isLive ? '#2EA043' : '#D29922';
        log.innerHTML += `<p>• <span style="color:${liveColor};">${t('x402_tx_log', { tx: data.payment.txHash.slice(0, 42) + '…' })}</span> <span style="font-size:0.8em;color:${liveColor};">[${liveLabel}]</span></p>`;
      }
      log.innerHTML += `<p style="margin-top:8px;color:#2EA043;"><strong>${t('x402_pass')}</strong></p>`;
    } else {
      setX402Step('unlock', 'error', t('x402_failed'));
      log.innerHTML += `<p>• <span style="color:#D6336C;">${t('x402_fail_log', { msg: data.error || t('x402_error') })}</span></p>`;
    }
  } catch (e) {
    setX402Step('settle', 'error', t('x402_failed'));
    log.innerHTML += `<p>• <span style="color:#D6336C;">${t('x402_fail_log', { msg: e.message })}</span></p>`;
  }
}

/**
 * Real x402 wallet flow — user's wallet directly calls PaymentOracle on-chain:
 *   1. GET endpoint → HTTP 402 + challenge
 *   2. User signs challenge via personal_sign
 *   3. User's wallet calls PaymentOracle.logPaymentEvidence() (user pays gas)
 *   4. POST signed tx hash to server → intel report unlocked
 */
async function purchaseWithWallet(serviceId, priceUSDC, endpoint) {
  const log = $('#x402-log');
  if (!log) return;
  log.innerHTML = `<p class="muted">${t('x402_initiating')}</p>`;
  renderX402FlowReset();

  // ── Get wallet ──
  const eth = web3.getEthereumProvider();
  if (!eth) {
    log.innerHTML += `<p>• <span style="color:#D6336C;">❌ No wallet detected. Please install MetaMask or OKX wallet, or use the 🔥 Run Demo button.</span></p>`;
    setX402Step('pay', 'error', 'No wallet');
    return;
  }

  try {
    // ── Step 1: GET without payment → HTTP 402 ──
    setX402Step('challenge', 'active', t('x402_challenge_status'));
    log.innerHTML += `<p>• <span style="color:#D6336C;">${t('x402_challenge_log')}</span></p>`;

    const unpaidRes = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (unpaidRes.status !== 402) {
      throw new Error(`Expected HTTP 402, got ${unpaidRes.status}`);
    }
    const unpaidBody = await unpaidRes.json();
    const challenge = unpaidBody.challenge;
    const nonce = unpaidBody.nonce;
    if (!challenge) throw new Error('No challenge message in 402 response');

    log.innerHTML += `<p>• <span style="color:#D6336C;">📝 Challenge received: "${challenge.slice(0, 60)}…"</span></p>`;

    // ── Step 2: Wallet personal_sign ──
    setX402Step('pay', 'active', t('x402_signing_status'));
    log.innerHTML += `<p>• <span style="color:#D6336C;">🦊 Opening wallet — please sign the payment authorization…</span></p>`;

    // Ensure connected
    if (!web3.isWalletConnected()) {
      try {
        const { address } = await web3.connectWallet();
        state.wallet = { address };
      } catch (e) {
        if (e.code === 'NO_WALLET') throw e;
        if (e.code === 'REJECTED') { const err = new Error('User rejected wallet connection'); err.code = 'REJECTED'; throw err; }
        throw e;
      }
    }

    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    const signerAddr = accounts[0];
    const signature = await eth.request({
      method: 'personal_sign',
      params: [challenge, signerAddr]
    });

    log.innerHTML += `<p>• <span style="color:#2EA043;">✓ Signed by ${signerAddr.slice(0, 8)}…${signerAddr.slice(-4)}</span></p>`;

    // ── Step 3: User's wallet calls PaymentOracle.logPaymentEvidence() on-chain ──
    setX402Step('settle', 'active', t('x402_settling_status'));

    // Compute evidence hashes via Web Crypto
    const responsePayload = JSON.stringify({ serviceId, priceUSDC, payer: signerAddr, nonce });
    const respBuf = new TextEncoder().encode(responsePayload);
    const respDigest = await crypto.subtle.digest('SHA-256', respBuf);
    const responseHash = '0x' + [...new Uint8Array(respDigest)].map(b => b.toString(16).padStart(2, '0')).join('');

    const paymentRef = `x402:${serviceId}:${nonce}`;
    const amountMicrousd = Math.floor(priceUSDC * 1_000_000);

    let paymentResult;
    let useDirectChain = false;
    try {
      paymentResult = await web3.logX402PaymentOnChain({
        payer: signerAddr,
        serviceId,
        amountMicrousd,
        paymentRef,
        responseHash,
        quoteHash: responseHash,
        evidenceHash: responseHash,
        pricingAction: 'OPEN'
      });
      useDirectChain = true;
      log.innerHTML += `<p>• <span style="color:#2EA043;">⛓️ On-chain tx sent from your wallet: ${paymentResult.txHash.slice(0, 18)}…</span></p>`;
    } catch (chainErr) {
      // Fallback: server relay if PaymentOracle not deployed or user rejected
      if (chainErr.code === 'REJECTED') throw chainErr;
      log.innerHTML += `<p>• <span style="color:#D29922;">⚠ Direct on-chain call unavailable (${chainErr.message}) — using server relay fallback.</span></p>`;
    }

    // ── Step 4: POST to server to get the unlocked intel report ──
    const paidRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X402-Signature': signature,
        'X402-Signer': signerAddr,
        ...(useDirectChain ? {
          'X402-TxHash': paymentResult.txHash,
          'X402-BlockNumber': String(paymentResult.blockNumber)
        } : {})
      },
      body: JSON.stringify({ nonce, txHash: useDirectChain ? paymentResult.txHash : undefined })
    });

    if (!paidRes.ok) {
      const errBody = await paidRes.json().catch(() => ({}));
      throw new Error(errBody.error || `Server returned ${paidRes.status}`);
    }

    const data = await paidRes.json();

    // ── Done ──
    setX402Step('pay', 'done', t('x402_signed'));
    setX402Step('settle', 'done', useDirectChain ? '⛓️ Settled (your wallet)' : t('x402_settled'));
    setX402Step('unlock', 'done', t('x402_unlocked'));
    updateX402PaymentCard(data);
    updateX402PricingImpact(data);

    log.innerHTML += `<p>• <span style="color:#2EA043;">${t('x402_unlocked_log', { events: data.events?.length || 0, intel: data.deepIntel?.length || 0 })}</span></p>`;

    // Show the ACTUAL on-chain tx hash from user's wallet
    const displayTx = useDirectChain ? paymentResult : data.payment;
    if (displayTx?.txHash) {
      const explorerUrl = displayTx.explorerUrl
        || `https://testnet.blockscout.injective.network/tx/${displayTx.txHash}`;
      log.innerHTML += `<p>• <span style="color:#2EA043;">⛓️ <a href="${explorerUrl}" target="_blank" style="color:#1F6FEB;">View on Injective Explorer ↗</a></span></p>`;
      log.innerHTML += `<p>• <span style="color:#2EA043;">💳 Payer (tx from YOUR wallet): ${signerAddr.slice(0, 10)}…${signerAddr.slice(-6)}</span></p>`;
    }

    log.innerHTML += `<p style="margin-top:8px;color:#2EA043;"><strong>💰 x402 Payment Complete ✓ — Report Unlocked</strong></p>`;
  } catch (e) {
    setX402Step('settle', 'error', t('x402_failed'));
    log.innerHTML += `<p>• <span style="color:#D6336C;">✗ ${t('x402_fail_log', { msg: e.message })}</span></p>`;
    if (e.code === 4001 || e.code === 'REJECTED') {
      log.innerHTML += `<p>• <span style="color:#D29922;">⚠ User rejected in wallet</span></p>`;
    }
  }
}

function wireX402Handlers() {
  const smokeBtn = $('#x402-smoke-btn');
  if (smokeBtn) {
    smokeBtn.addEventListener('click', runX402Smoke);
  }

  const purchaseBtn = $('#x402-purchase-btn');
  if (purchaseBtn) {
    purchaseBtn.addEventListener('click', () => {
      purchaseWithWallet('premium-risk', 0.001, '/api/x402/intel/premium-risk');
    });
  }

  document.querySelectorAll('#x402-service-list .x402-service-item').forEach((item) => {
    item.addEventListener('click', function () {
      document.querySelectorAll('#x402-service-list .x402-service-item').forEach((i) => {
        i.style.borderColor = 'var(--border)';
      });
      this.style.borderColor = '#D6336C';
    });
  });
}

// ===========================================================================
// FE-12: Render Investor Portfolio
// ===========================================================================
async function renderPortfolio() {
  const list = $('#portfolio-list');
  if (!list) return;
  try {
    const res = await fetch('/api/investors/portfolio?wallet_address=' + (state.walletAddress || '0xDemoWallet'));
    const data = await res.json();
    if (!data.ok) return;

    $('#portfolio-total').textContent = '$' + data.summary.totalInvestedUsd.toLocaleString();
    $('#portfolio-yield').textContent = (data.summary.avgYieldBps / 100).toFixed(2) + '%';
    
    if (data.investments.length === 0) {
      list.innerHTML = '<p class="muted" style="text-align: center;">No investments yet.</p>';
      return;
    }

    list.innerHTML = data.investments.map(inv => `
      <div style="border-bottom: 1px solid var(--line-soft); padding: 8px 0; font-size: 13px;">
        <div style="display:flex; justify-content:space-between;">
          <strong>${inv.label}</strong>
          <span style="color:var(--ok)">+$${inv.amountUsd.toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; color:var(--text-2); font-size:12px;">
          <span>Yield: ${(inv.yieldBps/100).toFixed(2)}% | Risk: ${inv.riskLevel}</span>
          <span style="font-family:var(--mono)">${inv.txHash.slice(0,10)}...</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load portfolio', err);
  }
}

// ===========================================================================
// FE-13: Agent Activity Console
// ===========================================================================
function agentLog(msg, color = 'var(--text-2)') {
  const container = $('#agent-logs-container');
  if (!container) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.style.color = color;
  const time = new Date().toISOString().split('T')[1].slice(0,8);
  entry.innerHTML = `<span style="color:var(--muted)">[${time}]</span> ${msg}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

// Intercept window console for demo purposes to feed the agent log
const originalLog = console.log;
console.log = function(...args) {
  originalLog.apply(console, args);
  agentLog(args.join(' '));
};
const originalWarn = console.warn;
console.warn = function(...args) {
  originalWarn.apply(console, args);
  agentLog(args.join(' '), 'var(--warn)');
};
const originalError = console.error;
console.error = function(...args) {
  originalError.apply(console, args);
  agentLog(args.join(' '), 'var(--crit)');
};

// ===========================================================================
// Wiring
// ===========================================================================
function wireStaticHandlers() {
  document.querySelectorAll('#nav .nav-tab').forEach((b) =>
    b.addEventListener('click', () => {
      setView(b.dataset.view);
      if (b.dataset.view === 'market') renderPortfolio();
    }));
  $('#lang-btn').addEventListener('click', () => toggleLang());
  $('#wallet-btn').addEventListener('click', onWalletClick);
  $('#mode-toggle-btn')?.addEventListener('click', onModeToggle);
  $('#demo-reset-btn')?.addEventListener('click', onDemoReset);
  $('#mint-btn').addEventListener('click', onMint);
  $('#pref-min-price')?.addEventListener('change', async () => {
    if (state.caseId) {
      const entry = state.cases.find(c => c.case_id === state.caseId);
      if (entry) {
        setBusy(true);
        try {
          agentLog(`Exporter updated Min Price constraint to ${$('#pref-min-price').value}`);
          state.comparison = await getCaseComparison(entry, true);
          renderMarket();
          renderViewMint();
        } catch(e) {
          toast('Failed to reprice: ' + e.message, true);
        } finally {
          setBusy(false);
        }
      }
    }
  });
  $('#pref-speed')?.addEventListener('change', (e) => {
    const val = e.target.value;
    agentLog(`Exporter updated payout speed preference to ${val || 'AI Recommended'}`);
    if (val) {
      selectSpeed(val);
    } else {
      selectSpeed(state.comparison?.recommended_payout_speed ?? 'BALANCED');
    }
  });
  $('#mint-financing').addEventListener('input', () => {
    const q = selectedQuote();
    if (q && !$('#mint-financing').disabled) renderMintReadout(q);
  });

  // FE-11: eBL Management Upload Listeners
  const eblBrowseBtn = $('#ebl-browse-btn');
  const eblFileInput = $('#ebl-file-input');
  const eblUploadZone = $('#ebl-upload-zone');
  const eblUploadStatus = $('#ebl-upload-status');

  if (eblBrowseBtn && eblFileInput) {
    eblBrowseBtn.addEventListener('click', (e) => { e.preventDefault(); eblFileInput.click(); });
    eblUploadZone.addEventListener('dragover', e => { e.preventDefault(); eblUploadZone.style.background = 'var(--panel)'; });
    eblUploadZone.addEventListener('dragleave', () => eblUploadZone.style.background = 'transparent');
    eblUploadZone.addEventListener('drop', e => {
      e.preventDefault();
      eblUploadZone.style.background = 'transparent';
      handleMockUpload(e.dataTransfer.files);
    });
    eblFileInput.addEventListener('change', (e) => handleMockUpload(e.target.files));
  }

  function handleMockUpload(files) {
    if (!files || files.length === 0) return;
    eblUploadStatus.style.color = 'var(--accent)';
    eblUploadStatus.innerHTML = `Scanning ${files.length} documents...`;
    agentLog(`Agent received ${files.length} new documents for ENI verification.`);
    
    setTimeout(() => {
      eblUploadStatus.style.color = 'var(--ok)';
      eblUploadStatus.innerHTML = '✔ Documents parsed. ENI signature verified.<br>✔ Trade case generated and sent to Risk Engine.';
      agentLog(`Documents verified. Generating mock trade case...`, 'var(--ok)');
    }, 1500);
  }

  // FE-13: Agent Console Toggle
  $('#toggle-activity-console')?.addEventListener('click', () => {
    const c = $('#agent-activity-console');
    if (c.style.height === '40px') {
      c.style.height = '160px';
    } else {
      c.style.height = '40px';
    }
  });

  // Category filter buttons
  document.querySelectorAll('#category-filter .cat-btn').forEach((b) =>
    b.addEventListener('click', () => onCategoryClick(b.dataset.cat)));

  // Search input
  const searchInput = $('#search-input');
  if (searchInput) {
    searchInput.addEventListener('input', onSearchInput);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onAiSearch();
    });
  }

  // AI search button
  $('#ai-search-btn')?.addEventListener('click', onAiSearch);

  $('#market-sort')?.addEventListener('change', (e) => {
    state.marketSort = e.target.value || 'recommended';
    renderMarket();
  });
}

boot().then(() => renderPortfolio());

