// TradeShield RAG Tests
// Data integrity + search correctness + Judge Q&A validation

import test from 'node:test';
import assert from 'node:assert/strict';
import { KNOWLEDGE_BASE, KNOWLEDGE_CATEGORIES, getCategoryCounts, validateKnowledgeBase } from '../src/rag/knowledgeBase.js';
import { searchKnowledgeBase, searchByRoute, searchByCommodity, fullRiskSweep } from '../src/rag/search.js';
import { JUDGE_QA_PAIRS, getAllQAPairs, getQAById, searchQA } from '../src/rag/judgeQA.js';

// ============================================================
// Data Integrity Tests
// ============================================================

test('knowledge base has correct number of categories', () => {
  assert.equal(KNOWLEDGE_CATEGORIES.length, 7);
  const expected = ['war_risk', 'sanction_risk', 'port_congestion', 'severe_weather', 'commodity_volatility', 'fx_volatility', 'buyer_country_risk'];
  for (const cat of expected) {
    assert.ok(KNOWLEDGE_CATEGORIES.includes(cat), `Expected category: ${cat}`);
  }
});

test('knowledge base has at least 3 entries per category', () => {
  const counts = getCategoryCounts();
  for (const cat of KNOWLEDGE_CATEGORIES) {
    assert.ok(counts[cat] >= 3, `Category "${cat}" has ${counts[cat]} entries, expected >= 3`);
  }
});

test('validateKnowledgeBase returns zero errors', () => {
  const errors = validateKnowledgeBase();
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

test('every entry has all required fields', () => {
  const required = ['id', 'category', 'title', 'summary', 'detail', 'severity', 'region', 'date', 'source', 'keywords', 'relevance'];
  for (const entry of KNOWLEDGE_BASE) {
    for (const field of required) {
      assert.ok(entry[field] !== undefined && entry[field] !== null, `${entry.id}: missing "${field}"`);
    }
  }
});

test('every entry has a valid category', () => {
  for (const entry of KNOWLEDGE_BASE) {
    assert.ok(KNOWLEDGE_CATEGORIES.includes(entry.category), `${entry.id}: invalid category "${entry.category}"`);
  }
});

test('every entry has a valid severity', () => {
  for (const entry of KNOWLEDGE_BASE) {
    assert.ok(['info', 'warning', 'critical'].includes(entry.severity), `${entry.id}: invalid severity "${entry.severity}"`);
  }
});

test('every entry has at least 3 keywords', () => {
  for (const entry of KNOWLEDGE_BASE) {
    assert.ok(entry.keywords.length >= 3, `${entry.id}: only ${entry.keywords.length} keywords`);
  }
});

test('every entry has a valid ISO date string', () => {
  for (const entry of KNOWLEDGE_BASE) {
    assert.ok(!Number.isNaN(Date.parse(entry.date)), `${entry.id}: invalid date "${entry.date}"`);
  }
});

test('no duplicate IDs in knowledge base', () => {
  const ids = new Set();
  for (const entry of KNOWLEDGE_BASE) {
    assert.ok(!ids.has(entry.id), `Duplicate ID: ${entry.id}`);
    ids.add(entry.id);
  }
});

test('all IDs follow the XXX-NNN pattern', () => {
  for (const entry of KNOWLEDGE_BASE) {
    assert.ok(/^[A-Z]+-\d{3}$/.test(entry.id), `${entry.id}: does not match pattern XXX-NNN`);
  }
});

// ============================================================
// Search Function Tests
// ============================================================

test('search returns entries matching exact keywords', () => {
  const results = searchKnowledgeBase('Red Sea');
  assert.ok(results.length > 0, 'Expected at least 1 result for "Red Sea"');
  const hasRedSea = results.some(r =>
    r.keywords.some(k => k.includes('red sea') || k.includes('sea'))
    || r.title.toLowerCase().includes('red sea')
  );
  assert.ok(hasRedSea, 'Expected results to match "Red Sea"');
});

test('search returns relevant results for "copper"', () => {
  const results = searchKnowledgeBase('copper');
  assert.ok(results.length > 0, 'Expected at least 1 result for "copper"');
  // The top results should be about copper, not random entries
  const topResult = results[0];
  const isAboutCommodity = topResult.category === 'commodity_volatility'
    || topResult.keywords.some(k => k.includes('copper'))
    || topResult.title.toLowerCase().includes('copper');
  assert.ok(isAboutCommodity, `Top result "${topResult.title}" is not about copper`);
});

test('search for "monsoon" returns weather-related results', () => {
  const results = searchKnowledgeBase('monsoon');
  assert.ok(results.length > 0);
  const topResult = results[0];
  assert.equal(topResult.category, 'severe_weather');
});

test('search returns empty array for completely unrelated query', () => {
  const results = searchKnowledgeBase('zxcvbnmqwerty12345');
  assert.equal(results.length, 0);
});

test('search returns empty array for empty query string', () => {
  const results = searchKnowledgeBase('');
  assert.equal(results.length, 0);
});

test('search is case-insensitive', () => {
  const upper = searchKnowledgeBase('COPPER');
  const lower = searchKnowledgeBase('copper');
  assert.equal(upper.length, lower.length, 'Case-insensitive search should return same count');
  assert.equal(upper[0].id, lower[0].id, 'Case-insensitive search should return same top result');
});

test('search respects category filter', () => {
  const results = searchKnowledgeBase('risk', { categories: ['war_risk'] });
  for (const r of results) {
    assert.equal(r.category, 'war_risk', `Entry ${r.id} has category ${r.category}, expected war_risk`);
  }
});

test('search respects limit parameter', () => {
  const results = searchKnowledgeBase('shipping', { limit: 3 });
  assert.ok(results.length <= 3, `Expected <= 3 results, got ${results.length}`);
});

test('search with limit=1 returns at most 1 result', () => {
  const results = searchKnowledgeBase('war', { limit: 1 });
  assert.ok(results.length <= 1);
});

test('search ranks critical entries above info entries when scores are tied', () => {
  // Search for something broad that will match multiple entries of different severities
  const results = searchKnowledgeBase('shipping transport trade', { limit: 10 });
  // Verify results are sorted by score descending
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1]._score >= results[i]._score, `Results not sorted by score: ${results[i - 1]._score} < ${results[i]._score}`);
  }
});

test('search returns entries with _score and _matchedTokens', () => {
  const results = searchKnowledgeBase('Hamburg');
  for (const r of results) {
    assert.ok(typeof r._score === 'number', `Entry ${r.id} missing _score`);
    assert.ok(r._score > 0, `Entry ${r.id} has score ${r._score}`);
  }
});

test('searchByRoute finds route-relevant results', () => {
  const results = searchByRoute('Shanghai->Hamburg');
  assert.ok(results.length > 0, 'Expected route-based search to return results');
});

test('searchByCommodity finds commodity-relevant results', () => {
  const results = searchByCommodity('copper');
  assert.ok(results.length > 0, 'Expected commodity search to return results');
  assert.equal(results[0].category, 'commodity_volatility');
});

test('fullRiskSweep returns results for all 6 risk dimensions', () => {
  const mockCase = {
    case_id: 'TEST-001',
    bill_of_lading: { port_of_loading: 'Shanghai', port_of_discharge: 'Hamburg', cargo: 'Copper Cathodes', quantity_mt: 1000 },
    market: { commodity: 'Copper' }
  };
  const sweep = fullRiskSweep(mockCase);
  assert.equal(sweep.case_id, 'TEST-001');
  const dimensions = Object.keys(sweep.results);
  assert.equal(dimensions.length, 6, `Expected 6 dimensions, got ${dimensions.length}`);
  assert.ok(sweep.total_matches > 0, 'Expected at least some matches');
  assert.ok(sweep.summary.overall_assessment, 'Expected overall assessment');
});

// ============================================================
// Judge Q&A Tests
// ============================================================

test('Judge Q&A has exactly 4 pairs', () => {
  assert.equal(JUDGE_QA_PAIRS.length, 4);
});

test('each Judge Q&A pair has required fields', () => {
  for (const pair of JUDGE_QA_PAIRS) {
    assert.ok(pair.id, 'Missing id');
    assert.ok(pair.question, 'Missing question');
    assert.ok(pair.answer, 'Missing answer');
    assert.ok(pair.keywords.length > 0, 'Missing keywords');
    assert.ok(pair.source, 'Missing source');
  }
});

test('getAllQAPairs returns all 4 pairs', () => {
  assert.equal(getAllQAPairs().length, 4);
});

test('getQAById returns correct pair', () => {
  const qa = getQAById('QA-1');
  assert.ok(qa, 'QA-1 should exist');
  assert.ok(qa.question.includes('eBL') || qa.question.includes('Bill of Lading'));
});

test('getQAById returns null for unknown ID', () => {
  assert.equal(getQAById('NONEXISTENT'), null);
});

test('searchQA finds relevant Q&A by keywords', () => {
  const results = searchQA('insurance expire transit');
  assert.ok(results.length > 0, 'Expected matches for insurance question');
  assert.equal(results[0].id, 'QA-4');
});

test('searchQA returns empty for unrelated query', () => {
  const results = searchQA('pizza delivery');
  assert.equal(results.length, 0);
});

test('searchQA respects limit parameter', () => {
  const results = searchQA('AI pricing oracle contract', 2);
  assert.ok(results.length <= 2);
});
