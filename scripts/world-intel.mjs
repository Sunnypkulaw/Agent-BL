// CLI: run the xAPI world-risk agent on a trade case, then re-price with the
// live signals folded in. Default case: copper Singapore -> Shanghai (war crisis).
//
//   npm run intel                                   # offline fixtures (no key)
//   node scripts/world-intel.mjs data/cases/copper-sg-shanghai.case.json
//
// Set XAPI_KEY in .env to pull REAL signals (Twitter/X + Google News + prediction
// markets) through xAPI. Register: `npx xapi-to register` (invite code: xapito),
// then `npx xapi-to oauth bind --provider twitter`. With no key it runs offline.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { assessWorldRisk } from '../src/agent/worldRiskAgent.js';
import { repriceWithWorldRisk } from '../src/core/worldRiskPricing.js';
import { isXapiConfigured } from '../src/agent/xapi/xapiClient.js';

// --- tiny .env loader (no dependency), same as scripts/agent-valuation.mjs ---
function loadEnv(path = '.env') {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const caseFile = process.argv[2] ?? 'data/cases/copper-sg-shanghai-warcrisis.case.json';
const caseData = JSON.parse(await fsp.readFile(caseFile, 'utf8'));

console.log('\nTradeShield · xAPI world-risk intelligence');
console.log('='.repeat(52));
console.log(`Case   : ${caseData.case_id}  (${caseFile})`);
console.log(`xAPI   : ${isXapiConfigured() ? 'configured (XAPI_KEY) -> live signals' : 'no key -> offline fixtures'}`);

const assessment = await assessWorldRisk(caseData);

console.log('');
console.log('Queries sent to xAPI');
for (const [k, v] of Object.entries(assessment.queried)) console.log(`  ${k.padEnd(13)}: ${v}`);
console.log(`  exposure     : ${assessment.profile.route_region}${assessment.profile.hormuz_exposed ? '  (chokepoint!)' : ''}`);

const fmtTweet = (t) => `  @${t.author ?? '?'}: ${(t.text ?? '').replace(/\s+/g, ' ').slice(0, 110)}`;
console.log('');
console.log(`Signals  (provider: ${assessment.provider}, live: ${assessment.live})`);
console.log(`  tweets            : ${assessment.signals.tweets.length}   [${assessment.sources.tweets}]`);
for (const t of assessment.signals.tweets.slice(0, 2)) console.log(fmtTweet(t));
console.log(`  official posts    : ${assessment.signals.officials.length}   [${(assessment.sources.officials || []).join(', ')}]`);
for (const t of assessment.signals.officials.slice(0, 1)) console.log(fmtTweet(t));
console.log(`  news              : ${assessment.signals.news.length}   [${assessment.sources.news}]`);
for (const n of assessment.signals.news.slice(0, 2)) console.log(`  • ${n.title}  (${n.source ?? 'n/a'})`);
console.log(`  prediction markets: ${assessment.signals.prediction_markets.length}   [${assessment.sources.prediction_markets}]`);
for (const m of assessment.signals.prediction_markets.slice(0, 3)) {
  console.log(`  ⌁ ${Math.round((m.implied_prob ?? 0) * 100)}%  ${m.market}`);
}

console.log('');
console.log('Derived macro_risk_events (fed into the pricing engine)');
for (const e of assessment.events) {
  console.log(`  [${e.severity.toUpperCase().padEnd(8)}] ${e.type.padEnd(20)} ${e.region}   (${e.signal_count} signal(s))`);
  for (const ev of e.evidence.slice(0, 1)) console.log(`        ↳ ${ev}`);
}
if (assessment.events.length === 0) console.log('  (none — no elevated signals)');

const { before, after, delta } = repriceWithWorldRisk(caseData, assessment.events);
console.log('');
console.log('Re-pricing with live world risk folded in');
console.log(`  BEFORE : issue $${before.final_issue_price_usd.toFixed(2)}  · risk ${before.risk_score_bps}bps ${before.risk_level}  · ${before.pricing_action}`);
console.log(`  AFTER  : issue $${after.final_issue_price_usd.toFixed(2)}  · risk ${after.risk_score_bps}bps ${after.risk_level}  · ${after.pricing_action}`);
console.log(`  Δ      : price ${delta.issue_price_usd >= 0 ? '+' : ''}${delta.issue_price_usd.toFixed(2)}  · risk +${delta.risk_score_bps}bps`
  + `${delta.action_changed ? `  · action ${delta.from.pricing_action} → ${delta.to.pricing_action}` : ''}`);

console.log('');
console.log('AI summary');
console.log(`  ${assessment.summary}`);
console.log(`\nevidence_hash: ${assessment.evidence_hash}`);

if (!assessment.live) {
  console.log('\n(Tip) No XAPI_KEY found — ran on offline fixtures. Add XAPI_KEY to .env for live');
  console.log('      Twitter/X + Google News + prediction-market signals. See docs/xapi-integration.md.');
}
