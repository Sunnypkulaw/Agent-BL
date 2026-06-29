import crypto from 'node:crypto';
import { stableStringify } from './settlement.js';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/u;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/u;
const REPORT_ID_RE = /^rpt_[0-9a-f]{64}$/u;
const ATOMIC_AMOUNT_RE = /^[1-9][0-9]*$/u;
const LIVE_TX_RE = /^0x[0-9a-fA-F]{64}$/u;
const DEMO_RECEIPT_RE = /^demo:\/\/receipt\/[0-9a-zA-Z._:-]{8,160}$/u;
const MAX_SNAPSHOT_BYTES = 256 * 1024;

export const PAID_REPORT_KINDS = Object.freeze([
  'risk-intelligence',
  'collateral-valuation',
  'document-fraud-review'
]);

export const PAID_REPORT_REQUIRED_FIELDS = Object.freeze([
  'report_id',
  'kind',
  'case_id',
  'payer',
  'payee',
  'network',
  'asset',
  'amount',
  'payment_tx',
  'settled_at',
  'data_snapshot',
  'model_provider',
  'evidence_hash',
  'report_hash',
  'expires_at'
]);

// JSON-Schema-compatible manifest for MCP/API consumers. Runtime validation is
// performed by assertPaidReportEnvelope below so no second schema dependency is
// needed in the hackathon bundle.
export const PAID_REPORT_ENVELOPE_SCHEMA = Object.freeze({
  $id: 'agentbl://schemas/paid-report-envelope-v1',
  type: 'object',
  required: PAID_REPORT_REQUIRED_FIELDS,
  properties: {
    report_id: { type: 'string', pattern: '^rpt_[0-9a-f]{64}$' },
    kind: { type: 'string', enum: PAID_REPORT_KINDS },
    case_id: { type: 'string', minLength: 1, maxLength: 160 },
    payer: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
    payee: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
    network: { type: 'string', pattern: '^eip155:[1-9][0-9]*$' },
    asset: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
    amount: { type: 'string', pattern: '^[1-9][0-9]*$' },
    payment_tx: { type: 'string' },
    settled_at: { type: 'string', format: 'date-time' },
    data_snapshot: { type: 'object' },
    model_provider: { type: 'string', minLength: 1, maxLength: 160 },
    evidence_hash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
    report_hash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
    expires_at: { type: 'string', format: 'date-time' }
  }
});

export class PaidReportValidationError extends Error {
  constructor(errors) {
    super(`PaidReportEnvelope validation failed: ${errors.join('; ')}`);
    this.name = 'PaidReportValidationError';
    this.code = 'paid_report_invalid';
    this.errors = errors;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/gu, '');
}

function isSensitiveKey(key) {
  const normalized = normalizedKey(key);
  return [
    'chainofthought',
    'rawchainofthought',
    'internalreasoning',
    'reasoningtrace',
    'privatekey',
    'secretkey',
    'apikey',
    'accesstoken',
    'refreshtoken',
    'walletsecret',
    'mnemonic',
    'seedphrase',
    'rawdocument',
    'fulldocument',
    'documentcontent',
    'documentbytes',
    'documentimage',
    'documentpdf',
    'billoflading',
    'commercialinvoice',
    'insurancepolicy',
    'fullinvoice',
    'fullinsurancepolicy',
    'pdfbase64',
    'imagebase64'
  ].some((token) => normalized === token || normalized.includes(token));
}

function isSensitiveString(value) {
  return /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/u.test(value)
    || /^data:(?:application\/pdf|image\/[^;]+);base64,/u.test(value)
    || value.length > 64 * 1024;
}

export function findSensitivePaths(value) {
  const findings = [];
  const ancestors = new WeakSet();
  function visit(current, path) {
    if (typeof current === 'string') {
      if (isSensitiveString(current)) findings.push(path || '$');
      return;
    }
    if (!current || typeof current !== 'object') return;
    if (ancestors.has(current)) {
      findings.push(`${path || '$'} (circular)`);
      return;
    }
    ancestors.add(current);
    for (const [key, child] of Object.entries(current)) {
      const childPath = path ? `${path}.${key}` : key;
      if (isSensitiveKey(key)) findings.push(childPath);
      else visit(child, childPath);
    }
    ancestors.delete(current);
  }
  visit(value, '');
  return findings;
}

/** Return a JSON-safe snapshot with secrets, raw documents and binary payloads removed. */
export function sanitizeReportSnapshot(value) {
  const ancestors = new WeakSet();
  function sanitize(current) {
    if (typeof current === 'string') return isSensitiveString(current) ? '[redacted]' : current;
    if (current === null || ['number', 'boolean'].includes(typeof current)) return current;
    if (current === undefined || typeof current === 'function' || typeof current === 'symbol') return undefined;
    if (current instanceof Uint8Array) return '[binary redacted]';
    if (typeof current !== 'object') return String(current);
    if (ancestors.has(current)) throw new PaidReportValidationError(['data_snapshot must not contain circular references']);
    ancestors.add(current);
    if (Array.isArray(current)) {
      const output = current.map(sanitize).filter((entry) => entry !== undefined);
      ancestors.delete(current);
      return output;
    }
    const output = {};
    for (const [key, child] of Object.entries(current)) {
      if (isSensitiveKey(key)) continue;
      const sanitized = sanitize(child);
      if (sanitized !== undefined) output[key] = sanitized;
    }
    ancestors.delete(current);
    return output;
  }
  const sanitized = sanitize(value);
  return isRecord(sanitized) ? sanitized : { value: sanitized };
}

function sha256(value) {
  return `0x${crypto.createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

export function computeReportHash(envelope) {
  if (!isRecord(envelope)) throw new TypeError('envelope must be an object');
  const preimage = { ...envelope };
  delete preimage.report_hash;
  return sha256(preimage);
}

export function computeReportId(envelope) {
  const identity = {
    kind: envelope.kind,
    case_id: envelope.case_id,
    payer: envelope.payer?.toLowerCase?.(),
    payment_tx: envelope.payment_tx,
    settled_at: envelope.settled_at,
    evidence_hash: envelope.evidence_hash?.toLowerCase?.()
  };
  return `rpt_${sha256(identity).slice(2)}`;
}

export function hashReportSnapshot(snapshot) {
  return sha256(sanitizeReportSnapshot(snapshot));
}

function validDate(value) {
  return typeof value === 'string' && value.endsWith('Z') && Number.isFinite(Date.parse(value));
}

export function assertPaidReportEnvelope(envelope) {
  const errors = [];
  if (!isRecord(envelope)) throw new PaidReportValidationError(['envelope must be an object']);
  for (const field of PAID_REPORT_REQUIRED_FIELDS) {
    if (envelope[field] === undefined || envelope[field] === null || envelope[field] === '') {
      errors.push(`${field} is required`);
    }
  }
  if (!REPORT_ID_RE.test(envelope.report_id ?? '')) errors.push('report_id must be rpt_ followed by a 32-byte lowercase hex digest');
  if (!PAID_REPORT_KINDS.includes(envelope.kind)) errors.push(`kind must be one of: ${PAID_REPORT_KINDS.join(', ')}`);
  if (typeof envelope.case_id !== 'string' || envelope.case_id.length < 1 || envelope.case_id.length > 160) errors.push('case_id must be 1-160 characters');
  if (!ADDRESS_RE.test(envelope.payer ?? '')) errors.push('payer must be a 20-byte EVM address');
  if (!ADDRESS_RE.test(envelope.payee ?? '')) errors.push('payee must be a 20-byte EVM address');
  if (!/^eip155:[1-9][0-9]*$/u.test(envelope.network ?? '')) errors.push('network must be an eip155 CAIP-2 identifier');
  if (!ADDRESS_RE.test(envelope.asset ?? '')) errors.push('asset must be a 20-byte EVM address');
  if (!ATOMIC_AMOUNT_RE.test(envelope.amount ?? '')) errors.push('amount must be positive integer atomic units');
  if (!LIVE_TX_RE.test(envelope.payment_tx ?? '') && !DEMO_RECEIPT_RE.test(envelope.payment_tx ?? '')) {
    errors.push('payment_tx must be a 32-byte transaction hash or demo://receipt identifier');
  }
  if (!validDate(envelope.settled_at)) errors.push('settled_at must be an ISO UTC date-time');
  if (!validDate(envelope.expires_at)) errors.push('expires_at must be an ISO UTC date-time');
  if (validDate(envelope.settled_at) && validDate(envelope.expires_at)
    && Date.parse(envelope.expires_at) <= Date.parse(envelope.settled_at)) {
    errors.push('expires_at must be later than settled_at');
  }
  if (!isRecord(envelope.data_snapshot)) errors.push('data_snapshot must be an object');
  if (typeof envelope.model_provider !== 'string' || envelope.model_provider.trim() === '' || envelope.model_provider.length > 160) {
    errors.push('model_provider must be a non-empty string of at most 160 characters');
  }
  if (!HASH_RE.test(envelope.evidence_hash ?? '')) errors.push('evidence_hash must be a 32-byte hash');
  if (!HASH_RE.test(envelope.report_hash ?? '')) errors.push('report_hash must be a 32-byte hash');
  const sensitivePaths = findSensitivePaths(envelope);
  if (sensitivePaths.length > 0) errors.push(`sensitive content is forbidden at: ${sensitivePaths.join(', ')}`);
  if (isRecord(envelope.data_snapshot)
    && Buffer.byteLength(stableStringify(envelope.data_snapshot), 'utf8') > MAX_SNAPSHOT_BYTES) {
    errors.push(`data_snapshot must be <= ${MAX_SNAPSHOT_BYTES} bytes`);
  }
  if (HASH_RE.test(envelope.report_hash ?? '') && computeReportHash(envelope).toLowerCase() !== envelope.report_hash.toLowerCase()) {
    errors.push('report_hash does not match the canonical envelope payload');
  }
  if (errors.length > 0) throw new PaidReportValidationError(errors);
  return envelope;
}

export function validatePaidReportEnvelope(envelope) {
  try {
    assertPaidReportEnvelope(envelope);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof PaidReportValidationError) return { valid: false, errors: error.errors };
    throw error;
  }
}

export function createPaidReportEnvelope(input, options = {}) {
  if (!isRecord(input)) throw new TypeError('input must be an object');
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const ttlSeconds = Number(options.ttlSeconds ?? 300);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 10 || ttlSeconds > 86_400) {
    throw new RangeError('ttlSeconds must be an integer between 10 and 86400');
  }
  const settledAt = input.settled_at ?? now.toISOString();
  const expiresAt = input.expires_at ?? new Date(Date.parse(settledAt) + ttlSeconds * 1000).toISOString();
  const envelope = {
    ...input,
    payer: typeof input.payer === 'string' ? input.payer.toLowerCase() : input.payer,
    payee: typeof input.payee === 'string' ? input.payee.toLowerCase() : input.payee,
    asset: typeof input.asset === 'string' ? input.asset.toLowerCase() : input.asset,
    amount: String(input.amount ?? ''),
    settled_at: settledAt,
    data_snapshot: sanitizeReportSnapshot(input.data_snapshot ?? {}),
    expires_at: expiresAt
  };
  delete envelope.report_hash;
  envelope.report_id = input.report_id ?? computeReportId(envelope);
  envelope.report_hash = computeReportHash(envelope);
  return assertPaidReportEnvelope(envelope);
}

export function isPaidReportExpired(envelope, now = Date.now()) {
  assertPaidReportEnvelope(envelope);
  const timestamp = now instanceof Date
    ? now.getTime()
    : typeof now === 'string'
      ? Date.parse(now)
      : Number(now);
  if (!Number.isFinite(timestamp)) throw new TypeError('now must be a Date, timestamp, or ISO date-time string');
  return timestamp >= Date.parse(envelope.expires_at);
}
