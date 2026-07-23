import { state } from './store.js';
import { $, el, clear, toast } from './dom.js';
import { t, tData } from './i18n.js';
import * as web3 from './web3.js';
import { isIndependentSubscriptionAuthorized, verifyMysteryProof } from './mystery-proof.js';
import {
  assertSafePassportShareCard,
  buildPassportShareCard,
  buildPassportShareText,
  shortPassportDigest
} from './passport.js';

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
  subscriptionSignature: null,
  subscription: null,
  passports: [],
  selectedPassport: null,
  shareCard: null,
  showHiddenPassports: false
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

function passportWallet() {
  return mysteryState.signer?.address || web3.connectedAddress() || '';
}

function passportClaimMessage(stampType, walletAddress, revealProofHash, revealId) {
  return [
    'AgentBL Voyage Passport Claim',
    `Reveal: ${String(revealId)}`,
    `Stamp: ${String(stampType)}`,
    `Wallet: ${String(walletAddress).toLowerCase()}`,
    `Proof: ${String(revealProofHash).toLowerCase()}`,
    'This credential is non-transferable and carries no investment or cargo rights.'
  ].join('\n');
}

function hiddenPassportIds() {
  try { return new Set(JSON.parse(localStorage.getItem('agentbl_hidden_passports') || '[]')); } catch { return new Set(); }
}

function saveHiddenPassportIds(ids) {
  try { localStorage.setItem('agentbl_hidden_passports', JSON.stringify([...ids])); } catch { /* private mode */ }
}

function passportIsDemo(credential) {
  return String(credential?.experience_mode ?? '').toUpperCase() === 'DEMO';
}

function passportStampLabel(stampType) {
  return stampType === 'INVESTOR_JOURNEY' ? t('passport_stamp_investor') : t('passport_stamp_discovery');
}

function passportStampIcon(stampType) {
  return stampType === 'INVESTOR_JOURNEY' ? '◆' : '✦';
}

function passportShareOrigin() {
  return window.location.origin;
}

function renderPassportCollection() {
  const grid = $('#passport-collection-grid');
  const empty = $('#passport-collection-empty');
  const count = $('#passport-collection-count');
  if (!grid || !empty) return;
  clear(grid);
  const hidden = hiddenPassportIds();
  const visible = mysteryState.passports.filter((credential) => mysteryState.showHiddenPassports || !hidden.has(credential.credential_id));
  if (count) count.textContent = String(visible.length);
  empty.hidden = visible.length > 0;
  visible.forEach((credential) => {
    const share = credential.share ?? credential;
    let card;
    try { card = buildPassportShareCard(share, { origin: passportShareOrigin() }); } catch { return; }
    const stamp = credential.stamp_type ?? card.stamp_type;
    const article = el('article', { class: `passport-card passport-${stamp.toLowerCase()}` });
    article.append(
      el('div', { class: 'passport-card-art', 'aria-hidden': 'true' },
        el('span', { class: 'passport-card-symbol', text: passportStampIcon(stamp) }),
        el('span', { class: 'passport-card-artwork', text: String(card.artwork_variant || 'DAWN') })
      ),
      el('div', { class: 'passport-card-body' },
        el('div', { class: 'passport-card-heading' },
          el('span', { class: 'passport-stamp-label', text: `${passportStampIcon(stamp)} ${passportStampLabel(stamp)}` }),
          el('span', { class: `passport-status ${card.verified_reveal ? 'verified' : 'revoked'}`, text: card.verified_reveal ? t('passport_verified') : t('passport_revoked') })
        ),
        el('h3', { text: card.voyage_id }),
        el('p', { class: 'passport-route', text: `${card.cargo_category} · ${card.route_label}` }),
        el('div', { class: 'passport-card-meta' },
          el('span', { text: `${t('passport_reveal_date')}: ${card.reveal_date || '—'}` }),
          el('code', { text: shortPassportDigest(card.credential_id) })
        ),
        el('p', { class: 'passport-card-notice', text: t('passport_fixed_disclaimer') }),
        el('div', { class: 'passport-card-actions' },
          el('button', { class: 'btn ghost sm', type: 'button', text: t('passport_share'), onclick: () => openPassportShare(credential) }),
          el('a', { class: 'btn ghost sm', href: card.verify_url, target: '_blank', rel: 'noopener', text: t('passport_verify') }),
          el('button', { class: 'btn ghost sm', type: 'button', text: hidden.has(card.credential_id) ? t('passport_unhide') : t('passport_hide'), onclick: () => togglePassportHidden(card.credential_id) })
        )
      )
    );
    grid.append(article);
  });
}

async function loadPassportCollection(wallet = passportWallet()) {
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/u.test(wallet)) return;
  try {
    const { body } = await fetchJson(`/api/mystery/passports?wallet_address=${encodeURIComponent(wallet)}`);
    mysteryState.passports = Array.isArray(body.credentials) ? body.credentials : [];
    renderPassportCollection();
  } catch (error) {
    if (error.status !== 404) toast(error.message, true);
  }
}

function togglePassportHidden(credentialId) {
  const ids = hiddenPassportIds();
  if (ids.has(credentialId)) ids.delete(credentialId); else ids.add(credentialId);
  saveHiddenPassportIds(ids);
  renderPassportCollection();
}

async function claimPassport(stampType) {
  if (!mysteryState.report || !mysteryState.proofValid) {
    toast(t('mystery_proof_failed'), true);
    return;
  }
  const wallet = await resolveSigner();
  const button = stampType === 'INVESTOR_JOURNEY' ? $('#mystery-claim-journey-btn') : $('#mystery-claim-discovery-btn');
  if (button) button.disabled = true;
  try {
    const message = passportClaimMessage(
      stampType,
      wallet.address,
      mysteryState.report.reveal_proof_hash,
      mysteryState.report.reveal_id
    );
    const signature = await wallet.signMessage(message);
    const { body } = await fetchJson(`/api/mystery/${encodeURIComponent(mysteryState.report.reveal_id)}/passport/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: wallet.address, stamp_type: stampType, claim_signature: signature })
    });
    const credential = body.credential;
    if (credential) {
      const publicPayment = mysteryState.report?.payment?.live === true
        ? { txHash: mysteryState.report.payment.txHash, explorerUrl: mysteryState.report.payment.explorerUrl }
        : null;
      mysteryState.passports = [...mysteryState.passports.filter((item) => item.credential_id !== credential.credential_id), { ...credential, share: body.share, _publicPayment: publicPayment }];
      renderPassportCollection();
      if (stampType === 'DISCOVERY') $('#mystery-claim-discovery-btn').textContent = t('passport_claimed');
      if (stampType === 'INVESTOR_JOURNEY') $('#mystery-claim-journey-btn').textContent = t('passport_claimed');
      toast(t('passport_claim_success'));
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    if (button) button.disabled = false;
  }
}

function openPassportShare(credential) {
  mysteryState.selectedPassport = credential;
  const nickname = $('#passport-share-nickname');
  const advanced = $('#passport-advanced-share');
  const confirm = $('#passport-advanced-confirm');
  if (nickname) nickname.value = '';
  if (advanced) { advanced.checked = false; advanced.disabled = passportIsDemo(credential) || !credential._publicPayment; }
  if (confirm) { confirm.checked = false; confirm.disabled = true; }
  const advancedNote = $('#passport-advanced-note');
  if (advancedNote) advancedNote.textContent = (passportIsDemo(credential) || !credential._publicPayment) ? t('passport_advanced_unavailable') : t('passport_advanced_note');
  renderPassportSharePreview();
  const dialog = $('#passport-share-modal');
  if (dialog && !dialog.open) dialog.showModal();
}

function renderPassportSharePreview() {
  const credential = mysteryState.selectedPassport;
  if (!credential) return;
  const includePublicTx = Boolean($('#passport-advanced-share')?.checked && $('#passport-advanced-confirm')?.checked);
  const payment = credential._publicPayment ?? {};
  const card = buildPassportShareCard(credential.share ?? credential, {
    origin: passportShareOrigin(),
    nickname: $('#passport-share-nickname')?.value,
    includePublicTx,
    advancedConfirmed: includePublicTx,
    publicTxHash: payment.txHash,
    explorerUrl: payment.explorerUrl
  });
  assertSafePassportShareCard(card);
  mysteryState.shareCard = card;
  const preview = $('#passport-share-preview');
  if (preview) preview.textContent = buildPassportShareText(card);
  const json = $('#passport-json-preview');
  if (json) json.value = JSON.stringify(card, null, 2);
}

function downloadBlob(name, type, content) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = el('a', { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportPassportJson() {
  if (!mysteryState.shareCard) renderPassportSharePreview();
  downloadBlob(`${mysteryState.shareCard?.credential_id || 'voyage-passport'}.json`, 'application/json', JSON.stringify(mysteryState.shareCard, null, 2));
}

function exportPassportPng() {
  const card = mysteryState.shareCard;
  if (!card) return;
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 760;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f5b942'; ctx.font = '700 34px system-ui'; ctx.fillText(`${passportStampIcon(card.stamp_type)} ${passportStampLabel(card.stamp_type)}`, 70, 90);
  ctx.fillStyle = '#f3f5f7'; ctx.font = '700 58px system-ui'; ctx.fillText(card.voyage_id, 70, 180);
  ctx.fillStyle = '#aab4c2'; ctx.font = '28px system-ui'; ctx.fillText(`${card.cargo_category} · ${card.route_label}`, 70, 240);
  ctx.fillText(`${card.experience_mode} · ${card.reveal_date}`, 70, 300);
  ctx.fillStyle = '#f3f5f7'; ctx.font = '22px system-ui';
  const lines = ctx.measureText(card.notice).width > 1000 ? [card.notice.slice(0, 85), card.notice.slice(85)] : [card.notice];
  lines.forEach((line, index) => ctx.fillText(line, 70, 625 + index * 30));
  const link = el('a', { href: canvas.toDataURL('image/png'), download: `${card.credential_id || 'voyage-passport'}.png` });
  link.click();
}

function printPassport() {
  if (!mysteryState.shareCard) renderPassportSharePreview();
  window.print();
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
    mysteryState.subscription = null;
    resetSteps();
    renderCommittedPreview();
    $('#mystery-preopen').hidden = false;
    $('#mystery-reveal').hidden = true;
    $('#mystery-risk-passport').hidden = true;
    $('#mystery-proof-tool').hidden = true;
    $('#mystery-post-actions').hidden = true;
    await loadPassportCollection(mysteryState.signer.address);
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
  const discoveryClaim = $('#mystery-claim-discovery-btn');
  const journeyClaim = $('#mystery-claim-journey-btn');
  if (discoveryClaim) discoveryClaim.disabled = !mysteryState.proofValid;
  if (journeyClaim) {
    journeyClaim.hidden = !mysteryState.subscription;
    journeyClaim.disabled = !mysteryState.proofValid || !mysteryState.subscription;
  }
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
    $('#mystery-claim-discovery-btn').disabled = true;
    $('#mystery-claim-journey-btn').disabled = true;
    status.textContent = t('mystery_proof_failed');
    status.className = 'mystery-proof-status failed';
    setStep('verify', 'error', t('mystery_fail_closed'));
    result.errors.forEach((error) => summary.append(el('div', { class: 'mystery-proof-error', text: error })));
    return;
  }
  mysteryState.proofValid = true;
  $('#mystery-subscribe-btn').disabled = false;
  $('#mystery-claim-discovery-btn').disabled = false;
  if (mysteryState.subscription) $('#mystery-claim-journey-btn').disabled = false;
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
        amount_usd: amountUsd,
        mystery_source: {
          reveal_id: report.reveal_id,
          selected_pool_id: report.selected_pool_id,
          reveal_proof_hash: report.reveal_proof_hash
        }
      })
    });
    mysteryState.subscription = body;
    $('#mystery-subscribe-result').textContent = t('mystery_subscription_success', { tx: shortHash(body.txHash) });
    $('#mystery-subscribe-result').className = 'tone-ok';
    window.dispatchEvent(new CustomEvent('agentbl:portfoliochange'));
    $('#mystery-claim-journey-btn').hidden = false;
    $('#mystery-claim-journey-btn').disabled = !mysteryState.proofValid;
    await loadPassportCollection(mysteryState.signer.address);
    $('#mystery-subscribe-modal')?.close();
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
  mysteryState.subscription = null;
  if (!options.preserveSigner) mysteryState.signer = null;
  resetSteps();
  const modal = $('#mystery-modal');
  const subscribeModal = $('#mystery-subscribe-modal');
  if (modal?.open) modal.close();
  if (subscribeModal?.open) subscribeModal.close();
  renderMysteryExperience();
  renderPassportCollection();
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
  $('#mystery-confirm-subscribe')?.addEventListener('click', confirmSubscription);
  $('#mystery-claim-discovery-btn')?.addEventListener('click', () => claimPassport('DISCOVERY'));
  $('#mystery-claim-journey-btn')?.addEventListener('click', () => claimPassport('INVESTOR_JOURNEY'));
  $('#passport-refresh-btn')?.addEventListener('click', () => loadPassportCollection());
  $('#passport-show-hidden')?.addEventListener('change', (event) => { mysteryState.showHiddenPassports = event.target.checked; renderPassportCollection(); });
  $('#passport-share-nickname')?.addEventListener('input', renderPassportSharePreview);
  $('#passport-advanced-share')?.addEventListener('change', (event) => {
    const confirm = $('#passport-advanced-confirm');
    if (confirm) { confirm.disabled = !event.target.checked; if (!event.target.checked) confirm.checked = false; }
    renderPassportSharePreview();
  });
  $('#passport-advanced-confirm')?.addEventListener('change', renderPassportSharePreview);
  $('#passport-export-json')?.addEventListener('click', exportPassportJson);
  $('#passport-export-png')?.addEventListener('click', exportPassportPng);
  $('#passport-print')?.addEventListener('click', printPassport);
  $('#passport-share-close')?.addEventListener('click', () => $('#passport-share-modal')?.close());
  $('#passport-share-copy')?.addEventListener('click', async () => {
    if (!mysteryState.shareCard) renderPassportSharePreview();
    try { await navigator.clipboard.writeText(buildPassportShareText(mysteryState.shareCard)); toast(t('passport_copied')); }
    catch { toast(t('passport_copy_failed'), true); }
  });
  renderMysteryExperience();
  renderPassportCollection();
}
