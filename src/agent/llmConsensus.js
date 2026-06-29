import { chatCompletion as realChatCompletion } from './llm/openaiCompatClient.js';

/**
 * AI-20: Multi-LLM Consensus Evaluator
 * Evaluates a case using multiple providers independently. 
 * Aggregates results using median. Falls back to deterministic engine if all fail or variance is too high.
 */
export async function evaluateWithConsensus(messages, deterministicFallbackFn, options = {}) {
  const {
    providers = ['tencent', 'deepseek', 'qwen'],
    timeoutMs = 15000,
    maxDisagreement = 2, // If max - min >= this, we fallback
    chatFn = realChatCompletion
  } = options;

  const promises = providers.map(async (provider) => {
    const env = { ...process.env, LLM_PROVIDER: provider };
    // Make sure we inject dummy keys so resolveProvider doesn't fail early if we are running real function
    if (!env[`${provider.toUpperCase()}_API_KEY`] && provider !== 'tencent') {
        env[`${provider.toUpperCase()}_API_KEY`] = 'dummy';
    }
    if (provider === 'tencent' && !env.Tencent_API_KEY) {
        env.Tencent_API_KEY = 'dummy';
    }

    try {
      const response = await chatFn({ messages, timeoutMs, temperature: 0.2 }, env);
      const content = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(content);
      return { provider, result: parsed, success: true };
    } catch (e) {
      return { provider, error: e.message, success: false };
    }
  });

  const results = await Promise.all(promises);
  
  const successful = results.filter(r => r.success);

  if (successful.length === 0) {
    return {
      consensus: deterministicFallbackFn(),
      usedFallback: true,
      reason: 'All providers failed.',
      details: results
    };
  }

  const riskMap = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const inverseRiskMap = { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH', 4: 'CRITICAL' };
  
  const validScores = successful
    .map(r => r.result.riskLevel ? riskMap[r.result.riskLevel.toUpperCase()] : null)
    .filter(s => s !== null);

  if (validScores.length === 0) {
    return {
      consensus: deterministicFallbackFn(),
      usedFallback: true,
      reason: 'No provider returned a valid riskLevel.',
      details: successful
    };
  }

  const maxScore = Math.max(...validScores);
  const minScore = Math.min(...validScores);

  // If one provider says LOW(1) and another says HIGH(3) or CRITICAL(4), maxDisagreement will be reached (e.g. 3-1 = 2)
  if (maxScore - minScore >= maxDisagreement) {
    return {
      consensus: deterministicFallbackFn(),
      usedFallback: true,
      reason: `Disagreement too large (max ${maxScore} - min ${minScore} >= ${maxDisagreement}).`,
      details: successful,
      warning: true
    };
  }

  validScores.sort((a, b) => a - b);
  const mid = Math.floor(validScores.length / 2);
  const medianScore = validScores.length % 2 !== 0 
    ? validScores[mid] 
    : Math.round((validScores[mid - 1] + validScores[mid]) / 2.0);

  const consensusRisk = inverseRiskMap[medianScore] || 'CRITICAL';
  const allIssues = [...new Set(successful.flatMap(r => r.result.issues || []))];

  return {
    consensus: {
      riskLevel: consensusRisk,
      issues: allIssues,
      score: medianScore
    },
    usedFallback: false,
    reason: `Consensus reached across ${successful.length} provider(s).`,
    details: successful
  };
}
