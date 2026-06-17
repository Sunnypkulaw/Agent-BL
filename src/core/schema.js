export const CONTRACT_ACTIONS = [
  'APPROVE_FINANCING',
  'CONTINUE_WITH_WARNING',
  'TRIGGER_MARGIN_CALL',
  'FREEZE_POOL',
  'TRIGGER_LIQUIDATION'
];

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'WARNING', 'CRITICAL'];

export const WORKFLOW_STATES = [
  'Created',
  'Funding',
  'Funded',
  'InTransit',
  'Warning',
  'Frozen',
  'Repaid',
  'Redeemed',
  'Default',
  'Liquidation',
  'Compensated',
  'Cancelled',
  'Refunded'
];

export const FINAL_STATE_BY_CONTRACT_ACTION = {
  APPROVE_FINANCING: 'InTransit',
  CONTINUE_WITH_WARNING: 'Warning',
  TRIGGER_MARGIN_CALL: 'Warning',
  FREEZE_POOL: 'Frozen',
  TRIGGER_LIQUIDATION: 'Liquidation'
};

export const SHIPMENT_EVENT_TYPES = [
  'loaded_on_board',
  'no_damage_reported',
  'bad_weather',
  'delay',
  'route_deviation',
  'port_strike',
  'cargo_damage',
  'partial_loss',
  'insurance_expiry_risk',
  'insurance_invalid'
];

export const SEVERITIES = ['info', 'warning', 'critical'];

export class ValidationError extends Error {
  constructor(label, errors) {
    super(`${label}: ${errors.join('; ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, fieldName, errors) {
  if (!isRecord(value)) errors.push(`${fieldName} must be an object`);
  return isRecord(value) ? value : {};
}

function requireString(value, fieldName, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${fieldName} must be a non-empty string`);
  }
}

function requireNumber(value, fieldName, errors, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${fieldName} must be a finite number`);
    return;
  }
  if (options.min !== undefined && value < options.min) {
    errors.push(`${fieldName} must be >= ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    errors.push(`${fieldName} must be <= ${options.max}`);
  }
}

function requireEnum(value, fieldName, allowedValues, errors) {
  if (!allowedValues.includes(value)) {
    errors.push(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }
}

function requireDateString(value, fieldName, errors) {
  requireString(value, fieldName, errors);
  if (typeof value === 'string' && Number.isNaN(Date.parse(value))) {
    errors.push(`${fieldName} must be an ISO-compatible date string`);
  }
}

function assertNoErrors(label, errors) {
  if (errors.length > 0) throw new ValidationError(label, errors);
}

export function assertTradeCase(caseData) {
  const errors = [];
  const data = requireRecord(caseData, 'case', errors);
  const bl = requireRecord(data.bill_of_lading, 'bill_of_lading', errors);
  const insurance = requireRecord(data.insurance, 'insurance', errors);
  const financing = requireRecord(data.financing, 'financing', errors);
  const market = requireRecord(data.market, 'market', errors);

  requireString(data.case_id, 'case_id', errors);

  for (const field of ['bl_id', 'shipper', 'consignee', 'carrier', 'vessel', 'port_of_loading', 'port_of_discharge', 'cargo', 'document_hash']) {
    requireString(bl[field], `bill_of_lading.${field}`, errors);
  }
  requireNumber(bl.quantity_mt, 'bill_of_lading.quantity_mt', errors, { min: 0.0001 });
  requireNumber(bl.declared_value_usd, 'bill_of_lading.declared_value_usd', errors, { min: 0 });
  requireDateString(bl.issue_date, 'bill_of_lading.issue_date', errors);
  requireDateString(bl.eta, 'bill_of_lading.eta', errors);

  requireString(insurance.provider, 'insurance.provider', errors);
  requireNumber(insurance.insured_value_usd, 'insurance.insured_value_usd', errors, { min: 0 });
  requireDateString(insurance.expires_at, 'insurance.expires_at', errors);
  requireString(insurance.policy_hash, 'insurance.policy_hash', errors);

  requireNumber(financing.requested_amount_usd, 'financing.requested_amount_usd', errors, { min: 0.0001 });
  requireNumber(financing.duration_days, 'financing.duration_days', errors, { min: 1 });
  requireNumber(financing.expected_yield_bps, 'financing.expected_yield_bps', errors, { min: 0 });
  requireNumber(financing.initial_ltv, 'financing.initial_ltv', errors, { min: 0, max: 1 });
  requireNumber(financing.liquidation_threshold, 'financing.liquidation_threshold', errors, { min: 0, max: 1 });
  requireEnum(financing.currency, 'financing.currency', ['USDC', 'USD'], errors);

  requireString(market.commodity, 'market.commodity', errors);
  requireNumber(market.initial_price_usd_per_mt, 'market.initial_price_usd_per_mt', errors, { min: 0.0001 });
  requireNumber(market.current_price_usd_per_mt, 'market.current_price_usd_per_mt', errors, { min: 0.0001 });
  requireString(market.source, 'market.source', errors);

  if (!Array.isArray(data.shipment_events)) {
    errors.push('shipment_events must be an array');
  } else {
    for (const [index, event] of data.shipment_events.entries()) {
      const prefix = `shipment_events[${index}]`;
      requireRecord(event, prefix, errors);
      requireDateString(event.date, `${prefix}.date`, errors);
      requireEnum(event.type, `${prefix}.type`, SHIPMENT_EVENT_TYPES, errors);
      requireString(event.description, `${prefix}.description`, errors);
      requireEnum(event.severity, `${prefix}.severity`, SEVERITIES, errors);
      if (event.delay_days !== undefined) {
        requireNumber(event.delay_days, `${prefix}.delay_days`, errors, { min: 0 });
      }
    }
  }

  if (data.expectations !== undefined) assertScenarioShape(data.expectations, errors);

  assertNoErrors('Trade case validation failed', errors);
  return caseData;
}

function assertScenarioShape(expectations, errors) {
  const expected = requireRecord(expectations, 'expectations', errors);
  if (expected.contract_action !== undefined) requireEnum(expected.contract_action, 'expectations.contract_action', CONTRACT_ACTIONS, errors);
  if (expected.final_state !== undefined) requireEnum(expected.final_state, 'expectations.final_state', WORKFLOW_STATES, errors);
  if (expected.risk_level !== undefined) requireEnum(expected.risk_level, 'expectations.risk_level', RISK_LEVELS, errors);
  if (expected.min_health_factor !== undefined) requireNumber(expected.min_health_factor, 'expectations.min_health_factor', errors, { min: 0 });
  if (expected.max_health_factor !== undefined) requireNumber(expected.max_health_factor, 'expectations.max_health_factor', errors, { min: 0 });
  if (expected.detected_risks_include !== undefined) {
    if (!Array.isArray(expected.detected_risks_include) || expected.detected_risks_include.some((item) => typeof item !== 'string')) {
      errors.push('expectations.detected_risks_include must be an array of strings');
    }
  }
}

export function assertRiskReport(report, caseData) {
  const errors = [];
  const data = requireRecord(report, 'risk_report', errors);

  requireString(data.case_id, 'risk_report.case_id', errors);
  requireString(data.bl_id, 'risk_report.bl_id', errors);
  requireEnum(data.risk_level, 'risk_report.risk_level', RISK_LEVELS, errors);
  requireNumber(data.cargo_health_score, 'risk_report.cargo_health_score', errors, { min: 0, max: 100 });
  requireNumber(data.verified_cargo_value_usd, 'risk_report.verified_cargo_value_usd', errors, { min: 0 });
  requireNumber(data.adjusted_collateral_value_usd, 'risk_report.adjusted_collateral_value_usd', errors, { min: 0 });
  requireNumber(data.requested_amount_usd, 'risk_report.requested_amount_usd', errors, { min: 0 });
  requireNumber(data.health_factor, 'risk_report.health_factor', errors, { min: 0 });
  requireNumber(data.recommended_ltv, 'risk_report.recommended_ltv', errors, { min: 0, max: 1 });
  requireEnum(data.contract_action, 'risk_report.contract_action', CONTRACT_ACTIONS, errors);
  requireString(data.explanation, 'risk_report.explanation', errors);

  if (!Array.isArray(data.detected_risks) || data.detected_risks.some((item) => typeof item !== 'string')) {
    errors.push('risk_report.detected_risks must be an array of strings');
  }

  if (typeof data.evidence_hash !== 'string' || !/^0x[0-9a-f]{64}$/u.test(data.evidence_hash)) {
    errors.push('risk_report.evidence_hash must be a 0x-prefixed sha256 hash');
  }

  if (caseData) {
    if (data.case_id !== caseData.case_id) errors.push('risk_report.case_id must match case.case_id');
    if (data.bl_id !== caseData.bill_of_lading?.bl_id) errors.push('risk_report.bl_id must match bill_of_lading.bl_id');
  }

  assertNoErrors('Risk report validation failed', errors);
  return report;
}

export function assertWorkflowResult(result, caseData) {
  const errors = [];
  const data = requireRecord(result, 'workflow', errors);

  requireString(data.case_id, 'workflow.case_id', errors);
  requireEnum(data.final_state, 'workflow.final_state', WORKFLOW_STATES, errors);
  if (!Array.isArray(data.steps) || data.steps.length < 1) {
    errors.push('workflow.steps must be a non-empty array');
  } else {
    for (const [index, step] of data.steps.entries()) {
      const prefix = `workflow.steps[${index}]`;
      requireRecord(step, prefix, errors);
      requireEnum(step.state, `${prefix}.state`, WORKFLOW_STATES, errors);
      requireString(step.actor, `${prefix}.actor`, errors);
      requireString(step.event, `${prefix}.event`, errors);
    }
  }

  if (isRecord(data.risk_report) && CONTRACT_ACTIONS.includes(data.risk_report.contract_action)) {
    const expectedState = FINAL_STATE_BY_CONTRACT_ACTION[data.risk_report.contract_action];
    if (expectedState && data.final_state !== expectedState) {
      errors.push(`workflow.final_state must be ${expectedState} for ${data.risk_report.contract_action}`);
    }
  }

  assertNoErrors('Workflow validation failed', errors);
  assertRiskReport(data.risk_report, caseData);

  if (caseData && data.case_id !== caseData.case_id) {
    throw new ValidationError('Workflow validation failed', ['workflow.case_id must match case.case_id']);
  }

  return result;
}

export function assertScenarioExpectations(caseData, workflow) {
  const expected = caseData.expectations;
  if (!expected) return workflow;

  const errors = [];
  const report = workflow.risk_report;

  if (expected.contract_action && report.contract_action !== expected.contract_action) {
    errors.push(`expected contract_action ${expected.contract_action}, got ${report.contract_action}`);
  }
  if (expected.final_state && workflow.final_state !== expected.final_state) {
    errors.push(`expected final_state ${expected.final_state}, got ${workflow.final_state}`);
  }
  if (expected.risk_level && report.risk_level !== expected.risk_level) {
    errors.push(`expected risk_level ${expected.risk_level}, got ${report.risk_level}`);
  }
  if (expected.min_health_factor !== undefined && report.health_factor < expected.min_health_factor) {
    errors.push(`expected health_factor >= ${expected.min_health_factor}, got ${report.health_factor}`);
  }
  if (expected.max_health_factor !== undefined && report.health_factor > expected.max_health_factor) {
    errors.push(`expected health_factor <= ${expected.max_health_factor}, got ${report.health_factor}`);
  }
  if (expected.detected_risks_include) {
    for (const risk of expected.detected_risks_include) {
      if (!report.detected_risks.includes(risk)) errors.push(`expected detected risk ${risk}`);
    }
  }

  assertNoErrors(`Scenario expectations failed for ${caseData.case_id}`, errors);
  return workflow;
}
