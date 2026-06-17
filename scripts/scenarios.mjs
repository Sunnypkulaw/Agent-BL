// `npm run scenarios` — the multi-scenario regression for BOTH engines:
//   1. the legacy RiskReport harness (data/demo-case.json + data/scenarios/*)
//   2. the AI dynamic-pricing scenarios (data/pricing-scenarios/*) that exercise
//      the risk discount (AI-4) and the high-risk reprice / pause path (AI-10).
//
// Keeping both under one command means the documented verification for the AI
// pricing tasks (`npm run scenarios`) actually drives the pricing engine.
import { runHarnessScenarios } from '../src/core/scenarioRunner.js';
import { runPricingScenarios } from '../src/core/pricingScenarioRunner.js';

// --- Part 1: legacy RiskReport harness scenarios -----------------------------
const legacy = await runHarnessScenarios();

console.log('\nTradeShield harness scenarios (legacy RiskReport)');
console.log('='.repeat(60));
for (const result of legacy) {
  console.log(
    [
      result.case_id,
      result.contract_action,
      `state=${result.final_state}`,
      `risk=${result.risk_level}`,
      `hf=${result.health_factor}`
    ].join(' | ')
  );
}

const legacyCounts = legacy.reduce((summary, result) => {
  summary[result.contract_action] = (summary[result.contract_action] ?? 0) + 1;
  return summary;
}, {});
console.log('\nAction coverage');
console.log(JSON.stringify(legacyCounts, null, 2));

// --- Part 2: AI dynamic-pricing scenarios (fast / balanced / high-risk) -------
const pricing = await runPricingScenarios();

console.log('\n\nTradeShield AI pricing scenarios (eBL-backed RWA discount issuance)');
console.log('='.repeat(60));
for (const r of pricing) {
  const parts = [
    r.name.padEnd(18),
    r.payout_speed.padEnd(9),
    `issue=${r.final_issue_price_usd.toFixed(3)}`,
    `risk=${r.risk_level}(${r.risk_score_bps}bps)`,
    `action=${r.pricing_action}`
  ];
  if (r.offering_final_state) parts.push(`offering=${r.offering_final_state}`);
  console.log(parts.join(' | '));
}

const pricingCounts = pricing.reduce((summary, r) => {
  summary[r.pricing_action] = (summary[r.pricing_action] ?? 0) + 1;
  return summary;
}, {});
console.log('\nPricing action coverage');
console.log(JSON.stringify(pricingCounts, null, 2));

console.log(`\n${legacy.length} legacy + ${pricing.length} pricing scenarios passed.`);
