// AI-17 — deterministic-first trade document parser.
//
// The parser accepts text/Markdown directly and supports PDF/image OCR through
// an injected `textExtractor`. An optional `aiExtractor` may fill missing
// fields, but deterministic extraction remains the fallback and every field
// carries source-line provenance plus a confidence score.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const DOCUMENT_TYPES = ['EBL', 'COMMERCIAL_INVOICE', 'INSURANCE_POLICY'];

export class DocumentParseError extends Error {
  constructor(message, code = 'DOCUMENT_PARSE_ERROR', details = {}) {
    super(message);
    this.name = 'DocumentParseError';
    this.code = code;
    this.details = details;
  }
}

function hashText(text) {
  return `0x${crypto.createHash('sha256').update(text).digest('hex')}`;
}

function stripMarkdown(value = '') {
  return String(value)
    .replace(/\*\*/gu, '')
    .replace(/`/gu, '')
    .replace(/^#+\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function labelKey(value = '') {
  return stripMarkdown(value).toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
}

function lineNumber(text, offset) {
  return text.slice(0, Math.max(0, offset)).split(/\r?\n/u).length;
}

function parseTableEntries(text) {
  const entries = [];
  const lines = text.split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (!line.trim().startsWith('|')) return;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2 || cells.every((cell) => /^:?-+:?$/u.test(cell))) return;
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const key = labelKey(cells[i]);
      const value = stripMarkdown(cells[i + 1]);
      if (!key || !value || key === 'field' || key === 'value') continue;
      entries.push({ key, value, line: index + 1, method: 'markdown-table', confidence: 0.98 });
    }
  });
  return entries;
}

function parseInlineEntries(text) {
  const entries = [];
  const pattern = /\*\*([^*\n]+?)(?::)?\*\*\s*:?[ \t]*([^\n|]+)/gu;
  for (const match of text.matchAll(pattern)) {
    const key = labelKey(match[1]);
    const value = stripMarkdown(match[2]);
    if (!key || !value || value === '---') continue;
    entries.push({ key, value, line: lineNumber(text, match.index ?? 0), method: 'inline-label', confidence: 0.94 });
  }
  return entries;
}

function entryFor(entries, labels) {
  const keys = labels.map(labelKey);
  return entries.find((entry) => keys.includes(entry.key))
    ?? entries.find((entry) => keys.some((key) => entry.key.includes(key) || key.includes(entry.key)));
}

function sectionValue(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const re = new RegExp(`\\*\\*${escaped}\\*\\*\\s*\\r?\\n([^\\n]+)`, 'iu');
    const match = re.exec(text);
    if (match) {
      return {
        value: stripMarkdown(match[1]),
        line: lineNumber(text, match.index),
        method: 'section-label',
        confidence: 0.93
      };
    }
  }
  return null;
}

function regexValue(text, regex, confidence = 0.88) {
  const match = regex.exec(text);
  if (!match) return null;
  return {
    value: stripMarkdown(match[1]),
    line: lineNumber(text, match.index),
    method: 'regex',
    confidence
  };
}

function numeric(value) {
  if (value === undefined || value === null) return null;
  const match = String(value).replace(/,/gu, '').match(/-?\d+(?:\.\d+)?/u);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function money(value) {
  return numeric(value);
}

function isoDate(value) {
  if (!value) return null;
  const match = String(value).match(/\b(20\d{2})[-/]([01]?\d)[-/]([0-3]?\d)\b/u);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function hsCode(value) {
  const match = String(value ?? '').match(/\b(\d{4})[.]?(\d{2})\b/u);
  return match ? `${match[1]}${match[2]}` : null;
}

function vesselVoyage(value) {
  if (!value) return { vessel: null, voyage_no: null };
  const [vessel, ...rest] = String(value).split('/');
  return { vessel: stripMarkdown(vessel), voyage_no: stripMarkdown(rest.join('/')) || null };
}

function goodsRow(text) {
  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(stripMarkdown);
    const joined = cells.join(' ');
    if (!/\b\d{4}[.]?\d{2}\b/u.test(joined) || !/\bMT\b/iu.test(joined)) continue;
    const description = cells.find((cell) => /copper|soy|oil|ore|rubber|aluminium|aluminum|goods/iu.test(cell))
      ?? cells.find((cell) => cell.length > 20)
      ?? null;
    const quantityCell = cells.find((cell) => /\d[\d,.]*\s*MT\b/iu.test(cell));
    const amountCell = [...cells].reverse().find((cell) => /\d[\d,.]*/u.test(cell) && !/MT\b/iu.test(cell));
    return {
      description,
      hs_code: hsCode(joined),
      quantity_mt: numeric(quantityCell),
      amount_usd: money(amountCell),
      cells,
      line: index + 1,
      method: 'goods-table',
      confidence: 0.96
    };
  }
  return null;
}

function fieldCollector() {
  const fields = {};
  const provenance = {};
  const add = (name, source, transform = (value) => value) => {
    if (!source || source.value === undefined || source.value === null || source.value === '') return;
    const value = transform(source.value);
    if (value === null || value === undefined || value === '') return;
    fields[name] = value;
    provenance[name] = {
      line: source.line ?? null,
      method: source.method ?? 'unknown',
      confidence: source.confidence ?? 0.8,
      raw: String(source.value).slice(0, 240)
    };
  };
  return { fields, provenance, add };
}

function detectDocumentType(text, filename = '') {
  const haystack = `${filename}\n${text.slice(0, 3000)}`.toLowerCase();
  if (/commercial invoice|invoice no|total invoice/u.test(haystack)) return 'COMMERCIAL_INVOICE';
  if (/insurance policy|policy no|insured amount|marine cargo/u.test(haystack)) return 'INSURANCE_POLICY';
  if (/bill of lading|electronic bill|\bebl\b|b\/l no/u.test(haystack)) return 'EBL';
  throw new DocumentParseError('Unable to determine document type', 'UNKNOWN_DOCUMENT_TYPE', { filename });
}

function parseEbl(text, entries) {
  const c = fieldCollector();
  const get = (...labels) => entryFor(entries, labels);
  c.add('bl_no', get('B/L No.', 'Bill of Lading No.', 'BL No.'));
  c.add('bl_id', get('eBL Token / Title Ref', 'eBL Title Ref'));
  c.add('bl_type', get('B/L Type'));
  c.add('ebl_platform', get('eBL Platform'));
  c.add('carrier', get('Carrier'));
  c.add('shipper', sectionValue(text, ['Shipper / Exporter', 'Shipper']));
  c.add('consignee', sectionValue(text, ['Consignee']));
  c.add('notify_party', sectionValue(text, ['Notify Party']));
  const vv = get('Vessel / Voyage');
  if (vv) {
    const parsed = vesselVoyage(vv.value);
    c.add('vessel', { ...vv, value: parsed.vessel });
    c.add('voyage_no', { ...vv, value: parsed.voyage_no });
  }
  c.add('port_of_loading', get('Port of Loading'));
  c.add('port_of_discharge', get('Port of Discharge'));
  c.add('shipped_on_board', get('Shipped on Board'), isoDate);
  c.add('eta', get('Estimated Time of Arrival (ETA)', 'ETA'), isoDate);
  c.add('issue_date', get('Place & Date of Issue'), isoDate);
  c.add('document_hash', get('Document Hash (SHA-256)', 'Document Hash'));
  const goods = goodsRow(text);
  if (goods) {
    const source = (value) => ({ ...goods, value });
    c.add('cargo', source(goods.description));
    c.add('hs_code', source(goods.hs_code));
    c.add('quantity_mt', source(goods.quantity_mt), Number);
  }
  c.add('declared_value_usd', regexValue(text, /Declared Cargo Value[^\n]*?USD\s*([\d,.]+)/iu, 0.97), money);
  c.add('incoterms', regexValue(text, /Declared Cargo Value[^\n]*?\(((?:CIF|CFR|FOB|DAP|DDP)[^)]+)\)/iu, 0.75));
  if (!c.fields.bl_id && c.fields.bl_no) c.add('bl_id', { value: c.fields.bl_no, line: c.provenance.bl_no.line, method: 'derived-from-bl-no', confidence: 0.8 });
  return c;
}

function parseInvoice(text, entries) {
  const c = fieldCollector();
  const get = (...labels) => entryFor(entries, labels);
  c.add('invoice_no', get('Invoice No.'));
  c.add('invoice_date', get('Invoice Date'), isoDate);
  c.add('sales_contract', get('Sales Contract'));
  c.add('incoterms', get('Incoterms 2020', 'Incoterms'));
  c.add('payment_terms', get('Payment Terms'));
  c.add('bl_no', get('B/L No.'));
  const vv = get('Vessel / Voyage');
  if (vv) {
    const parsed = vesselVoyage(vv.value);
    c.add('vessel', { ...vv, value: parsed.vessel });
    c.add('voyage_no', { ...vv, value: parsed.voyage_no });
  }
  c.add('port_of_loading', get('Port of Loading'));
  c.add('port_of_discharge', get('Port of Discharge'));
  c.add('seller', regexValue(text, /\*\*Seller \(Beneficiary\):\*\*\s*([^\n]+)/iu, 0.95));
  c.add('buyer', regexValue(text, /\*\*Buyer \(Applicant\):\*\*\s*([^\n]+)/iu, 0.95));
  const goods = goodsRow(text);
  if (goods) {
    const source = (value) => ({ ...goods, value });
    c.add('cargo', source(goods.description));
    c.add('hs_code', source(goods.hs_code));
    c.add('quantity_mt', source(goods.quantity_mt), Number);
    const numericCells = goods.cells.map((cell) => numeric(cell)).filter((value) => value !== null);
    if (numericCells.length >= 2) {
      c.add('unit_price_usd_per_mt', source(numericCells.at(-2)), Number);
      c.add('total_amount_usd', source(numericCells.at(-1)), Number);
    }
  }
  c.add('total_amount_usd', regexValue(text, /Total Invoice Value:\s*USD\s*([\d,.]+)/iu, 0.99), money);
  c.add('currency', { value: 'USD', line: 1, method: 'document-currency', confidence: 0.9 });
  c.add('is_provisional', regexValue(text, /\b(PROVISIONAL INVOICE)\b/iu, 0.98), () => true);
  return c;
}

function parseInsurance(text, entries) {
  const c = fieldCollector();
  const get = (...labels) => entryFor(entries, labels);
  c.add('policy_no', get('Policy No.'));
  c.add('policy_type', get('Policy Type'));
  c.add('provider', get('Insurer'));
  c.add('insured_party', sectionValue(text, ['Insured']));
  c.add('origin', get('From'));
  c.add('destination', get('To'));
  const vv = get('Vessel');
  if (vv) {
    const parsed = vesselVoyage(vv.value);
    c.add('vessel', { ...vv, value: parsed.vessel });
    c.add('voyage_no', { ...vv, value: parsed.voyage_no });
  }
  c.add('commodity', get('Commodity'));
  c.add('quantity_mt', get('Quantity'), numeric);
  c.add('cif_value_usd', get('CIF Value'), money);
  c.add('coverage_ratio', get('Coverage Ratio'), (value) => {
    const n = numeric(value);
    return n === null ? null : (n > 2 ? n / 100 : n);
  });
  c.add('insured_value_usd', get('Insured Amount', 'Sum Insured'), money);
  c.add('expires_at', get('Expiry'), isoDate);
  c.add('deductible_usd', get('Deductible'), money);
  c.add('policy_hash', get('Policy Hash'));
  return c;
}

function toCaseFragment(type, fields, textHash) {
  if (type === 'EBL') {
    return {
      bill_of_lading: {
        bl_id: fields.bl_id ?? fields.bl_no,
        bl_no: fields.bl_no,
        bl_type: fields.bl_type,
        ebl_platform: fields.ebl_platform,
        shipper: fields.shipper,
        consignee: fields.consignee,
        notify_party: fields.notify_party,
        carrier: fields.carrier,
        vessel: fields.vessel,
        voyage_no: fields.voyage_no,
        port_of_loading: fields.port_of_loading,
        port_of_discharge: fields.port_of_discharge,
        cargo: fields.cargo,
        quantity_mt: fields.quantity_mt,
        declared_value_usd: fields.declared_value_usd,
        incoterms: fields.incoterms,
        issue_date: fields.issue_date ?? fields.shipped_on_board,
        shipped_on_board: fields.shipped_on_board,
        eta: fields.eta,
        document_hash: fields.document_hash ?? textHash
      },
      cargo: { hs_code: fields.hs_code, quantity_mt: fields.quantity_mt, commodity: fields.cargo }
    };
  }
  if (type === 'COMMERCIAL_INVOICE') {
    return {
      commercial_invoice: {
        invoice_no: fields.invoice_no,
        invoice_date: fields.invoice_date,
        sales_contract: fields.sales_contract,
        incoterms: fields.incoterms,
        payment_terms: fields.payment_terms,
        bl_no: fields.bl_no,
        seller: fields.seller,
        buyer: fields.buyer,
        unit_price_usd_per_mt: fields.unit_price_usd_per_mt,
        quantity_mt: fields.quantity_mt,
        total_amount_usd: fields.total_amount_usd,
        currency: fields.currency,
        is_provisional: fields.is_provisional,
        hs_code: fields.hs_code
      },
      cargo: { hs_code: fields.hs_code, quantity_mt: fields.quantity_mt, commodity: fields.cargo }
    };
  }
  return {
    insurance: {
      policy_no: fields.policy_no,
      provider: fields.provider,
      policy_type: fields.policy_type,
      insured_value_usd: fields.insured_value_usd,
      coverage_ratio: fields.coverage_ratio,
      expires_at: fields.expires_at,
      policy_hash: fields.policy_hash ?? textHash
    }
  };
}

function removeUndefined(value) {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined && item !== null && item !== '')
    .map(([key, item]) => [key, removeUndefined(item)]));
}

function mergeDeep(base, next) {
  const out = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(next ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) out[key] = mergeDeep(out[key], value);
    else if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

async function resolveInput(input, options) {
  const descriptor = typeof input === 'object' && !Buffer.isBuffer(input) ? input : {};
  const filename = descriptor.filename ?? descriptor.name ?? descriptor.path ?? (typeof input === 'string' ? input : 'document');
  const mimeType = descriptor.mimeType ?? descriptor.contentType ?? '';
  if (descriptor.text !== undefined) return { text: String(descriptor.text), filename, mimeType, extractor: 'provided-text' };

  if (descriptor.buffer || Buffer.isBuffer(input)) {
    const buffer = descriptor.buffer ?? input;
    if (/text|markdown|json/iu.test(mimeType)) return { text: buffer.toString('utf8'), filename, mimeType, extractor: 'buffer-text' };
    if (!options.textExtractor) throw new DocumentParseError('PDF/image requires a textExtractor (OCR) or extracted text', 'OCR_REQUIRED', { filename, mimeType });
    return { text: String(await options.textExtractor({ buffer, filename, mimeType })), filename, mimeType, extractor: 'injected-ocr' };
  }

  if (descriptor.path || (typeof input === 'string' && !input.includes('\n'))) {
    const filePath = descriptor.path ?? input;
    try {
      const buffer = await fs.readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();
      if (['.md', '.txt', '.json', '.csv'].includes(extension)) {
        return { text: buffer.toString('utf8'), filename: filePath, mimeType, extractor: 'file-text' };
      }
      if (!options.textExtractor) throw new DocumentParseError('PDF/image requires a textExtractor (OCR) or extracted text', 'OCR_REQUIRED', { filename: filePath, mimeType });
      return { text: String(await options.textExtractor({ buffer, filename: filePath, mimeType })), filename: filePath, mimeType, extractor: 'injected-ocr' };
    } catch (error) {
      if (error instanceof DocumentParseError) throw error;
      if (error?.code !== 'ENOENT' || descriptor.path) throw error;
    }
  }

  return { text: String(input), filename, mimeType, extractor: 'inline-text' };
}

/** Parse one eBL, invoice, or insurance document. */
export async function parseDocument(input, options = {}) {
  const resolved = await resolveInput(input, options);
  const text = resolved.text.replace(/\u0000/gu, '').trim();
  if (text.length < 20) throw new DocumentParseError('Document text is empty or too short', 'EMPTY_DOCUMENT', { filename: resolved.filename });
  const type = options.documentType ?? detectDocumentType(text, resolved.filename);
  if (!DOCUMENT_TYPES.includes(type)) throw new DocumentParseError(`Unsupported document type: ${type}`, 'UNKNOWN_DOCUMENT_TYPE');

  const entries = [...parseTableEntries(text), ...parseInlineEntries(text)];
  const parsed = type === 'EBL' ? parseEbl(text, entries)
    : type === 'COMMERCIAL_INVOICE' ? parseInvoice(text, entries)
      : parseInsurance(text, entries);
  const warnings = [];

  if (options.aiExtractor) {
    try {
      const ai = await options.aiExtractor({ text, documentType: type, fields: { ...parsed.fields } });
      for (const [name, value] of Object.entries(ai?.fields ?? ai ?? {})) {
        if (parsed.fields[name] !== undefined || value === undefined || value === null || value === '') continue;
        parsed.fields[name] = value;
        parsed.provenance[name] = { line: null, method: 'ai-extractor', confidence: 0.72, raw: String(value).slice(0, 240) };
      }
    } catch (error) {
      warnings.push(`AI extractor failed; deterministic fallback used: ${error.message}`);
    }
  }

  const requiredByType = {
    EBL: ['bl_id', 'carrier', 'shipper', 'consignee', 'vessel', 'port_of_loading', 'port_of_discharge', 'cargo', 'quantity_mt', 'document_hash'],
    COMMERCIAL_INVOICE: ['invoice_no', 'invoice_date', 'incoterms', 'quantity_mt', 'total_amount_usd'],
    INSURANCE_POLICY: ['policy_no', 'provider', 'insured_value_usd']
  };
  const required = requiredByType[type];
  const missing = required.filter((field) => parsed.fields[field] === undefined || parsed.fields[field] === null);
  if (missing.length > 0) warnings.push(`Missing required fields: ${missing.join(', ')}`);
  const extractedRequired = required.length - missing.length;
  const requiredCoverage = extractedRequired / required.length;
  const provenanceScores = Object.values(parsed.provenance).map((item) => item.confidence);
  const averageConfidence = provenanceScores.length > 0
    ? provenanceScores.reduce((sum, score) => sum + score, 0) / provenanceScores.length
    : 0;
  const confidence = Math.round((requiredCoverage * 0.65 + averageConfidence * 0.35) * 1000) / 1000;
  const textHash = hashText(text);

  return {
    document_type: type,
    source: { filename: resolved.filename, mime_type: resolved.mimeType || null, extractor: resolved.extractor },
    fields: parsed.fields,
    provenance: parsed.provenance,
    confidence,
    requires_human_review: confidence < (options.reviewThreshold ?? 0.82) || missing.length > 0,
    missing_fields: missing,
    warnings,
    text_hash: textHash,
    case_fragment: removeUndefined(toCaseFragment(type, parsed.fields, textHash))
  };
}

/** Parse a document bundle and merge it over an optional structured case. */
export async function parseDocuments(inputs, options = {}) {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new DocumentParseError('documents must be a non-empty array', 'NO_DOCUMENTS');
  const documents = [];
  for (const input of inputs) documents.push(await parseDocument(input, options));

  let mergedCase = structuredClone(options.templateCase ?? {});
  for (const document of documents) mergedCase = mergeDeep(mergedCase, document.case_fragment);
  if (!mergedCase.case_id) {
    const seed = mergedCase.bill_of_lading?.bl_id ?? documents.map((document) => document.text_hash).join(':');
    mergedCase.case_id = `CASE-PARSED-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12).toUpperCase()}`;
  }
  mergedCase.document_parsing = documents.map(({ document_type, source, confidence, requires_human_review, text_hash }) => ({
    document_type, source, confidence, requires_human_review, text_hash
  }));

  return {
    case_id: mergedCase.case_id,
    documents,
    case_data: mergedCase,
    requires_human_review: documents.some((document) => document.requires_human_review),
    warnings: documents.flatMap((document) => document.warnings.map((warning) => `${document.document_type}: ${warning}`))
  };
}
