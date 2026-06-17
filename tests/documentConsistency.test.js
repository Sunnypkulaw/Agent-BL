import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { checkDocumentConsistency } from '../src/agent/documentConsistency.js';

const copperCase = JSON.parse(
  await fs.readFile(new URL('../data/cases/copper-sg-shanghai.case.json', import.meta.url), 'utf8')
);

test('AI-8: the clean copper fixture passes all consistency checks', () => {
  const report = checkDocumentConsistency(copperCase);
  assert.equal(report.ok, true);
  assert.equal(report.has_critical, false);
  assert.equal(report.penalty_bps, 0);
  assert.ok(report.checks.length >= 6);
  assert.ok(report.checks.every((c) => c.status === 'ok'));
});

test('AI-8: a quantity mismatch is flagged critical with a penalty', () => {
  const tampered = structuredClone(copperCase);
  tampered.commercial_invoice.quantity_mt = 600; // eBL says 500
  const report = checkDocumentConsistency(tampered);
  assert.equal(report.ok, false);
  assert.equal(report.has_critical, true);
  const quantity = report.checks.find((c) => c.id === 'quantity_match');
  assert.equal(quantity.status, 'critical');
  assert.ok(report.penalty_bps > 0);
});

test('AI-8: an insurance coverage gap and an expired policy are detected', () => {
  const tampered = structuredClone(copperCase);
  tampered.insurance.insured_value_usd = 5_000_000; // below invoice 6,875,000
  tampered.insurance.expires_at = '2026-06-10'; // before ETA 2026-06-15
  const report = checkDocumentConsistency(tampered);

  const coverage = report.checks.find((c) => c.id === 'insurance_coverage');
  const expiry = report.checks.find((c) => c.id === 'insurance_expiry');
  assert.equal(coverage.status, 'critical');
  assert.equal(expiry.status, 'critical');
  assert.ok(report.issues.length >= 2);
});

test('AI-8: incoterms and over-invoicing mismatches raise warnings', () => {
  const tampered = structuredClone(copperCase);
  tampered.commercial_invoice.incoterms = 'FOB Singapore'; // eBL is CIF Shanghai
  tampered.commercial_invoice.unit_price_usd_per_mt = 17_000; // market landed ~13,750
  const report = checkDocumentConsistency(tampered);

  assert.equal(report.checks.find((c) => c.id === 'incoterms_match').status, 'warning');
  assert.equal(report.checks.find((c) => c.id === 'invoice_vs_market').status, 'warning');
});

test('AI-8: degrades gracefully when only an eBL is present (legacy case)', () => {
  const minimal = { bill_of_lading: { quantity_mt: 1000, declared_value_usd: 8_500_000, eta: '2026-07-16' } };
  const report = checkDocumentConsistency(minimal);
  assert.ok(Array.isArray(report.checks));
  assert.equal(typeof report.penalty_bps, 'number');
});
