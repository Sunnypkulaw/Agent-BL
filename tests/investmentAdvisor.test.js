import assert from 'node:assert/strict';
import test from 'node:test';
import { recommend } from '../src/agent/investmentAdvisor.js';

const mockCases = [
  { id: '1', caseEntry: { cargo: 'Copper' }, riskLevel: 'LOW', yieldBps: 400, riskBps: 100, score: 4.0, financingUsd: 1000000 },
  { id: '2', caseEntry: { cargo: 'Soybeans' }, riskLevel: 'MEDIUM', yieldBps: 800, riskBps: 300, score: 2.6, financingUsd: 500000 },
  { id: '3', caseEntry: { cargo: 'Copper' }, riskLevel: 'HIGH', yieldBps: 1200, riskBps: 600, score: 2.0, financingUsd: 2000000 },
  { id: '4', caseEntry: { cargo: 'Iron Ore' }, riskLevel: 'LOW', yieldBps: 350, riskBps: 80, score: 4.3, financingUsd: 800000 }
];

test('AI-19: deterministic fallback filters by low risk', async () => {
  // Pass an environment without LLM keys to force deterministic fallback
  const oldEnv = process.env;
  process.env = {}; 

  const res = await recommend('I want safe low risk investments', mockCases);
  
  assert.ok(res.recommendations.length > 0);
  assert.ok(res.recommendations.every(r => r.riskLevel === 'LOW'));
  assert.equal(res.criteria.risk_max, 'LOW');
  assert.equal(res.criteria.sort_by, 'risk_asc');
  
  process.env = oldEnv;
});

test('AI-19: deterministic fallback sorts by high yield', async () => {
  const oldEnv = process.env;
  process.env = {}; 
  const res = await recommend('Give me high yield', mockCases);
  
  assert.ok(res.recommendations.length > 0);
  assert.equal(res.recommendations[0].id, '3'); // 1200 bps
  assert.equal(res.criteria.sort_by, 'yield_desc');
  process.env = oldEnv;
});

test('AI-19: deterministic fallback filters by commodity', async () => {
  const oldEnv = process.env;
  process.env = {}; 
  const res = await recommend('I want copper', mockCases);
  
  assert.ok(res.recommendations.length > 0);
  assert.ok(res.recommendations.every(r => r.caseEntry.cargo.toLowerCase() === 'copper'));
  process.env = oldEnv;
});
