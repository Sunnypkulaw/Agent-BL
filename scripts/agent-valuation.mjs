// CLI: run the AI valuation agent on a trade case (default: copper Singapore -> Shanghai).
//
//   npm run agent:value                      # copper case, offline deterministic fallback
//   node scripts/agent-valuation.mjs data/cases/crude-sg-ulsan.case.json
//
// Put API keys in a .env file (loaded below) to use a real LLM + live data:
//   DEEPSEEK_API_KEY=...   or   DASHSCOPE_API_KEY=...   (LLM)
//   ALPHAVANTAGE_API_KEY=... / METALPRICE_API_KEY=...   (live price)
//   COMTRADE_PRIMARY_KEY=...                            (historical comparables)

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { runValuationAgent } from '../src/agent/valuationAgent.js';
import { isConfigured, resolveProvider } from '../src/agent/llm/openaiCompatClient.js';

// --- tiny .env loader (no dependency) ---
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

const caseFile = process.argv[2] ?? 'data/cases/copper-sg-shanghai.case.json';
const caseData = JSON.parse(await fsp.readFile(caseFile, 'utf8'));

const provider = resolveProvider();
console.log('\nTradeShield AI valuation agent');
console.log('='.repeat(46));
console.log(`Case        : ${caseData.case_id}  (${caseFile})`);
console.log(`LLM         : ${isConfigured() ? `${provider.provider} / ${provider.model}` : 'none -> deterministic fallback'}`);
console.log('');

const report = await runValuationAgent(caseData);

console.log(`Commodity   : ${report.commodity} (HS ${report.hs_code}), ${report.quantity_mt} MT`);
console.log('');
console.log('Live market');
console.log(`  price             : USD ${report.live_market.price_usd_per_mt} / MT  (as of ${report.live_market.as_of ?? 'n/a'})`);
console.log(`  regional premium  : USD ${report.live_market.regional_premium_usd_per_mt} / MT`);
console.log(`  landed price      : USD ${report.live_market.landed_price_usd_per_mt} / MT`);
console.log(`  sources           : ${report.live_market.sources.join(' | ')}`);
console.log('');
console.log('Historical comparable transaction prices (HS ' + report.hs_code + ')');
for (const c of report.historical_comparables) {
  console.log(`  ${String(c.period).padEnd(8)} ${String(c.partner).padEnd(8)} USD ${c.unit_value_usd_per_mt} / MT   [${c.source}]`);
}
console.log(`  source            : ${report.historical_source}`);
console.log('');
console.log('Valuation');
const v = report.valuation;
console.log(`  market value          : USD ${v.market_value_usd}`);
console.log(`  declared invoice      : USD ${v.declared_invoice_value_usd}`);
console.log(`  insured value         : USD ${v.insured_value_usd}`);
console.log(`  volatility haircut    : ${Math.round(v.volatility_haircut_pct * 100)}%`);
console.log(`  AI verified collateral: USD ${v.ai_verified_collateral_value_usd}`);
console.log(`  max safe redemption   : USD ${v.max_safe_redemption_exposure_usd}`);
console.log(`  basis                 : ${v.valuation_basis}`);
console.log('');
console.log('AI explanation');
console.log('  ' + report.ai_explanation);
console.log('');
console.log('Tool calls');
for (const t of report.tool_trace) {
  console.log(`  -> ${t.tool}  [${t.source ?? 'n/a'}]`);
}
console.log(`\nprovider: ${report.provider}`);

if (report.provider === 'deterministic-fallback') {
  console.log('\n(Tip) No LLM key found. Add DEEPSEEK_API_KEY or DASHSCOPE_API_KEY to .env to let the model drive the tools.');
  console.log('      See docs/ai-valuation-tooling.md for all API keys and how to get them.');
}
