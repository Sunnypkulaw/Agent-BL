import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { quoteFromCase } from '../src/core/pricingEngine.js';
import { toOracleUpdate } from '../src/core/oracle.js';

// BE-8: the quote must serialise into the exact payload the on-chain
// RiskPricingOracle / RWAOfferingPool need, carrying both anchoring hashes.

const copperCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);
const warCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai-warcrisis.case.json', import.meta.url), 'utf8')
);

test('BE-8: toOracleUpdate maps an opening quote to the oracle payload', () => {
  const quote = quoteFromCase(copperCase, { payout_speed: 'FAST' });
  const update = toOracleUpdate(quote, { pool_id: 'POOL-1' });

  assert.equal(update.pool_id, 'POOL-1');
  assert.equal(update.case_id, quote.case_id);
  assert.equal(update.bl_id, quote.bl_id);
  // RiskPricingOracle.updatePricing(poolId, issuePrice, riskLevel, action, evidenceHash)
  assert.equal(update.issue_price_usd, quote.final_issue_price_usd);
  assert.equal(update.risk_level, quote.risk_level);
  assert.equal(update.pricing_action, 'OPEN_OFFERING');
  assert.equal(update.offering_state, 'Open');
  // RWAOfferingPool.createOffering(eblId, tokenSupply, issuePrice, targetRedemptionValue)
  assert.equal(update.recommended_token_supply, quote.recommended_token_supply);
  assert.equal(update.target_redemption_value_usd, 1);

  // Both anchoring hashes are present, valid and distinct.
  assert.match(update.evidence_hash, /^0x[0-9a-f]{64}$/);
  assert.match(update.quote_hash, /^0x[0-9a-f]{64}$/);
  assert.notEqual(update.evidence_hash, update.quote_hash);
});

test('BE-8: a paused war-crisis quote maps to the Paused offering state', () => {
  const update = toOracleUpdate(quoteFromCase(warCase, { payout_speed: 'FAST' }));
  assert.equal(update.pricing_action, 'PAUSE_OFFERING');
  assert.equal(update.offering_state, 'Paused');
  assert.equal(update.pool_id, null);
});
