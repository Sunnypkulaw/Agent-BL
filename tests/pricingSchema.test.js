import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { quoteFromCase } from '../src/core/pricingEngine.js';
import { assertPricingQuote } from '../src/core/pricingSchema.js';
import { ValidationError } from '../src/core/schema.js';

// BE-2: direct, adversarial coverage of the PricingQuote schema validator.
// tests/pricingEngine.test.js proves the validator ACCEPTS produced quotes; this
// file proves it REJECTS malformed quotes and enforces the structural invariants
// that make an AI price defensible (AI-5 collateral guardrail + the additive
// price decomposition + the collateral floor direction).

const copperCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);

// A known-valid quote used as the baseline for negative mutations.
const validQuote = quoteFromCase(copperCase, { payout_speed: 'FAST' });

/** A deep clone of the valid quote with a few fields overridden. */
function mutated(overrides) {
  return { ...structuredClone(validQuote), ...overrides };
}

test('BE-2: a well-formed PricingQuote passes (with and without case cross-check)', () => {
  assert.doesNotThrow(() => assertPricingQuote(structuredClone(validQuote)));
  assert.doesNotThrow(() => assertPricingQuote(structuredClone(validQuote), copperCase));
});

test('BE-2: a non-object is rejected', () => {
  assert.throws(() => assertPricingQuote(null), ValidationError);
  assert.throws(() => assertPricingQuote('quote'), ValidationError);
});

test('BE-2: missing / non-finite numeric fields are rejected', () => {
  assert.throws(() => assertPricingQuote(mutated({ final_issue_price_usd: 'cheap' })), /final_issue_price_usd/);
  assert.throws(() => assertPricingQuote(mutated({ recommended_token_supply: Number.NaN })), /recommended_token_supply/);
  const { requested_cash_usd, ...withoutCash } = structuredClone(validQuote);
  assert.throws(() => assertPricingQuote(withoutCash), /requested_cash_usd/);
});

test('BE-2: out-of-set enums are rejected', () => {
  assert.throws(() => assertPricingQuote(mutated({ payout_speed: 'INSTANT' })), /payout_speed/);
  assert.throws(() => assertPricingQuote(mutated({ pricing_action: 'YOLO' })), /pricing_action/);
  assert.throws(() => assertPricingQuote(mutated({ binding_constraint: 'VIBES' })), /binding_constraint/);
  assert.throws(() => assertPricingQuote(mutated({ risk_level: 'SPICY' })), /risk_level/);
});

test('BE-2 invariant (AI-5): redemption exposure must not exceed safe collateral coverage', () => {
  const q = mutated({ target_redemption_exposure_usd: validQuote.max_safe_redemption_exposure_usd + 1000 });
  assert.throws(() => assertPricingQuote(q), /redemption_exposure_usd must be <= max_safe/);
});

test('BE-2 invariant: base - urgency - risk must reconstruct the indicative price', () => {
  // Inflate the risk discount without re-deriving the indicative price.
  const q = mutated({ risk_discount_bps: validQuote.risk_discount_bps + 500 });
  assert.throws(() => assertPricingQuote(q), /indicative_issue_price_usd must equal base/);
});

test('BE-2 invariant: the collateral floor can only lift the price (final >= indicative)', () => {
  const q = mutated({ final_issue_price_usd: validQuote.indicative_issue_price_usd - 0.05 });
  assert.throws(() => assertPricingQuote(q), /final_issue_price_usd must be >= indicative/);
});

test('BE-2 invariant: cash advanced cannot exceed cash requested', () => {
  const q = mutated({ expected_cash_to_exporter_usd: validQuote.requested_cash_usd + 5000 });
  assert.throws(() => assertPricingQuote(q), /expected_cash_to_exporter_usd must be <= requested_cash_usd/);
});

test('BE-2: evidence graph and 0x sha256 oracle hashes are required (BE-8)', () => {
  assert.throws(() => assertPricingQuote(mutated({ evidence_graph: [] })), /evidence_graph/);
  assert.throws(() => assertPricingQuote(mutated({ quote_hash: '0xnothex' })), /quote_hash/);
  assert.throws(() => assertPricingQuote(mutated({ evidence_hash: 'missing' })), /evidence_hash/);
});

test('BE-2: case_id / bl_id are cross-checked against the case', () => {
  assert.throws(() => assertPricingQuote(mutated({ case_id: 'WRONG' }), copperCase), /case_id must match/);
  assert.throws(() => assertPricingQuote(mutated({ bl_id: 'WRONG' }), copperCase), /bl_id must match/);
});
