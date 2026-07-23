import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Wallet } from 'ethers';
import { buildMysteryAnalytics } from '../src/mystery/analytics.js';
import { createUserNonce } from '../src/mystery/fairness.js';
import { passportClaimMessage, verifyVoyagePassport } from '../src/mystery/passport.js';
import {
  claimMysteryPassport,
  listMysteryPassports,
  previewMysteryVoyage,
  revealMysteryVoyage,
  validateMysterySubscriptionSource
} from '../src/mystery/service.js';
import { MysteryRevealStore } from '../src/mystery/store.js';
import { createPool, resetStore, storeState, subscribeToPool } from '../src/app/store.js';

function fixturePool() {
  const now = new Date().toISOString();
  const quote = {
    quote_hash: `0x${'ab'.repeat(32)}`,
    evidence_hash: `0x${'bc'.repeat(32)}`,
    final_issue_price_usd: 0.8,
    target_redemption_value_usd: 1,
    implied_gross_yield_bps: 2500,
    base_issue_price_usd: 0.9,
    urgency_discount_bps: 300,
    risk_discount_bps: 700,
    risk_level: 'MEDIUM',
    risk_score_bps: 400,
    risk_factors: ['Port delay'],
    pricing_action: 'OPEN_OFFERING',
    binding_constraint: 'requested_cash',
    ai_verified_collateral_value_usd: 1_500_000,
    target_redemption_exposure_usd: 1_000_000,
    requested_cash_usd: 800_000,
    evidence_graph: []
  };
  return {
    poolId: 'CASE-PASSPORT-1',
    caseData: {
      case_id: 'CASE-PASSPORT-1',
      bill_of_lading: {
        cargo: 'Copper cathodes',
        port_of_loading: 'Singapore',
        port_of_discharge: 'Hamburg',
        eta: '2026-08-01'
      }
    },
    quote,
    status: 'Open',
    subscribedUsd: 0,
    targetUsd: quote.requested_cash_usd,
    createdAt: now,
    quoteUpdatedAt: now,
    complianceStatus: 'CLEARED',
    investorEligible: true
  };
}

async function revealedFixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbl-passport-test-'));
  const store = new MysteryRevealStore({ filePath: path.join(directory, 'reveals.json') });
  const wallet = Wallet.createRandom();
  const pool = fixturePool();
  const pools = new Map([[pool.poolId, pool]]);
  const preview = await previewMysteryVoyage({
    wallet_address: wallet.address,
    risk_passport: { tier: 'BALANCED' }
  }, { pools, store });
  await revealMysteryVoyage({
    reveal_id: preview.reveal_id,
    wallet_address: wallet.address,
    user_nonce: createUserNonce(),
    payment_tx_hash: 'demo://receipt/passport-test-1234'
  }, { pools, store });
  return { directory, store, wallet, pool, preview };
}

test('MBOX-BE-7/FE-7: verified reveal issues a signed, sanitized Discovery credential', async () => {
  const fixture = await revealedFixture();
  try {
    const record = await fixture.store.get(fixture.preview.reveal_id, { internal: true });
    const claimSignature = await fixture.wallet.signMessage(passportClaimMessage({
      revealId: record.reveal_id,
      stampType: 'DISCOVERY',
      walletAddress: fixture.wallet.address,
      revealProofHash: record.proof.reveal_proof_hash
    }));
    const claimed = await claimMysteryPassport({
      reveal_id: record.reveal_id,
      wallet_address: fixture.wallet.address,
      stamp_type: 'DISCOVERY',
      claim_signature: claimSignature
    }, { store: fixture.store, investments: [] });
    assert.equal(claimed.credential.stamp_type, 'DISCOVERY');
    assert.equal(verifyVoyagePassport(claimed.credential).valid, true);
    assert.equal(claimed.share.cargo_category, 'Industrial metals');
    assert.equal(claimed.share.route_label, 'Asia to Europe');
    const serialized = JSON.stringify(claimed.share).toLowerCase();
    for (const forbidden of ['wallet', 'amountusd', 'yieldbps', 'risklevel', 'ebl_reference', 'port_of_loading']) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
    const listed = await listMysteryPassports(fixture.wallet.address, { store: fixture.store });
    assert.equal(listed.credentials.length, 1);
  } finally {
    await fs.rm(fixture.directory, { recursive: true, force: true });
  }
});

test('MBOX-BE-7: mystery source is bound into portfolio without changing quote-derived price or yield', async () => {
  const fixture = await revealedFixture();
  try {
    resetStore();
    createPool(fixture.pool.poolId, fixture.pool.caseData, fixture.pool.quote, {
      createdAt: fixture.pool.createdAt,
      quoteUpdatedAt: fixture.pool.quoteUpdatedAt
    });
    const record = await fixture.store.get(fixture.preview.reveal_id, { internal: true });
    const source = await validateMysterySubscriptionSource({
      wallet_address: fixture.wallet.address,
      pool_id: fixture.pool.poolId,
      source: {
        reveal_id: record.reveal_id,
        selected_pool_id: record.proof.selected_pool_id,
        reveal_proof_hash: record.proof.reveal_proof_hash
      }
    }, { store: fixture.store });
    const subscribed = subscribeToPool(fixture.wallet.address.toLowerCase(), fixture.pool.poolId, 10_000, { source });
    assert.equal(subscribed.investment.source.kind, 'MYSTERY_VOYAGE');
    assert.equal(subscribed.investment.price, fixture.pool.quote.final_issue_price_usd);
    assert.equal(subscribed.investment.yieldBps, fixture.pool.quote.implied_gross_yield_bps);

    const analytics = buildMysteryAnalytics({
      records: await fixture.store.list({ internal: true }),
      investments: storeState.investments
    });
    assert.equal(analytics.funnel.preview_count, 1);
    assert.equal(analytics.funnel.revealed_count, 1);
    assert.equal(analytics.funnel.mystery_subscription_count, 1);
    assert.equal(analytics.source_integrity[0].quote_hash, fixture.pool.quote.quote_hash);

    await assert.rejects(
      () => validateMysterySubscriptionSource({
        wallet_address: fixture.wallet.address,
        pool_id: 'wrong-pool',
        source: {
          reveal_id: record.reveal_id,
          selected_pool_id: record.proof.selected_pool_id,
          reveal_proof_hash: record.proof.reveal_proof_hash
        }
      }, { store: fixture.store }),
      (error) => error.code === 'mystery_source_pool_mismatch'
    );
  } finally {
    resetStore();
    await fs.rm(fixture.directory, { recursive: true, force: true });
  }
});

test('MBOX-FE-7: Investor Journey stamp requires a mystery-attributed subscription', async () => {
  const fixture = await revealedFixture();
  try {
    const record = await fixture.store.get(fixture.preview.reveal_id, { internal: true });
    const claimSignature = await fixture.wallet.signMessage(passportClaimMessage({
      revealId: record.reveal_id,
      stampType: 'INVESTOR_JOURNEY',
      walletAddress: fixture.wallet.address,
      revealProofHash: record.proof.reveal_proof_hash
    }));
    await assert.rejects(
      () => claimMysteryPassport({
        reveal_id: record.reveal_id,
        wallet_address: fixture.wallet.address,
        stamp_type: 'INVESTOR_JOURNEY',
        claim_signature: claimSignature
      }, { store: fixture.store, investments: [] }),
      (error) => error.code === 'passport_subscription_required'
    );
  } finally {
    await fs.rm(fixture.directory, { recursive: true, force: true });
  }
});
