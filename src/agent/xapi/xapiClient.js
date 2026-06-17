// xAPI HTTP client (xapi.to) — programmatic access to the unified action gateway.
//
// xAPI is an Agent-friendly unified API platform: one key calls Twitter/X, Google
// search, prediction markets, crypto quotes and more, with output normalized to
// JSON. We talk to it directly over HTTP (no CLI subprocess):
//
//   POST https://action.xapi.to/v1/actions/execute
//   header: XAPI-Key: sk-...
//   body:   { action_id, input, method? }
//   resp:   { success: boolean, data: ... }   // success:false + data.statusCode 401/403 => auth/oauth
//
// The contract mirrors the open-source CLI (github.com/xapi-labs/xapi-cli,
// src/client.ts). No SDK: uses the global fetch shipped with Node >= 18.
//
// Like the LLM client, if no key is configured isXapiConfigured() is false and
// callers fall back to deterministic offline fixtures so the demo always runs.
// `execute` is an injectable seam (tests pass a fake to exercise the parse/auth
// paths with no network) — same idea as valuationAgent's injectable `chat`.

const DEFAULT_ACTION_HOST = 'action.xapi.to';
const EXECUTE_PATH = '/v1/actions/execute';
const SEARCH_PATH = '/v1/actions/search';
const DEFAULT_TIMEOUT_MS = 20000;

/** True when an xAPI key is present (env XAPI_KEY or XAPI_API_KEY). */
export function isXapiConfigured(env = process.env) {
  return Boolean(env.XAPI_KEY || env.XAPI_API_KEY);
}

/** Resolve the API key + action host from the environment. */
export function resolveXapiConfig(env = process.env) {
  return {
    apiKey: env.XAPI_KEY || env.XAPI_API_KEY || null,
    actionHost: env.XAPI_ACTION_HOST || DEFAULT_ACTION_HOST
  };
}

function scheme(host) {
  return host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
}

async function httpJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`xAPI HTTP ${res.status}: ${text.slice(0, 300)}`);
    return text.trim() ? JSON.parse(text) : undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Unwrap the xAPI `{ success, data }` envelope, turning business-level auth /
 * OAuth failures (HTTP 200 + success:false) into thrown errors the caller's
 * try/catch can route to the deterministic fallback.
 */
function unwrap(body, actionId) {
  if (body && typeof body === 'object' && 'success' in body) {
    if (body.success === false) {
      const data = body.data ?? {};
      if (data.statusCode === 401 || data.error === 'Unauthorized') {
        throw new Error(`xAPI auth failed for ${actionId}: ${data.message || 'invalid or missing API key'}`);
      }
      if (data.error === 'OAuth Required' || (data.statusCode === 403 && String(data.message || '').includes('OAuth'))) {
        throw new Error(`xAPI OAuth required for ${actionId}: run "npx xapi-to oauth bind" to connect the account`);
      }
      throw new Error(`xAPI error for ${actionId}: ${data.message || data.error || 'unknown'}`);
    }
    return body.data ?? body;
  }
  return body;
}

/**
 * Execute an xAPI action and return its unwrapped `data`.
 * @param {string} actionId e.g. "twitter.search_timeline", "web.search.news"
 * @param {object} input action input payload
 * @param {object} [opts] { env, method, timeoutMs, execute }
 *   opts.execute(actionId, input, {method, env}) -> envelope JSON — injected for tests.
 */
export async function executeAction(actionId, input = {}, opts = {}) {
  const { env = process.env, method, timeoutMs = DEFAULT_TIMEOUT_MS, execute } = opts;

  if (execute) {
    const body = await execute(actionId, input, { method, env });
    return unwrap(body, actionId);
  }

  const cfg = resolveXapiConfig(env);
  if (!cfg.apiKey) throw new Error('xAPI not configured: set XAPI_KEY in .env (register via npx xapi-to).');

  const url = `${scheme(cfg.actionHost)}://${cfg.actionHost}${EXECUTE_PATH}`;
  const body = await httpJson(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'XAPI-Key': cfg.apiKey },
      body: JSON.stringify({ action_id: actionId, ...(method ? { method } : {}), input })
    },
    timeoutMs
  );
  return unwrap(body, actionId);
}

/**
 * Discover actions by keyword (used to find a prediction-market capability at
 * runtime). Returns the raw search payload, or [] on any failure.
 * @param {string} query
 * @param {object} [opts] { env, timeoutMs, execute }
 */
export async function searchActions(query, opts = {}) {
  const { env = process.env, timeoutMs = 15000, execute } = opts;
  if (execute) {
    const body = await execute('actions.search', { q: query }, { env });
    return unwrap(body, 'actions.search');
  }
  const cfg = resolveXapiConfig(env);
  if (!cfg.apiKey) throw new Error('xAPI not configured: set XAPI_KEY in .env');
  const url = `${scheme(cfg.actionHost)}://${cfg.actionHost}${SEARCH_PATH}?q=${encodeURIComponent(query)}`;
  return httpJson(url, { method: 'GET', headers: { 'Content-Type': 'application/json', 'XAPI-Key': cfg.apiKey } }, timeoutMs);
}
