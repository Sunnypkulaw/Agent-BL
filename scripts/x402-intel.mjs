/**
 * x402 Intel CLI — AgentBL
 *
 * Command-line tool to query x402-protected premium risk intel.
 * Demonstrates the full HTTP 402 → payment → intel flow from the terminal.
 *
 * Usage:
 *   node scripts/x402-intel.mjs                          # default demo case
 *   node scripts/x402-intel.mjs --case copper-sg-shanghai # specific case
 *   node scripts/x402-intel.mjs --service premium-risk     # pick service
 *   BASE_URL=http://localhost:3000 node scripts/x402-intel.mjs
 */

import fs from 'node:fs/promises';
import { fetchPaidIntel } from '../src/x402/client.js';
import { X402_SERVICES } from '../src/x402/config.js';

const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
};

const serviceId = getArg('--service') || 'premium-risk';
const service = X402_SERVICES.find((s) => s.serviceId === serviceId);
if (!service) {
  console.error(`Unknown service: ${serviceId}`);
  console.error(`Available: ${X402_SERVICES.map((s) => s.serviceId).join(', ')}`);
  process.exit(1);
}

const caseFile = getArg('--case');
const caseData = caseFile
  ? JSON.parse(await fs.readFile(`data/cases/${caseFile}${caseFile.endsWith('.json') ? '' : '.case.json'}`, 'utf8'))
  : null;

console.log('═══════════════════════════════════════════════════');
console.log('  AgentBL x402 Paid Intel CLI');
console.log('═══════════════════════════════════════════════════');
console.log(`  Service:  ${service.title}`);
console.log(`  Price:    ${service.priceUSDC} USDC`);
console.log(`  Endpoint: ${service.endpoint}`);
console.log('───────────────────────────────────────────────────');

// Step 1: Try unpaid first
console.log('\n  [1/3] Requesting without payment (expecting HTTP 402)...');
const unpaidRes = await fetch(`${baseUrl}${service.endpoint}`, {
  headers: { Accept: 'application/json' }
});

if (unpaidRes.status === 402) {
  console.log(`  ✓ Server returned HTTP 402 Payment Required`);
  const priceUSDC = unpaidRes.headers.get('X-Price-USDC');
  const network = unpaidRes.headers.get('X-Network');
  console.log(`    Price: ${priceUSDC} USDC  |  Network: ${network}`);
} else {
  console.log(`  ⚠ Server returned ${unpaidRes.status} (expected 402 — might be in dev mode)`);
}

// Step 2: Pay and fetch
console.log('\n  [2/3] Paying with x402 and fetching intel...');
const result = await fetchPaidIntel(baseUrl, service.endpoint, {
  budgetUSDC: 0.01
});

if (result.x402_required && result.paid) {
  console.log(`  ✓ Payment settled — txHash: ${result.paymentTxHash || 'mock'}`);
} else if (!result.x402_required) {
  console.log(`  ℹ Endpoint returned intel without requiring payment (dev/demo mode)`);
}

// Step 3: Display results
console.log('\n  [3/3] Intel Results');
console.log('───────────────────────────────────────────────────');

const data = result.paid || result.unpaid;
if (data && data.ok !== false) {
  if (data.events) {
    console.log(`  Risk Events: ${data.events.length}`);
    for (const evt of data.events.slice(0, 5)) {
      console.log(`    • [${evt.severity || '?'}] ${evt.type || 'unknown'}: ${(evt.description || '').slice(0, 60)}`);
    }
    if (data.events.length > 5) console.log(`    ... and ${data.events.length - 5} more`);
  }

  if (data.deepIntel) {
    console.log(`\n  Deep Intel: ${data.deepIntel.length} entries`);
    for (const item of data.deepIntel.slice(0, 3)) {
      console.log(`    • [${item.type}] ${(item.snippet || '').slice(0, 80)}`);
    }
  }

  if (data.before_quote && data.after_quote) {
    console.log(`\n  Pricing Impact:`);
    console.log(`    Before: $${data.before_quote.final_issue_price_usd} (risk: ${data.before_quote.risk_level})`);
    console.log(`    After:  $${data.after_quote.final_issue_price_usd} (risk: ${data.after_quote.risk_level})`);
    console.log(`    Delta:  ${data.delta?.issue_price_delta_usd || 'N/A'}`);
  }
} else {
  console.log(`  ⚠ No intel data returned`);
  console.log(`  Error: ${JSON.stringify(data)}`);
}

console.log('\n═══════════════════════════════════════════════════');
console.log('  Done. x402 paid intel flow completed.');
console.log('═══════════════════════════════════════════════════');
