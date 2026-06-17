import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { evaluateRetrieval, getRiskCorpus, retrieveByQuery, retrieveRiskIntel } from '../src/agent/riskIntel.js';

const copperCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);

test('AI-11: corpus loads from the risk-intel feed', () => {
  const corpus = getRiskCorpus();
  assert.ok(corpus.length >= 8);
  assert.ok(corpus.every((d) => d.id && d.type && d.text));
});

test('AI-11: copper case retrieves the Hormuz war + copper volatility intel', () => {
  const matches = retrieveRiskIntel(copperCase, { k: 3 });
  const ids = matches.map((m) => m.id);
  assert.ok(ids.includes('MRI-HORMUZ-WAR-2026-06'));
  assert.ok(ids.includes('MRI-COPPER-VOL-2026-06'));
  // scores are sorted descending and carry a source for citation
  assert.ok(matches[0].score >= matches[matches.length - 1].score);
  assert.ok(matches.every((m) => m.source));
});

test('AI-11: retrieval eval keeps precision@k high (>= 0.8 mean)', () => {
  const evalResult = evaluateRetrieval();
  assert.ok(evalResult.mean_precision >= 0.8, `mean precision ${evalResult.mean_precision}`);
  for (const c of evalResult.cases) {
    assert.ok(c.precision >= 0.66, `${c.name} precision ${c.precision}`);
  }
});

test('AI-11: free-text query surfaces policy notes for the Q&A assistant', () => {
  const matches = retrieveByQuery('is the target redemption guaranteed?');
  assert.ok(matches.some((m) => m.id === 'POL-TARGET-REDEMPTION-NOT-GUARANTEED'));
});

test('AI-11: a custom corpus can be supplied (no hidden global state)', () => {
  const corpus = [
    { id: 'X', type: 'war_risk', region: 'Test', commodity: 'copper', severity: 'critical', tags: ['copper'], text: 'copper war' }
  ];
  const matches = retrieveRiskIntel({ cargo: { commodity: 'Copper' }, macro_risk_events: [{ type: 'war_risk', region: 'Test' }] }, { corpus });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'X');
});
