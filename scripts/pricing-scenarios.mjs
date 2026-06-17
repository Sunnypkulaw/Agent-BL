// CLI: run the AI pricing scenario regression (fast / balanced / high-risk).
//   npm run price:scenarios
import { runPricingScenarios } from '../src/core/pricingScenarioRunner.js';

const results = await runPricingScenarios();

console.log('\nTradeShield AI pricing scenarios');
console.log('='.repeat(72));
for (const r of results) {
  const parts = [
    r.name.padEnd(18),
    `${r.payout_speed.padEnd(9)}`,
    `issue=${r.final_issue_price_usd.toFixed(3)}`,
    `risk=${r.risk_level}(${r.risk_score_bps}bps)`,
    `action=${r.pricing_action}`
  ];
  if (r.offering_final_state) parts.push(`offering=${r.offering_final_state}`);
  console.log(parts.join(' | '));
}

const actions = results.reduce((acc, r) => {
  acc[r.pricing_action] = (acc[r.pricing_action] ?? 0) + 1;
  return acc;
}, {});
console.log('\nAction coverage');
console.log(JSON.stringify(actions, null, 2));
console.log(`\n${results.length} pricing scenarios passed.`);
