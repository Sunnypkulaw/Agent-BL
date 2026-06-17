// CLI: AI dynamic pricing for an eBL-backed RWA offering.
//
//   npm run price                                        # copper SG -> Shanghai
//   node scripts/price.mjs data/cases/crude-sg-ulsan.case.json
//   node scripts/price.mjs data/cases/copper-sg-shanghai.case.json FAST
//
// Pure / deterministic / offline: it derives the AI-verified collateral, the
// exporter's verified trade profit and the trade-risk score from the case, then
// prices FAST / BALANCED / LOW_COST payout side by side so you can see the
// "speed vs cost-of-financing" trade-off and the share of profit each costs.

import fsp from 'node:fs/promises';
import { compareSpeeds, quoteFromCase } from '../src/core/pricingEngine.js';

const caseFile = process.argv[2] ?? 'data/cases/copper-sg-shanghai.case.json';
const onlySpeed = process.argv[3];
const caseData = JSON.parse(await fsp.readFile(caseFile, 'utf8'));

const usd = (n) => 'USD ' + Math.round(n).toLocaleString('en-US');
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

console.log('\nTradeShield AI dynamic pricing — eBL-backed RWA offering');
console.log('='.repeat(64));
console.log(`Case        : ${caseData.case_id}  (${caseFile})`);

const sample = quoteFromCase(caseData, onlySpeed ? { payout_speed: onlySpeed } : {});
console.log(`Cargo       : ${caseData.cargo?.commodity ?? caseData.bill_of_lading?.cargo}  ${caseData.bill_of_lading?.port_of_loading} -> ${caseData.bill_of_lading?.port_of_discharge}`);
console.log(`Collateral  : ${usd(sample.ai_verified_collateral_value_usd)} AI-verified  ->  max safe redemption ${usd(sample.max_safe_redemption_exposure_usd)} (coverage ${sample.redemption_coverage_limit})`);
console.log(`Exporter    : profit ${usd(sample.exporter_gross_profit_usd)} (margin ${(sample.exporter_gross_margin_pct * 100).toFixed(1)}%)  |  requested cash ${usd(sample.requested_cash_usd)}`);
console.log(`Trade risk  : ${sample.risk_level} (${sample.risk_score_bps}bps)  ${sample.risk_factors.join(' | ')}`);

const comparison = compareSpeeds(caseData, onlySpeed ? { payout_speed: onlySpeed } : {});
const rows = onlySpeed ? comparison.quotes.filter((q) => q.payout_speed === onlySpeed) : comparison.quotes;

console.log('\nPayout speed comparison (1 RWA = 1.00 USD target redemption, not guaranteed)');
console.log('-'.repeat(96));
console.log(
  [pad('speed', 10), padL('issue', 7), padL('supply', 12), padL('cash now', 14), padL('fin.cost', 13), padL('profit%', 8), padL('yield%', 7), padL('action', 18)].join(' ')
);
console.log('-'.repeat(96));
for (const q of rows) {
  console.log(
    [
      pad(q.payout_speed, 10),
      padL(q.final_issue_price_usd.toFixed(3), 7),
      padL(q.recommended_token_supply.toLocaleString('en-US'), 12),
      padL(usd(q.expected_cash_to_exporter_usd), 14),
      padL(usd(q.financing_cost_usd), 13),
      padL((q.exporter_profit_share_bps / 100).toFixed(1), 8),
      padL((q.implied_gross_yield_bps / 100).toFixed(1), 7),
      padL(q.pricing_action, 18)
    ].join(' ')
  );
}

const rec = comparison.recommended_quote;
console.log('\nAI recommendation: ' + comparison.recommended_payout_speed);
console.log('-'.repeat(64));
console.log('Investor explanation:');
console.log('  ' + rec.investor_explanation);
console.log('\nExporter explanation:');
console.log('  ' + rec.exporter_explanation);
console.log('\nEvidence hash: ' + rec.evidence_hash);
console.log('Binding constraint: ' + rec.binding_constraint + '  |  base ' + rec.base_issue_price_usd
  + '  - urgency ' + rec.urgency_discount_bps + 'bps - risk ' + rec.risk_discount_bps + 'bps  = indicative ' + rec.indicative_issue_price_usd
  + (rec.binding_constraint === 'COLLATERAL' ? `  -> floored to ${rec.final_issue_price_usd}` : ''));
