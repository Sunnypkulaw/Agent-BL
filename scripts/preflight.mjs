/**
 * AgentBL 赛前全量检查 — preflight
 *
 * 对标 hermes-pay 的 13 项 local test。一键验证：
 *  - 文件完整性
 *  - API 端点
 *  - 定价引擎
 *  - x402 链路
 *  - MCP 工具
 *  - 合同编译
 *
 * Usage: npm run preflight
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from '../src/app/server.js';
import { MCP_TOOL_HANDLERS } from '../src/mcp/mcpServer.js';

const PASS = '✓';
const FAIL = '✗';
const WARN = '⚠';

let total = 0, passed = 0;

function check(name, ok, detail = '') {
  total++;
  if (ok) {
    passed++;
    console.log(`  ${PASS} [${total}] ${name}`);
  } else {
    console.log(`  ${FAIL} [${total}] ${name}  — ${detail}`);
  }
}

// ── 1. 文件完整性 ──
console.log('\n📁 文件完整性');
const rootDir = path.resolve(import.meta.dirname || '.', '..');
const requiredFiles = [
  'package.json', 'README.md', 'project.md',
  'src/app/server.js',
  'src/core/pricingEngine.js', 'src/core/pricingSchema.js', 'src/core/offeringSimulator.js',
  'src/mcp/mcpServer.js', 'src/mcp/tools.js', 'src/mcp/standalone-server.js',
  'src/x402/config.js', 'src/x402/server.js', 'src/x402/client.js', 'src/x402/settlement.js',
  'src/agent/riskIntel.js', 'src/agent/worldRiskAgent.js',
  'public/index.html', 'public/app.js', 'public/styles.css',
  'hardhat/contracts/AgentBLRWA.sol', 'hardhat/contracts/RiskPricingOracle.sol',
  'hardhat/contracts/PaymentOracle.sol',
  'scripts/check.mjs', 'scripts/smoke.mjs', 'scripts/smoke-x402.mjs',
  'scripts/demo-once.mjs', 'scripts/preflight.mjs',
  'mcp-config.json', 'docs/x402-integration.md'
];

for (const file of requiredFiles) {
  try {
    await fs.access(path.join(rootDir, file));
    check(`存在: ${file}`, true);
  } catch {
    check(`存在: ${file}`, false);
  }
}

// ── 2. API 端点 ──
console.log('\n🌐 API 端点');
const server = createServer();
await new Promise((r) => server.listen(0, r));
const { port } = server.address();
const API = `http://127.0.0.1:${port}`;

try {
  const health = await fetch(`${API}/api/health`).then((r) => r.json());
  check('GET /api/health', health.ok);

  const cases = await fetch(`${API}/api/cases`).then((r) => r.json());
  check('GET /api/cases', cases.ok && cases.count >= 8);

  const quote = await fetch(`${API}/api/pricing/quote`, { method: 'POST' }).then((r) => r.json());
  check('POST /api/pricing/quote', quote.final_issue_price_usd > 0 && quote.final_issue_price_usd <= 1);

  const compare = await fetch(`${API}/api/pricing/quote?compare=true`, { method: 'POST' }).then((r) => r.json());
  check('POST /api/pricing/quote?compare=true', compare.quotes?.length === 3);

  const offering = await fetch(`${API}/api/offering/simulate`, { method: 'POST' }).then((r) => r.json());
  check('POST /api/offering/simulate', offering.steps?.length >= 2);

  const oracle = await fetch(`${API}/api/oracle/pricing-update`, { method: 'POST' }).then((r) => r.json());
  check('POST /api/oracle/pricing-update', oracle.evidence_hash?.startsWith('0x'));

  const mcpTools = await fetch(`${API}/api/mcp/tools`).then((r) => r.json());
  check('GET /api/mcp/tools', mcpTools.ok && mcpTools.tools?.length >= 5);

  const rag = await fetch(`${API}/api/rag/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'copper war risk' })
  }).then((r) => r.json());
  check('POST /api/rag/search', rag.ok && rag.match_count > 0);

  const worldRisk = await fetch(`${API}/api/intel/world-risk`, { method: 'POST' }).then((r) => r.json());
  check('POST /api/intel/world-risk', worldRisk.ok);

  // x402 endpoints
  const x402Unpaid = await fetch(`${API}/api/x402/intel/premium-risk`);
  check('GET /api/x402/intel/premium-risk (402)', x402Unpaid.status === 402);

  const x402Config = await fetch(`${API}/api/x402/config`).then((r) => r.json());
  check('GET /api/x402/config', x402Config.ok && x402Config.services?.length >= 2);

  const x402Smoke = await fetch(`${API}/api/x402/smoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale: 'en' })
  }).then((r) => r.json());
  check('POST /api/x402/smoke', x402Smoke.ok && x402Smoke.steps?.length === 4);

} finally {
  server.close();
}

// ── 3. MCP 工具 ──
console.log('\n🔧 MCP 工具');
const toolNames = Object.keys(MCP_TOOL_HANDLERS);
check(`工具数量: ${toolNames.length}`, toolNames.length >= 5, toolNames.join(', '));

for (const name of ['get_trade_case', 'generate_pricing_quote', 'search_knowledge_base']) {
  try {
    const params = name === 'get_trade_case' ? { case_id: 'CASE-EBL-2026-0001' }
      : name === 'search_knowledge_base' ? { query: 'copper' }
      : { case_id: 'CASE-EBL-2026-0001' };

    const result = await MCP_TOOL_HANDLERS[name](params);
    check(`MCP tool: ${name}`, Boolean(result), typeof result === 'object' ? 'ok' : '');
  } catch (e) {
    check(`MCP tool: ${name}`, false, e.message);
  }
}

// ── 4. 定价引擎 ──
console.log('\n📊 定价引擎');
try {
  const { quoteFromCase, compareSpeeds } = await import('../src/core/pricingEngine.js');
  check('quoteFromCase 可导入', true);

  const demoCase = JSON.parse(await fs.readFile(path.join(rootDir, 'data/demo-case.json'), 'utf8'));
  const q = quoteFromCase(demoCase, { payout_speed: 'BALANCED' });
  check('BALANCED 定价', q.final_issue_price_usd > 0 && q.final_issue_price_usd <= 1, `$${q.final_issue_price_usd?.toFixed(3)}`);

  const speeds = compareSpeeds(demoCase);
  check('三档速度对比', speeds.quotes?.length === 3);
  check('推荐速度存在', Boolean(speeds.recommended_payout_speed));
} catch (e) {
  check('定价引擎导入', false, e.message);
}

// ── 5. 文档完整性 ──
console.log('\n📚 文档完整性');
const docChecks = [
  ['README.md', '# 🛡️ AgentBL Agent'],
  ['project.md', 'AgentBL'],
  ['docs/x402-integration.md', 'x402'],
  ['mcp-config.json', 'agentbl'],
  ['基础说明.md', 'AgentBL Agent']
];
for (const [file, expected] of docChecks) {
  try {
    const content = await fs.readFile(path.join(rootDir, file), 'utf8');
    check(`文档 ${file}`, content.includes(expected));
  } catch {
    check(`文档 ${file}`, false, '文件缺失');
  }
}

// ── 汇总 ──
console.log(`\n${'═'.repeat(50)}`);
const status = passed === total ? '✅ ALL PASSED' : passed >= total - 2 ? '⚠️ MINOR ISSUES' : '❌ FAILURES';
console.log(`  ${status}  ${passed}/${total} checks passed`);
console.log(`${'═'.repeat(50)}\n`);

process.exit(passed === total ? 0 : 1);
