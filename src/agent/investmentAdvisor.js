import { chatCompletion, isConfigured } from './llm/openaiCompatClient.js';

/**
 * AI-19: Investment Advisor
 * Recommends eBL cases based on natural language preferences.
 * 
 * @param {string} preference - Natural language preference (e.g., "High yield, medium risk")
 * @param {Array} availableCases - Array of pre-scored case objects, each containing:
 *   { caseEntry, score, riskLevel, yieldBps, financingUsd, price, riskBps }
 * @returns {Promise<Object>} - { recommendations: Array, reason: string }
 */
export async function recommend(preference, availableCases) {
  if (!preference) {
    return { recommendations: [], reason: 'No preference provided.' };
  }
  if (!availableCases || !availableCases.length) {
    return { recommendations: [], reason: 'No available cases to recommend.' };
  }

  let criteria = {
    risk_max: null,
    yield_min: null,
    commodity: null,
    financing_max: null,
    sort_by: 'score_desc' // default
  };

  // 1. Try to use LLM to parse preferences
  if (isConfigured()) {
    try {
      const messages = [
        { role: 'system', content: `You are an AI investment advisor for an eBL RWA platform. 
Extract the user's investment preferences into a JSON object.
Valid keys:
- risk_max: "LOW", "MEDIUM", "HIGH", or "CRITICAL"
- yield_min: integer (in basis points, e.g. 500 for 5%)
- commodity: string (e.g. "copper", "soybeans")
- financing_max: number (in USD)
- sort_by: "yield_desc", "risk_asc", or "score_desc"

Only return valid JSON.` },
        { role: 'user', content: preference }
      ];

      const response = await chatCompletion({ messages, temperature: 0.1 });
      const content = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(content);
      
      criteria = { ...criteria, ...parsed };
    } catch (e) {
      // Fallback to deterministic
      criteria = deterministicFallback(preference);
    }
  } else {
    // LLM not configured, use deterministic fallback
    criteria = deterministicFallback(preference);
  }

  // 2. Filter cases based on criteria
  const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  let results = [...availableCases];

  if (criteria.risk_max && riskOrder[criteria.risk_max] !== undefined) {
    results = results.filter(r => riskOrder[r.riskLevel] <= riskOrder[criteria.risk_max]);
  }
  if (criteria.yield_min) {
    results = results.filter(r => r.yieldBps >= criteria.yield_min);
  }
  if (criteria.commodity) {
    const kw = criteria.commodity.toLowerCase();
    results = results.filter(r => 
      (r.caseEntry.cargo || '').toLowerCase().includes(kw) ||
      (r.caseData?.bill_of_lading?.cargo || '').toLowerCase().includes(kw)
    );
  }
  if (criteria.financing_max) {
    results = results.filter(r => r.financingUsd <= criteria.financing_max);
  }

  // 3. Sort cases
  if (criteria.sort_by === 'yield_desc') {
    results.sort((a, b) => b.yieldBps - a.yieldBps);
  } else if (criteria.sort_by === 'risk_asc') {
    results.sort((a, b) => a.riskBps - b.riskBps);
  } else {
    // Default score_desc
    results.sort((a, b) => b.score - a.score);
  }

  const top = results.slice(0, 3);
  
  const reasonText = criteria.risk_max 
    ? `Filtered by Risk <= ${criteria.risk_max}` + (criteria.yield_min ? `, Yield >= ${(criteria.yield_min/100).toFixed(1)}%` : '')
    : `Ranked by ${criteria.sort_by === 'yield_desc' ? 'Yield' : 'Risk/Reward Score'}`;

  return {
    recommendations: top,
    reason: `AI Recommendation based on "${preference}" (${reasonText})`,
    criteria
  };
}

function deterministicFallback(pref) {
  const p = pref.toLowerCase();
  const criteria = { sort_by: 'score_desc' };

  if (p.includes('low risk') || p.includes('safe') || p.includes('稳健') || p.includes('低风险')) {
    criteria.risk_max = 'LOW';
    criteria.sort_by = 'risk_asc';
  } else if (p.includes('medium risk') || p.includes('中风险')) {
    criteria.risk_max = 'MEDIUM';
  } else if (p.includes('high yield') || p.includes('高收益')) {
    criteria.sort_by = 'yield_desc';
  }

  if (p.includes('copper') || p.includes('铜')) criteria.commodity = 'copper';
  if (p.includes('soybean') || p.includes('大豆')) criteria.commodity = 'soybean';

  return criteria;
}
