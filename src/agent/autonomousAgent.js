// AI-14 / AI-15 — event-driven autonomous Agent with reliable execution.

import { AgentOrchestrator } from './orchestrator.js';
import { DecisionLogger, createDecisionId, hashSnapshot } from './decisionLogger.js';
import {
  eventIdempotencyKey,
  executeWithRetry,
  KeyedSingleFlight,
  pollEventSource
} from './executionReliability.js';
import { repriceWithWorldRisk } from '../core/worldRiskPricing.js';

export const AUTONOMOUS_EVENT_TYPES = [
  'EBL_MINTED',
  'WORLD_RISK_UPDATED',
  'RISK_CLEARED',
  'PAYMENT_RECEIVED',
  'CARGO_ARRIVED',
  'INSURANCE_EXPIRED'
];

export const AUTONOMOUS_ACTIONS = ['OPEN', 'REPRICE', 'PAUSE', 'RESUME', 'SETTLE', 'WARNING'];

function caseIdOf(event) {
  return event.case_id ?? event.case_data?.case_id;
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new TypeError('event must be an object');
  if (!AUTONOMOUS_EVENT_TYPES.includes(event.type)) {
    throw new TypeError(`event.type must be one of: ${AUTONOMOUS_EVENT_TYPES.join(', ')}`);
  }
  if (!caseIdOf(event)) throw new TypeError('event.case_id or event.case_data.case_id is required');
  if (['EBL_MINTED', 'WORLD_RISK_UPDATED'].includes(event.type) && !event.case_data) {
    throw new TypeError(`${event.type} requires event.case_data`);
  }
}

function normalizedPricingAction(pricingAction) {
  if (['OPEN_OFFERING', 'OPEN_WITH_WARNING'].includes(pricingAction)) return 'OPEN';
  if (pricingAction === 'REPRICE_DOWN') return 'REPRICE';
  return 'PAUSE';
}

function activePool(event) {
  const state = String(event.pool_state ?? event.data?.pool_state ?? 'InTransit').toLowerCase();
  return ['open', 'subscribed', 'funded', 'intransit', 'repriced'].includes(state);
}

function actionPayload(method, event, extra = {}) {
  return {
    method,
    args: {
      case_id: caseIdOf(event),
      pool_id: event.pool_id ?? null,
      ...extra
    }
  };
}

function eventSnapshot(event) {
  return {
    event_id: event.event_id ?? null,
    type: event.type,
    case_id: caseIdOf(event),
    pool_id: event.pool_id ?? null,
    occurred_at: event.occurred_at ?? null,
    pool_state: event.pool_state ?? event.data?.pool_state ?? null,
    case_hash: event.case_data ? hashSnapshot(event.case_data) : null,
    data: event.data ?? null,
    world_risk_events: event.world_risk_events ?? null
  };
}

async function defaultExecutor(command) {
  return {
    success: true,
    mode: 'dry-run',
    idempotency_key: command.idempotency_key,
    method: command.method,
    tx_hash: null
  };
}

export class AutonomousAgent {
  constructor(options = {}) {
    this.orchestrator = options.orchestrator ?? new AgentOrchestrator(options.orchestratorOptions);
    this.logger = options.logger ?? new DecisionLogger(options.loggerOptions);
    this.executor = options.executor ?? defaultExecutor;
    this.singleFlight = options.singleFlight ?? new KeyedSingleFlight();
    this.retry = {
      maxAttempts: options.maxAttempts ?? 3,
      baseDelayMs: options.baseDelayMs ?? 100,
      sleep: options.sleep
    };
  }

  async decide(event) {
    validateEvent(event);
    const caseId = caseIdOf(event);
    const snapshot = eventSnapshot(event);
    let action;
    let reasoning;
    let protocolAction;
    let evidenceHash;
    let details = {};

    if (event.type === 'EBL_MINTED') {
      const result = await this.orchestrator.processEbl({ case_data: event.case_data, documents: event.documents }, {
        forceDeterministic: event.force_deterministic ?? true,
        parser: event.parser_options,
        valuation: event.valuation_options
      });
      action = normalizedPricingAction(result.action);
      reasoning = result.reasoning_summary;
      protocolAction = result.contract_action;
      evidenceHash = result.evidence_hash;
      details = { orchestration: result };
    } else if (event.type === 'WORLD_RISK_UPDATED') {
      const worldEvents = event.world_risk_events ?? event.data?.events ?? [];
      const repricing = repriceWithWorldRisk(event.case_data, worldEvents, {
        payout_speed: event.payout_speed,
        requested_cash_usd: event.requested_cash_usd
      });
      const criticalInput = worldEvents.some((item) => item?.severity === 'critical');
      const forcedPause = criticalInput
        || ['PAUSE_OFFERING', 'FREEZE_POOL', 'TRIGGER_LIQUIDATION'].includes(repricing.after.pricing_action);
      const priceFell = repricing.delta.issue_price_usd < 0;
      action = forcedPause ? 'PAUSE' : priceFell ? 'REPRICE' : 'WARNING';
      reasoning = forcedPause
        ? `World risk increased to ${repricing.after.risk_level}; the offering must pause.`
        : priceFell
          ? `World risk added ${repricing.delta.risk_score_bps} bps and moved the issue price by ${repricing.delta.issue_price_usd}.`
          : 'World-risk evidence changed, but the deterministic pricing guardrails did not require a lower price.';
      protocolAction = action === 'PAUSE'
        ? actionPayload('pauseOffering', event, { evidence_hash: repricing.after.evidence_hash })
        : action === 'REPRICE'
          ? actionPayload('repriceOffering', event, {
            issue_price_usd: repricing.after.final_issue_price_usd,
            quote_hash: repricing.after.quote_hash,
            evidence_hash: repricing.after.evidence_hash
          })
          : actionPayload('recordWarning', event, { evidence_hash: repricing.after.evidence_hash });
      evidenceHash = repricing.after.evidence_hash;
      details = { repricing };
    } else if (event.type === 'RISK_CLEARED') {
      action = 'RESUME';
      reasoning = 'The blocking risk is cleared and the pool may resume under its last verified quote.';
      protocolAction = actionPayload('resumeOffering', event, { evidence_hash: event.evidence_hash ?? hashSnapshot(snapshot) });
      evidenceHash = event.evidence_hash ?? hashSnapshot(snapshot);
    } else if (event.type === 'PAYMENT_RECEIVED') {
      action = 'SETTLE';
      reasoning = 'Importer payment was verified; settle the offering and make investor redemption available.';
      protocolAction = actionPayload('settleOffering', event, { payment_tx: event.data?.payment_tx ?? event.payment_tx ?? null });
      evidenceHash = event.evidence_hash ?? hashSnapshot(snapshot);
    } else if (event.type === 'CARGO_ARRIVED') {
      const paid = event.data?.payment_received === true || event.payment_received === true;
      action = paid ? 'SETTLE' : 'WARNING';
      reasoning = paid
        ? 'Cargo arrival and importer payment are both verified; settle the offering.'
        : 'Cargo arrived but importer payment is not verified; alert operators without settling investor funds.';
      protocolAction = paid
        ? actionPayload('settleOffering', event, { arrival_proof: event.data?.arrival_proof ?? null })
        : actionPayload('recordWarning', event, { warning: 'ARRIVED_AWAITING_PAYMENT' });
      evidenceHash = event.evidence_hash ?? hashSnapshot(snapshot);
    } else {
      action = activePool(event) ? 'PAUSE' : 'WARNING';
      reasoning = action === 'PAUSE'
        ? 'Insurance expired while the offering is active; pause new exposure pending renewed cover.'
        : 'Insurance expired outside an active financing state; record a warning for review.';
      protocolAction = action === 'PAUSE'
        ? actionPayload('pauseOffering', event, { reason: 'INSURANCE_EXPIRED' })
        : actionPayload('recordWarning', event, { warning: 'INSURANCE_EXPIRED' });
      evidenceHash = event.evidence_hash ?? hashSnapshot(snapshot);
    }

    const idempotencyKey = eventIdempotencyKey(event);
    const core = {
      idempotency_key: idempotencyKey,
      event_id: event.event_id ?? idempotencyKey,
      event_type: event.type,
      case_id: caseId,
      pool_id: event.pool_id ?? null,
      action,
      input_snapshot: snapshot,
      evidence_hash: evidenceHash
    };
    return {
      ...core,
      decision_id: createDecisionId(core),
      reasoning_summary: reasoning,
      protocol_action: protocolAction,
      details
    };
  }

  async processEvent(event) {
    validateEvent(event);
    const key = eventIdempotencyKey(event);
    return this.singleFlight.run(key, async () => {
      await this.logger.init();
      const existing = await this.logger.findByIdempotencyKey(key);
      if (existing?.status === 'COMPLETED') {
        return { duplicate: true, recovered: false, decision: existing, execution: existing.transaction };
      }

      // A process may have crashed after broadcast but before tx backfill. Give
      // the executor a chance to reconcile by the same idempotency key first.
      if (existing?.status === 'EXECUTING' && typeof this.executor.findByIdempotencyKey === 'function') {
        const recovered = await this.executor.findByIdempotencyKey(key);
        if (recovered) {
          const completed = await this.logger.attachTransaction(existing.decision_id, { success: true, recovered: true, ...recovered });
          return { duplicate: true, recovered: true, decision: completed, execution: completed.transaction };
        }
      }

      const decision = await this.decide(event);
      const { details: _runtimeDetails, ...auditDecision } = decision;
      await this.logger.record({
        ...auditDecision,
        decision: { protocol_action: decision.protocol_action },
        status: 'EXECUTING',
        transaction: existing?.transaction ?? null
      });

      try {
        const retried = await executeWithRetry(
          async (attempt) => {
            const receipt = await this.executor({
              decision_id: decision.decision_id,
              idempotency_key: key,
              attempt,
              action: decision.action,
              ...decision.protocol_action
            });
            if (receipt?.success === false) throw new Error(receipt.error ?? 'executor returned success=false');
            return receipt;
          },
          this.retry
        );
        const transaction = {
          success: retried.value?.success !== false,
          attempts: retried.attempts,
          ...retried.value
        };
        if (transaction.success === false) throw new Error(transaction.error ?? 'executor returned success=false');
        const completed = await this.logger.attachTransaction(decision.decision_id, transaction);
        return { duplicate: false, recovered: false, decision: completed, execution: transaction };
      } catch (error) {
        await this.logger.update(decision.decision_id, {
          status: 'FAILED',
          error: { name: error.name, message: error.message, attempts: error.attempts ?? null }
        });
        throw error;
      }
    });
  }

  async processEvents(events) {
    if (!Array.isArray(events)) throw new TypeError('events must be an array');
    const results = [];
    for (const event of events) results.push(await this.processEvent(event));
    return results;
  }

  startMonitoring(fetchEvents, options = {}) {
    const controller = options.controller ?? new AbortController();
    const errors = [];
    const done = pollEventSource({
      fetchEvents,
      onEvent: (event) => this.processEvent(event),
      signal: controller.signal,
      intervalMs: options.intervalMs,
      sleep: options.sleep,
      onError: (error) => {
        errors.push(error);
        options.onError?.(error);
      }
    });
    return { controller, done, errors };
  }
}
