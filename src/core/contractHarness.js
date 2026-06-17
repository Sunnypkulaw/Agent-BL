import crypto from 'node:crypto';
import { calculateRisk } from './riskEngine.js';
import { assertRiskReport, assertTradeCase } from './schema.js';

export const PRICING_ACTION_BY_CONTRACT_ACTION = {
  APPROVE_FINANCING: 'OPEN_OFFERING',
  CONTINUE_WITH_WARNING: 'OPEN_WITH_WARNING',
  TRIGGER_MARGIN_CALL: 'REPRICE_DOWN',
  FREEZE_POOL: 'FREEZE_POOL',
  TRIGGER_LIQUIDATION: 'TRIGGER_LIQUIDATION'
};

// End-to-end final state after the harness runs the full flow
// (mint -> pledge -> create -> subscribe -> price -> apply action).
// This differs from docs/contracts.md §5.5, which maps a single action to its
// immediate state. Keep both: §5.5 is per-step, this table is the terminal state.
export const OFFERING_STATE_BY_CONTRACT_ACTION = {
  APPROVE_FINANCING: 'InTransit',
  CONTINUE_WITH_WARNING: 'Repriced',
  TRIGGER_MARGIN_CALL: 'Repriced',
  FREEZE_POOL: 'Frozen',
  TRIGGER_LIQUIDATION: 'Liquidation'
};

// docs/contracts.md §2.2
export const RISK_LEVEL_TO_UINT8 = {
  LOW: 0,
  MEDIUM: 1,
  WARNING: 2,
  CRITICAL: 3
};

// docs/contracts.md §2.3 (keyed by pricing_action)
export const PRICING_ACTION_TO_UINT8 = {
  OPEN_OFFERING: 0,
  OPEN_WITH_WARNING: 1,
  REPRICE_DOWN: 2,
  PAUSE_OFFERING: 3,
  FREEZE_POOL: 4,
  TRIGGER_LIQUIDATION: 5
};

const DEFAULT_INVESTOR = 'permissioned-investor-1';
const DEFAULT_ORACLE = 'ai-pricing-agent';

function assertHash32(value, fieldName) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${fieldName} must be a 0x-prefixed 32-byte hex hash`);
  }
}

function hashPayload(payload) {
  return '0x' + crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function toBps(value) {
  return Math.round(value * 10_000);
}

function buildMockPricingQuote(caseData, riskReport, options = {}) {
  const issuePriceUsd = options.issue_price_usd ?? 0.9;
  const targetRedemptionValueUsd = options.target_redemption_value_usd ?? 1;
  const requestedCashUsd = caseData.financing.requested_cash_usd ?? caseData.financing.requested_amount_usd;
  const recommendedTokenSupply = Math.ceil(requestedCashUsd / issuePriceUsd);
  const pricingAction = PRICING_ACTION_BY_CONTRACT_ACTION[riskReport.contract_action];

  const quote = {
    case_id: caseData.case_id,
    bl_id: caseData.bill_of_lading.bl_id,
    target_redemption_value_usd: targetRedemptionValueUsd,
    ai_verified_collateral_value_usd: riskReport.verified_cargo_value_usd,
    max_safe_redemption_exposure_usd: Math.floor(riskReport.adjusted_collateral_value_usd * riskReport.recommended_ltv),
    recommended_token_supply: recommendedTokenSupply,
    requested_cash_usd: requestedCashUsd,
    final_issue_price_usd: issuePriceUsd,
    expected_cash_to_exporter_usd: Math.round(recommendedTokenSupply * issuePriceUsd),
    implied_gross_yield_bps: toBps((targetRedemptionValueUsd - issuePriceUsd) / issuePriceUsd),
    risk_level: riskReport.risk_level,
    pricing_action: pricingAction,
    risk_factors: riskReport.detected_risks,
    evidence_hash: riskReport.evidence_hash
  };

  return {
    ...quote,
    quote_hash: options.quote_hash ?? hashPayload(quote)
  };
}

export function simulateContractHarness(caseData, options = {}) {
  assertTradeCase(caseData);
  const riskReport = calculateRisk(caseData);
  assertRiskReport(riskReport, caseData);

  const pricingQuote = buildMockPricingQuote(caseData, riskReport, options);
  assertHash32(pricingQuote.evidence_hash, 'evidence_hash');
  assertHash32(pricingQuote.quote_hash, 'quote_hash');

  const investor = options.investor ?? DEFAULT_INVESTOR;
  const oracleUpdater = options.oracle_updater ?? DEFAULT_ORACLE;
  const whitelist = new Set(options.whitelist ?? [investor]);
  if (!whitelist.has(investor)) {
    throw new Error(`Investor ${investor} is not permissioned for this offering`);
  }

  const eblId = 1;
  const poolId = 1;
  const subscribedAmount = options.subscribed_amount ?? pricingQuote.recommended_token_supply;
  const subscribedPaidAmount = Math.round(subscribedAmount * pricingQuote.final_issue_price_usd);
  const finalState = OFFERING_STATE_BY_CONTRACT_ACTION[riskReport.contract_action];
  const riskLevelCode = RISK_LEVEL_TO_UINT8[pricingQuote.risk_level];
  const actionCode = PRICING_ACTION_TO_UINT8[pricingQuote.pricing_action];

  const events = [
    {
      contract: 'EBLRegistry',
      event: 'EBLMinted',
      args: {
        eblId,
        metadataHash: caseData.bill_of_lading.document_hash,
        holder: caseData.bill_of_lading.shipper
      }
    },
    {
      contract: 'EBLRegistry',
      event: 'EBLPledged',
      args: {
        eblId,
        pool: 'RWAOfferingPool',
        holder: caseData.bill_of_lading.shipper
      }
    },
    {
      contract: 'RWAOfferingPool',
      event: 'OfferingCreated',
      args: {
        poolId,
        eblId,
        tokenSupply: pricingQuote.recommended_token_supply,
        issuePrice: pricingQuote.final_issue_price_usd,
        targetRedemptionValue: pricingQuote.target_redemption_value_usd
      }
    },
    {
      contract: 'RWAOfferingPool',
      event: 'Subscribed',
      args: {
        poolId,
        investor,
        amount: subscribedAmount,
        paidAmount: subscribedPaidAmount
      }
    },
    {
      contract: 'RWAToken',
      event: 'RWAMinted',
      args: {
        poolId,
        investor,
        amount: subscribedAmount
      }
    },
    {
      contract: 'RiskPricingOracle',
      event: 'PricingUpdated',
      args: {
        poolId,
        issuePrice: pricingQuote.final_issue_price_usd,
        riskLevel: pricingQuote.risk_level,
        riskLevelCode,
        action: pricingQuote.pricing_action,
        actionCode,
        evidenceHash: pricingQuote.evidence_hash,
        quoteHash: pricingQuote.quote_hash,
        updater: oracleUpdater
      }
    },
    {
      contract: 'RWAOfferingPool',
      event: 'OfferingStateChanged',
      args: {
        poolId,
        oldState: 'Funded',
        newState: finalState,
        action: pricingQuote.pricing_action,
        actionCode
      }
    }
  ];

  return {
    case_id: caseData.case_id,
    ebl: {
      ebl_id: eblId,
      bl_id: caseData.bill_of_lading.bl_id,
      holder: caseData.bill_of_lading.shipper,
      pledged_to: 'RWAOfferingPool'
    },
    offering: {
      pool_id: poolId,
      state: finalState,
      token_supply: pricingQuote.recommended_token_supply,
      subscribed_amount: subscribedAmount,
      subscribed_paid_amount: subscribedPaidAmount,
      issue_price_usd: pricingQuote.final_issue_price_usd,
      target_redemption_value_usd: pricingQuote.target_redemption_value_usd
    },
    oracle: {
      updater: oracleUpdater,
      latest_event: events.find((event) => event.contract === 'RiskPricingOracle')
    },
    pricing_quote: pricingQuote,
    risk_report: riskReport,
    events
  };
}
