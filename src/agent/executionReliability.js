// AI-15 — reusable reliability primitives for autonomous execution.

import { hashSnapshot } from './decisionLogger.js';

export function eventIdempotencyKey(event = {}) {
  if (event.idempotency_key) return String(event.idempotency_key);
  if (event.event_id) return `event:${event.event_id}`;
  return `event-hash:${hashSnapshot({
    type: event.type,
    case_id: event.case_id ?? event.case_data?.case_id,
    pool_id: event.pool_id ?? null,
    occurred_at: event.occurred_at ?? null,
    data: event.data ?? event.world_risk_events ?? null
  }).slice(2)}`;
}

export class KeyedSingleFlight {
  constructor() {
    this.inflight = new Map();
  }

  run(key, operation) {
    if (this.inflight.has(key)) return this.inflight.get(key);
    const promise = Promise.resolve()
      .then(operation)
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}

export async function executeWithRetry(operation, options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts ?? 3));
  const baseDelayMs = Math.max(0, Number(options.baseDelayMs ?? 100));
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await operation(attempt);
      return { value, attempts: attempt };
    } catch (error) {
      lastError = error;
      options.onAttemptFailure?.({ attempt, error });
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) break;
      await sleep(baseDelayMs * (2 ** (attempt - 1)));
    }
  }
  const failure = new Error(`Operation failed after ${maxAttempts} attempt(s): ${lastError?.message ?? 'unknown error'}`);
  failure.name = 'RetryExhaustedError';
  failure.cause = lastError;
  failure.attempts = maxAttempts;
  throw failure;
}

/**
 * Poll an event source until aborted. `fetchEvents` returns an array and
 * `onEvent` is called serially so ordering is deterministic.
 */
export async function pollEventSource(options) {
  const {
    fetchEvents,
    onEvent,
    signal,
    intervalMs = 5000,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onError = () => {}
  } = options;
  if (typeof fetchEvents !== 'function' || typeof onEvent !== 'function') {
    throw new TypeError('fetchEvents and onEvent functions are required');
  }

  let cycles = 0;
  while (!signal?.aborted) {
    cycles += 1;
    try {
      const events = await fetchEvents();
      if (!Array.isArray(events)) throw new TypeError('fetchEvents must return an array');
      for (const event of events) {
        if (signal?.aborted) break;
        await onEvent(event);
      }
    } catch (error) {
      onError(error);
    }
    if (!signal?.aborted) await sleep(intervalMs);
  }
  return { cycles, stopped: true };
}

