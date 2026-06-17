// TradeShield MCP Tool Implementations
// 5 tools: get_trade_case, generate_pricing_quote, simulate_offering,
// push_pricing_to_oracle, search_knowledge_base

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { calculateRisk } from '../core/riskEngine.js';
import { simulateWorkflow } from '../core/workflow.js';
import { assertTradeCase } from '../core/schema.js';
import { listHarnessCaseFiles } from '../core/scenarioRunner.js';
import { searchKnowledgeBase } from '../rag/search.js';

// Import Bowen's pricing engine — for real PricingQuote generation
async function tryImportPricingEngine() {
  try {
    return await import('../core/pricingEngine.js');
  } catch {
    return null;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

/**
 * Load a trade case by its case_id.
 * Searches data/demo-case.json and data/scenarios/*.json.
 *
 * @param {string} caseId
 * @returns {Promise<Object>} TradeCase object
 * @throws {Error} if not found
 */
async function loadCaseById(caseId) {
  const files = await listHarnessCaseFiles({ includeDemo: true });
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const data = JSON.parse(raw);
    if (data.case_id === caseId) {
      assertTradeCase(data);
      return data;
    }
  }
  throw new Error(`Trade case not found: ${caseId}. Available cases can be listed via listHarnessCaseFiles().`);
}

// ============================================================
// Tool 1: get_trade_case
// ============================================================

export async function handleGetTradeCase({ case_id }) {
  if (!case_id || typeof case_id !== 'string') {
    throw new Error('Missing required parameter: case_id (string)');
  }
  const caseData = await loadCaseById(case_id);
  return {
    tool: 'get_trade_case',
    result: caseData
  };
}

// ============================================================
// Tool 2: generate_pricing_quote
// ============================================================

export async function handleGeneratePricingQuote({ case_id, trade_case } = {}) {
  const caseData = trade_case || (case_id ? await loadCaseById(case_id) : null);
  if (!caseData) {
    throw new Error('Either case_id or trade_case must be provided');
  }

  assertTradeCase(caseData);

  // ============================================================
  // New model (Bowen): delegate to the canonical pricing engine.
  //
  // quoteFromCase is the SAME entry point the backend (/api/pricing/quote),
  // the frontend and the offering simulator use, so the MCP tool emits the
  // identical PricingQuote — one structured output for AI / backend / FE /
  // contract (the P0 schema goal). Bowen's engine derives gross profit from
  // trade_economics, risk from scoreRisk, and collateral from the AI valuation;
  // the base issue price is the patient-money anchor (a discount to the 1.00
  // target), NOT a flat 1.00. Only legacy scenario cases without a payout_speed
  // fall back to the riskEngine mock below.
  // ============================================================
  const pricingEngine = await tryImportPricingEngine();
  if (pricingEngine?.quoteFromCase && caseData.financing?.payout_speed) {
    try {
      const quote = pricingEngine.quoteFromCase(caseData, {
        payout_speed: caseData.financing.payout_speed
      });
      return { tool: 'generate_pricing_quote', result: quote };
    } catch (err) {
      // If the new-model engine cannot price this case, fall back to legacy mock.
      console.warn('quoteFromCase failed, falling back to legacy:', err.message);
    }
  }

  // ============================================================
  // Legacy fallback (riskEngine-based mock)
  // ============================================================
  const riskReport = calculateRisk(caseData);
  const bl = caseData.bill_of_lading;
  const financing = caseData.financing;
  const market = caseData.market;

  // Map risk to pricing
  const cargoHealthScore = riskReport.cargo_health_score;
  const healthFactor = riskReport.health_factor;

  // Risk discount: based on cargo health score
  // Cargo health 100 = no discount. Cargo health 0 = maximum discount.
  const riskDiscountBps = Math.round((100 - cargoHealthScore) * 6);
  const riskDiscount = riskDiscountBps / 10000; // bps to decimal

  // Base price depends on the financing structure
  const basePrice = 1.0; // Target redemption is always 1 USD per RWA

  // Final price = base - risk discount, floor at 0.35
  const finalPrice = Math.max(0.35, Math.round((basePrice - riskDiscount) * 100) / 100);

  // Implied gross yield for investors
  const impliedYieldBps = finalPrice > 0 ? Math.round(((1 / finalPrice) - 1) * 10000) : 0;

  // Collateral-based limits
  const aiVerifiedCollateral = riskReport.verified_cargo_value_usd;
  const adjustedCollateral = riskReport.adjusted_collateral_value_usd;
  const liquidationThreshold = financing.liquidation_threshold || 0.85;
  const maxSafeRedemptionExposure = Math.round(adjustedCollateral * liquidationThreshold);
  const recommendedTokenSupply = maxSafeRedemptionExposure; // 1 RWA = 1 USD target redemption

  // Expected cash to exporter
  const expectedCash = Math.round(finalPrice * recommendedTokenSupply);

  // Pricing action mapping: riskEngine contract_action → PRD pricing_action
  const pricingActionMap = {
    'APPROVE_FINANCING': 'OPEN_OFFERING',
    'CONTINUE_WITH_WARNING': 'OPEN_WITH_WARNING',
    'TRIGGER_MARGIN_CALL': 'REPRICE_DOWN',
    'FREEZE_POOL': 'PAUSE_OFFERING',
    'TRIGGER_LIQUIDATION': 'TRIGGER_LIQUIDATION'
  };

  // Build the quote hash (deterministic evidence of this pricing decision)
  const quoteCore = {
    case_id: caseData.case_id,
    bl_id: bl.bl_id,
    base_price: basePrice,
    risk_discount_bps: riskDiscountBps,
    final_price: finalPrice,
    risk_level: riskReport.risk_level,
    pricing_action: pricingActionMap[riskReport.contract_action],
    timestamp: new Date().toISOString()
  };
  const quoteHash = '0x' + crypto.createHash('sha256')
    .update(JSON.stringify(quoteCore))
    .digest('hex');

  const quote = {
    case_id: caseData.case_id,
    bl_id: bl.bl_id,
    target_redemption_value_usd: 1,
    ai_verified_collateral_value_usd: aiVerifiedCollateral,
    max_safe_redemption_exposure_usd: maxSafeRedemptionExposure,
    recommended_token_supply: recommendedTokenSupply,
    requested_cash_usd: financing.requested_amount_usd,
    base_issue_price_usd: basePrice,
    urgency_discount_bps: 0, // Urgency discount TBD when payout_speed field is added
    risk_discount_bps: riskDiscountBps,
    final_issue_price_usd: finalPrice,
    expected_cash_to_exporter_usd: expectedCash,
    implied_gross_yield_bps: impliedYieldBps,
    risk_level: riskReport.risk_level,
    pricing_action: pricingActionMap[riskReport.contract_action] || 'OPEN_WITH_WARNING',
    risk_factors: riskReport.detected_risks,
    investor_explanation: riskReport.explanation,
    evidence_hash: riskReport.evidence_hash,
    quote_hash: quoteHash
  };

  return {
    tool: 'generate_pricing_quote',
    result: quote
  };
}

// ============================================================
// Tool 3: simulate_offering
// ============================================================

export async function handleSimulateOffering({ case_id, trade_case } = {}) {
  const caseData = trade_case || (case_id ? await loadCaseById(case_id) : null);
  if (!caseData) {
    throw new Error('Either case_id or trade_case must be provided');
  }

  const workflow = simulateWorkflow(caseData);
  const report = workflow.risk_report;

  // Augment with RWA offering-specific fields
  const offeringResult = {
    case_id: workflow.case_id,
    final_state: workflow.final_state,
    offering_state: workflow.final_state,
    risk_report: report,
    steps: workflow.steps,
    pricing_summary: {
      health_factor: report.health_factor,
      cargo_health_score: report.cargo_health_score,
      recommended_ltv: report.recommended_ltv,
      contract_action: report.contract_action,
      risk_level: report.risk_level
    }
  };

  return {
    tool: 'simulate_offering',
    result: offeringResult
  };
}

// ============================================================
// Tool 4: push_pricing_to_oracle
// ============================================================

export async function handlePushPricingToOracle({ case_id, pricing_quote } = {}) {
  if (!case_id) {
    throw new Error('Missing required parameter: case_id');
  }
  if (!pricing_quote) {
    throw new Error('Missing required parameter: pricing_quote');
  }

  // Build a deterministic but unique transaction payload
  const txPayload = {
    oracle_id: 'TradeShield-RiskPricingOracle-v1',
    oracle_address: '0x' + crypto.createHash('sha256')
      .update('TradeShield-RiskPricingOracle-v1')
      .digest('hex').slice(0, 40),
    pool_address: '0x' + crypto.createHash('sha256')
      .update(case_id + '_pool')
      .digest('hex').slice(0, 40),
    case_id,
    final_price: pricing_quote.final_issue_price_usd,
    risk_level: pricing_quote.risk_level,
    pricing_action: pricing_quote.pricing_action,
    evidence_hash: pricing_quote.evidence_hash,
    quote_hash: pricing_quote.quote_hash,
    timestamp: Math.floor(Date.now() / 1000)
  };

  // Generate mock transaction hash
  const txHash = '0x' + crypto.createHash('sha256')
    .update(JSON.stringify(txPayload) + crypto.randomBytes(8).toString('hex'))
    .digest('hex');

  // Mock block number
  const blockNumber = Math.floor(Math.random() * 50000) + 19200000;

  return {
    tool: 'push_pricing_to_oracle',
    result: {
      tx_hash: txHash,
      block_number: blockNumber,
      block_hash: '0x' + crypto.createHash('sha256').update(String(blockNumber)).digest('hex'),
      status: 'confirmed',
      confirmations: 12,
      gas_used: Math.floor(Math.random() * 50000) + 100000,
      effective_gas_price_gwei: Math.floor(Math.random() * 30) + 5,
      from: '0x' + crypto.createHash('sha256').update('oracle-operator').digest('hex').slice(0, 40),
      to: txPayload.oracle_address,
      contract_address: txPayload.oracle_address,
      event: 'PricingUpdated',
      event_args: {
        poolId: case_id,
        issuePrice: pricing_quote.final_issue_price_usd,
        riskLevel: pricing_quote.risk_level,
        pricingAction: pricing_quote.pricing_action,
        evidenceHash: pricing_quote.evidence_hash,
        quoteHash: pricing_quote.quote_hash
      }
    }
  };
}

// ============================================================
// Tool 5: search_knowledge_base
// ============================================================

export async function handleSearchKnowledgeBase({ query, categories, limit } = {}) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    throw new Error('Missing required parameter: query (non-empty string)');
  }

  const results = searchKnowledgeBase(query, {
    categories: Array.isArray(categories) ? categories : undefined,
    limit: typeof limit === 'number' && limit > 0 ? limit : 5
  });

  return {
    tool: 'search_knowledge_base',
    result: {
      query: query.trim(),
      matches: results,
      match_count: results.length,
      categories_searched: categories || 'all'
    }
  };
}
