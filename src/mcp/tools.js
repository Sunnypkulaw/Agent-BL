// AgentBL MCP Tool Implementations
// 7 tools: deterministic trade/pricing/document/report capabilities plus
// policy-guarded oracle writes.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { calculateRisk } from '../core/riskEngine.js';
import { simulateWorkflow } from '../core/workflow.js';
import { assertTradeCase } from '../core/schema.js';
import { listHarnessCaseFiles } from '../core/scenarioRunner.js';
import { searchKnowledgeBase } from '../rag/search.js';
import { checkDocumentConsistency } from '../agent/documentConsistency.js';
import { authorizeMcpWrite, MCP_PINNED_NETWORK } from './security.js';
import { X402_SERVICES } from '../x402/config.js';
import chainConfigLib from '../../scripts/lib/chain-config.cjs';

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

export async function handlePushPricingToOracle({
  case_id,
  pricing_quote,
  pool_id = 1,
  network = MCP_PINNED_NETWORK,
  contract,
  dry_run = true,
  approved = false,
  approval_token
} = {}) {
  if (!case_id) {
    throw new Error('Missing required parameter: case_id');
  }
  if (!pricing_quote) {
    throw new Error('Missing required parameter: pricing_quote');
  }

  const chainConfig = chainConfigLib.resolveNetworkConfig(
    JSON.parse(await fs.readFile(path.join(rootDir, 'public', 'chain-config.json'), 'utf8')),
    'injective-testnet'
  );
  const oracleAddress = contract ?? chainConfig.contracts?.RiskPricingOracle;
  if (!oracleAddress) throw new Error('RiskPricingOracle is not deployed in public/chain-config.json');

  const policy = authorizeMcpWrite({
    operation: 'pricing_update',
    network,
    contract: oracleAddress,
    amount_usdc: 0,
    dry_run,
    approved,
    approval_token
  });
  const riskLevels = { LOW: 0, MEDIUM: 1, WARNING: 2, CRITICAL: 3 };
  const actions = {
    OPEN_OFFERING: 0,
    OPEN_WITH_WARNING: 1,
    REPRICE_DOWN: 2,
    PAUSE_OFFERING: 3,
    FREEZE_POOL: 4,
    TRIGGER_LIQUIDATION: 5
  };
  const txPayload = {
    oracle_id: 'AgentBL-RiskPricingOracle-v1',
    oracle_address: oracleAddress,
    pool_id: Number(pool_id),
    case_id,
    issue_price_e6: Math.round(Number(pricing_quote.final_issue_price_usd) * 1_000_000),
    risk_level: riskLevels[pricing_quote.risk_level] ?? 1,
    pricing_action: actions[pricing_quote.pricing_action] ?? 1,
    evidence_hash: pricing_quote.evidence_hash,
    quote_hash: pricing_quote.quote_hash
  };

  if (policy.dry_run) {
    return {
      tool: 'push_pricing_to_oracle',
      result: {
        status: 'dry_run',
        policy,
        transaction: txPayload,
        event: 'PricingUpdated',
        evidence_hash: pricing_quote.evidence_hash,
        quote_hash: pricing_quote.quote_hash,
        tx_hash: null,
        explorer_url: null
      }
    };
  }

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error('DEPLOYER_PRIVATE_KEY is required for an approved oracle write');
  const { ethers } = await import('ethers');
  const rpcUrl = process.env.INJECTIVE_RPC_URL ?? 'https://k8s.testnet.json-rpc.injective.network';
  const provider = new ethers.JsonRpcProvider(rpcUrl, 1439);
  const wallet = new ethers.Wallet(privateKey, provider);
  const artifactPath = path.join(rootDir, 'hardhat', 'artifacts', 'contracts', 'RiskPricingOracle.sol', 'RiskPricingOracle.json');
  const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
  const oracle = new ethers.Contract(oracleAddress, artifact.abi, wallet);
  const transaction = await oracle.updatePricing(
    txPayload.pool_id,
    txPayload.issue_price_e6,
    txPayload.risk_level,
    txPayload.pricing_action,
    txPayload.evidence_hash,
    txPayload.quote_hash
  );
  const mined = await transaction.wait();
  const explorerUrl = `${chainConfig.explorerBase}/tx/${mined.hash}`;

  return {
    tool: 'push_pricing_to_oracle',
    result: {
      tx_hash: mined.hash,
      block_number: mined.blockNumber,
      block_hash: mined.blockHash,
      status: 'confirmed',
      confirmations: await mined.confirmations(),
      gas_used: mined.gasUsed.toString(),
      from: mined.from,
      to: mined.to,
      contract_address: oracleAddress,
      explorer_url: explorerUrl,
      policy,
      event: 'PricingUpdated',
      event_args: {
        poolId: txPayload.pool_id,
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

// ============================================================
// Tool 6: verify_trade_documents
// ============================================================

export async function handleVerifyTradeDocuments({ case_id, trade_case } = {}) {
  const caseData = trade_case || (case_id ? await loadCaseById(case_id) : null);
  if (!caseData) throw new Error('Either case_id or trade_case must be provided');
  assertTradeCase(caseData);
  return {
    tool: 'verify_trade_documents',
    result: checkDocumentConsistency(caseData)
  };
}

async function withEphemeralApp(run) {
  const { createServer } = await import('../app/server.js');
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// ============================================================
// Tool 7: purchase_premium_analysis
// ============================================================

export async function handlePurchasePremiumAnalysis({
  case_id,
  kind = 'premium-risk',
  mode = 'demo',
  budget_usdc = 0.005,
  approved = false,
  approval_token
} = {}) {
  if (!case_id) throw new Error('Missing required parameter: case_id');
  const service = X402_SERVICES.find((item) => item.serviceId === kind);
  if (!service) throw new Error(`Unknown premium analysis kind: ${kind}`);
  if (!['demo', 'live'].includes(mode)) throw new Error('mode must be demo or live');
  const caseData = await loadCaseById(case_id);

  if (mode === 'live') {
    const chainConfig = chainConfigLib.resolveNetworkConfig(
      JSON.parse(await fs.readFile(path.join(rootDir, 'public', 'chain-config.json'), 'utf8')),
      'injective-testnet'
    );
    authorizeMcpWrite({
      operation: 'x402_payment',
      network: MCP_PINNED_NETWORK,
      contract: chainConfig.contracts?.PaymentOracle,
      amount_usdc: service.priceUSDC,
      dry_run: false,
      approved,
      approval_token
    });
    throw new Error('Live MCP purchase requires the V2 facilitator client; use npm run smoke:x402:live. Demo mode still traverses the HTTP 402 middleware.');
  }

  const { fetchPaidIntel } = await import('../x402/client.js');
  const result = await withEphemeralApp((baseUrl) => fetchPaidIntel(baseUrl, service.endpoint, {
    demoMode: true,
    budgetUSDC: Number(budget_usdc),
    caseData,
    timeoutMs: 15_000
  }));
  if (!result.paid?.report_envelope) throw new Error(result.error?.error ?? 'Paid report was not unlocked');
  const envelope = result.paid.report_envelope;
  return {
    tool: 'purchase_premium_analysis',
    result: {
      payment: {
        mode: 'demo',
        protocol: 'x402',
        challenged: result.x402_required,
        network: result.network,
        amount_usdc: result.priceUSDC,
        settlement_tx: envelope.payment_tx,
        live: false
      },
      report: envelope,
      oracle_proof: {
        event: null,
        attestation_tx: null,
        onchain: false,
        reason: 'demo_mode'
      }
    }
  };
}
