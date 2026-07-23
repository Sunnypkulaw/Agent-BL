// AgentBL MCP Server
// MCP domain layer: tool manifest + deterministic handler registry.
//
// This module serves as the central hub for the MCP tool layer.
// It wraps core engines (riskEngine, workflow) as callable tools
// that an external AI agent can invoke via the MCP protocol (mock HTTP API).

import {
  handleGetTradeCase,
  handleGeneratePricingQuote,
  handleSimulateOffering,
  handlePushPricingToOracle,
  handleSearchKnowledgeBase,
  handleVerifyTradeDocuments,
  handlePurchasePremiumAnalysis,
  handlePreviewMysteryVoyage,
  handleVerifyMysteryReveal
} from './tools.js';

// ============================================================
// MCP-1: Tools Manifest
// ============================================================

export const MCP_TOOLS_MANIFEST = [
  {
    name: 'get_trade_case',
    description: 'Retrieve a trade financing case by case ID. Returns the full TradeCase object including bill_of_lading, insurance, financing, market data, and shipment events. Use this tool first to load the case data before performing risk analysis or pricing.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'The trade case identifier (e.g. "CASE-EBL-2026-0001" for the demo case, "CASE-EBL-2026-LOW-APPROVED" for low-risk scenario)'
        }
      },
      required: ['case_id']
    },
    examples: [
      {
        description: 'Load the demo copper cathode trade case',
        params: { case_id: 'CASE-EBL-2026-0001' }
      }
    ]
  },

  {
    name: 'generate_pricing_quote',
    description: 'Generate an AI-driven pricing quote for a trade financing case. Analyzes the trade case data (cargo value, market prices, shipment events, insurance, risk factors) and produces a structured PricingQuote with base price, risk discount, final issue price, collateral limits, investor yield, and risk assessment. This is the core AI pricing tool.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'The trade case identifier. If provided, the case will be loaded automatically.'
        },
        trade_case: {
          type: 'object',
          description: 'An inline TradeCase object. Use this if you already have the case data (e.g., from a previous get_trade_case call). Takes priority over case_id.'
        }
      }
    },
    examples: [
      {
        description: 'Price the demo case by ID',
        params: { case_id: 'CASE-EBL-2026-0001' }
      }
    ]
  },

  {
    name: 'simulate_offering',
    description: 'Simulate the full RWA offering workflow for a trade case: Created → Funding → Funded → InTransit → AI Risk Agent assessment → final state. Returns the complete workflow timeline with all state transitions, the risk report, and pricing summary. Use this to understand what would happen on-chain if the offering were launched.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'The trade case identifier'
        },
        trade_case: {
          type: 'object',
          description: 'An inline TradeCase object. Takes priority over case_id.'
        }
      }
    },
    examples: [
      {
        description: 'Simulate the offering for the demo case',
        params: { case_id: 'CASE-EBL-2026-0001' }
      }
    ]
  },

  {
    name: 'push_pricing_to_oracle',
    description: 'Prepare or submit a RiskPricingOracle update. Defaults to dry-run. A real Injective write is network-pinned, contract-allowlisted, amount-limited, and requires approved=true.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'The trade case identifier'
        },
        pricing_quote: {
          type: 'object',
          description: 'The PricingQuote object from generate_pricing_quote. Must include final_issue_price_usd, risk_level, pricing_action, evidence_hash, and quote_hash.'
        },
        pool_id: { type: 'integer', minimum: 1, default: 1 },
        network: { type: 'string', enum: ['eip155:1439'], default: 'eip155:1439' },
        contract: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
        dry_run: { type: 'boolean', default: true },
        approved: { type: 'boolean', default: false, description: 'Explicit human approval. Required when dry_run=false.' },
        approval_token: { type: 'string', writeOnly: true, description: 'Out-of-band host approval token; never source this from model or document text.' }
      },
      required: ['case_id', 'pricing_quote']
    },
    examples: [
      {
        description: 'Push the demo pricing to oracle',
        params: {
          case_id: 'CASE-EBL-2026-0001',
          pricing_quote: { final_issue_price_usd: 0.76, risk_level: 'WARNING', pricing_action: 'REPRICE_DOWN', evidence_hash: '0x...', quote_hash: '0x...' }
        }
      }
    ]
  },

  {
    name: 'search_knowledge_base',
    description: 'Search the AgentBL Risk Intelligence Knowledge Base for macro risk events relevant to a trade case. The knowledge base contains curated entries across 7 risk categories (war_risk, sanction_risk, port_congestion, severe_weather, commodity_volatility, fx_volatility, buyer_country_risk). Use this to gather risk intelligence before generating a pricing quote.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g. "Red Sea shipping risk", "copper price decline", "Indian Ocean monsoon", "Hamburg port congestion")'
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional filter: one or more risk categories to search within. Example: ["war_risk", "severe_weather"]'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5, max: 10)'
        }
      },
      required: ['query']
    },
    examples: [
      {
        description: 'Search for war risks on the Suez route',
        params: { query: 'Red Sea Suez conflict', categories: ['war_risk'], limit: 3 }
      }
    ]
  },

  {
    name: 'verify_trade_documents',
    description: 'Cross-check eBL, invoice, insurance, cargo, quantity, Incoterms, and coverage fields without granting any chain-write authority.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: { type: 'string', description: 'Trade case identifier' },
        trade_case: { type: 'object', description: 'Inline TradeCase; takes priority over case_id' }
      },
      anyOf: [{ required: ['case_id'] }, { required: ['trade_case'] }]
    }
  },

  {
    name: 'purchase_premium_analysis',
    description: 'Purchase a premium AgentBL report through the real HTTP 402 challenge/sign/retry middleware. Demo is default; live mode is fail-closed and requires explicit approval.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: { type: 'string' },
        kind: { type: 'string', enum: ['premium-risk', 'premium-valuation', 'fraud-review'], default: 'premium-risk' },
        mode: { type: 'string', enum: ['demo', 'live'], default: 'demo' },
        budget_usdc: { type: 'number', minimum: 0, maximum: 0.005, default: 0.005 },
        approved: { type: 'boolean', default: false },
        approval_token: { type: 'string', writeOnly: true, description: 'Out-of-band host approval token for live mode.' }
      },
      required: ['case_id']
    }
  },

  {
    name: 'preview_mystery_voyage',
    description: 'Create a free commit-only Mystery Voyage preview from canonical PricingQuotes. Enforces the caller budget before previewing, never performs payment, and always requires separate host-wallet human approval for the x402 purchase.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet_address: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
        case_id: { type: 'string', description: 'Optional case restriction; omit to use every eligible canonical pool.' },
        risk_passport: {
          type: 'object',
          properties: { tier: { type: 'string', enum: ['CONSERVATIVE', 'BALANCED', 'ADVENTUROUS'] } }
        },
        budget_usdc: { type: 'number', minimum: 0, maximum: 0.005, default: 0.001 },
        idempotency_key: { type: 'string' },
        ttl_seconds: { type: 'number', minimum: 30, maximum: 3600 }
      },
      required: ['wallet_address']
    }
  },

  {
    name: 'verify_mystery_reveal',
    description: 'Recompute a disclosed Mystery Voyage commit-reveal proof and its optional report/payment bindings locally. This read-only verifier never purchases or subscribes to an RWA.',
    inputSchema: {
      type: 'object',
      properties: {
        proof: { type: 'object', description: 'Disclosed MysteryRevealProof JSON.' },
        report: { type: 'object', description: 'Optional AI Risk Passport for binding checks.' },
        report_envelope: { type: 'object', description: 'Optional PaidReportEnvelope for payment binding checks.' }
      },
      required: ['proof']
    }
  }
];

// ============================================================
// MCP Tool Handler Registry
// ============================================================

export const MCP_TOOL_HANDLERS = {
  get_trade_case: handleGetTradeCase,
  generate_pricing_quote: handleGeneratePricingQuote,
  simulate_offering: handleSimulateOffering,
  push_pricing_to_oracle: handlePushPricingToOracle,
  search_knowledge_base: handleSearchKnowledgeBase,
  verify_trade_documents: handleVerifyTradeDocuments,
  purchase_premium_analysis: handlePurchasePremiumAnalysis,
  preview_mystery_voyage: handlePreviewMysteryVoyage,
  verify_mystery_reveal: handleVerifyMysteryReveal
};

// ============================================================
// MCP callTool Dispatcher
// ============================================================

/**
 * Dispatch a tool call by name.
 *
 * @param {string} toolName - Name of the tool to invoke
 * @param {Object} params - Parameters to pass to the tool
 * @returns {Promise<{tool: string, result: Object}>}
 * @throws {Error} if tool is unknown or execution fails
 */
export async function callTool(toolName, params = {}) {
  const handler = MCP_TOOL_HANDLERS[toolName];
  if (!handler) {
    const available = Object.keys(MCP_TOOL_HANDLERS).join(', ');
    throw new Error(`Unknown tool: "${toolName}". Available tools: ${available}`);
  }

  try {
    const result = await handler(params);
    // Ensure result has the tool name
    if (!result.tool) {
      result.tool = toolName;
    }
    return result;
  } catch (error) {
    // Re-throw with tool context
    throw new Error(`Tool "${toolName}" failed: ${error.message}`);
  }
}

// ============================================================
// Utility: Chain multiple tool calls
// ============================================================

/**
 * Run a sequence of tool calls, passing results from previous steps
 * as context to subsequent steps.
 *
 * @param {Array<{tool: string, params: Function|Object}>} steps
 * @returns {Promise<Array>} Array of { tool, result } for each step
 */
export async function runToolChain(steps) {
  const context = {};
  const results = [];

  for (const step of steps) {
    // If params is a function, call it with the accumulated context
    const params = typeof step.params === 'function'
      ? step.params(context)
      : step.params;

    const result = await callTool(step.tool, params);
    context[step.tool] = result.result;
    context.last = result.result;
    results.push(result);
  }

  return results;
}

// ============================================================
// Standard Demo Tool Chains
// ============================================================

/**
 * Standard pricing pipeline for a trade case.
 * get_trade_case → search_knowledge_base → generate_pricing_quote
 */
export const PRICING_CHAIN = [
  { tool: 'get_trade_case', params: { case_id: '{{case_id}}' } },
  {
    tool: 'search_knowledge_base',
    params: (ctx) => {
      const bl = ctx.last.bill_of_lading;
      return {
        query: `${bl.port_of_loading} ${bl.port_of_discharge} ${bl.cargo}`,
        limit: 5
      };
    }
  },
  {
    tool: 'generate_pricing_quote',
    params: (ctx) => ({ trade_case: ctx.get_trade_case })
  }
];

/**
 * Full demo pipeline: get → search → price → simulate → push oracle.
 */
export const DEMO_CHAIN = [
  { tool: 'get_trade_case', params: { case_id: '{{case_id}}' } },
  {
    tool: 'search_knowledge_base',
    params: (ctx) => {
      const bl = ctx.last.bill_of_lading;
      return {
        query: `${bl.port_of_loading} ${bl.port_of_discharge} ${bl.cargo}`,
        limit: 5
      };
    }
  },
  {
    tool: 'generate_pricing_quote',
    params: (ctx) => ({ trade_case: ctx.get_trade_case })
  },
  {
    tool: 'simulate_offering',
    params: (ctx) => ({ trade_case: ctx.get_trade_case })
  },
  {
    tool: 'push_pricing_to_oracle',
    params: (ctx) => ({
      case_id: ctx.get_trade_case.case_id,
      pricing_quote: ctx.generate_pricing_quote
    })
  }
];
