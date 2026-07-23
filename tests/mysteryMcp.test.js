import assert from 'node:assert/strict';
import test from 'node:test';
import { Wallet } from 'ethers';
import { createRevealProof } from '../src/mystery/fairness.js';
import {
  handlePreviewMysteryVoyage,
  handleVerifyMysteryReveal
} from '../src/mcp/tools.js';

test('MBOX-MCP-1: preview enforces budget and never authorizes payment', async () => {
  const wallet = Wallet.createRandom();
  await assert.rejects(
    () => handlePreviewMysteryVoyage({
      wallet_address: wallet.address,
      case_id: 'CASE-EBL-2026-0001',
      risk_passport: { tier: 'ADVENTUROUS' },
      budget_usdc: 0.0009
    }),
    /budget_usdc is too low/u
  );
  const preview = await handlePreviewMysteryVoyage({
    wallet_address: wallet.address,
    case_id: 'CASE-EBL-2026-0001',
    risk_passport: { tier: 'ADVENTUROUS' },
    budget_usdc: 0.001
  });
  assert.equal(preview.tool, 'preview_mystery_voyage');
  assert.equal(preview.result.state, 'COMMITTED');
  assert.ok(preview.result.candidate_count > 0);
  assert.equal(preview.result.authorization.budget_ok, true);
  assert.equal(preview.result.authorization.payment_authorized, false);
  assert.equal(preview.result.authorization.human_approval_required, true);
});

test('MBOX-MCP-1: verifier recomputes proof and fails closed on report binding tamper', async () => {
  const proof = createRevealProof({
    reveal_id: 'mcp-reveal',
    round_id: 'mcp-round',
    risk_passport_hash: `0x${'11'.repeat(32)}`,
    candidates: [
      { pool_id: 'pool-a', quote_hash: `0x${'22'.repeat(32)}`, weight: 1 },
      { pool_id: 'pool-b', quote_hash: `0x${'33'.repeat(32)}`, weight: 1 }
    ],
    server_secret: `0x${'44'.repeat(32)}`,
    user_nonce: `0x${'55'.repeat(32)}`,
    payment_tx_hash: `0x${'66'.repeat(32)}`,
    wallet_address: Wallet.createRandom().address,
    created_at: '2026-07-23T08:00:00.000Z',
    expires_at: '2026-07-23T08:10:00.000Z'
  });
  const verified = await handleVerifyMysteryReveal({
    proof,
    report: {
      selected_pool_id: proof.selected_pool_id,
      reveal_proof_hash: proof.reveal_proof_hash,
      risk_passport_hash: proof.risk_passport_hash
    }
  });
  assert.equal(verified.result.valid, true, verified.result.errors.join(', '));
  assert.equal(verified.result.investment_authorized, false);
  assert.equal(verified.result.subscription_requires_independent_signature, true);

  const tampered = await handleVerifyMysteryReveal({
    proof,
    report: { selected_pool_id: 'pool-z' }
  });
  assert.equal(tampered.result.valid, false);
  assert.ok(tampered.result.errors.includes('report.selected_pool_id mismatch'));
});
