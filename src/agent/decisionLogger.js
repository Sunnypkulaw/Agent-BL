// AI-16 — persistent, deterministic decision audit log.
//
// Stores input snapshots, concise reasoning summaries, evidence hashes,
// decisions and transaction receipts. It deliberately does not store hidden
// chain-of-thought. Writes are serialized and atomically replace the JSON file.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_PATH = path.resolve(__dirname, '../../data/runtime/agent-decisions.json');
const HASH_RE = /^0x[0-9a-f]{64}$/u;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => [key, canonicalize(value[key])]));
}

export function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function hashSnapshot(value) {
  return `0x${crypto.createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

export function createDecisionId(decision = {}) {
  const identity = {
    idempotency_key: decision.idempotency_key ?? null,
    event_id: decision.event_id ?? null,
    event_type: decision.event_type ?? null,
    case_id: decision.case_id ?? null,
    pool_id: decision.pool_id ?? null,
    action: decision.action ?? decision.decision?.action ?? null,
    input_snapshot: decision.input_snapshot ?? null,
    evidence_hash: decision.evidence_hash ?? null
  };
  return `decision_${hashSnapshot(identity).slice(2, 26)}`;
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function validateRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('decision must be an object');
  if (!record.case_id || typeof record.case_id !== 'string') throw new TypeError('decision.case_id is required');
  if (!record.action || typeof record.action !== 'string') throw new TypeError('decision.action is required');
  if (!record.reasoning_summary || typeof record.reasoning_summary !== 'string') {
    throw new TypeError('decision.reasoning_summary is required (concise summary, not chain-of-thought)');
  }
  if (record.evidence_hash !== undefined && !HASH_RE.test(record.evidence_hash)) {
    throw new TypeError('decision.evidence_hash must be a 0x-prefixed sha256 hash');
  }
}

export class DecisionLogger {
  constructor(options = {}) {
    this.filePath = options.filePath === null ? null : (options.filePath ?? DEFAULT_LOG_PATH);
    this.clock = options.clock ?? (() => new Date());
    this.records = [];
    this.initialized = false;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    if (this.initialized) return this;
    if (this.filePath) {
      try {
        const body = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
        if (!Array.isArray(body)) throw new Error('decision log root must be an array');
        this.records = body;
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        this.records = [];
      }
    }
    this.initialized = true;
    return this;
  }

  now() {
    return this.clock().toISOString();
  }

  async persist() {
    if (!this.filePath) return;
    const body = `${JSON.stringify(this.records, null, 2)}\n`;
    const target = this.filePath;
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(target), { recursive: true });
      const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(temp, body, 'utf8');
      await fs.rename(temp, target);
    });
    await this.writeQueue;
  }

  async record(decision) {
    await this.init();
    validateRecord(decision);
    const timestamp = this.now();
    const record = {
      ...clone(decision),
      decision_id: decision.decision_id ?? createDecisionId(decision),
      status: decision.status ?? 'DECIDED',
      created_at: decision.created_at ?? timestamp,
      updated_at: timestamp,
      transaction: decision.transaction ?? null
    };
    const existingIndex = this.records.findIndex((item) => item.decision_id === record.decision_id);
    if (existingIndex >= 0) {
      const existing = this.records[existingIndex];
      this.records[existingIndex] = {
        ...existing,
        ...record,
        created_at: existing.created_at,
        transaction: record.transaction ?? existing.transaction ?? null
      };
    } else {
      this.records.push(record);
    }
    await this.persist();
    return clone(this.records.find((item) => item.decision_id === record.decision_id));
  }

  async update(decisionId, patch) {
    await this.init();
    const index = this.records.findIndex((record) => record.decision_id === decisionId);
    if (index < 0) throw new Error(`Unknown decision_id: ${decisionId}`);
    const immutable = this.records[index];
    this.records[index] = {
      ...immutable,
      ...clone(patch),
      decision_id: immutable.decision_id,
      created_at: immutable.created_at,
      updated_at: this.now()
    };
    await this.persist();
    return clone(this.records[index]);
  }

  async attachTransaction(decisionId, transaction) {
    if (!transaction || typeof transaction !== 'object') throw new TypeError('transaction must be an object');
    return this.update(decisionId, {
      transaction,
      status: transaction.success === false ? 'FAILED' : 'COMPLETED'
    });
  }

  async get(decisionId) {
    await this.init();
    return clone(this.records.find((record) => record.decision_id === decisionId) ?? null);
  }

  async findByIdempotencyKey(key) {
    await this.init();
    return clone(this.records.find((record) => record.idempotency_key === key) ?? null);
  }

  async list(filters = {}) {
    await this.init();
    let result = this.records;
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) result = result.filter((record) => record[key] === value);
    }
    return clone(result);
  }
}

