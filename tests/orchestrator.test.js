import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { AgentOrchestrator } from '../src/agent/orchestrator.js';
import { DecisionLogger } from '../src/agent/decisionLogger.js';
import { assertPricingQuote } from '../src/core/pricingSchema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copperCase = JSON.parse(await fs.readFile(path.join(root, 'data/cases/copper-sg-shanghai.case.json'), 'utf8'));
const bolPath = path.join(root, 'data/uploads/copper-sg-shanghai/bill-of-lading.md');
const invoicePath = path.join(root, 'data/uploads/copper-sg-shanghai/commercial-invoice.md');

test('AI-13: orchestrator runs parse/check/value/three-speed-price/decision as one pipeline', async () => {
  const orchestrator = new AgentOrchestrator();
  const result = await orchestrator.processEbl({
    case_data: copperCase,
    documents: [{ path: bolPath }, { path: invoicePath }]
  });

  assert.equal(result.case_id, copperCase.case_id);
  assert.equal(result.parsing.documents.length, 2);
  assert.equal(result.document_report.ok, true);
  assert.equal(result.valuation.provider, 'deterministic-fallback');
  assert.equal(result.pricing_comparison.quotes.length, 3);
  for (const quote of result.pricing_comparison.quotes) assertPricingQuote(quote, result.parsing.case_data);
  assert.equal(result.action, 'OPEN_OFFERING');
  assert.equal(result.can_auto_execute, true);
  assert.equal(result.contract_action.method, 'createOffering');
  assert.deepEqual(result.pipeline.map((step) => step.step), [
    'document_parse', 'document_consistency', 'cargo_valuation', 'three_speed_pricing', 'decision'
  ]);
});

test('AI-13: the same eBL produces exactly the same deterministic opening decision', async () => {
  const orchestrator = new AgentOrchestrator();
  const first = await orchestrator.processEbl(copperCase);
  const second = await orchestrator.processEbl(structuredClone(copperCase));
  assert.equal(first.decision_id, second.decision_id);
  assert.equal(first.quote_hash, second.quote_hash);
  assert.equal(first.recommended_quote.final_issue_price_usd, second.recommended_quote.final_issue_price_usd);
});

test('AI-13: a critical document mismatch pauses instead of auto-opening', async () => {
  const tampered = structuredClone(copperCase);
  tampered.commercial_invoice.quantity_mt = 700;
  const result = await new AgentOrchestrator().processEbl(tampered);
  assert.equal(result.document_report.has_critical, true);
  assert.equal(result.action, 'PAUSE_OFFERING');
  assert.equal(result.can_auto_execute, false);
  assert.equal(result.contract_action.method, 'pauseOffering');
});

test('AI-13: optional execution and decision logging use the same decision_id', async () => {
  const logger = new DecisionLogger({ filePath: null });
  const calls = [];
  const orchestrator = new AgentOrchestrator({ logger });
  const result = await orchestrator.processEbl(copperCase, {
    executeAction: async (command) => {
      calls.push(command);
      return { success: true, tx_hash: `0x${'11'.repeat(32)}` };
    }
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].decision_id, result.decision_id);
  assert.equal(result.execution.success, true);
  const logged = await logger.get(result.decision_id);
  assert.equal(logged.action, 'OPEN_OFFERING');
  assert.equal(logged.evidence_hash, result.evidence_hash);
});

