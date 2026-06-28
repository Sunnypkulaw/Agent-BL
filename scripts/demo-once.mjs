/**
 * AgentBL 一键演示脚本
 *
 * 1 分钟内走完整条 AI 定价主线：
 *  案例加载 → AI 估值 → 定价折价 → 投资者认购 → 航运风险 → x402 付费情报
 *
 * 对标 wohainengren 的 1 分钟闭环节奏。
 * 全程离线可跑，不需要钱包/合约/API Key。
 *
 * Usage: npm run demo:once
 */

import { createServer } from '../src/app/server.js';

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       AgentBL · AI 动态定价 eBL-backed RWA               ║');
console.log('║       一键演示 — 1 分钟完整闭环                            ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const server = createServer();
await new Promise((r) => server.listen(0, r));
const { port } = server.address();
const API = `http://127.0.0.1:${port}`;

try {
  // ═══════════════════════════════════════════════════════
  // 第 1 幕：案例选择 (10 秒)
  // ═══════════════════════════════════════════════════════
  console.log('┌─ 第 1 幕 ─────────────────────────────────────────────┐');
  console.log('│ 🚢 新加坡港，500 吨铜阴极板即将装船                   │');
  console.log('│    目的地：上海港                                      │');
  console.log('│    发票货值：$4,500,000                                │');
  console.log('│    出口商：Shanghai Metals Export Co.                  │');
  console.log('│    痛点：货在海上漂 18 天，钱要 45 天才回来             │');
  console.log('└──────────────────────────────────────────────────────┘\n');

  const cases = await fetch(`${API}/api/cases`).then((r) => r.json());
  const copperCase = cases.cases.find((c) => c.case_id === 'CASE-EBL-2026-0001');
  console.log(`  ✓ 已加载案例: ${copperCase.label} (${copperCase.risk_hint})\n`);

  // ═══════════════════════════════════════════════════════
  // 第 2 幕：AI 定价 (15 秒)
  // ═══════════════════════════════════════════════════════
  console.log('┌─ 第 2 幕 ─────────────────────────────────────────────┐');
  console.log('│ 🤖 AI 定价与风控 Agent 启动                            │');
  console.log('│    ① 审单：交叉核验 eBL / 发票 / 保险                  │');
  console.log('│    ② 估值：调用实时 LME 铜价 + UN Comtrade 历史成交  │');
  console.log('│    ③ 风控：战争/天气/港口/保险/价格波动 五维评分      │');
  console.log('│    ④ 定价：折价 = 到账速度 + 贸易风险                 │');
  console.log('└──────────────────────────────────────────────────────┘\n');

  const comparison = await fetch(`${API}/api/pricing/quote?compare=true`, { method: 'POST' }).then((r) => r.json());

  for (const q of comparison.quotes) {
    const yield_pct = ((1 / q.final_issue_price_usd - 1) * 100).toFixed(1);
    console.log(`  ${q.payout_speed.padEnd(10)} 发行价: $${q.final_issue_price_usd.toFixed(3)}  |  投资者回报: +${yield_pct}%  |  动作: ${q.pricing_action}`);
  }
  console.log(`\n  ✓ 推荐到账速度: ${comparison.recommended_payout_speed}\n`);

  // ═══════════════════════════════════════════════════════
  // 第 3 幕：投资 (10 秒)
  // ═══════════════════════════════════════════════════════
  console.log('┌─ 第 3 幕 ─────────────────────────────────────────────┐');
  console.log('│ 💰 投资者认购                                          │');
  console.log('│    出口商质押 eBL → 智能合约创建 RWA Offering        │');
  console.log('│    投资者以 $0.80 折价认购 → 目标兑付 $1.00          │');
  console.log('│    RiskPricingOracle 链上锚定定价决策                  │');
  console.log('└──────────────────────────────────────────────────────┘\n');

  const offering = await fetch(`${API}/api/offering/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payout_speed: 'FAST' })
  }).then((r) => r.json());

  const steps = offering.steps.map((s) => `${s.state} →`).join(' ');
  console.log(`  ✓ 生命周期: ${steps} ${offering.final_state}`);
  console.log(`  ✓ 初始定价: $${offering.initial_quote?.final_issue_price_usd?.toFixed(3)}\n`);

  // ═══════════════════════════════════════════════════════
  // 第 4 幕：航运风险 (15 秒)
  // ═══════════════════════════════════════════════════════
  console.log('┌─ 第 4 幕 ─────────────────────────────────────────────┐');
  console.log('│ 🌪 航运途中的突发事件                                  │');
  console.log('│    ① 台风在东海形成 → AI 打 150bps 天气风险          │');
  console.log('│    ② 霍尔木兹冲突升级 → AI 识别战争溢价双刃剑         │');
  console.log('│    ③ AI 反向操作：haircut 21% + 暂停发行              │');
  console.log('│    "价格预言机以为铜价涨了更安全——完全看反"          │');
  console.log('└──────────────────────────────────────────────────────┘\n');

  // 战争危机案例
  const warRes = await fetch(`${API}/api/pricing/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case_id: 'CASE-EBL-2026-CU-SG-SHA-WARCRISIS', payout_speed: 'FAST' })
  });

  if (warRes.ok) {
    const war = await warRes.json();
    console.log(`  ⚔ 战争危机: 发行价 $${war.final_issue_price_usd?.toFixed(3)}  |  风险 ${war.risk_score_bps}bps  |  动作: ${war.pricing_action}`);
    console.log(`  ✓ AI 看穿了战争溢价的欺骗性信号\n`);
  }

  // ═══════════════════════════════════════════════════════
  // 第 5 幕：x402 付费情报 (10 秒)
  // ═══════════════════════════════════════════════════════
  console.log('┌─ 第 5 幕 ─────────────────────────────────────────────┐');
  console.log('│ 💎 x402 付费情报市场                                   │');
  console.log('│    AI 判断免费情报不够 → 自动支付解锁高级数据          │');
  console.log('│    HTTP 402 → EIP-3009 签名 → 链上结算 → 情报解锁    │');
  console.log('│    PaymentOracle 记录链上支付证据，可审计              │');
  console.log('└──────────────────────────────────────────────────────┘\n');

  const x402 = await fetch(`${API}/api/x402/smoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale: 'zh' })
  }).then((r) => r.json());

  if (x402.ok) {
    console.log(`  ✓ x402 付费流程: ${x402.steps.length} 步 (挑战→签名→结算→解锁)`);
    console.log(`  ✓ 支付证据 txHash: ${x402.payment?.txHash?.slice(0, 42)}…`);
    console.log(`  ✓ 情报解锁: ${x402.intel_preview?.events_count || 0} 个风险事件, ${x402.intel_preview?.deep_intel_count || 0} 条深度情报\n`);
  }

  // ═══════════════════════════════════════════════════════
  // 收束
  // ═══════════════════════════════════════════════════════
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🎯 一句话总结:                                         ║');
  console.log('║                                                          ║');
  console.log('║  普通 DeFi 让市场去猜价格、让清算去善后。                 ║');
  console.log('║  AgentBL 让 AI 在投资者下单【之前】,                    ║');
  console.log('║  就把贸易欺诈和真实世界风险，                            ║');
  console.log('║  定成一个可解释、可上链的 RWA 折价。                     ║');
  console.log('║                                                          ║');
  console.log('║  AI 定价风险，链上强制执行。                              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

} finally {
  server.close();
}
