// Wire live world-risk events into the AI pricing engine.
//
// The world-risk agent (src/agent/worldRiskAgent.js) produces macro_risk_events
// in the exact shape scoreRisk consumes. These helpers append those events to a
// case and re-run the deterministic pricing engine, so we can show the issue
// price move BEFORE vs AFTER folding in live real-world risk (or trip PAUSE).
//
// Kept separate from pricingWorkflow.js so the stable workflow path is untouched.

import { quoteFromCase } from './pricingEngine.js';

/** A live world event only needs the fields scoreRisk reads; keep it clean. */
function toMacroEvent(event = {}) {
  return {
    date: event.date,
    type: event.type,
    region: event.region,
    severity: event.severity,
    description: event.description,
    source: event.source ?? 'xAPI/world-intel'
  };
}

/**
 * Return a shallow clone of the case with live world-risk events appended to
 * macro_risk_events. Original case is not mutated.
 */
export function mergeWorldRiskIntoCase(caseData, events = []) {
  if (!Array.isArray(events) || events.length === 0) return caseData;
  return {
    ...caseData,
    macro_risk_events: [...(caseData.macro_risk_events ?? []), ...events.map(toMacroEvent)]
  };
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

/**
 * Quote the case before and after folding in live world-risk events.
 * @param {object} caseData
 * @param {Array} events macro_risk_events from the world-risk agent
 * @param {object} [opts] { payout_speed, requested_cash_usd } — passed to quoteFromCase
 * @returns {{ before, after, delta }}
 */
export function repriceWithWorldRisk(caseData, events = [], opts = {}) {
  const before = quoteFromCase(caseData, opts);
  const merged = mergeWorldRiskIntoCase(caseData, events);
  const after = quoteFromCase(merged, opts);

  return {
    before,
    after,
    delta: {
      issue_price_usd: round(after.final_issue_price_usd - before.final_issue_price_usd),
      risk_score_bps: after.risk_score_bps - before.risk_score_bps,
      risk_level_changed: before.risk_level !== after.risk_level,
      action_changed: before.pricing_action !== after.pricing_action,
      from: { risk_level: before.risk_level, pricing_action: before.pricing_action, issue_price_usd: before.final_issue_price_usd },
      to: { risk_level: after.risk_level, pricing_action: after.pricing_action, issue_price_usd: after.final_issue_price_usd }
    }
  };
}
