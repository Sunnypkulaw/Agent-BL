import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Short-TTL cache of already-paid report envelopes so a buyer can re-read a
 * report they already settled (e.g. after a page refresh) without being charged
 * again, exactly until the envelope's `expires_at`. Expired entries are pruned
 * on read and on load; the store NEVER extends a TTL and never mints receipts.
 *
 * This is a convenience re-read layer only — settlement/attestation remain the
 * source of truth (see settlement.js). A cache miss simply means "pay again".
 */
export class PaidReportCache {
  constructor(options = {}) {
    this.filePath = options.filePath === null ? null : options.filePath;
    this.now = options.now ?? (() => Date.now());
    this.records = new Map();
    this.initialized = false;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    if (this.initialized) return this;
    if (this.filePath) {
      try {
        const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
        const records = Array.isArray(parsed) ? parsed : parsed.records;
        if (Array.isArray(records)) {
          for (const record of records) {
            if (record?.report_id) this.records.set(record.report_id, record);
          }
        }
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    this.initialized = true;
    this.pruneExpired();
    return this;
  }

  pruneExpired() {
    const nowMs = this.now();
    let changed = false;
    for (const [id, record] of this.records) {
      if (this.#isExpired(record, nowMs)) {
        this.records.delete(id);
        changed = true;
      }
    }
    return changed;
  }

  #isExpired(record, nowMs) {
    const expiresMs = Date.parse(record?.expires_at ?? '');
    return !Number.isFinite(expiresMs) || expiresMs <= nowMs;
  }

  async persist() {
    if (!this.filePath) return;
    const target = this.filePath;
    const body = `${JSON.stringify({ version: 1, records: [...this.records.values()] }, null, 2)}\n`;
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(temporary, body, 'utf8');
      await fs.rename(temporary, target);
    });
    await this.writeQueue;
  }

  /**
   * Cache a delivered report keyed by its envelope `report_id`. The TTL is taken
   * from the envelope's `expires_at`; entries without a valid one are ignored.
   */
  async save({ envelope, report }) {
    await this.init();
    const reportId = envelope?.report_id;
    const expiresAt = envelope?.expires_at;
    if (!reportId || !Number.isFinite(Date.parse(expiresAt ?? ''))) return null;
    const record = { report_id: reportId, expires_at: expiresAt, envelope, report };
    this.records.set(reportId, record);
    await this.persist();
    return record;
  }

  /** Return a cached report by id if it has not expired, otherwise null. */
  async read(reportId) {
    await this.init();
    const record = this.records.get(reportId);
    if (!record) return null;
    if (this.#isExpired(record, this.now())) {
      this.records.delete(reportId);
      await this.persist();
      return null;
    }
    return { report: record.report, envelope: record.envelope, expires_at: record.expires_at };
  }

  async list() {
    await this.init();
    this.pruneExpired();
    return [...this.records.values()].map((record) => ({
      report_id: record.report_id,
      expires_at: record.expires_at,
      kind: record.envelope?.kind ?? null,
      case_id: record.envelope?.case_id ?? null
    }));
  }
}

let sharedCache = null;

/** Process-wide cache used by the built-in HTTP server's paid routes. */
export function getPaidReportCache(options = {}) {
  if (sharedCache && !options.filePath) return sharedCache;
  const filePath = options.filePath
    ?? process.env.X402_REPORT_CACHE_PATH
    ?? path.resolve('data/runtime/x402-reports.json');
  const cache = new PaidReportCache({ filePath, now: options.now });
  if (!options.filePath) sharedCache = cache;
  return cache;
}
