import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { Wallet } from 'ethers';
import { resetStore, storeState } from '../src/app/store.js';
import { createUserNonce } from '../src/mystery/fairness.js';
import { passportClaimMessage } from '../src/mystery/passport.js';
import { resetDefaultMysteryRevealStore } from '../src/mystery/store.js';
import { createPaidFetch } from '../src/x402/client.js';
import { assertPaidReportEnvelope } from '../src/x402/paidReport.js';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbl-mystery-api-'));
process.env.MYSTERY_STORE_PATH = path.join(directory, 'reveals.json');
process.env.DEMO_MODE = 'true';

const { createServer } = await import('../src/app/server.js');
let server;
let baseUrl;

before(async () => {
  resetStore();
  resetDefaultMysteryRevealStore();
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(directory, { recursive: true, force: true });
});

async function preview(wallet, idempotencyKey) {
  const response = await fetch(`${baseUrl}/api/mystery/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      wallet_address: wallet.address,
      idempotency_key: idempotencyKey,
      risk_passport: { tier: 'ADVENTUROUS' }
    })
  });
  return { response, body: await response.json() };
}

async function paidReveal(wallet, previewBody, userNonce = createUserNonce()) {
  const paidFetch = createPaidFetch({ signer: wallet, demoMode: true, budgetUSDC: 0.005, timeoutMs: 30_000 });
  const response = await paidFetch(`${baseUrl}/api/x402/mystery/voyage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reveal_id: previewBody.reveal_id, user_nonce: userNonce })
  });
  return { response, body: await response.json(), userNonce };
}

test('MBOX-BE-5/X402-1/2/AI-1: preview → 402 → paid reveal → public proof is verifiable', async () => {
  const wallet = Wallet.createRandom();
  const created = await preview(wallet, 'api-happy-path');
  assert.equal(created.response.status, 201);
  assert.equal(created.body.state, 'COMMITTED');
  assert.ok(created.body.candidate_count > 0);
  assert.match(created.body.candidate_set_hash, /^0x[0-9a-f]{64}$/u);
  assert.match(created.body.server_commitment, /^0x[0-9a-f]{64}$/u);
  assert.equal('server_secret' in created.body, false);
  assert.equal('candidate_pool_ids' in created.body, false);

  let response = await fetch(`${baseUrl}/api/mystery/${created.body.reveal_id}/proof`);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'mystery_not_revealed');

  response = await fetch(`${baseUrl}/api/x402/mystery/voyage`);
  assert.equal(response.status, 402);
  assert.equal((await response.json()).serviceId, 'mystery-voyage');

  const revealed = await paidReveal(wallet, created.body);
  assert.equal(revealed.response.status, 200);
  assert.equal(revealed.body.kind, 'mystery-voyage-risk-passport');
  assert.equal(revealed.body.reveal_state, 'REVEALED');
  assert.equal(revealed.body.payment.status, 'settled');
  assert.equal(revealed.body.payment.live, false);
  assert.equal(revealed.body.disclosure.automatically_subscribes_rwa, false);
  assert.equal(storeState.investments.length, 0);

  const envelope = revealed.body.report_envelope;
  assertPaidReportEnvelope(envelope);
  assert.equal(envelope.payment_tx, revealed.body.proof.payment_tx_hash);
  assert.equal(envelope.case_id, revealed.body.case_id);
  assert.equal(envelope.selected_pool_id, revealed.body.selected_pool_id);
  assert.equal(envelope.risk_passport_hash, revealed.body.risk_passport_hash);
  assert.equal(envelope.reveal_proof_hash, revealed.body.reveal_proof_hash);
  assert.equal(revealed.body.suitability.matched, true);
  assert.ok(revealed.body.pricing.issue_price_usd > 0);
  assert.ok(revealed.body.risk.stress_recovery_per_token_usd >= 0);
  assert.equal(revealed.body.evidence_freshness.status, 'FRESH');
  assert.match(revealed.body.non_guarantee_notice, /not guarantees|lose/u);

  const proofResponse = await fetch(`${baseUrl}/api/mystery/${created.body.reveal_id}/proof`);
  const proofBody = await proofResponse.json();
  assert.equal(proofResponse.status, 200);
  assert.deepEqual(proofBody.verification, { valid: true, errors: [] });
  assert.equal(proofBody.proof.selected_pool_id, revealed.body.selected_pool_id);

  const discoverySignature = await wallet.signMessage(passportClaimMessage({
    revealId: created.body.reveal_id,
    stampType: 'DISCOVERY',
    walletAddress: wallet.address,
    revealProofHash: revealed.body.proof.reveal_proof_hash
  }));
  response = await fetch(`${baseUrl}/api/mystery/${created.body.reveal_id}/passport/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      wallet_address: wallet.address,
      stamp_type: 'DISCOVERY',
      claim_signature: discoverySignature
    })
  });
  const discovery = await response.json();
  assert.equal(response.status, 201);
  assert.equal(discovery.credential.stamp_type, 'DISCOVERY');
  assert.equal(discovery.share.experience_mode, 'DEMO');
  assert.equal('wallet_address' in discovery.share, false);

  response = await fetch(`${baseUrl}/api/pool/subscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      wallet_address: wallet.address,
      pool_id: revealed.body.selected_pool_id,
      amount_usd: 1000,
      mystery_source: {
        reveal_id: created.body.reveal_id,
        selected_pool_id: revealed.body.selected_pool_id,
        reveal_proof_hash: revealed.body.proof.reveal_proof_hash
      }
    })
  });
  const subscription = await response.json();
  assert.equal(response.status, 200);
  assert.equal(subscription.investment.source.kind, 'MYSTERY_VOYAGE');
  assert.equal(subscription.investment.price, revealed.body.pricing.issue_price_usd);
  assert.equal(subscription.investment.yieldBps, revealed.body.pricing.implied_gross_yield_bps);

  const investorSignature = await wallet.signMessage(passportClaimMessage({
    revealId: created.body.reveal_id,
    stampType: 'INVESTOR_JOURNEY',
    walletAddress: wallet.address,
    revealProofHash: revealed.body.proof.reveal_proof_hash
  }));
  response = await fetch(`${baseUrl}/api/mystery/${created.body.reveal_id}/passport/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      wallet_address: wallet.address,
      stamp_type: 'INVESTOR_JOURNEY',
      claim_signature: investorSignature
    })
  });
  const investorPassport = await response.json();
  assert.equal(response.status, 201);
  assert.equal(investorPassport.credential.stamp_type, 'INVESTOR_JOURNEY');

  response = await fetch(`${baseUrl}/api/mystery/passports?wallet_address=${encodeURIComponent(wallet.address)}`);
  const passportList = await response.json();
  assert.equal(response.status, 200);
  assert.equal(passportList.credentials.length, 2);
  response = await fetch(`${baseUrl}${investorPassport.share.verify_path}`);
  const publicVerification = await response.json();
  assert.equal(response.status, 200);
  assert.equal(publicVerification.verification.valid, true);
  assert.equal(publicVerification.credential.stamp_type, 'INVESTOR_JOURNEY');

  response = await fetch(`${baseUrl}/api/mystery/analytics`);
  const analytics = await response.json();
  assert.equal(response.status, 200);
  assert.equal(analytics.funnel.preview_count, 1);
  assert.equal(analytics.funnel.mystery_subscription_count, 1);
  assert.ok(analytics.events.some((event) => event.stage === 'MYSTERY_SUBSCRIPTION'));
});

test('MBOX-BE-6: a candidate invalidated before payment aborts without collecting or replacing', async () => {
  const wallet = Wallet.createRandom();
  const created = await preview(wallet, 'api-invalidated');
  assert.equal(created.response.status, 201);
  for (const pool of storeState.pools.values()) pool.status = 'Paused';

  const revealed = await paidReveal(wallet, created.body);
  assert.equal(revealed.response.status, 409);
  assert.equal(revealed.body.code, 'candidate_invalidated_before_payment');
  assert.equal(revealed.body.payment.status, 'not_settled');
  assert.equal(revealed.body.details.abort.free_reopen_eligible, true);
  assert.equal(revealed.body.details.abort.refund_status, 'PAYMENT_NOT_SETTLED');

  const proofResponse = await fetch(`${baseUrl}/api/mystery/${created.body.reveal_id}/proof`);
  const proofBody = await proofResponse.json();
  assert.equal(proofResponse.status, 409);
  assert.equal(proofBody.code, 'mystery_aborted');
  assert.equal(proofBody.details.state, 'ABORTED');
});
