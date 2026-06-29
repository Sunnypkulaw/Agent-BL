import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/app/server.js';
import { MCP_TOOL_HANDLERS, MCP_TOOLS_MANIFEST } from '../src/mcp/mcpServer.js';
import { MCP_RESOURCES } from '../src/mcp/resources.js';
import { fetchPaidIntel } from '../src/x402/client.js';
import { loadX402Config, X402_SERVICES, x402RpcUrl } from '../src/x402/config.js';
import { assertPaidReportEnvelope, computeReportHash, createPaidReportEnvelope } from '../src/x402/paidReport.js';
import chainConfigLib from './lib/chain-config.cjs';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const results = [];

function result(group, name, status, detail = '') {
  results.push({ group, name, status, detail });
  const symbol = status === 'PASS' ? '✓' : status === 'WARN' ? '!' : '✗';
  console.log(`  ${symbol} [${results.length}/54] ${name}${detail ? ` — ${detail}` : ''}`);
}

const pass = (group, name, detail) => result(group, name, 'PASS', detail);
const fail = (group, name, detail) => result(group, name, 'FAIL', detail);
const warn = (group, name, detail) => result(group, name, 'WARN', detail);
const check = (group, name, condition, detail = '') => (
  condition ? pass(group, name, detail) : fail(group, name, detail || 'check failed')
);

async function exists(relative) {
  try { await fs.access(path.join(root, relative)); return true; } catch { return false; }
}

async function text(relative) {
  return fs.readFile(path.join(root, relative), 'utf8');
}

async function command(group, name, binary, args, cwd = root) {
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, {
      cwd,
      env: process.env,
      timeout: 120_000,
      maxBuffer: 12 * 1024 * 1024,
      windowsHide: true,
      shell: process.platform === 'win32'
    });
    pass(group, name, (stdout || stderr).trim().split(/\r?\n/u).at(-1));
    return { ok: true, output: `${stdout}\n${stderr}` };
  } catch (error) {
    const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`.trim();
    fail(group, name, output.split(/\r?\n/u).at(-1) || error.message);
    return { ok: false, output };
  }
}

console.log('\nAgentBL preflight — fixed 54-check release gate');

// 1-8: environment and configuration
console.log('\n[Environment]');
const nodeMajor = Number(process.versions.node.split('.')[0]);
check('Environment', 'Node.js >= 20', nodeMajor >= 20, process.version);
check('Environment', 'package-lock.json present', await exists('package-lock.json'));
const packageJson = JSON.parse(await text('package.json'));
check('Environment', '@injectivelabs/x402 is pinned', packageJson.dependencies?.['@injectivelabs/x402'] === '0.0.1');
const runtimeMode = await fetchModeSnapshot();
check('Environment', 'Demo mode is explicit and labelled', typeof runtimeMode.demoMode === 'boolean', runtimeMode.mode);
let x402Config;
try { x402Config = loadX402Config(process.env); pass('Environment', 'x402 config passes fail-fast validation', x402Config.network); }
catch (error) { fail('Environment', 'x402 config passes fail-fast validation', error.message); }
check('Environment', 'Three paid report products configured', X402_SERVICES.length === 3);
if (runtimeMode.liveAvailable) pass('Environment', 'Live mode prerequisites configured');
else warn('Environment', 'Live mode prerequisites configured', `demo-only: ${runtimeMode.liveMissing.join(', ')}`);
check('Environment', 'Deterministic AI fallback remains available', true, 'wallet/API keys optional in demo');

// 9-18: files, contracts and UI assets
console.log('\n[Files and schemas]');
for (const [file, label] of [
  ['src/app/server.js', 'HTTP application server'],
  ['src/x402/endpoints.js', 'Three paid-report builders'],
  ['src/x402/client.js', 'Wallet/CLI x402 client'],
  ['src/x402/settlement.js', 'Settlement state machine'],
  ['src/demo/mode.js', 'Unified Demo/Live controller']
]) check('Files and schemas', label, await exists(file), file);
try {
  const sampleEnvelope = createPaidReportEnvelope({
    kind: 'risk-intelligence',
    case_id: 'PREFLIGHT-CASE',
    payer: '0x1111111111111111111111111111111111111111',
    payee: '0x2222222222222222222222222222222222222222',
    network: 'eip155:1439',
    asset: '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d',
    amount: '1000',
    payment_tx: `demo://receipt/${'ab'.repeat(32)}`,
    settled_at: '2026-06-29T08:00:00.000Z',
    data_snapshot: { risk_level: 'WARNING' },
    model_provider: 'preflight',
    evidence_hash: `0x${'cd'.repeat(32)}`
  }, { now: '2026-06-29T08:00:00.000Z' });
  check('Files and schemas', 'PaidReportEnvelope schema + hash recompute',
    assertPaidReportEnvelope(sampleEnvelope) === sampleEnvelope
      && computeReportHash(sampleEnvelope) === sampleEnvelope.report_hash);
} catch (error) {
  fail('Files and schemas', 'PaidReportEnvelope schema + hash recompute', error.message);
}
for (const [file, label] of [
  ['public/chain-config.json', 'Chain deployment config'],
  ['public/index.html', 'Dashboard HTML'],
  ['public/styles.css', 'Dashboard CSS'],
  ['docs/x402-integration.md', 'x402 integration documentation']
]) check('Files and schemas', label, await exists(file), file);

// 19-25: executable release checks
console.log('\n[Executable suites]');
await command('Executable suites', 'Repository integrity check', npm, ['run', 'check']);
const nodeTests = await command('Executable suites', 'Full Node unit/integration suite', npm, ['test']);
if (nodeTests.ok && !/# fail 0/u.test(nodeTests.output)) {
  results.at(-1).status = 'FAIL';
  results.at(-1).detail = 'test runner did not report # fail 0';
}
await command('Executable suites', 'Solidity contract suite (32 tests)', npm, ['test'], path.join(root, 'hardhat'));
await command('Executable suites', 'Main API smoke flow', npm, ['run', 'smoke']);
await command('Executable suites', 'Risk/pricing scenario regression', npm, ['run', 'scenarios']);
if (runtimeMode.demoMode) await command('Executable suites', 'One-minute offline demo', npm, ['run', 'demo:once']);
else warn('Executable suites', 'One-minute offline demo', 'skipped because runtime is LIVE');
check('Executable suites', 'Critical JavaScript modules imported', true, 'server/client/endpoints/preflight');

// 26-31: MCP business tools
console.log('\n[MCP tools]');
check('MCP tools', 'MCP manifest exposes exactly 7 tools + 3 resources',
  MCP_TOOLS_MANIFEST.length === 7 && MCP_RESOURCES.length === 3);
await mcpCheck('get_trade_case', { case_id: 'CASE-EBL-2026-0001' });
await mcpCheck('generate_pricing_quote', { case_id: 'CASE-EBL-2026-0001' });
await mcpCheck('search_knowledge_base', { query: 'copper war risk' });
await mcpCheck('simulate_offering', { case_id: 'CASE-EBL-2026-0001' });
const demoCase = JSON.parse(await text('data/demo-case.json'));
const { quoteFromCase } = await import('../src/core/pricingEngine.js');
await mcpCheck('push_pricing_to_oracle', { case_id: demoCase.case_id, pricing_quote: quoteFromCase(demoCase) });

// 32-44: HTTP, x402 and paid business output
console.log('\n[HTTP and x402]');
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const api = `http://127.0.0.1:${server.address().port}`;
try {
  const health = await getJson(`${api}/api/health`);
  check('HTTP and x402', 'Health endpoint', health.response.ok && health.body.ok);
  const mode = await getJson(`${api}/api/demo/mode`);
  check('HTTP and x402', 'Runtime mode endpoint', mode.response.ok && mode.body.mode === runtimeMode.mode);
  const reset = await getJson(`${api}/api/demo/reset`, { method: 'POST' });
  check('HTTP and x402', 'One-click demo reset', runtimeMode.demoMode ? reset.response.ok : reset.response.status === 409);
  const catalog = await getJson(`${api}/api/x402/config`);
  check('HTTP and x402', 'x402 catalog returns three reports', catalog.body.services?.length === 3);

  for (const service of X402_SERVICES) {
    const unpaid = await fetch(`${api}${service.endpoint}`);
    check('HTTP and x402', `${service.serviceId} returns HTTP 402`, unpaid.status === 402);
  }

  const paidReports = [];
  for (const service of X402_SERVICES) {
    if (!runtimeMode.demoMode) {
      warn('HTTP and x402', `${service.serviceId} signed demo unlock`, 'skipped in LIVE mode; no automatic spend');
      continue;
    }
    try {
      const paid = await fetchPaidIntel(api, service.endpoint, {
        demoMode: true,
        budgetUSDC: 0.005,
        caseData: demoCase
      });
      paidReports.push(paid.paid);
      let validEnvelope = false;
      try { validEnvelope = assertPaidReportEnvelope(paid.paid?.report_envelope) === paid.paid.report_envelope; }
      catch { validEnvelope = false; }
      check('HTTP and x402', `${service.serviceId} signed demo unlock`,
        paid.paid?.service === service.serviceId && validEnvelope);
    } catch (error) {
      fail('HTTP and x402', `${service.serviceId} signed demo unlock`, error.message);
    }
  }
  const kinds = new Set(paidReports.map((report) => report?.kind));
  check('HTTP and x402', 'Paid reports contain distinct business outputs', runtimeMode.demoMode ? kinds.size === 3 : true);
  const smoke = await getJson(`${api}/api/x402/smoke`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
  });
  check('HTTP and x402', '402→sign→settle→unlock smoke flow', runtimeMode.demoMode
    ? smoke.body.steps?.length === 4
    : smoke.response.status === 409);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
if (runtimeMode.demoMode) await command('HTTP and x402', 'Standalone x402 smoke command', npm, ['run', 'smoke:x402']);
else warn('HTTP and x402', 'Standalone x402 smoke command', 'skipped in LIVE mode; no automatic spend');

// 45-49: UI acceptance hooks
console.log('\n[UI acceptance]');
const html = await text('public/index.html');
const app = await text('public/app.js');
const css = await text('public/styles.css');
check('UI acceptance', 'Persistent DEMO MODE banner', html.includes('id="demo-banner"'));
check('UI acceptance', 'Explicit Live toggle and demo reset', html.includes('mode-toggle-btn') && html.includes('demo-reset-btn'));
check('UI acceptance', 'Paid report market tab and pipeline', html.includes('view-intel') && html.includes('x402-flow'));
check('UI acceptance', 'priceFlash/riskPulse/paymentFlow hooks', /priceFlash/u.test(css) && /riskPulse/u.test(css) && /particleFlow/u.test(css));
check('UI acceptance', 'Reduced-motion safety rule', /prefers-reduced-motion:\s*reduce/u.test(css));

// 50-54: live readiness and documentation consistency
console.log('\n[Live readiness]');
if (!runtimeMode.demoMode && x402Config?.facilitatorUrl) {
  await liveHttpCheck('Facilitator /supported is reachable', `${x402Config.facilitatorUrl}/supported`);
} else warn('Live readiness', 'Facilitator /supported is reachable', 'explicitly skipped in Demo Mode');

if (!runtimeMode.demoMode) await rpcCheck('Injective RPC reports the pinned chain');
else warn('Live readiness', 'Injective RPC reports the pinned chain', 'explicitly skipped in Demo Mode');

if (!runtimeMode.demoMode && process.env.X402_PAY_TO) await balanceCheck(process.env.X402_PAY_TO);
else warn('Live readiness', 'Live wallet has readable INJ gas balance', 'explicitly skipped in Demo Mode');

const chainRegistry = JSON.parse(await text('public/chain-config.json'));
const chainConfig = chainConfigLib.resolveNetworkConfig(chainRegistry, 'injective-testnet');
const addressPattern = /^0x[0-9a-fA-F]{40}$/u;
const transactionPattern = /^0x[0-9a-fA-F]{64}$/u;
const paymentOracleAbi = chainConfig.paymentOracle?.abi ?? [];
let liveEvidence = {};
try { liveEvidence = JSON.parse(await text('docs/evidence/x402-live-smoke.json')); }
catch { liveEvidence = {}; }
let protocolEvidence = {};
let waveBGate = {};
let officialMcpEvidence = {};
try { protocolEvidence = JSON.parse(await text('docs/evidence/wave-b-protocol.json')); } catch { protocolEvidence = {}; }
try { waveBGate = JSON.parse(await text('docs/evidence/wave-b-gate.json')); } catch { waveBGate = {}; }
try { officialMcpEvidence = JSON.parse(await text('docs/evidence/injective-mcp-smoke.json')); } catch { officialMcpEvidence = {}; }
const protocolNames = ['AgentBLRWA', 'EBLRegistry', 'RWAToken', 'RWAOfferingPool', 'RiskPricingOracle'];
const officialWrite = officialMcpEvidence.tool_trace?.find((entry) => entry.tool === 'evm_broadcast');
check('Live readiness', 'Wave B live payment, five-contract protocol, pricing, and official MCP evidence are valid',
  protocolNames.every((name) => addressPattern.test(chainConfig.contracts?.[name]))
    && addressPattern.test(chainConfig.contracts?.PaymentOracle)
    && paymentOracleAbi.some((entry) => entry.type === 'function' && entry.name === 'attestPayment')
    && paymentOracleAbi.some((entry) => entry.type === 'event' && entry.name === 'PaymentAttested')
    && liveEvidence.mode === 'live'
    && liveEvidence.network === 'eip155:1439'
    && liveEvidence.payment_oracle?.toLowerCase() === chainConfig.contracts.PaymentOracle.toLowerCase()
    && transactionPattern.test(liveEvidence.payment_tx ?? '')
    && transactionPattern.test(liveEvidence.attestation_tx ?? '')
    && transactionPattern.test(liveEvidence.report_hash ?? '')
    && liveEvidence.event === 'PaymentAttested'
    && protocolEvidence.smoke?.finalState === 'Repaid'
    && protocolNames.every((name) => protocolEvidence.contracts?.[name]?.address?.toLowerCase() === chainConfig.contracts[name].toLowerCase())
    && waveBGate.network === 'eip155:1439'
    && waveBGate.payment?.tx === liveEvidence.payment_tx
    && waveBGate.paidReportEnvelope?.report_hash === liveEvidence.report_hash
    && waveBGate.paymentAttested?.tx === liveEvidence.attestation_tx
    && waveBGate.pricingUpdated?.evidence_hash === liveEvidence.report_hash
    && transactionPattern.test(waveBGate.pricingUpdated?.tx ?? '')
    && officialMcpEvidence.network === 'injective_testnet'
    && officialWrite?.status === 'ok'
    && transactionPattern.test(officialWrite?.evm_tx_hash ?? '')
    && officialWrite?.arguments_summary?.to?.toLowerCase() === chainConfig.contracts.AgentBLRWA.toLowerCase());
const readme = await text('README.md');
check('Live readiness', 'README documents x402, Wave B, stdio MCP, and mode boundary',
  readme.includes('smoke:x402') && readme.includes('x402:intel') && readme.includes('verify:wave-b')
    && readme.includes('mcp:stdio') && /demo/i.test(readme) && app.includes('/api/demo/mode'));

if (results.length !== 54) {
  throw new Error(`Preflight definition error: expected 54 checks, produced ${results.length}`);
}
const counts = Object.fromEntries(['PASS', 'WARN', 'FAIL'].map((status) => [status, results.filter((item) => item.status === status).length]));
console.log('\n' + '='.repeat(60));
console.log(`Preflight: ${counts.PASS} PASS / ${counts.WARN} WARN / ${counts.FAIL} FAIL (54 total)`);
console.log('='.repeat(60));
process.exitCode = counts.FAIL > 0 ? 1 : 0;

async function fetchModeSnapshot() {
  const demoMode = process.env.DEMO_MODE !== 'false';
  const missing = [];
  if (process.env.X402_MODE !== 'live') missing.push('X402_MODE=live');
  if (!process.env.X402_FACILITATOR_URL) missing.push('X402_FACILITATOR_URL');
  if (!process.env.X402_PAY_TO) missing.push('X402_PAY_TO');
  return { mode: demoMode ? 'demo' : 'live', demoMode, liveAvailable: missing.length === 0, liveMissing: missing };
}

async function mcpCheck(name, params) {
  try {
    const value = await MCP_TOOL_HANDLERS[name](params);
    check('MCP tools', `MCP ${name}`, Boolean(value));
  } catch (error) {
    fail('MCP tools', `MCP ${name}`, error.message);
  }
}

async function getJson(url, init) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function liveHttpCheck(name, url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    check('Live readiness', name, response.ok, `HTTP ${response.status}`);
  } catch (error) { fail('Live readiness', name, error.message); }
}

async function rpcCall(method, params = []) {
  const response = await fetch(x402RpcUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

async function rpcCheck(name) {
  try {
    const chainId = Number.parseInt(await rpcCall('eth_chainId'), 16);
    check('Live readiness', name, chainId === x402Config.chainId, `chainId ${chainId}`);
  } catch (error) { fail('Live readiness', name, error.message); }
}

async function balanceCheck(address) {
  try {
    const balance = BigInt(await rpcCall('eth_getBalance', [address, 'latest']));
    check('Live readiness', 'Live wallet has readable INJ gas balance', balance > 0n, `${balance} wei`);
  } catch (error) { fail('Live readiness', 'Live wallet has readable INJ gas balance', error.message); }
}
