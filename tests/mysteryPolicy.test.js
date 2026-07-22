import assert from 'node:assert/strict';
import test from 'node:test';
import { hashCanonical } from '../src/mystery/fairness.js';
import {
  evaluateMysteryCandidate,
  filterMysteryCandidates,
  normalizeRiskPassport
} from '../src/mystery/policy.js';

const NOW = '2026-07-23T00:30:00.000Z';

function pool(overrides = {}) {
  const quote = {
    quote_hash: hashCanonical({ pool: overrides.poolId ?? 'pool-1' }),
    risk_score_bps: 400,
    stress_loss_pct: 0.2,
    ai_verified_collateral_value_usd: 125,
    target_redemption_exposure_usd: 100,
    ...overrides.quote
  };
  return {
    poolId: overrides.poolId ?? 'pool-1',
    status: 'Open',
    targetUsd: 100_000,
    subscribedUsd: 0,
    investorEligible: true,
    complianceStatus: 'CLEARED',
    quote,
    quoteUpdatedAt: '2026-07-23T00:00:00.000Z',
    createdAt: '2026-07-23T00:00:00.000Z',
    caseData: {
      bill_of_lading: {
        cargo: 'Copper cathodes',
        port_of_loading: 'Singapore',
        port_of_discharge: 'Shanghai'
      },
      exporter: { country: 'Singapore' },
      importer: { country: 'China' }
    },
    ...overrides,
    quote
  };
}

test('MBOX-BE-2: the three Risk Passport tiers apply deterministic ceilings', () => {
  assert.equal(evaluateMysteryCandidate(pool(), normalizeRiskPassport({ tier: 'CONSERVATIVE' }), { now: NOW }).eligible, true);
  assert.equal(evaluateMysteryCandidate(pool({ quote: { risk_score_bps: 800 } }), normalizeRiskPassport({ tier: 'CONSERVATIVE' }), { now: NOW }).eligible, false);
  assert.equal(evaluateMysteryCandidate(pool({ quote: { risk_score_bps: 800, stress_loss_pct: 0.4 } }), normalizeRiskPassport({ tier: 'BALANCED' }), { now: NOW }).eligible, true);
  assert.equal(evaluateMysteryCandidate(pool({ quote: { risk_score_bps: 1400, stress_loss_pct: 0.7 } }), normalizeRiskPassport({ tier: 'ADVENTUROUS' }), { now: NOW }).eligible, true);
});

test('MBOX-BE-2: compliance, lifecycle, capacity and freshness fail closed', () => {
  const passport = normalizeRiskPassport({ tier: 'BALANCED', max_quote_age_seconds: 3600 });
  const fixtures = [
    pool({ status: 'Paused' }),
    pool({ complianceStatus: 'BLOCKED' }),
    pool({ investorEligible: false }),
    pool({ subscribedUsd: 100_000 }),
    pool({ quoteUpdatedAt: '2026-07-22T22:00:00.000Z' })
  ];
  for (const fixture of fixtures) {
    assert.equal(evaluateMysteryCandidate(fixture, passport, { now: NOW }).eligible, false);
  }
});

test('MBOX-BE-2: cargo, route and jurisdiction exclusions are enforced', () => {
  const result = evaluateMysteryCandidate(pool(), normalizeRiskPassport({
    tier: 'BALANCED',
    excluded_cargo: ['copper'],
    excluded_routes: ['singapore → shanghai'],
    excluded_jurisdictions: ['china']
  }), { now: NOW });
  assert.deepEqual(result.reasons.filter((reason) => reason.endsWith('excluded')), [
    'cargo_excluded',
    'route_excluded',
    'jurisdiction_excluded'
  ]);
});

test('MBOX-BE-2: filtering returns an explicit zero-candidate result', () => {
  const filtered = filterMysteryCandidates([
    pool({ status: 'Paused' }),
    pool({ poolId: 'pool-2', complianceStatus: 'BLOCKED' })
  ], { tier: 'BALANCED' }, { now: NOW });
  assert.deepEqual(filtered.eligible, []);
  assert.equal(filtered.rejected.length, 2);
});
