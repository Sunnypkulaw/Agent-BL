// `npm run demo:default` — why the AI risk discount is NOT free money.
//
//   node scripts/demo-default.mjs
//   node scripts/demo-default.mjs data/cases/copper-sg-shanghai.case.json
//
// Runs the SAME funded copper offering to three different settlements so you can
// see that "1.00 redemption" is a TARGET, not a guarantee:
//
//   1. REPAID            importer pays  -> investors redeem at 1.00, earn the discount
//   2. DEFAULT (tail)    importer walks after a war-premium retrace + price crash;
//                        insurer disputes the war loss -> liquidation recovers little
//                        -> investors recover BELOW what they paid and LOSE money
//   3. DEFAULT (mild)    importer just goes bankrupt, cargo still sound -> the
//                        over-collateral buffer absorbs it -> investors ~whole
//
// The point: investors are only "guaranteed" a profit if default never happens.
// It does. The discount the AI sets is the PRICE of that default risk — so the
// riskier the trade, the cheaper the RWA must be sold to compensate. Remove the
// risk pricing and you either rob safe exporters or hand investors a loss they
// were never paid to take.

import fsp from 'node:fs/promises';
import { simulateOffering } from '../src/core/offeringSimulator.js';

const caseFile = process.argv[2] ?? 'data/cases/copper-sg-shanghai.case.json';
const caseData = JSON.parse(await fsp.readFile(caseFile, 'utf8'));

const usd = (n) => 'USD ' + Math.round(n).toLocaleString('en-US');
const signedUsd = (n) => (n < 0 ? '-' : '+') + usd(Math.abs(n));
const pct = (frac) => (frac * 100).toFixed(1) + '%';

// War escalates in transit -> the AI reprices the discount wider for new money.
const warEscalation = [
  { category: 'macro', type: 'war_risk', region: 'Strait of Hormuz', severity: 'warning', description: 'Hormuz tensions escalate; broad war premium across metals.' },
  { category: 'shipment', type: 'route_deviation', severity: 'warning', description: 'Vessel reroutes around the advisory zone; longer transit.' }
];

const SCENARIOS = [
  {
    title: '1) REPAID — importer pays, investors earn the discount',
    opts: { payout_speed: 'FAST' }
  },
  {
    title: '2) DEFAULT (tail) — war retrace + price crash + insurer disputes the loss',
    opts: {
      payout_speed: 'FAST',
      events: warEscalation,
      settlement: 'IMPORTER_DEFAULT',
      recovery_rate: 0.45, // seized copper re-marked far below the war-premium invoice; war exclusion bites
      default_reason: 'copper crashes as the war premium unwinds; importer abandons the contract and the war-exclusion clause guts the insurance claim'
    }
  },
  {
    title: '3) DEFAULT (mild) — importer bankruptcy, cargo still sound',
    opts: {
      payout_speed: 'FAST',
      settlement: 'IMPORTER_DEFAULT', // no recovery_rate -> derived from trade risk (good realization)
      default_reason: 'importer enters insolvency, but the cargo is undamaged and sells near market'
    }
  }
];

console.log('\nTradeShield — RWA settlement: why 1.00 is a target, not a guarantee');
console.log('='.repeat(72));
console.log(`Case   : ${caseData.case_id}  (${caseFile})`);
console.log(`Cargo  : ${caseData.cargo?.commodity ?? caseData.bill_of_lading?.cargo}  ${caseData.bill_of_lading?.port_of_loading} -> ${caseData.bill_of_lading?.port_of_discharge}`);

for (const scenario of SCENARIOS) {
  const offering = simulateOffering(caseData, scenario.opts);
  const q = offering.initial_quote;
  const s = offering.settlement;

  console.log('\n' + '-'.repeat(72));
  console.log(scenario.title);
  console.log('-'.repeat(72));
  console.log(`Priced : issue ${q.final_issue_price_usd.toFixed(3)}/token  |  supply ${q.recommended_token_supply.toLocaleString('en-US')}  |  risk ${q.risk_level} (${q.risk_score_bps}bps)`);

  console.log('Lifecycle:');
  for (const step of offering.steps) {
    console.log(`  ${step.state.padEnd(12)} [${step.actor}] ${step.event}`);
  }

  console.log(`Final state: ${offering.final_state}`);
  if (s) {
    const redeem = s.redemption_value_per_token;
    const pricePaid = offering.subscription.tokens > 0 ? offering.subscription.raised_usd / offering.subscription.tokens : 0;
    console.log('Investor P&L:');
    console.log(`  paid ${pricePaid.toFixed(3)}/token  ->  ${s.outcome === 'REPAID' ? 'redeemed' : 'recovered'} ${redeem.toFixed(3)}/token`);
    if (s.liquidation) {
      const liq = s.liquidation;
      console.log(`  liquidation: collateral ${usd(liq.ai_verified_collateral_value_usd)} x ${pct(liq.realization_rate)} realized = ${usd(liq.recoverable_value_usd)}  (owed ${usd(liq.amount_owed_usd)})`);
    }
    console.log(`  capital ${usd(s.investor_capital_usd)}  ->  proceeds ${usd(s.investor_proceeds_usd)}  =  ${signedUsd(s.investor_pnl_usd)} (${pct(s.investor_return_pct)})`);
  }
}

console.log('\n' + '='.repeat(72));
console.log('Takeaway: same offering, same 1.00 target — investors PROFIT when the trade');
console.log('settles and LOSE when a tail default outruns the collateral buffer. The AI');
console.log('discount is the price of that tail. No risk pricing => mispriced RWA.');
