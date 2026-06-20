import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { calculateRisk } from '../core/riskEngine.js';
import { runHarnessScenarios, runScenario } from '../core/scenarioRunner.js';
import { assertRiskReport, assertTradeCase, ValidationError } from '../core/schema.js';
import { simulateWorkflow } from '../core/workflow.js';
import { compareSpeeds, quoteFromCase } from '../core/pricingEngine.js';
import { simulateOffering } from '../core/offeringSimulator.js';
import { simulatePricingWorkflow } from '../core/pricingWorkflow.js';
import { toOracleUpdate } from '../core/oracle.js';
import { assertPricingQuote, PAYOUT_SPEEDS } from '../core/pricingSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const publicDir = path.join(rootDir, 'public');
const dataPath = path.join(rootDir, 'data/demo-case.json');
const casesDir = path.join(rootDir, 'data/cases');

// FE-7 support: human labels + a risk-ladder ordering for the curated demo
// cases, so the frontend scenario selector can present clean -> warning ->
// critical without bundling case JSON. Cases not listed here still load (with a
// derived label) so adding a *.case.json file is enough to surface it.
const CASE_META = {
  'CASE-EBL-2026-CU-SG-SHA': { label: 'Clean copper · Singapore → Shanghai', risk_hint: 'MEDIUM', order: 1 },
  'CASE-EBL-2026-0001': { label: 'Copper · Shanghai → Hamburg (insurance gap)', risk_hint: 'WARNING', order: 2 },
  'CASE-EBL-2026-OIL-SG-ULS': { label: 'Crude oil · Singapore → Ulsan', risk_hint: 'MEDIUM', order: 3 },
  'CASE-EBL-2026-CU-SG-SHA-WARCRISIS': { label: 'Hormuz war crisis · Singapore → Shanghai', risk_hint: 'CRITICAL', order: 4 }
};

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return null;
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text === '' ? null : JSON.parse(text);
}

async function loadDemoCase() {
  return JSON.parse(await fs.readFile(dataPath, 'utf8'));
}

/**
 * FE-7 support: load the curated trade-case catalog (demo case + data/cases/*.case.json).
 * Returns full case objects, each annotated with a label / route / risk_hint and
 * ordered as a risk ladder, so the frontend can drive the pricing endpoints
 * directly. Read-only; never throws on a single bad file.
 */
async function loadCaseCatalog() {
  const files = new Map(); // case_id -> case object (demo first, then data/cases)
  const add = (data) => { if (data?.case_id && !files.has(data.case_id)) files.set(data.case_id, data); };

  try { add(await loadDemoCase()); } catch { /* ignore */ }
  try {
    const entries = await fs.readdir(casesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.case.json')) continue;
      try { add(JSON.parse(await fs.readFile(path.join(casesDir, entry.name), 'utf8'))); } catch { /* skip bad file */ }
    }
  } catch { /* no cases dir */ }

  const cases = [...files.values()].map((data) => {
    const bl = data.bill_of_lading ?? {};
    const meta = CASE_META[data.case_id] ?? {};
    return {
      case_id: data.case_id,
      label: meta.label ?? `${bl.cargo ?? 'Trade case'} · ${bl.port_of_loading ?? '?'} → ${bl.port_of_discharge ?? '?'}`,
      route: `${bl.port_of_loading ?? '?'} → ${bl.port_of_discharge ?? '?'}`,
      cargo: bl.cargo ?? null,
      risk_hint: meta.risk_hint ?? null,
      order: meta.order ?? 99,
      case: data
    };
  });
  cases.sort((a, b) => a.order - b.order || a.case_id.localeCompare(b.case_id));
  return cases;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// A POST body is treated as a bare trade case when it carries a bill_of_lading
// (legacy seed) or a case_id + financing block (new-model case). Otherwise it is
// treated as a request wrapper:
//   { case?, payout_speed?, requested_cash_usd?, subscription_usd?, events?, compare? }
function looksLikeCase(value) {
  return isRecord(value)
    && (value.bill_of_lading !== undefined || (value.case_id !== undefined && value.financing !== undefined));
}

// BE-7: parse a caller-supplied numeric override, collecting a validation error
// when it is present but not a valid (non-)negative number.
function parseAmount(raw, field, errors, { allowZero = false } = {}) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0)) {
    errors.push(`${field} must be a ${allowZero ? 'non-negative' : 'positive'} number`);
    return undefined;
  }
  return n;
}

/**
 * Resolve the case + pricing options for the AI-pricing endpoints from a POST
 * body and the request URL. Empty body -> the demo case (PRD §9 convention).
 * Query params (?payout_speed=&requested_cash_usd=&compare=) override the body.
 * Throws ValidationError (-> HTTP 400) on malformed input (BE-7).
 */
async function resolvePricingRequest(body, url) {
  const wrapper = isRecord(body) && !looksLikeCase(body) ? body : {};
  const caseData = looksLikeCase(body) ? body : (wrapper.case ?? await loadDemoCase());
  const q = url.searchParams;

  const errors = [];
  const payoutSpeed = q.get('payout_speed') ?? wrapper.payout_speed ?? undefined;
  if (payoutSpeed !== undefined && payoutSpeed !== null && !PAYOUT_SPEEDS.includes(payoutSpeed)) {
    errors.push(`payout_speed must be one of: ${PAYOUT_SPEEDS.join(', ')}`);
  }
  const requestedCash = parseAmount(q.get('requested_cash_usd') ?? wrapper.requested_cash_usd, 'requested_cash_usd', errors);
  const subscription = parseAmount(q.get('subscription_usd') ?? wrapper.subscription_usd, 'subscription_usd', errors, { allowZero: true });

  // target redemption value is FIXED at 1.00 in this model; reject any other.
  const target = caseData?.financing?.target_redemption_value_usd;
  if (target !== undefined && Number(target) !== 1) {
    errors.push('financing.target_redemption_value_usd must be 1.00 (target redemption value is fixed)');
  }
  if (wrapper.events !== undefined && !Array.isArray(wrapper.events)) {
    errors.push('events must be an array');
  }
  if (errors.length > 0) throw new ValidationError('Invalid pricing request', errors);

  const compareRaw = q.get('compare') ?? wrapper.compare;
  const options = {
    payout_speed: payoutSpeed === null ? undefined : payoutSpeed,
    requested_cash_usd: requestedCash,
    subscription_usd: subscription,
    events: Array.isArray(wrapper.events) ? wrapper.events : undefined,
    compare: compareRaw === true || compareRaw === 'true',
    pool_id: q.get('pool_id') ?? wrapper.pool_id ?? undefined
  };
  return { caseData, options };
}

/** Narrow the resolved options to what quoteFromCase / compareSpeeds accept. */
function quoteOptions(options) {
  const out = {};
  if (options.payout_speed !== undefined) out.payout_speed = options.payout_speed;
  if (options.requested_cash_usd !== undefined) out.requested_cash_usd = options.requested_cash_usd;
  return out;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, { 'content-type': contentType });
  response.end(text);
}

function sendError(response, error) {
  const isValidationError = error instanceof ValidationError || error instanceof SyntaxError;
  sendJson(response, isValidationError ? 400 : 500, {
    ok: false,
    error: error.message,
    details: error.errors ?? undefined
  });
}

async function serveStatic(urlPath, response) {
  const safePath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(publicDir, safePath));
  if (!filePath.startsWith(publicDir)) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };
    response.writeHead(200, { 'content-type': types[ext] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    sendText(response, 404, 'Not found');
  }
}

export async function handleRequest(request, response) {
  const url = new URL(request.url, 'http://localhost');

  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { ok: true, service: 'tradeshield-agent-harness' });
      return;
    }

      if (request.method === 'GET' && url.pathname === '/api/demo-data') {
        sendJson(response, 200, await loadDemoCase());
        return;
      }

      // FE-7: curated trade-case catalog for the scenario selector (read-only).
      if (request.method === 'GET' && url.pathname === '/api/cases') {
        const cases = await loadCaseCatalog();
        sendJson(response, 200, { ok: true, count: cases.length, cases });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/risk/analyze') {
        const body = await readJsonBody(request);
        const caseData = body ?? await loadDemoCase();
        assertTradeCase(caseData);
        const report = calculateRisk(caseData);
        assertRiskReport(report, caseData);
        sendJson(response, 200, report);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/workflow/simulate') {
        const body = await readJsonBody(request);
        sendJson(response, 200, simulateWorkflow(body ?? await loadDemoCase()));
        return;
      }

      // BE-3: AI dynamic-pricing quote. Empty body -> demo case. `compare=true`
      // returns all three payout speeds + a recommendation (Exporter page).
      if (request.method === 'POST' && url.pathname === '/api/pricing/quote') {
        const body = await readJsonBody(request);
        const { caseData, options } = await resolvePricingRequest(body, url);
        if (options.compare) {
          const comparison = compareSpeeds(caseData, quoteOptions(options));
          for (const quote of comparison.quotes) assertPricingQuote(quote, caseData);
          sendJson(response, 200, comparison);
        } else {
          const quote = quoteFromCase(caseData, quoteOptions(options));
          assertPricingQuote(quote, caseData);
          sendJson(response, 200, quote);
        }
        return;
      }

      // BE-4: RWA offering lifecycle — issue, subscribe, reprice, pause, settle.
      // Pass `events` to escalate risk mid-transit; `subscription_usd` to size demand.
      if (request.method === 'POST' && url.pathname === '/api/offering/simulate') {
        const body = await readJsonBody(request);
        const { caseData, options } = await resolvePricingRequest(body, url);
        const offering = simulateOffering(caseData, {
          ...quoteOptions(options),
          subscription_usd: options.subscription_usd,
          events: options.events
        });
        assertPricingQuote(offering.initial_quote, caseData);
        sendJson(response, 200, offering);
        return;
      }

      // BE-6: merged PricingQuote + RiskReport + offering workflow simulation.
      if (request.method === 'POST' && url.pathname === '/api/workflow/pricing-simulate') {
        const body = await readJsonBody(request);
        const { caseData, options } = await resolvePricingRequest(body, url);
        sendJson(response, 200, simulatePricingWorkflow(caseData, {
          ...quoteOptions(options),
          subscription_usd: options.subscription_usd,
          events: options.events
        }));
        return;
      }

      // BE-8: on-chain oracle update payload (quote_hash / evidence_hash + terms)
      // for RiskPricingOracle.updatePricing / RWAOfferingPool.createOffering.
      if (request.method === 'POST' && url.pathname === '/api/oracle/pricing-update') {
        const body = await readJsonBody(request);
        const { caseData, options } = await resolvePricingRequest(body, url);
        const quote = quoteFromCase(caseData, quoteOptions(options));
        assertPricingQuote(quote, caseData);
        sendJson(response, 200, toOracleUpdate(quote, { pool_id: options.pool_id }));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/scenarios') {
        sendJson(response, 200, { ok: true, scenarios: await runHarnessScenarios() });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/scenarios/run') {
        const body = await readJsonBody(request);
        sendJson(response, 200, runScenario(body ?? await loadDemoCase()));
        return;
      }

      // ========================
      // MCP / RAG / Skill Endpoints
      // ========================

      // MCP-1: Return tools manifest
      if (request.method === 'GET' && url.pathname === '/api/mcp/tools') {
        const { MCP_TOOLS_MANIFEST } = await import('../mcp/mcpServer.js');
        sendJson(response, 200, { ok: true, protocol: 'tradeshield-mcp-v1', tools: MCP_TOOLS_MANIFEST });
        return;
      }

      // MCP-2~5: Universal tool call dispatcher
      if (request.method === 'POST' && url.pathname === '/api/mcp/call') {
        const body = await readJsonBody(request);
        if (!body || !body.tool) {
          sendJson(response, 400, { ok: false, error: 'Missing "tool" in request body. Available tools: GET /api/mcp/tools' });
          return;
        }
        try {
          const { callTool } = await import('../mcp/mcpServer.js');
          const result = await callTool(body.tool, body.params ?? {});
          sendJson(response, 200, { ok: true, ...result });
        } catch (error) {
          sendJson(response, 400, { ok: false, error: error.message, tool: body.tool });
        }
        return;
      }

      // RAG: Search knowledge base
      if (request.method === 'POST' && url.pathname === '/api/rag/search') {
        const body = await readJsonBody(request);
        if (!body || !body.query) {
          sendJson(response, 400, { ok: false, error: 'Missing "query" in request body' });
          return;
        }
        const { searchKnowledgeBase } = await import('../rag/search.js');
        const results = searchKnowledgeBase(body.query, {
          categories: body.categories,
          limit: body.limit || 10
        });
        sendJson(response, 200, { ok: true, query: body.query, matches: results, match_count: results.length });
        return;
      }

      // RAG-2: Return Judge Q&A pairs
      if (request.method === 'GET' && url.pathname === '/api/rag/judge-qa') {
        const { JUDGE_QA_PAIRS } = await import('../rag/judgeQA.js');
        sendJson(response, 200, { ok: true, pairs: JUDGE_QA_PAIRS });
        return;
      }

      // RAG: Full risk sweep for a case
      if (request.method === 'POST' && url.pathname === '/api/rag/risk-sweep') {
        const body = await readJsonBody(request);
        const caseData = body ?? await loadDemoCase();
        const { fullRiskSweep } = await import('../rag/search.js');
        sendJson(response, 200, { ok: true, ...fullRiskSweep(caseData) });
        return;
      }

      // INTEL: live real-world risk via xAPI (Twitter/X + Google News + prediction
      // markets) -> structured macro_risk_events -> re-priced quote (before/after).
      // No XAPI_KEY -> deterministic offline fixtures, so the endpoint never breaks.
      if (request.method === 'POST' && url.pathname === '/api/intel/world-risk') {
        const body = await readJsonBody(request);
        const caseData = looksLikeCase(body) ? body : (isRecord(body) && body.case ? body.case : await loadDemoCase());
        const { assessWorldRisk } = await import('../agent/worldRiskAgent.js');
        const { repriceWithWorldRisk } = await import('../core/worldRiskPricing.js');
        const assessment = await assessWorldRisk(caseData, {});
        const repriced = repriceWithWorldRisk(caseData, assessment.events);
        sendJson(response, 200, {
          ok: true,
          live: assessment.live,
          provider: assessment.provider,
          queried: assessment.queried,
          profile: assessment.profile,
          events: assessment.events,
          signals: assessment.signals,
          sources: assessment.sources,
          summary: assessment.summary,
          evidence_hash: assessment.evidence_hash,
          before_quote: repriced.before,
          after_quote: repriced.after,
          delta: repriced.delta
        });
        return;
      }

      // SKILL-1: Run pricing analyst
      if (request.method === 'POST' && url.pathname === '/api/skill/pricing-analyst') {
        const body = await readJsonBody(request);
        const { runPricingAnalyst } = await import('../skill/pricingAnalyst.js');
        const result = await runPricingAnalyst(body ?? { case_id: 'CASE-EBL-2026-0001' });
        sendJson(response, 200, { ok: true, ...result });
        return;
      }

      // SKILL-2: Run demo operator
      if (request.method === 'POST' && url.pathname === '/api/skill/demo-operator') {
        const body = await readJsonBody(request);
        const { runDemoOperator } = await import('../skill/demoOperator.js');
        const result = await runDemoOperator(body ?? { case_id: 'CASE-EBL-2026-0001' });
        sendJson(response, 200, { ok: true, ...result });
        return;
      }

      if (request.method === 'GET') {
        await serveStatic(url.pathname, response);
        return;
      }

      sendText(response, 405, 'Method not allowed');
    } catch (error) {
      sendError(response, error);
    }
}

export function createServer() {
  return http.createServer(handleRequest);
}

const isEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntryPoint) {
  const port = Number(process.env.PORT ?? 3000);
  createServer().listen(port, () => {
    console.log(`TradeShield Agent harness running at http://localhost:${port}`);
  });
}
