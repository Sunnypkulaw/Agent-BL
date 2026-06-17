// Pricing scenario harness (BE-5 / AI-4 / AI-10).
//
// Regression fixtures for the AI pricing path: fast payout, balanced payout, and
// high-risk repricing / pause. Each fixture is a thin OVERRIDE on a base case
// (so fixtures stay tiny) plus expectations on the produced PricingQuote and,
// optionally, on the offering lifecycle after risk events arrive.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quoteFromCase } from './pricingEngine.js';
import { simulateOffering } from './offeringSimulator.js';
import { assertPricingQuote } from './pricingSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

function fromRoot(rel) {
  return path.isAbsolute(rel) ? rel : path.join(rootDir, rel);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge override into base. Objects merge; arrays and scalars replace. */
function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return out;
}

async function readJson(rel) {
  return JSON.parse(await fs.readFile(fromRoot(rel), 'utf8'));
}

export async function listPricingScenarioFiles(dir = fromRoot('data/pricing-scenarios')) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => path.join(dir, e.name)).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/** Load a fixture and build the effective case data from base_case + overrides. */
export async function loadPricingScenario(file) {
  const fixture = await readJson(file);
  const base = fixture.base_case ? await readJson(fixture.base_case) : {};
  const caseData = deepMerge(base, fixture.overrides ?? {});
  return { fixture, caseData, name: fixture.name ?? path.basename(file, '.json') };
}

function checkRange(value, min, max, label, errors) {
  if (min !== undefined && value < min) errors.push(`${label} ${value} < min ${min}`);
  if (max !== undefined && value > max) errors.push(`${label} ${value} > max ${max}`);
}

/** Run one scenario: assert the quote and (optionally) the offering lifecycle. */
export function runPricingScenario({ fixture, caseData, name }) {
  const payoutSpeed = fixture.pricing_expectations?.payout_speed ?? caseData.financing?.payout_speed;
  const quote = quoteFromCase(caseData, { payout_speed: payoutSpeed });
  assertPricingQuote(quote, caseData);

  const errors = [];
  const exp = fixture.pricing_expectations ?? {};
  if (exp.pricing_action && quote.pricing_action !== exp.pricing_action) {
    errors.push(`pricing_action expected ${exp.pricing_action}, got ${quote.pricing_action}`);
  }
  if (exp.binding_constraint && quote.binding_constraint !== exp.binding_constraint) {
    errors.push(`binding_constraint expected ${exp.binding_constraint}, got ${quote.binding_constraint}`);
  }
  if (exp.risk_level && quote.risk_level !== exp.risk_level) {
    errors.push(`risk_level expected ${exp.risk_level}, got ${quote.risk_level}`);
  }
  checkRange(quote.final_issue_price_usd, exp.min_issue_price, exp.max_issue_price, 'final_issue_price', errors);

  let offering;
  const offExp = fixture.offering_expectations;
  if (offExp) {
    offering = simulateOffering(caseData, { payout_speed: payoutSpeed, events: offExp.events ?? [] });
    if (offExp.final_state && offering.final_state !== offExp.final_state) {
      errors.push(`offering final_state expected ${offExp.final_state}, got ${offering.final_state}`);
    }
    // A reprice (or pause) is an intermediate lifecycle event: a healthy pool
    // that is repriced mid-transit still settles to Redeemed, so assert the
    // event appears in the state sequence rather than as the terminal state.
    const lifecycle = offering.steps.map((s) => s.state);
    for (const wanted of offExp.includes_states ?? []) {
      if (!lifecycle.includes(wanted)) {
        errors.push(`offering lifecycle expected to include ${wanted}, got [${lifecycle.join(', ')}]`);
      }
    }
  }

  if (errors.length > 0) throw new Error(`Pricing scenario "${name}" failed: ${errors.join('; ')}`);

  return {
    name,
    case_id: quote.case_id,
    payout_speed: quote.payout_speed,
    final_issue_price_usd: quote.final_issue_price_usd,
    risk_level: quote.risk_level,
    risk_score_bps: quote.risk_score_bps,
    pricing_action: quote.pricing_action,
    binding_constraint: quote.binding_constraint,
    exporter_profit_share_bps: quote.exporter_profit_share_bps,
    implied_gross_yield_bps: quote.implied_gross_yield_bps,
    offering_final_state: offering?.final_state ?? null,
    offering_states: offering ? offering.steps.map((s) => s.state) : null
  };
}

export async function runPricingScenarios(dir) {
  const files = await listPricingScenarioFiles(dir);
  const loaded = await Promise.all(files.map(loadPricingScenario));
  return loaded.map(runPricingScenario);
}
