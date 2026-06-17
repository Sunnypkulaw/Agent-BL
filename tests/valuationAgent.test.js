import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { computeCargoValuation } from '../src/agent/tools/copperValuationTools.js';
import { resolveProvider } from '../src/agent/llm/openaiCompatClient.js';
import { runValuationAgent, suggestHaircut } from '../src/agent/valuationAgent.js';

const copperCase = JSON.parse(await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8'));

test('computeCargoValuation takes the conservative minimum and applies the haircut', () => {
  const v = computeCargoValuation({
    quantity_mt: 500,
    market_price_usd_per_mt: 13680,
    premium_usd_per_mt: 70,
    declared_invoice_value_usd: 6875000,
    insured_value_usd: 7562500,
    volatility_haircut_pct: 0.05,
    redemption_coverage_limit: 0.9
  });
  assert.equal(v.landed_price_usd_per_mt, 13750);
  assert.equal(v.market_value_usd, 6875000);
  assert.equal(v.raw_verified_value_usd, 6875000); // min(declared, market, insured)
  assert.equal(v.ai_verified_collateral_value_usd, 6531250); // 6,875,000 * 0.95
  assert.equal(v.max_safe_redemption_exposure_usd, 5878125); // * 0.9
});

test('suggestHaircut sums war + volatility macro risk into 5% for the copper case', () => {
  assert.equal(suggestHaircut(copperCase), 0.05);
});

test('runValuationAgent (deterministic) returns market valuation + historical comparables', async () => {
  const report = await runValuationAgent(copperCase, { forceDeterministic: true });

  assert.equal(report.provider, 'deterministic-fallback');
  assert.equal(report.commodity, 'Copper Cathode');
  assert.equal(report.hs_code, '740311');
  assert.ok(report.live_market.price_usd_per_mt > 0);
  assert.ok(report.historical_comparables.length >= 3);

  const v = report.valuation;
  // Core invariants: collateral floor never exceeds market value, redemption never exceeds collateral.
  assert.ok(v.ai_verified_collateral_value_usd <= v.market_value_usd);
  assert.ok(v.max_safe_redemption_exposure_usd <= v.ai_verified_collateral_value_usd);
  // Requested cash must fit under the safe redemption exposure.
  assert.ok(copperCase.financing.requested_cash_usd <= v.max_safe_redemption_exposure_usd);
  assert.equal(report.tool_trace.length, 4);
});

test('resolveProvider selects by env key and returns null when none set', () => {
  assert.equal(resolveProvider({ DEEPSEEK_API_KEY: 'x' }).provider, 'deepseek');
  assert.equal(resolveProvider({ DASHSCOPE_API_KEY: 'x' }).provider, 'qwen');
  assert.equal(resolveProvider({ LLM_BASE_URL: 'https://h/v1', LLM_API_KEY: 'x' }).provider, 'custom');
  assert.equal(resolveProvider({}), null);
});

test('resolveProvider wires Tencent hy3-preview, locks the model, and wins on tie', () => {
  const p = resolveProvider({ Tencent_API_KEY: 'x', Tencent_BASE_URL: 'https://tokenhub.tencentmaas.com/v1/' });
  assert.equal(p.provider, 'tencent');
  assert.equal(p.model, 'hy3-preview');
  assert.equal(p.baseUrl, 'https://tokenhub.tencentmaas.com/v1'); // trailing slash trimmed
  // Only hy3-preview is allowed on this account: LLM_MODEL cannot override it.
  assert.equal(resolveProvider({ Tencent_API_KEY: 'x', LLM_MODEL: 'hunyuan-pro' }).model, 'hy3-preview');
  // With multiple keys set, Tencent wins (user instruction: use hy3-preview).
  assert.equal(resolveProvider({ Tencent_API_KEY: 'x', DASHSCOPE_API_KEY: 'y' }).provider, 'tencent');
  // qwen can still pick up a custom DashScope base URL.
  assert.equal(resolveProvider({ DASHSCOPE_API_KEY: 'y', DASHSCOPE_BASE_URL: 'https://ds/v1' }).baseUrl, 'https://ds/v1');
});

test('AI-9: a configured LLM that errors falls back to the deterministic valuation', async () => {
  // env has a provider key, so the agent takes the LLM path; the injected chat
  // throws, exercising the deterministic fallback with no network call.
  const failingChat = async () => {
    throw new Error('provider 500: upstream timeout');
  };
  const report = await runValuationAgent(copperCase, {
    env: { DEEPSEEK_API_KEY: 'test-key' },
    chat: failingChat
  });

  assert.equal(report.provider, 'deterministic-fallback');
  assert.match(report.ai_explanation, /LLM error/);
  assert.ok(report.valuation.ai_verified_collateral_value_usd > 0);
  assert.equal(report.tool_trace.length, 4); // all four tools ran deterministically
});

test('AI-9: a working injected LLM drives the tool loop and reports its provider', async () => {
  // Minimal fake model: no tool calls, just returns a final explanation. The
  // agent then backfills the valuation deterministically (no network).
  const fakeChat = async () => ({ role: 'assistant', content: 'Verified collateral looks conservative.' });
  const report = await runValuationAgent(copperCase, {
    env: { DEEPSEEK_API_KEY: 'test-key' },
    chat: fakeChat
  });

  assert.equal(report.provider, 'deepseek');
  assert.ok(report.valuation.ai_verified_collateral_value_usd > 0);
});
