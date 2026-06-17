import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { assessWorldRisk, scoreWorldSignals, buildQueryProfile } from '../src/agent/worldRiskAgent.js';
import { mergeWorldRiskIntoCase, repriceWithWorldRisk } from '../src/core/worldRiskPricing.js';
import { scoreRisk } from '../src/core/pricingEngine.js';

const VALID_TYPES = new Set([
  'war_risk', 'sanction_risk', 'commodity_volatility', 'fx_volatility',
  'port_congestion', 'severe_weather', 'buyer_country_risk'
]);
const VALID_SEVERITIES = new Set(['info', 'warning', 'critical']);

const copperCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);

// A fake xAPI executor: returns the { success, data } envelope per action id,
// so we exercise the live parse path with no network (like valuationAgent's
// injected `chat`).
function fakeExecute(success = true) {
  return async (actionId) => {
    if (!success) return { success: false, data: { statusCode: 401, error: 'Unauthorized', message: 'bad key' } };
    switch (actionId) {
      case 'twitter.search_timeline':
        return { success: true, data: { tweets: [
          { id: '1', full_text: 'Strait of Hormuz closure after overnight attack; convoys halted.', author: { screen_name: 'GulfWatch' } }
        ] } };
      case 'twitter.user_by_screen_name':
        return { success: true, data: { rest_id: '999' } };
      case 'twitter.user_tweets':
        return { success: true, data: { tweets: [
          { id: '2', full_text: 'New sanctions package announced targeting Gulf shipping.', author: { screen_name: 'StateDeptDemo' } }
        ] } };
      case 'web.search.news':
        return { success: true, data: { news: [
          { title: 'Copper hits record high on supply shock', snippet: 'prices surge', source: 'Markets' }
        ] } };
      case 'web.search.realtime':
        return { success: true, data: { organic: [
          { title: 'Polymarket: Strait of Hormuz closure', snippet: 'market currently prices a 45% chance of closure', link: 'https://polymarket.com/x' }
        ] } };
      default:
        return { success: true, data: {} };
    }
  };
}

test('XAPI: offline fallback (no key) yields valid macro_risk_events', async () => {
  const out = await assessWorldRisk(copperCase, { env: {} });
  assert.equal(out.live, false);
  assert.ok(Array.isArray(out.events) && out.events.length >= 1);
  for (const e of out.events) {
    assert.ok(VALID_TYPES.has(e.type), `unexpected type ${e.type}`);
    assert.ok(VALID_SEVERITIES.has(e.severity), `unexpected severity ${e.severity}`);
    assert.equal(typeof e.region, 'string');
    assert.ok(Array.isArray(e.evidence));
  }
  assert.match(out.evidence_hash, /^0x[0-9a-f]{64}$/);
});

test('XAPI: derived events raise the cargo risk score fed to the pricing engine', async () => {
  const base = scoreRisk(copperCase).risk_score_bps;
  const out = await assessWorldRisk(copperCase, { env: {} });
  const merged = mergeWorldRiskIntoCase(copperCase, out.events);
  const raised = scoreRisk(merged).risk_score_bps;
  assert.ok(raised > base, `expected ${raised} > ${base}`);
});

test('XAPI: an injected live executor produces live signals and the right risk types', async () => {
  const out = await assessWorldRisk(copperCase, { env: {}, execute: fakeExecute(true) });
  assert.equal(out.live, true);
  const types = new Set(out.events.map((e) => e.type));
  assert.ok(types.has('war_risk'));
  assert.ok(types.has('commodity_volatility'));
  assert.ok(types.has('sanction_risk'));
  // war_risk should be critical: a "closure/attack" tweet + a 45% prediction-market closure odds.
  const war = out.events.find((e) => e.type === 'war_risk');
  assert.equal(war.severity, 'critical');
});

test('XAPI: an auth failure falls back to fixtures without throwing', async () => {
  const out = await assessWorldRisk(copperCase, { env: {}, execute: fakeExecute(false) });
  assert.equal(out.live, false);
  assert.ok(Array.isArray(out.events)); // fixtures still produce events
});

test('XAPI: re-pricing with world risk lowers the issue price or escalates the action', async () => {
  const out = await assessWorldRisk(copperCase, { env: {} });
  const { before, after, delta } = repriceWithWorldRisk(copperCase, out.events);
  assert.ok(after.risk_score_bps >= before.risk_score_bps);
  const lowerOrPaused = after.final_issue_price_usd <= before.final_issue_price_usd + 1e-9
    || after.pricing_action !== before.pricing_action;
  assert.ok(lowerOrPaused, `price ${before.final_issue_price_usd}->${after.final_issue_price_usd}, action ${before.pricing_action}->${after.pricing_action}`);
  assert.equal(typeof delta.risk_score_bps, 'number');
});

test('XAPI: scoreWorldSignals maps a prediction-market probability to severity', () => {
  const profile = buildQueryProfile(copperCase);
  const events = scoreWorldSignals({
    tweets: [], officials: [], news: [],
    prediction_markets: [{ market: 'Strait of Hormuz closure', question: 'closed in 2026?', implied_prob: 0.41, platform: 'Polymarket' }]
  }, profile);
  const war = events.find((e) => e.type === 'war_risk');
  assert.ok(war, 'expected a war_risk event from the closure market');
  assert.equal(war.severity, 'critical'); // 0.41 >= 0.40
});
