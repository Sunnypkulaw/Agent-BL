// AI-13 — AgentBL deterministic Agent orchestrator.
//
// Pipeline: document parsing -> cross-document checks -> cargo valuation ->
// three-speed pricing -> recommendation -> optional on-chain execution.

import { checkDocumentConsistency } from './documentConsistency.js';
import { DecisionLogger, createDecisionId, hashSnapshot } from './decisionLogger.js';
import { parseDocuments } from './documentParser.js';
import { runValuationAgent } from './valuationAgent.js';
import { assertPricingQuote } from '../core/pricingSchema.js';
import { compareSpeeds } from '../core/pricingEngine.js';

const OPEN_ACTIONS = new Set(['OPEN_OFFERING', 'OPEN_WITH_WARNING']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateCaseForPricing(caseData) {
  const errors = [];
  if (!isRecord(caseData)) errors.push('case_data must be an object');
  if (!caseData?.case_id) errors.push('case_id is required');
  if (!caseData?.bill_of_lading?.bl_id) errors.push('bill_of_lading.bl_id is required');
  if (!caseData?.financing) errors.push('financing is required');
  if (!Number.isFinite(Number(caseData?.financing?.requested_cash_usd))) errors.push('financing.requested_cash_usd is required');
  if (!Number.isFinite(Number(caseData?.commercial_invoice?.total_amount_usd ?? caseData?.bill_of_lading?.declared_value_usd))) {
    errors.push('invoice or declared cargo value is required');
  }
  if (errors.length > 0) throw new TypeError(`Case cannot be priced: ${errors.join('; ')}`);
}

function enrichCaseWithValuation(caseData, valuation) {
  const live = valuation.live_market ?? {};
  const landed = Number(live.landed_price_usd_per_mt);
  const marketPrice = Number(live.price_usd_per_mt);
  const premium = Number(live.regional_premium_usd_per_mt);
  return {
    ...caseData,
    market: {
      ...(caseData.market ?? {}),
      ...(Number.isFinite(marketPrice) ? { reference_price_usd_per_mt: marketPrice, current_price_usd_per_mt: marketPrice } : {}),
      ...(Number.isFinite(premium) ? { regional_premium_usd_per_mt: premium } : {}),
      ...(Number.isFinite(landed) ? { landed_price_usd_per_mt: landed } : {})
    },
    ai_valuation: valuation
  };
}

function chooseAction({ parsing, documents, recommended }) {
  if (parsing?.requires_human_review) {
    return { action: 'PAUSE_OFFERING', reason: 'Document extraction confidence is below the auto-execution threshold.' };
  }
  if (documents.has_critical) {
    return { action: 'PAUSE_OFFERING', reason: 'Critical cross-document inconsistency requires human review.' };
  }
  return { action: recommended.pricing_action, reason: recommended.investor_explanation };
}

function contractAction(action, quote) {
  const common = {
    case_id: quote.case_id,
    ebl_id: quote.bl_id,
    quote_hash: quote.quote_hash,
    evidence_hash: quote.evidence_hash
  };
  if (OPEN_ACTIONS.has(action)) {
    return {
      method: 'createOffering',
      args: {
        ...common,
        token_supply: quote.recommended_token_supply,
        issue_price_usd: quote.final_issue_price_usd,
        target_redemption_value_usd: quote.target_redemption_value_usd
      }
    };
  }
  if (action === 'REPRICE_DOWN') return { method: 'repriceOffering', args: { ...common, issue_price_usd: quote.final_issue_price_usd } };
  if (action === 'FREEZE_POOL') return { method: 'freezeOffering', args: common };
  if (action === 'TRIGGER_LIQUIDATION') return { method: 'liquidateOffering', args: common };
  return { method: 'pauseOffering', args: common };
}

function buildSummary(action, documentReport, valuation, quote) {
  const documentSentence = documentReport.ok
    ? 'Trade documents agree on the material financing fields.'
    : `${documentReport.issues.length} document issue(s) produced ${documentReport.penalty_bps} bps of risk penalty.`;
  const value = valuation.valuation?.ai_verified_collateral_value_usd ?? quote.ai_verified_collateral_value_usd;
  return `${documentSentence} Verified collateral is USD ${Math.round(value)}. `
    + `The recommended ${quote.payout_speed} quote is USD ${quote.final_issue_price_usd} with ${quote.risk_score_bps} bps risk. `
    + `Decision: ${action}.`;
}

export class AgentOrchestrator {
  constructor(options = {}) {
    this.parseDocuments = options.parseDocuments ?? parseDocuments;
    this.checkDocuments = options.checkDocuments ?? checkDocumentConsistency;
    this.runValuation = options.runValuation ?? runValuationAgent;
    this.compareSpeeds = options.compareSpeeds ?? compareSpeeds;
    this.logger = options.logger ?? null;
  }

  /**
   * @param {object} input structured case, or { case_data/template_case, documents }
   * @param {object} options parser/valuation/execution options
   */
  async processEbl(input, options = {}) {
    const wrapper = input?.documents || input?.case_data || input?.template_case ? input : { case_data: input };
    let parsing = null;
    let caseData = wrapper.case_data ?? wrapper.template_case ?? {};
    if (wrapper.documents) {
      parsing = await this.parseDocuments(wrapper.documents, {
        ...(options.parser ?? {}),
        templateCase: caseData
      });
      caseData = parsing.case_data;
    }
    validateCaseForPricing(caseData);

    const documentReport = this.checkDocuments(caseData);
    const valuation = await this.runValuation(caseData, {
      forceDeterministic: options.forceDeterministic ?? true,
      ...(options.valuation ?? {})
    });
    const pricedCase = enrichCaseWithValuation(caseData, valuation);
    const comparison = this.compareSpeeds(pricedCase, {
      requested_cash_usd: options.requested_cash_usd ?? pricedCase.financing.requested_cash_usd
    });
    for (const quote of comparison.quotes) assertPricingQuote(quote, pricedCase);
    const recommended = comparison.recommended_quote;
    const selected = chooseAction({ parsing, documents: documentReport, recommended });
    const actionPayload = contractAction(selected.action, recommended);
    const inputSnapshot = {
      case_id: pricedCase.case_id,
      bl_id: pricedCase.bill_of_lading.bl_id,
      document_hashes: parsing?.documents.map((document) => document.text_hash)
        ?? [pricedCase.bill_of_lading.document_hash, pricedCase.insurance?.policy_hash].filter(Boolean),
      parser_requires_review: parsing?.requires_human_review ?? false,
      document_penalty_bps: documentReport.penalty_bps,
      valuation_hash: hashSnapshot(valuation),
      quote_hash: recommended.quote_hash
    };
    const decisionCore = {
      case_id: pricedCase.case_id,
      action: selected.action,
      input_snapshot: inputSnapshot,
      evidence_hash: recommended.evidence_hash
    };
    const decisionId = createDecisionId(decisionCore);
    const reasoningSummary = buildSummary(selected.action, documentReport, valuation, recommended);

    const result = {
      decision_id: decisionId,
      case_id: pricedCase.case_id,
      action: selected.action,
      can_auto_execute: OPEN_ACTIONS.has(selected.action) && !parsing?.requires_human_review && !documentReport.has_critical,
      reasoning_summary: reasoningSummary,
      evidence_hash: recommended.evidence_hash,
      quote_hash: recommended.quote_hash,
      input_snapshot: inputSnapshot,
      parsing,
      document_report: documentReport,
      valuation,
      pricing_comparison: comparison,
      recommended_quote: recommended,
      contract_action: actionPayload,
      pipeline: [
        { step: 'document_parse', status: parsing ? (parsing.requires_human_review ? 'REVIEW' : 'PASS') : 'STRUCTURED_INPUT' },
        { step: 'document_consistency', status: documentReport.has_critical ? 'CRITICAL' : documentReport.ok ? 'PASS' : 'WARNING' },
        { step: 'cargo_valuation', status: 'PASS', provider: valuation.provider },
        { step: 'three_speed_pricing', status: 'PASS', recommended: comparison.recommended_payout_speed },
        { step: 'decision', status: selected.action }
      ]
    };

    if (this.logger || options.logger) {
      const logger = options.logger ?? this.logger;
      if (!(logger instanceof DecisionLogger) && typeof logger?.record !== 'function') throw new TypeError('logger must implement record()');
      await logger.record({
        decision_id: decisionId,
        case_id: result.case_id,
        action: result.action,
        reasoning_summary: reasoningSummary,
        evidence_hash: result.evidence_hash,
        input_snapshot: inputSnapshot,
        decision: { contract_action: actionPayload, quote_hash: result.quote_hash },
        status: 'DECIDED'
      });
    }

    if (options.executeAction && result.can_auto_execute) {
      result.execution = await options.executeAction({
        decision_id: result.decision_id,
        idempotency_key: `orchestrator:${result.decision_id}`,
        ...result.contract_action
      });
    }
    return result;
  }
}

export async function orchestrateEbl(input, options = {}) {
  const orchestrator = options.orchestrator ?? new AgentOrchestrator(options);
  return orchestrator.processEbl(input, options);
}

