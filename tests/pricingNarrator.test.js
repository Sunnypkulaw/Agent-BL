import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { compareSpeeds } from '../src/core/pricingEngine.js';
import { buildPricingNarrative, narratePricing } from '../src/agent/pricingNarrator.js';

// BE-10: the demo narrator is deterministic-first; the LLM only rephrases and
// must fall back to the grounded text on any error (so `npm run demo` never breaks).

const copperCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);
const comparison = compareSpeeds(copperCase);

test('BE-10: the grounded narrative cites price, yield, risk and the not-guaranteed nuance', () => {
  const rec = comparison.recommended_quote;
  const text = buildPricingNarrative(comparison);
  assert.ok(text.includes(rec.final_issue_price_usd.toFixed(2)), 'cites the issue price');
  assert.ok(text.includes(rec.risk_level), 'cites the risk level');
  assert.match(text, /not a guarantee|not guaranteed/);
});

test('BE-10: narratePricing without an LLM returns the deterministic narrative', async () => {
  const out = await narratePricing(comparison, { useLlm: false });
  assert.equal(out.provider, 'deterministic');
  assert.equal(out.text, out.grounded);
});

test('BE-10: a failing LLM falls back to the grounded narrative', async () => {
  const failingChat = async () => { throw new Error('provider 500: upstream timeout'); };
  const out = await narratePricing(comparison, { useLlm: true, env: { Tencent_API_KEY: 'x' }, chat: failingChat });
  assert.equal(out.provider, 'deterministic-fallback');
  assert.equal(out.text, out.grounded);
});

test('BE-10: a working LLM rephrase is used and reports the Tencent provider', async () => {
  const fakeChat = async () => ({ role: 'assistant', content: 'AI cut the RWA to 0.80 for a 25% upside; risk is medium.' });
  const out = await narratePricing(comparison, { useLlm: true, env: { Tencent_API_KEY: 'x' }, chat: fakeChat });
  assert.equal(out.provider, 'tencent');
  assert.equal(out.text, 'AI cut the RWA to 0.80 for a 25% upside; risk is medium.');
});
