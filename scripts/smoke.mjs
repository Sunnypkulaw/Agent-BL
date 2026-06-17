import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from '../src/app/server.js';
import { PRICING_ACTIONS } from '../src/core/pricingSchema.js';

const warCase = JSON.parse(await fs.readFile('data/cases/copper-sg-shanghai-warcrisis.case.json', 'utf8'));
const copperCase = JSON.parse(await fs.readFile('data/cases/copper-sg-shanghai.case.json', 'utf8'));

const server = createServer();
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
  assert.equal(health.ok, true);

  const demo = await fetch(`${baseUrl}/api/demo-data`).then((r) => r.json());
  assert.equal(demo.bill_of_lading.bl_id, 'EBL-2026-0001');

  const workflow = await fetch(`${baseUrl}/api/workflow/simulate`, { method: 'POST' }).then((r) => r.json());
  assert.ok(workflow.risk_report.evidence_hash.startsWith('0x'));
  assert.ok(workflow.steps.length >= 5);

  // BE-9: the legacy RiskReport endpoint stays available.
  const risk = await fetch(`${baseUrl}/api/risk/analyze`, { method: 'POST' }).then((r) => r.json());
  assert.ok(risk.evidence_hash.startsWith('0x'));
  assert.ok(risk.contract_action);

  const scenarios = await fetch(`${baseUrl}/api/scenarios`).then((r) => r.json());
  assert.equal(scenarios.ok, true);
  assert.ok(scenarios.scenarios.length >= 5);
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'APPROVE_FINANCING'));
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'TRIGGER_LIQUIDATION'));
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'FREEZE_POOL'));
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'CONTINUE_WITH_WARNING'));
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'TRIGGER_MARGIN_CALL'));
  // BE-3: AI dynamic-pricing quote (empty body -> demo case).
  const quote = await fetch(`${baseUrl}/api/pricing/quote`, { method: 'POST' }).then((r) => r.json());
  assert.ok(quote.final_issue_price_usd > 0 && quote.final_issue_price_usd <= 1, 'issue price in (0,1]');
  assert.ok(quote.quote_hash.startsWith('0x') && quote.evidence_hash.startsWith('0x'));
  assert.ok(PRICING_ACTIONS.includes(quote.pricing_action));
  assert.ok(quote.target_redemption_exposure_usd <= quote.max_safe_redemption_exposure_usd + 1, 'collateral guardrail holds');

  // compare=true returns all three payout speeds + a recommendation.
  const comparison = await fetch(`${baseUrl}/api/pricing/quote?compare=true`, { method: 'POST' }).then((r) => r.json());
  assert.equal(comparison.quotes.length, 3);
  assert.ok(comparison.recommended_payout_speed);

  // A war-crisis case posted as the body is priced directly and pauses.
  const paused = await fetch(`${baseUrl}/api/pricing/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(warCase)
  }).then((r) => r.json());
  assert.equal(paused.pricing_action, 'PAUSE_OFFERING');

  // An invalid payout_speed is a client error.
  const badSpeed = await fetch(`${baseUrl}/api/pricing/quote?payout_speed=INSTANT`, { method: 'POST' });
  assert.equal(badSpeed.status, 400);

  // BE-4: RWA offering lifecycle (empty body -> demo case runs to a terminal state).
  const offering = await fetch(`${baseUrl}/api/offering/simulate`, { method: 'POST' }).then((r) => r.json());
  assert.ok(offering.steps.length >= 2);
  assert.equal(offering.steps[0].state, 'Created');
  assert.ok(['Redeemed', 'InTransit', 'Repriced', 'Paused', 'Frozen'].includes(offering.final_state));

  // A mid-transit risk shock reprices the open copper offering but it still settles.
  const repriced = await fetch(`${baseUrl}/api/offering/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      case: copperCase,
      payout_speed: 'FAST',
      events: [
        { category: 'macro', type: 'severe_weather', severity: 'warning', region: 'East China Sea', description: 'typhoon' },
        { category: 'shipment', type: 'route_deviation', severity: 'warning', description: 'reroute' }
      ]
    })
  }).then((r) => r.json());
  assert.ok(repriced.steps.some((s) => s.state === 'Repriced'), 'offering reprices on risk shock');
  assert.equal(repriced.final_state, 'Redeemed');

  // BE-6: merged pricing + risk + offering workflow simulation.
  const merged = await fetch(`${baseUrl}/api/workflow/pricing-simulate`, { method: 'POST' }).then((r) => r.json());
  assert.ok(merged.pricing_quote && merged.risk_report && merged.offering, 'merged workflow has all three parts');
  assert.equal(merged.final_state, merged.offering.final_state);
  assert.equal(merged.risk_report.pricing_action, merged.pricing_quote.pricing_action);

  // BE-8: on-chain oracle update payload carries both anchoring hashes.
  const oracle = await fetch(`${baseUrl}/api/oracle/pricing-update?pool_id=POOL-SMOKE`, { method: 'POST' }).then((r) => r.json());
  assert.match(oracle.evidence_hash, /^0x[0-9a-f]{64}$/);
  assert.match(oracle.quote_hash, /^0x[0-9a-f]{64}$/);
  assert.equal(oracle.pool_id, 'POOL-SMOKE');
  assert.ok(oracle.pricing_action && oracle.offering_state);

  // MCP endpoints
  const mcpTools = await fetch(`${baseUrl}/api/mcp/tools`).then((r) => r.json());
  assert.equal(mcpTools.ok, true);
  assert.equal(mcpTools.tools.length, 5);

  const mcpCall = await fetch(`${baseUrl}/api/mcp/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool: 'get_trade_case', params: { case_id: 'CASE-EBL-2026-0001' } })
  }).then((r) => r.json());
  assert.equal(mcpCall.ok, true);
  assert.equal(mcpCall.result.case_id, 'CASE-EBL-2026-0001');

  // RAG endpoints
  const ragSearch = await fetch(`${baseUrl}/api/rag/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'copper' })
  }).then((r) => r.json());
  assert.equal(ragSearch.ok, true);
  assert.ok(ragSearch.match_count > 0);

  const judgeQA = await fetch(`${baseUrl}/api/rag/judge-qa`).then((r) => r.json());
  assert.equal(judgeQA.ok, true);
  assert.equal(judgeQA.pairs.length, 4);

  // Skill endpoints
  const skillPricing = await fetch(`${baseUrl}/api/skill/pricing-analyst`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ case_id: 'CASE-EBL-2026-0001' })
  }).then((r) => r.json());
  assert.equal(skillPricing.ok, true);
  assert.equal(skillPricing.status, 'ok');

  const skillDemo = await fetch(`${baseUrl}/api/skill/demo-operator`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ case_id: 'CASE-EBL-2026-0001' })
  }).then((r) => r.json());
  assert.equal(skillDemo.ok, true);
  assert.equal(skillDemo.status, 'ok');

  console.log('smoke passed: health, demo data, risk, workflow, scenarios, pricing quote, offering, merged workflow, oracle update, MCP, RAG and Skill harness work.');
} finally {
  server.close();
}
