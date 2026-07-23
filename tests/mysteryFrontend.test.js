import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { Wallet } from 'ethers';
import { createRevealProof } from '../src/mystery/fairness.js';

globalThis._mockEthers = await import('ethers');
const {
  isIndependentSubscriptionAuthorized,
  verifyMysteryProof
} = await import('../public/mystery-proof.js');
const {
  assertSafePassportShareCard,
  buildPassportShareCard,
  buildPassportShareText
} = await import('../public/passport.js');

function fixture() {
  return createRevealProof({
    reveal_id: 'reveal_frontend_test',
    round_id: 'round_frontend_test',
    risk_passport_hash: `0x${'44'.repeat(32)}`,
    candidates: [
      { pool_id: 'pool-a', quote_hash: `0x${'aa'.repeat(32)}`, weight: 1 },
      { pool_id: 'pool-b', quote_hash: `0x${'bb'.repeat(32)}`, weight: 1 },
      { pool_id: 'pool-c', quote_hash: `0x${'cc'.repeat(32)}`, weight: 1 }
    ],
    server_secret: `0x${'11'.repeat(32)}`,
    user_nonce: `0x${'22'.repeat(32)}`,
    payment_tx_hash: `0x${'33'.repeat(32)}`,
    wallet_address: Wallet.createRandom().address,
    created_at: '2026-07-23T08:00:00.000Z',
    expires_at: '2026-07-23T08:10:00.000Z'
  });
}

function bindings(proof) {
  return {
    report: {
      selected_pool_id: proof.selected_pool_id,
      reveal_proof_hash: proof.reveal_proof_hash,
      risk_passport_hash: proof.risk_passport_hash
    },
    envelope: {
      selected_pool_id: proof.selected_pool_id,
      reveal_proof_hash: proof.reveal_proof_hash,
      risk_passport_hash: proof.risk_passport_hash,
      payment_tx: proof.payment_tx_hash
    }
  };
}

test('MBOX-FE-5: browser verifier reproduces the backend reveal selection', async () => {
  const proof = fixture();
  const result = await verifyMysteryProof(proof, bindings(proof));
  assert.equal(result.valid, true, result.errors.join(', '));
  assert.equal(result.summary.selected_pool_id, proof.selected_pool_id);
  assert.equal(result.summary.reveal_proof_hash, proof.reveal_proof_hash);
  assert.equal(result.summary.candidate_count, 3);
});

test('MBOX-FE-5: proof and binding tampering fails closed', async () => {
  const original = fixture();
  const tampered = [
    (proof) => { proof.server_secret = `0x${'12'.repeat(32)}`; },
    (proof) => { proof.user_nonce = `0x${'23'.repeat(32)}`; },
    (proof) => { proof.payment_tx_hash = `0x${'34'.repeat(32)}`; },
    (proof) => { proof.candidate_pool_ids[0] = 'pool-z'; },
    (proof) => { proof.candidate_quote_hashes[0] = `0x${'ab'.repeat(32)}`; },
    (proof) => { proof.disclosed_weights[0] = 2; },
    (proof) => { proof.selected_index = (proof.selected_index + 1) % 3; },
    (proof) => { proof.selected_pool_id = 'pool-z'; },
    (proof) => { proof.risk_passport_hash = `0x${'45'.repeat(32)}`; },
    (proof) => { proof.created_at = '2026-07-23T08:00:01.000Z'; }
  ];
  for (const mutate of tampered) {
    const proof = structuredClone(original);
    mutate(proof);
    const result = await verifyMysteryProof(proof, bindings(original));
    assert.equal(result.valid, false, JSON.stringify(proof));
    assert.ok(result.errors.length > 0);
  }

  const wrongReport = bindings(original);
  wrongReport.report.selected_pool_id = 'pool-z';
  assert.equal((await verifyMysteryProof(original, wrongReport)).valid, false);
  const wrongEnvelope = bindings(original);
  wrongEnvelope.envelope.payment_tx = `0x${'99'.repeat(32)}`;
  assert.equal((await verifyMysteryProof(original, wrongEnvelope)).valid, false);
});

test('MBOX-FE-6: independent subscription guard requires amount, acknowledgement and selected pool binding', () => {
  const report = { selected_pool_id: 'pool-a', risk: { stress_loss_pct: 0.4 } };
  const input = { amountUsd: 1000, acknowledged: true, report, selectedPoolId: 'pool-a' };
  assert.equal(isIndependentSubscriptionAuthorized(input), true);
  assert.equal(isIndependentSubscriptionAuthorized({ ...input, acknowledged: false }), false);
  assert.equal(isIndependentSubscriptionAuthorized({ ...input, amountUsd: 0 }), false);
  assert.equal(isIndependentSubscriptionAuthorized({ ...input, selectedPoolId: 'pool-b' }), false);
});

test('MBOX-FE-7: Passport share card uses a strict public whitelist', () => {
  const source = {
    credential_id: 'vp_safe123',
    stamp_type: 'DISCOVERY',
    voyage_id: 'VOY-1234ABCD',
    cargo_category: 'Industrial metals',
    route_label: 'Asia to Europe',
    route_code: 'ASIA-EUROPE',
    reveal_date: '2026-07-23',
    experience_mode: 'DEMO',
    verified_reveal: true,
    reveal_proof_digest: `0x${'11'.repeat(32)}`,
    report_hash: `0x${'22'.repeat(32)}`,
    artwork_variant: 'DAWN',
    verify_path: '/api/mystery/passport/vp_safe123/verify',
    wallet_address: Wallet.createRandom().address,
    amount_usd: 1_000,
    implied_yield_bps: 1200,
    risk_level: 'MEDIUM',
    exact_gps_position: '1,2',
    ebl_reference: 'BL-SECRET'
  };
  const card = buildPassportShareCard(source, { origin: 'https://agentbl.example', nickname: '  Captain   Atlas  ' });
  assert.doesNotThrow(() => assertSafePassportShareCard(card));
  assert.equal(card.nickname, 'Captain Atlas');
  assert.match(buildPassportShareText(card), /Not an RWA/u);
  const serialized = JSON.stringify(card).toLowerCase();
  for (const forbidden of ['wallet', 'amount_usd', 'yield_bps', 'risk_level', 'gps', 'ebl_reference']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('MBOX-FE-7: public transaction disclosure requires both advanced confirmations', () => {
  const source = {
    credential_id: 'vp_live123', stamp_type: 'INVESTOR_JOURNEY', voyage_id: 'VOY-LIVE1234',
    cargo_category: 'Energy cargo', route_label: 'Asia corridor', route_code: 'ASIA-ASIA',
    reveal_date: '2026-07-23', experience_mode: 'LIVE_PROTOTYPE', verified_reveal: true,
    reveal_proof_digest: `0x${'11'.repeat(32)}`, report_hash: `0x${'22'.repeat(32)}`
  };
  const options = {
    includePublicTx: true,
    publicTxHash: `0x${'33'.repeat(32)}`,
    explorerUrl: `https://explorer.injective.network/transaction/0x${'33'.repeat(32)}`
  };
  assert.equal('public_tx_hash' in buildPassportShareCard(source, options), false);
  const disclosed = buildPassportShareCard(source, { ...options, advancedConfirmed: true });
  assert.equal(disclosed.public_tx_hash, options.publicTxHash);
  assert.equal(disclosed.explorer_url, options.explorerUrl);
});

test('MBOX-FE-1~6: DOM contract includes tiers, five steps, reveal, verifier and guarded subscribe', async () => {
  const [html, css, ui] = await Promise.all([
    fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/styles.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/mystery.js', import.meta.url), 'utf8')
  ]);
  assert.equal((html.match(/name="mystery-tier"/gu) ?? []).length, 3);
  for (const id of ['mystery-step-commit', 'mystery-step-challenge', 'mystery-step-settlement', 'mystery-step-reveal', 'mystery-step-verify']) {
    assert.match(html, new RegExp(`id="${id}"`, 'u'));
  }
  for (const id of ['mystery-cargo-image', 'mystery-proof-json', 'mystery-view-report-btn', 'mystery-subscribe-btn', 'mystery-risk-ack']) {
    assert.match(html, new RegExp(`id="${id}"`, 'u'));
  }
  for (const id of ['passport-collection', 'passport-collection-grid', 'mystery-claim-discovery-btn', 'mystery-claim-journey-btn', 'passport-share-modal', 'passport-advanced-share', 'passport-advanced-confirm', 'passport-export-json', 'passport-export-png', 'passport-print']) {
    assert.match(html, new RegExp(`id="${id}"`, 'u'));
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(css, /@media \(max-width: 420px\)/u);
  const secondSignature = ui.indexOf('subscriptionSignature = await mysteryState.signer.signMessage');
  const subscribeCall = ui.indexOf("fetchJson('/api/pool/subscribe'");
  assert.ok(secondSignature >= 0 && subscribeCall > secondSignature, 'pool subscribe must follow the second signature');
  const claimSignature = ui.indexOf('const signature = await wallet.signMessage(message)');
  const claimCall = ui.indexOf("/passport/claim`");
  assert.ok(claimSignature >= 0 && claimCall > claimSignature, 'Passport claim API must follow the wallet signature');
  assert.match(ui, /mystery_source:\s*\{[^]*reveal_id:\s*report\.reveal_id[^]*selected_pool_id:\s*report\.selected_pool_id[^]*reveal_proof_hash:\s*report\.reveal_proof_hash/u);
  assert.match(ui, /onclick:\s*\(\)\s*=>\s*openPassportShare/u);
  assert.match(ui, /payment\.live === true[^]*payment\.explorerUrl/u);
});
