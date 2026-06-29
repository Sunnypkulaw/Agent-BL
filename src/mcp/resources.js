import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listHarnessCaseFiles } from '../core/scenarioRunner.js';
import chainConfig from '../../scripts/lib/chain-config.cjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const MCP_RESOURCES = Object.freeze([
  Object.freeze({
    uri: 'agentbl://cases/catalog',
    name: 'Trade Case Catalog',
    description: 'Redacted catalog of available eBL-backed financing cases',
    mimeType: 'application/json'
  }),
  Object.freeze({
    uri: 'agentbl://risk/methodology',
    name: 'Risk Pricing Methodology',
    description: 'Public risk dimensions, pricing boundaries, and non-guarantee policy',
    mimeType: 'application/json'
  }),
  Object.freeze({
    uri: 'agentbl://contracts/deployments',
    name: 'Injective Contract Deployments',
    description: 'Public Injective network, contract addresses, ABIs, and explorer evidence',
    mimeType: 'application/json'
  })
]);

function content(uri, value) {
  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(value, null, 2)
    }]
  };
}

async function caseCatalog() {
  const cases = [];
  for (const file of await listHarnessCaseFiles({ includeDemo: true })) {
    try {
      const value = JSON.parse(await fs.readFile(file, 'utf8'));
      const bill = value.bill_of_lading ?? {};
      cases.push({
        case_id: value.case_id,
        cargo: bill.cargo ?? value.cargo?.commodity ?? null,
        route: [bill.port_of_loading, bill.port_of_discharge].filter(Boolean).join(' -> '),
        payout_speed: value.financing?.payout_speed ?? null
      });
    } catch {
      // Invalid fixtures are rejected by the normal case/schema path; do not
      // expose partial document content through a resource.
    }
  }
  return { count: cases.length, cases };
}

async function deploymentEvidence() {
  const raw = JSON.parse(await fs.readFile(path.join(rootDir, 'public', 'chain-config.json'), 'utf8'));
  const config = chainConfig.resolveNetworkConfig(raw, 'injective-testnet');
  const gate = JSON.parse(await fs.readFile(path.join(rootDir, 'docs', 'evidence', 'wave-b-gate.json'), 'utf8'));
  const protocol = config.protocol ?? {};
  return {
    network: config.network,
    chainId: config.chainId,
    chainIdDecimal: config.chainIdDecimal,
    explorerBase: config.explorerBase,
    contracts: config.contracts,
    deployedAt: protocol.deployedAt ?? config.deployedAt,
    deployTransactions: protocol.deployTransactions ?? { AgentBLRWA: config.deployTx },
    smoke: protocol.smoke ?? null,
    latestPaidPricingProof: {
      paymentTx: gate.payment?.tx,
      reportHash: gate.paidReportEnvelope?.report_hash,
      paymentAttestationTx: gate.paymentAttested?.tx,
      pricingUpdateTx: gate.pricingUpdated?.tx,
      finalIssuePriceE6: gate.offering?.final_issue_price_e6
    }
  };
}

function riskMethodology() {
  return {
    version: 'agentbl-risk-v1',
    dimensions: [
      'document_integrity',
      'route_and_geopolitical',
      'cargo_and_market',
      'counterparty_and_country',
      'insurance_and_coverage',
      'shipment_events'
    ],
    pricing: {
      unit: 'basis_points',
      output: ['risk_level', 'risk_discount_bps', 'final_issue_price_usd', 'pricing_action'],
      evidenceRequired: true
    },
    boundaries: {
      targetRedemptionGuaranteed: false,
      paidIntelChangesProtocolStateAutomatically: false,
      chainWritesRequirePolicyApproval: true
    }
  };
}

export async function readMcpResource(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('agentbl://')) {
    throw Object.assign(new Error('Resource URI must use the agentbl:// scheme'), { code: -32602 });
  }
  if (uri === 'agentbl://cases/catalog') return content(uri, await caseCatalog());
  if (uri === 'agentbl://risk/methodology') return content(uri, riskMethodology());
  if (uri === 'agentbl://contracts/deployments') return content(uri, await deploymentEvidence());
  throw Object.assign(new Error(`Unknown resource URI: ${uri}`), { code: -32002 });
}
