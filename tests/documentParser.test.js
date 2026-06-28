import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DocumentParseError,
  parseDocument,
  parseDocuments
} from '../src/agent/documentParser.js';
import { checkDocumentConsistency } from '../src/agent/documentConsistency.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bolPath = path.join(root, 'data/uploads/copper-sg-shanghai/bill-of-lading.md');
const invoicePath = path.join(root, 'data/uploads/copper-sg-shanghai/commercial-invoice.md');
const insurancePath = path.join(root, 'data/uploads/soybean-sh-sg/insurance-policy.md');
const copperCase = JSON.parse(await fs.readFile(path.join(root, 'data/cases/copper-sg-shanghai.case.json'), 'utf8'));

test('AI-17: parses the demo eBL with field-level provenance and confidence', async () => {
  const result = await parseDocument({ path: bolPath });
  assert.equal(result.document_type, 'EBL');
  assert.equal(result.fields.bl_no, 'BSCL/SIN/SHA/2026/04417');
  assert.equal(result.fields.bl_id, 'WAVE-EBL-7F3A91C4');
  assert.equal(result.fields.quantity_mt, 500);
  assert.equal(result.fields.declared_value_usd, 6_875_000);
  assert.equal(result.fields.hs_code, '740311');
  assert.match(result.fields.document_hash, /^0x[0-9a-f]{64}$/u);
  assert.ok(result.provenance.quantity_mt.line > 0);
  assert.ok(result.provenance.quantity_mt.confidence >= 0.9);
  assert.ok(result.confidence >= 0.82);
  assert.equal(result.requires_human_review, false);
});

test('AI-17: parses invoice totals, unit price, parties and shipment references', async () => {
  const result = await parseDocument(invoicePath);
  assert.equal(result.document_type, 'COMMERCIAL_INVOICE');
  assert.equal(result.fields.invoice_no, 'SRT-INV-2026-04417');
  assert.equal(result.fields.invoice_date, '2026-06-03');
  assert.equal(result.fields.bl_no, 'BSCL/SIN/SHA/2026/04417');
  assert.equal(result.fields.quantity_mt, 500);
  assert.equal(result.fields.unit_price_usd_per_mt, 13_750);
  assert.equal(result.fields.total_amount_usd, 6_875_000);
  assert.match(result.fields.seller, /Strait Resources/iu);
  assert.match(result.fields.buyer, /Donghai Copper/iu);
  assert.equal(result.requires_human_review, false);
});

test('AI-17: merges a document bundle over a structured template without losing pricing fields', async () => {
  const parsed = await parseDocuments([{ path: bolPath }, { path: invoicePath }], { templateCase: copperCase });
  assert.equal(parsed.case_id, copperCase.case_id);
  assert.equal(parsed.documents.length, 2);
  assert.equal(parsed.case_data.financing.requested_cash_usd, 3_300_000);
  assert.equal(parsed.case_data.bill_of_lading.bl_no, 'BSCL/SIN/SHA/2026/04417');
  assert.equal(parsed.case_data.commercial_invoice.total_amount_usd, 6_875_000);
  assert.equal(parsed.requires_human_review, false);
  const consistency = checkDocumentConsistency(parsed.case_data);
  assert.equal(consistency.has_critical, false);
});

test('AI-17: PDF/image extraction is injectable and AI failure falls back deterministically', async () => {
  const invoiceText = await fs.readFile(invoicePath, 'utf8');
  const result = await parseDocument({
    buffer: Buffer.from('fake-image'),
    filename: 'invoice.png',
    mimeType: 'image/png'
  }, {
    textExtractor: async () => invoiceText,
    aiExtractor: async () => { throw new Error('provider unavailable'); }
  });
  assert.equal(result.source.extractor, 'injected-ocr');
  assert.equal(result.fields.invoice_no, 'SRT-INV-2026-04417');
  assert.ok(result.warnings.some((warning) => warning.includes('deterministic fallback')));

  const insurance = await parseDocument(insurancePath);
  assert.equal(insurance.document_type, 'INSURANCE_POLICY');
  assert.equal(insurance.fields.policy_no, 'MCI-2026-001');
  assert.equal(insurance.fields.insured_value_usd, 2_860_000);
  assert.equal(insurance.fields.coverage_ratio, 1.1);
});

test('AI-17: binary input without OCR requests human-capable extraction explicitly', async () => {
  await assert.rejects(
    () => parseDocument({ buffer: Buffer.from([0, 1, 2]), filename: 'scan.pdf', mimeType: 'application/pdf' }),
    (error) => error instanceof DocumentParseError && error.code === 'OCR_REQUIRED'
  );
});
