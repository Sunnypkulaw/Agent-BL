// TradeShield dashboard — router + shared controller + View ① (Tokenize / Mint).
//
// Two views share one selected trade case + one live PricingQuote (store.js):
//   View ① "提单上链铸造 RWA" — AI cargo valuation + route risk (with sources &
//           scores), the AI pricing waterfall, and a financing→mint module that
//           tokenizes the eBL into RWA on real Sepolia (or a simulated fallback).
//   View ② "航运追踪 & 实时定价" — lives in voyage.js.
// UI chrome is bilingual via i18n.js; the engine's own prose stays as returned.

import { state, selectedQuote } from './store.js';
import { $, el, clear, toast, setBusy } from './dom.js';
import * as f from './format.js';
import * as api from './api.js';
import * as web3 from './web3.js';
import { t, toggleLang, onLangChange, applyStaticI18n } from './i18n.js';
import { initVoyage, renderVoyage, startVoyageClock, stopVoyageClock } from './voyage.js';
import { initPopupAssistant } from './popup-assistant.js';

const PAUSED_ACTIONS = new Set(['PAUSE_OFFERING', 'FREEZE_POOL', 'TRIGGER_LIQUIDATION']);

// ===========================================================================
// Boot
// ===========================================================================
async function boot() {
  applyStaticI18n();
  wireStaticHandlers();
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
  setView('mint');
}

// Re-apply text + re-render the active view when the language changes.
function onLangChanged() {
  applyStaticI18n();
  refreshLangBtn();
  reflectChainStatus();
  refreshWalletUi();
  renderCaseSelector();
  renderSpeedSelector();
  highlightCase();
  highlightSpeed();
  renderViewMint();
  if (state.view === 'voyage') renderVoyage();
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
    state.comparison = await api.compareSpeeds(entry.case);
    state.speed = state.comparison.recommended_payout_speed
      ?? state.comparison.quotes?.[0]?.payout_speed ?? 'BALANCED';
    highlightSpeed();
    const q = selectedQuote();
    state.financingUsd = Math.round(q?.requested_cash_usd ?? q?.expected_cash_to_exporter_usd ?? 0);
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
  if (state.view === 'voyage') renderVoyage();
}

function setView(name) {
  state.view = name;
  document.querySelectorAll('#nav .nav-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $('#view-mint').hidden = name !== 'mint';
  $('#view-voyage').hidden = name !== 'voyage';
  if (name === 'voyage') { renderVoyage(); startVoyageClock(); }
  else { stopVoyageClock(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

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
// Selectors (case + speed)
// ===========================================================================
function renderCaseSelector() {
  const box = $('#case-select');
  clear(box);
  for (const c of state.cases) {
    box.append(el('button', {
      class: 'seg-btn', role: 'tab', 'data-case': c.case_id, title: c.label,
      onclick: () => selectCase(c.case_id)
    },
      el('span', { class: 'seg-main', text: shortLabel(c) }),
      c.risk_hint ? el('span', { class: `seg-hint tone-${f.riskTone(c.risk_hint)}`, text: c.risk_hint }) : null
    ));
  }
}
function shortLabel(c) {
  return (c.label || c.case_id).split('·')[0].trim();
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
// Hero + deal strip
// ===========================================================================
function renderDealStrip(quote) {
  const bl = state.caseData?.bill_of_lading ?? {};
  const strip = $('#deal-strip');
  clear(strip);
  const qty = bl.quantity_mt ? `${f.int(bl.quantity_mt)} MT` : (bl.quantity_bbl ? `${f.int(bl.quantity_bbl)} bbl` : '');
  const pills = [
    [t('ds_route'), bl.port_of_loading && bl.port_of_discharge ? `${bl.port_of_loading} → ${bl.port_of_discharge}` : '—'],
    [t('ds_cargo'), bl.cargo ? `${bl.cargo}${qty ? ` · ${qty}` : ''}` : '—'],
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
        el('span', { class: 'risk-dim-bps', text: !d.active ? 'clear' : d.bps > 0 ? `+${d.bps} bps` : 'flagged' })
      )
    ));
  }
  const total = $('#risk-total');
  total.textContent = `${f.int(quote.risk_score_bps)} bps · ${quote.risk_level}`;
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
    { kind: 'down', label: t('wf_risk'), value: -risk, top: speedPrice, bottom: indicative, note: `${quote.risk_level} · −${quote.risk_discount_bps} bps` },
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
          res = await web3.mintOnChain(quote, financing);
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
    if (res.mode === 'chain') toast(t('t_minted_chain', { n: f.int(res.mintedAmount) }));
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
  const chain = res.mode === 'chain';
  box.append(
    el('div', { class: 'mint-result-head' },
      el('span', { class: `badge ${chain ? 'tone-ok' : 'tone-warn'}`, text: chain ? t('res_chain') : t('res_sim') }),
      el('span', { class: 'mint-minted' }, t('res_minted_pre') + ' ', el('strong', { text: f.int(res.mintedAmount) }), ' ' + t('res_unit_rwa'))
    ),
    el('div', { class: 'mint-result-rows' },
      mintRow(t('res_price'), `$${f.price(quote.final_issue_price_usd)} ${t('unit_per_token')}`),
      mintRow('tx_hash', f.shortHash(res.txHash, 12, 10), chain && res.explorerUrl ? res.explorerUrl : null),
      res.poolId ? mintRow('poolId', String(res.poolId)) : null,
      res.blockNumber ? mintRow('block', `#${f.int(res.blockNumber)}`) : null
    )
  );
  if (chain) {
    const balRow = mintRow(t('res_balance'), t('res_reading'));
    box.append(balRow);
    web3.readBalance(res.poolId, res.address)
      .then((bal) => { balRow.querySelector('.mint-row-v').textContent = f.int(bal); })
      .catch(() => { balRow.querySelector('.mint-row-v').textContent = '—'; });
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
  elx.textContent = real ? t('chain_deployed') : t('chain_not_deployed');
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
  toast(t('t_wallet_connected'));
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
// Wiring
// ===========================================================================
function wireStaticHandlers() {
  document.querySelectorAll('#nav .nav-tab').forEach((b) =>
    b.addEventListener('click', () => setView(b.dataset.view)));
  $('#lang-btn').addEventListener('click', () => toggleLang());
  $('#wallet-btn').addEventListener('click', onWalletClick);
  $('#mint-btn').addEventListener('click', onMint);
  $('#mint-financing').addEventListener('input', () => {
    const q = selectedQuote();
    if (q && !$('#mint-financing').disabled) renderMintReadout(q);
  });
}

boot();
