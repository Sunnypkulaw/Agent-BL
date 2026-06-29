import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateWithConsensus } from '../src/agent/llmConsensus.js';

const mockFallback = () => ({ riskLevel: 'HIGH', issues: ['Fallback used'] });

test('AI-20: all succeed and reach consensus', async () => {
  const mockChatFn = async (args, env) => {
    // All return MEDIUM
    return { content: JSON.stringify({ riskLevel: 'MEDIUM', issues: ['Some minor issue'] }) };
  };

  const res = await evaluateWithConsensus([], mockFallback, { chatFn: mockChatFn });
  assert.equal(res.usedFallback, false);
  assert.equal(res.consensus.riskLevel, 'MEDIUM');
  assert.equal(res.details.length, 3);
});

test('AI-20: single provider fails but others reach consensus', async () => {
  const mockChatFn = async (args, env) => {
    if (env.LLM_PROVIDER === 'deepseek') throw new Error('API down');
    return { content: JSON.stringify({ riskLevel: 'LOW' }) };
  };

  const res = await evaluateWithConsensus([], mockFallback, { chatFn: mockChatFn });
  assert.equal(res.usedFallback, false);
  assert.equal(res.consensus.riskLevel, 'LOW');
  assert.equal(res.details.length, 2); // 2 successful
});

test('AI-20: extreme outlier causes disagreement fallback', async () => {
  const mockChatFn = async (args, env) => {
    if (env.LLM_PROVIDER === 'tencent') return { content: JSON.stringify({ riskLevel: 'LOW' }) };
    if (env.LLM_PROVIDER === 'deepseek') return { content: JSON.stringify({ riskLevel: 'CRITICAL' }) }; // Outlier
    return { content: JSON.stringify({ riskLevel: 'MEDIUM' }) };
  };

  const res = await evaluateWithConsensus([], mockFallback, { chatFn: mockChatFn, maxDisagreement: 2 });
  // CRITICAL(4) vs LOW(1) => 3 difference. maxDisagreement = 2, so it falls back
  assert.equal(res.usedFallback, true);
  assert.equal(res.consensus.riskLevel, 'HIGH'); // from fallback
  assert.equal(res.warning, true);
});

test('AI-20: all fail triggers fallback', async () => {
  const mockChatFn = async () => {
    throw new Error('Timeout');
  };

  const res = await evaluateWithConsensus([], mockFallback, { chatFn: mockChatFn });
  assert.equal(res.usedFallback, true);
  assert.equal(res.consensus.riskLevel, 'HIGH');
  assert.equal(res.reason, 'All providers failed.');
});
