import { state } from './store.js';
import { $, el, clear, toast } from './dom.js';
import { t, tData } from './i18n.js';
import * as web3 from './web3.js';
import { isIndependentSubscriptionAuthorized, verifyMysteryProof } from './mystery-proof.js';

const TIER_META = Object.freeze({
  CONSERVATIVE: { riskBps: 500, yieldRange: '3-8%', stressLossPct: 0.25 },
  BALANCED: { riskBps: 1000, yieldRange: '5-14%', stressLossPct: 0.5 },
  ADVENTUROUS: { riskBps: 1500, yieldRange: '8-22%', stressLossPct: 0.75 }
});

const mysteryState = {
  initialized: false,
  tier: 'BALANCED',
  preview: null,
  signer: null,
  report: null,
  canonicalProof: null,
  proofValid: false,
  proofVersion: 0,
  subscriptionSignature: null
};

function tierMeta() {
  return TIER_META[mysteryState.tier] ?? TIER_META.BALANCED;
}

function selectedTier() {
  return document.querySelector('input[name="mystery-tier"]:checked')?.value ?? 'BALANCED';
}

function formatPct(value, digits = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)}%` : '—';
}

function formatUsd(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: digits }).format(number)
    : '—';
}

function shortHash(value, start = 10, end = 8) {
  const text = String(value ?? '');
  return text.length > start + end + 1 ? `${text.slice(0, start)}…${text.slice(-end)}` : text || '—';
}

function randomHex32() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function cargoImage(category) {
  const cargo = String(category ?? '').toLowerCase();
  if (/copper|铜/u.test(cargo)) return '/img/cargo/copper.jpg';
  if (/oil|petroleum|原油|成品油/u.test(cargo)) return '/img/cargo/oil.jpg';
  if (/iron|ore|矿/u.test(cargo)) return '/img/cargo/ore.jpg';
  if (/rubber|橡胶/u.test(cargo)) return '/img/cargo/rubber.jpg';
  if (/soy|大豆/u.test(cargo)) return '/img/cargo/soybean.jpg';
  return '/img/cargo/alu.jpg';
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || body.message || `${url} returned ${response.status}`);
    error.status = response.status;
    error.code = body.code;
    error.details = body.details;
    throw error;
  }
  return { response, body };
}

async function resolveSigner() {
  const connected = web3.connectedAddress();
  const provider = web3.getEthereumProvider();
  if (connected && provider && /^0x[0-9a-fA-F]{40}$/u.test(connected)) {
    return {
      address: connected,
      demo: false,
      signMessage: (message) => provider.request({ method: 'personal_sign', params: [message, connected] })
    };
  }
  if (!state.demoMode) throw new Error(t('mystery_evm_wallet_required'));
  if (!mysteryState.signer?.demo) {
    const { Wallet } = await web3.loadEthers();
    const wallet = Wallet.createRandom();
    mysteryState.signer = {
      address: wallet.address,
      demo: true,
      signMessage: wallet.signMessage.bind(wallet)
    };
  }
  return mysteryState.signer;
}

function setStep(stepId, status = 'pending', label = '—') {
  const step = $(`#mystery-step-${stepId}`);
  if (!step) return;
  step.classList.remove('is-active', 'is-done', 'is-error');
  if (status !== 'pending') step.classList.add(`is-${status}`);
  const statusNode = step.querySelector('.x402-step-status');
  if (statusNode) statusNode.textContent = label;
}

function resetSteps() {
  ['commit', 'challenge', 'settlement', 'reveal', 'verify'].forEach((step) => setStep(step));
}

function renderModeNote() {
  const note = $('#mystery-mode-note');
  if (!note) return;
  note.textContent = state.demoMode ? t('mystery_demo_mode') : t('mystery_live_mode');
  note.className = `mystery-mode-note ${state.demoMode ? 'demo' : 'live'}`;
}

export function renderMysteryExperience() {
  mysteryState.tier = selectedTier();
  const meta = tierMeta();
  const entryYield = $('#mystery-entry-yield');
  const entryLoss = $('#mystery-entry-loss');
  if (entryYield) entryYield.textContent = meta.yieldRange;
  if (entryLoss) entryLoss.textContent = `5%–${formatPct(meta.stressLossPct)}`;
  renderModeNote();
  if (mysteryState.preview) renderCommittedPreview();
  if (mysteryState.report) renderReport(mysteryState.report);
}

function renderCommittedPreview() {
  const preview = mysteryState.preview;
  const meta = tierMeta();
  if (!preview) return;
  $('#mystery-candidate-count').textContent = String(preview.candidate_count);
  $('#mystery-odds').textContent = t('mystery_equal_odds', { n: preview.candidate_count });
  $('#mystery-risk-boundary').textContent = `0–${meta.riskBps.toLocaleString()} bps`;
  $('#mystery-yield-boundary').textContent = meta.yieldRange;
  $('#mystery-loss-boundary').textContent = `5%–${formatPct(meta.stressLossPct)}`;
  $('#mystery-server-commitment').textContent = shortHash(preview.server_commitment, 16, 10);
  $('#mystery-candidate-hash').textContent = shortHash(preview.candidate_set_hash, 16, 10);
  $('#mystery-payment-note').textContent = state.demoMode
    ? t('mystery_demo_receipt_note')
    : t('mystery_live_settlement_note');
  setStep('commit', 'done', t('mystery_frozen'));
}

async function createPreview() {
  const button = $('#mystery-preview-btn');
  const original = button?.textContent;
  if (button) { button.disabled = true; button.textContent = t('mystery_committing'); }
  try {
    mysteryState.tier = selectedTier();
    mysteryState.signer = await resolveSigner();
    const idempotencyKey = `web-${state.modeGeneration}-${crypto.randomUUID?.() ?? randomHex32().slice(2)}`;
    const { body } = await fetchJson('/api/mystery/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address: mysteryState.signer.address,
        idempotency_key: idempotencyKey,
        risk_passport: { tier: mysteryState.tier }
      })
    });
    mysteryState.preview = body;
    mysteryState.report = null;
    mysteryState.canonicalProof = null;
    mysteryState.proofValid = false;
    resetSteps();
    renderCommittedPreview();
    $('#mystery-preopen').hidden = false;
    $('#mystery-reveal').hidden = true;
    $('#mystery-risk-passport').hidden = true;
    $('#mystery-proof-tool').hidden = true;
    $('#mystery-post-actions').hidden = true;
    const modal = $('#mystery-modal');
    if (modal && !modal.open) modal.showModal();
  } catch (error) {
    toast(error.message, true);
  } finally {
    if (button) { button.disabled = false; button.textContent = original || t('mystery_preview_btn'); }
  }
}

function setPaymentNote(message, tone = '') {
  const note = $('#mystery-payment-note');
  if (!note) return;
  note.textContent = message;
  note.className = `muted ${tone}`.trim();
}

async function openMysteryVoyage() {
  if (!mysteryState.preview || !mysteryState.signer) return;
  const button = $('#mystery-open-btn');
  if (button) button.disabled = true;
  const userNonce = randomHex32();
  try {
    setStep('challenge', 'active', t('mystery_requesting_402'));
    setPaymentNote(t('mystery_requesting_402'));
    const endpoint = '/api/x402/mystery/voyage';
    const unpaid = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ reveal_id: mysteryState.preview.reveal_id, user_nonce: userNonce })
    });
    const challenge = await unpaid.json().catch(() => ({}));
    if (unpaid.status !== 402 || !challenge.challenge || !challenge.nonce) {
      throw new Error(challenge.error || t('mystery_live_v2_required'));
    }
    setStep('challenge', 'done', 'HTTP 402');
    setStep('settlement', 'active', t('mystery_signing_payment'));
    setPaymentNote(t('mystery_signing_payment'));

    const signature = await mysteryState.signer.signMessage(challenge.challenge);
    const paid = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X402-Signature': signature,
        'X402-Signer': mysteryState.signer.address
      },
      body: JSON.stringify({
        reveal_id: mysteryState.preview.reveal_id,
        user_nonce: userNonce,
        nonce: challenge.nonce
      })
    });
    const report = await paid.json().catch(() => ({}));
    if (!paid.ok) throw new Error(report.error || t('mystery_payment_failed'));
    mysteryState.report = report;
    setStep('settlement', 'done', report.payment?.live ? t('mystery_onchain') : t('mystery_demo_receipt'));
    setStep('reveal', 'active', t('mystery_opening'));
    renderReveal(report);
    const reveal = $('#mystery-reveal');
    reveal.hidden = false;
    requestAnimationFrame(() => reveal.classList.add('is-opening'));
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : 1250));
    reveal.classList.add('is-open');
    setStep('reveal', 'done', t('mystery_revealed'));
    $('#mystery-preopen').hidden = true;
    renderReport(report);
    await loadAndVerifyProof();
  } catch (error) {
    const stage = $('#mystery-step-settlement')?.classList.contains('is-active') ? 'settlement' : 'challenge';
    setStep(stage, 'error', t('mystery_failed'));
    setPaymentNote(error.message, 'tone-crit');
    toast(error.message, true);
  } finally {
    if (button) button.disabled = false;
  }
}

function renderReveal(report) {
  const cargo = report.cargo ?? {};
  const risk = report.risk ?? {};
  const image = $('#mystery-cargo-image');
  if (image) {
    image.src = cargoImage(cargo.category);
    image.alt = tData(cargo.category || t('mystery_trade_cargo'));
  }
  $('#mystery-cargo-name').textContent = tData(cargo.category || t('mystery_trade_cargo'));
  $('#mystery-port-from').textContent = tData(cargo.port_of_loading || '—');
  $('#mystery-port-to').textContent = tData(cargo.port_of_discharge || '—');
  const badge = $('#mystery-risk-badge');
  badge.textContent = `${risk.level ?? '—'} · ${Number(risk.score_bps ?? 0).toLocaleString()} bps`;
  badge.className = `badge mystery-risk-${String(risk.level ?? '').toLowerCase()} risk-pulse`;
}

function replaceList(node, items, fallback) {
  clear(node);
  const values = Array.isArray(items) && items.length ? items : [fallback];
  values.forEach((item) => node.append(el('li', { text: String(item) })));
}

function renderPaymentEvidence(report) {
  const target = $('#mystery-report-payment');
  if (!target) return;
  clear(target);
  const payment = report.payment ?? {};
  const tx = payment.txHash || report.proof?.payment_tx_hash;
  if (payment.live === true && /^0x[0-9a-fA-F]{64}$/u.test(String(tx)) && payment.explorerUrl) {
    target.append(el('a', { href: payment.explorerUrl, target: '_blank', rel: 'noopener', text: `${shortHash(tx)} ↗` }));
  } else {
    target.textContent = `${t('mystery_demo_receipt')} · ${shortHash(tx)}`;
  }
}

function renderReport(report) {
  if (!report) return;
  const cargo = report.cargo ?? {};
  const pricing = report.pricing ?? {};
  const risk = report.risk ?? {};
  const suitability = report.suitability ?? {};
  $('#mystery-risk-passport').hidden = false;
  $('#mystery-report-route').textContent = `${tData(cargo.port_of_loading || '—')} → ${tData(cargo.port_of_discharge || '—')}`;
  $('#mystery-match-badge').textContent = suitability.matched ? t('mystery_passport_match') : t('mystery_passport_mismatch');
  $('#mystery-match-badge').className = `badge ${suitability.matched ? 'tone-ok' : 'tone-crit'}`;
  $('#mystery-report-price').textContent = formatUsd(pricing.issue_price_usd, 3);
  $('#mystery-report-yield').textContent = `${(Number(pricing.implied_gross_yield_bps ?? 0) / 100).toFixed(2)}%`;
  $('#mystery-report-recovery').textContent = formatUsd(risk.stress_recovery_per_token_usd, 3);
  $('#mystery-report-coverage').textContent = `${Number(report.collateral?.coverage_ratio ?? 0).toFixed(2)}x`;
  $('#mystery-report-freshness').textContent = `${report.evidence_freshness?.status ?? '—'} · ${Number(report.evidence_freshness?.age_seconds ?? 0).toFixed(0)}s`;
  renderPaymentEvidence(report);
  replaceList($('#mystery-report-reasons'), suitability.reasons, t('mystery_no_match_reason'));
  replaceList($('#mystery-report-risks'), risk.factors, t('mystery_no_risk_factor'));
  $('#mystery-non-guarantee').textContent = report.non_guarantee_notice || t('mystery_non_guarantee');
  $('#mystery-post-actions').hidden = false;
  $('#mystery-subscribe-btn').disabled = !mysteryState.proofValid;
}

async function loadAndVerifyProof() {
  setStep('verify', 'active', t('mystery_verifying'));
  const { body } = await fetchJson(`/api/mystery/${encodeURIComponent(mysteryState.preview.reveal_id)}/proof`);
  mysteryState.canonicalProof = body.proof;
  const textarea = $('#mystery-proof-json');
  textarea.value = JSON.stringify(body.proof, null, 2);
  $('#mystery-proof-tool').hidden = false;
  await verifyEditedProof();
}

async function verifyEditedProof() {
  const version = ++mysteryState.proofVersion;
  const status = $('#mystery-proof-status');
  status.textContent = t('mystery_verifying');
  status.className = 'mystery-proof-status checking';
  let proof;
  try {
    proof = JSON.parse($('#mystery-proof-json').value);
  } catch (error) {
    renderProofResult({ valid: false, errors: [`JSON: ${error.message}`], summary: null }, version);
    return;
  }
  const result = await verifyMysteryProof(proof, {
    report: mysteryState.report,
    envelope: mysteryState.report?.report_envelope
  });
  renderProofResult(result, version);
}

function renderProofResult(result, version) {
  if (version !== mysteryState.proofVersion) return;
  const status = $('#mystery-proof-status');
  const summary = $('#mystery-proof-summary');
  clear(summary);
  if (!result.valid) {
    mysteryState.proofValid = false;
    $('#mystery-subscribe-btn').disabled = true;
    status.textContent = t('mystery_proof_failed');
    status.className = 'mystery-proof-status failed';
    setStep('verify', 'error', t('mystery_fail_closed'));
    result.errors.forEach((error) => summary.append(el('div', { class: 'mystery-proof-error', text: error })));
    return;
  }
  mysteryState.proofValid = true;
  $('#mystery-subscribe-btn').disabled = false;
  status.textContent = t('mystery_proof_valid');
  status.className = 'mystery-proof-status valid';
  setStep('verify', 'done', t('mystery_verified'));
  const fields = [
    [t('mystery_selected_pool'), result.summary.selected_pool_id],
    [t('mystery_candidate_count'), result.summary.candidate_count],
    [t('mystery_selection_hash'), shortHash(result.summary.selection_hash, 16, 10)],
    [t('mystery_proof_hash'), shortHash(result.summary.reveal_proof_hash, 16, 10)],
    [t('mystery_payment_binding'), shortHash(result.summary.payment_tx_hash, 16, 10)]
  ];
  fields.forEach(([label, value]) => summary.append(
    el('div', {}, el('span', { text: label }), el('strong', { text: String(value) }))
  ));
}

function resetProof() {
  if (!mysteryState.canonicalProof) return;
  $('#mystery-proof-json').value = JSON.stringify(mysteryState.canonicalProof, null, 2);
  verifyEditedProof();
}

function updateSubscriptionConfirmation() {
  const report = mysteryState.report;
  if (!report) return;
  const amount = Number($('#mystery-subscribe-amount').value);
  const loss = amount * Number(report.risk?.stress_loss_pct ?? 1);
  $('#mystery-confirm-pool').textContent = String(report.selected_pool_id ?? '—');
  $('#mystery-confirm-risk').textContent = `${report.risk?.level ?? '—'} · ${Number(report.risk?.score_bps ?? 0).toLocaleString()} bps`;
  $('#mystery-confirm-loss').textContent = formatUsd(loss, 0);
  $('#mystery-confirm-subscribe').disabled = !isIndependentSubscriptionAuthorized({
    amountUsd: amount,
    acknowledged: $('#mystery-risk-ack').checked,
    report,
    selectedPoolId: report.selected_pool_id
  });
}

function openSubscriptionConfirmation() {
  if (!mysteryState.report || !mysteryState.proofValid) {
    toast(t('mystery_proof_failed'), true);
    return;
  }
  $('#mystery-risk-ack').checked = false;
  $('#mystery-subscribe-result').textContent = '';
  mysteryState.subscriptionSignature = null;
  updateSubscriptionConfirmation();
  const dialog = $('#mystery-subscribe-modal');
  if (!dialog.open) dialog.showModal();
}

function subscriptionAuthorizationMessage(amountUsd) {
  const report = mysteryState.report;
  return [
    'AgentBL Independent RWA Subscription Authorization',
    `Pool: ${report.selected_pool_id}`,
    `Amount USD: ${amountUsd}`,
    `Risk: ${report.risk?.level} (${report.risk?.score_bps} bps)`,
    `Stress loss: ${formatPct(report.risk?.stress_loss_pct, 2)}`,
    `Reveal proof: ${report.reveal_proof_hash}`,
    'This authorization is independent from the Mystery Voyage report purchase.'
  ].join('\n');
}

async function confirmSubscription(event) {
  event.preventDefault();
  const report = mysteryState.report;
  const amountUsd = Number($('#mystery-subscribe-amount').value);
  const authorized = isIndependentSubscriptionAuthorized({
    amountUsd,
    acknowledged: $('#mystery-risk-ack').checked,
    report,
    selectedPoolId: report?.selected_pool_id
  });
  if (!authorized) return;
  const button = $('#mystery-confirm-subscribe');
  button.disabled = true;
  $('#mystery-subscribe-result').textContent = t('mystery_signing_subscription');
  try {
    // The pool API is called only after this independent second signature succeeds.
    mysteryState.subscriptionSignature = await mysteryState.signer.signMessage(subscriptionAuthorizationMessage(amountUsd));
    const { body } = await fetchJson('/api/pool/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address: mysteryState.signer.address,
        pool_id: report.selected_pool_id,
        amount_usd: amountUsd
      })
    });
    $('#mystery-subscribe-result').textContent = t('mystery_subscription_success', { tx: shortHash(body.txHash) });
    $('#mystery-subscribe-result').className = 'tone-ok';
    window.dispatchEvent(new CustomEvent('agentbl:portfoliochange'));
    toast(t('mystery_subscription_complete'));
  } catch (error) {
    $('#mystery-subscribe-result').textContent = error.message;
    $('#mystery-subscribe-result').className = 'tone-crit';
    updateSubscriptionConfirmation();
  }
}

export function resetMysteryExperience(options = {}) {
  mysteryState.preview = null;
  mysteryState.report = null;
  mysteryState.canonicalProof = null;
  mysteryState.proofValid = false;
  mysteryState.subscriptionSignature = null;
  if (!options.preserveSigner) mysteryState.signer = null;
  resetSteps();
  const modal = $('#mystery-modal');
  const subscribeModal = $('#mystery-subscribe-modal');
  if (modal?.open) modal.close();
  if (subscribeModal?.open) subscribeModal.close();
  renderMysteryExperience();
}

export function initMysteryExperience() {
  if (mysteryState.initialized) return;
  mysteryState.initialized = true;
  document.querySelectorAll('input[name="mystery-tier"]').forEach((input) => {
    input.addEventListener('change', () => {
      mysteryState.tier = selectedTier();
      resetMysteryExperience({ preserveSigner: true });
    });
  });
  $('#mystery-preview-btn')?.addEventListener('click', createPreview);
  $('#mystery-open-btn')?.addEventListener('click', openMysteryVoyage);
  $('#mystery-proof-json')?.addEventListener('input', verifyEditedProof);
  $('#mystery-proof-reset')?.addEventListener('click', resetProof);
  $('#mystery-view-report-btn')?.addEventListener('click', () => $('#mystery-risk-passport')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  $('#mystery-subscribe-btn')?.addEventListener('click', openSubscriptionConfirmation);
  $('#mystery-subscribe-close')?.addEventListener('click', () => $('#mystery-subscribe-modal')?.close());
  $('#mystery-subscribe-amount')?.addEventListener('input', updateSubscriptionConfirmation);
  $('#mystery-risk-ack')?.addEventListener('change', updateSubscriptionConfirmation);
  $('#mystery-subscribe-form')?.addEventListener('submit', confirmSubscription);
  renderMysteryExperience();
}
