// TradeShield AI 悬浮助手 — 原生 JS 实现
// 1) 右侧悬浮图标（可拖拽、hover 展开、点击打开弹窗）
// 2) AI 对话弹窗（DeepSeek 流式 API + Function Calling 工作流）
//
// 支持自然语言触发的 RWA 自动化工作流：
// - 一键铸造 RWA 上链（需 MetaMask）
// - 风险预警 + 自动重定价
// - 完整定价分析（三种速度对比）

import { $, el, clear } from './dom.js';
import { DeepSeekClient } from './llm-client.js';
import * as api from './api.js';
import * as web3 from './web3.js';
import { state, selectedQuote } from './store.js';

// ===========================================================================
// DeepSeek 客户端
// ===========================================================================
const ds = new DeepSeekClient();

// ===========================================================================
// System Prompt
// ===========================================================================
const SYSTEM_PROMPT = `你是 TradeShield AI 助手，专注于 RWA（真实世界资产）动态定价与供应链金融。

## 你的能力
你可以通过调用工具（function calling）来执行以下操作：
1. **getCases** — 列出所有可用的贸易案例
2. **selectCase** — 选择并加载一个贸易案例进行分析
3. **analyzePricing** — 获取单个 RWA 定价报价（发行价、风险评分、收益率）
4. **compareSpeeds** — 对比 FAST / BALANCED / SAFE 三种赔付速度的完整定价
5. **analyzeRisk** — 对案例进行 AI 风险评分
6. **getWorldRisk** — 获取实时世界风险情报（社交媒体、新闻、预测市场）
7. **mintRWA** — 一键铸造 RWA 上链（需要用户连接 MetaMask 钱包到 Sepolia 测试网）
8. **searchKnowledge** — 搜索本地知识库获取参考案例和历史数据

## 工作流规则
- 当用户说"帮我分析案例"或"推荐融资金额"时，应先调用 getCases 查看可用案例，然后 selectCase，再 analyzePricing 或 compareSpeeds
- 当用户说"铸造上链"或"一键上链"时，应先确保已有定价报价数据，再调用 mintRWA
- 当用户问"当前风险"或"有什么风险事件"时，应调用 getWorldRisk
- 当用户问"有什么案例"时，直接调用 getCases 并列出
- 执行上链操作前，提醒用户需要连接 MetaMask 钱包

## 回复风格
- 简洁、专业、中文
- 涉及金额时保留 2 位小数，使用 $ 符号
- 风险等级用中文标注（低风险/中风险/高风险/严重）
- 给出明确的操作建议`;

// ===========================================================================
// Tool 定义
// ===========================================================================
const TOOLS = [
  {
    name: 'getCases',
    description: '获取所有可用的贸易案例列表，返回案例ID、路线、货物类型和风险提示',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'selectCase',
    description: '选择并加载一个贸易案例进行后续分析，加载后可在当前案例上执行定价、风险分析等操作',
    parameters: {
      type: 'object',
      properties: {
        case_id: { type: 'string', description: '案例ID，例如 CASE-EBL-2026-0001' }
      },
      required: ['case_id']
    }
  },
  {
    name: 'analyzePricing',
    description: '获取当前案例的 RWA 定价报价，包含发行价格、风险评分、隐含收益率和定价动作',
    parameters: {
      type: 'object',
      properties: {
        payout_speed: {
          type: 'string',
          enum: ['FAST', 'BALANCED', 'SAFE'],
          description: '赔付速度，默认为 BALANCED'
        }
      },
      required: []
    }
  },
  {
    name: 'compareSpeeds',
    description: '对比 FAST / BALANCED / SAFE 三种赔付速度的完整定价，包含推荐的最优方案',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'analyzeRisk',
    description: '对当前案例执行完整的 AI 风险评分分析，返回风险等级、风险因素和合约动作建议',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getWorldRisk',
    description: '获取当前案例相关的实时世界风险情报，包括社交媒体信号、新闻报道、预测市场数据及重定价影响',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'mintRWA',
    description: '一键铸造 RWA 上链（需要用户先连接 MetaMask 钱包）。根据当前定价的发行价和推荐融资金额，调用智能合约 tokenize() 将提单资产铸造为链上 RWA 代币',
    parameters: {
      type: 'object',
      properties: {
        financing_usd: {
          type: 'number',
          description: '融资金额（美元），如果不提供则使用定价报价中推荐的金额'
        },
        payout_speed: {
          type: 'string',
          enum: ['FAST', 'BALANCED', 'SAFE'],
          description: '使用的定价速度，默认 BALANCED'
        }
      },
      required: []
    }
  },
  {
    name: 'searchKnowledge',
    description: '搜索 TradeShield 知识库，查找历史案例、风险事件和定价参考数据',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词，例如"台风 东亚 铜矿"' }
      },
      required: ['query']
    }
  },
  {
    name: 'getWalletStatus',
    description: '检查当前钱包连接状态（MetaMask 是否已连接、连接地址）',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// ===========================================================================
// Tool 执行层 —— 对接 api.js / web3.js / store.js
// ===========================================================================
const toolExecutors = {
  async getCases() {
    const cases = await api.getCases();
    if (!cases || !cases.length) return '当前没有可用的贸易案例。';
    const lines = cases.map((c) =>
      `- **${c.case_id}**: ${c.label} | 风险提示: ${c.risk_hint || '未知'}`
    );
    return `共 ${cases.length} 个可用案例：\n\n${lines.join('\n')}`;
  },

  async selectCase(params) {
    const caseId = params.case_id;
    state.caseId = caseId;

    // 从已加载的案例列表中找
    if (!state.cases || !state.cases.length) {
      state.cases = await api.getCases();
    }
    const found = state.cases.find((c) => c.case_id === caseId);
    if (!found) return `未找到案例 ${caseId}，请先调用 getCases 查看可用案例列表。`;

    state.caseData = found.case;
    state.comparison = null;

    const bl = found.case?.bill_of_lading || {};
    return `已加载案例 **${caseId}**：
- 路线：${found.route}
- 货物：${found.cargo || '未指定'}
- 提单号：${bl.bl_number || 'N/A'}
- 发货日期：${bl.shipped_on_board || bl.issue_date || 'N/A'}
- ETA：${bl.eta || 'N/A'}

现在可以执行定价分析、风险评分或一键铸造上链。`;
  },

  async analyzePricing(params) {
    if (!state.caseData) {
      return '请先用 selectCase 加载一个案例。';
    }
    const speed = params.payout_speed || 'BALANCED';
    state.speed = speed;

    try {
      const quote = await api.compareSpeeds(state.caseData); // 获取完整对比
      // 提取当前速度的报价
      const current = quote.quotes?.find((q) => q.payout_speed === speed) || quote.quotes?.[0];
      state.comparison = quote;

      if (!current) return '未能获取定价数据，请检查后端服务是否正常运行。';

      return `**${speed} 速度定价结果：**
- 发行价：$${Number(current.final_issue_price_usd).toFixed(2)}
- 风险等级：${current.risk_level} (${current.risk_score_bps} bps)
- 隐含收益率：${(current.implied_gross_yield_bps / 100).toFixed(2)}%
- 定价动作：${current.pricing_action}
- 推荐代币供应量：${current.recommended_token_supply || 'N/A'}
- AI 验证担保品价值：$${Number(current.ai_verified_collateral_value_usd || 0).toFixed(2)}
- 预期兑付金额：$${Number(current.expected_cash_to_exporter_usd || 0).toFixed(2)}`;
    } catch (e) {
      return `定价分析失败：${e.message}`;
    }
  },

  async compareSpeeds() {
    if (!state.caseData) {
      return '请先用 selectCase 加载一个案例。';
    }
    try {
      const comp = await api.compareSpeeds(state.caseData);
      state.comparison = comp;
      state.speed = comp.recommended_speed || 'BALANCED';

      const lines = (comp.quotes || []).map((q) => {
        const rec = q.payout_speed === comp.recommended_speed ? ' ⭐推荐' : '';
        return `**${q.payout_speed}**${rec}：发行价 $${Number(q.final_issue_price_usd).toFixed(2)} | 风险 ${q.risk_level} (${q.risk_score_bps}bps) | 收益 ${(q.implied_gross_yield_bps / 100).toFixed(2)}%`;
      });

      return `**三种赔付速度对比：**\n\n${lines.join('\n')}\n\n推荐方案：**${comp.recommended_speed}** — ${comp.recommendation_reason || '综合风险收益最优'}`;
    } catch (e) {
      return `对比分析失败：${e.message}`;
    }
  },

  async analyzeRisk() {
    if (!state.caseData) {
      return '请先用 selectCase 加载一个案例。';
    }
    try {
      const body = JSON.stringify({ case: state.caseData });
      const res = await fetch('/api/risk/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      const report = await res.json();
      if (!res.ok) throw new Error(report.error || 'Unknown error');

      const factors = (report.risk_factors || []).map((f) => `- ${f}`).join('\n');
      return `**风险分析报告**（案例：${report.case_id || state.caseId}）
- 风险等级：**${report.risk_level}**
- 风险评分：${report.risk_score_bps} bps
- 合约动作：${report.contract_action}
- 解释：${report.explanation}
${factors ? `\n风险因素：\n${factors}` : ''}`;
    } catch (e) {
      return `风险分析失败：${e.message}`;
    }
  },

  async getWorldRisk() {
    if (!state.caseData) {
      return '请先用 selectCase 加载一个案例。';
    }
    try {
      const res = await api.worldRisk(state.caseData);
      if (!res.ok && !res.events) return `世界风险情报获取失败：${res.error || '未知错误'}`;

      const eventLines = (res.events || []).slice(0, 5).map((e) =>
        `- [${e.severity?.toUpperCase()}] ${e.description || e.type}`
      ).join('\n');

      let result = `**实时世界风险情报**（${res.live ? '🟢 实时数据' : '🟡 离线模式'}）`;
      if (res.summary) result += `\n\n${res.summary}`;
      if (eventLines) result += `\n\n风险事件：\n${eventLines}`;
      if (res.after_quote) {
        result += `\n\n**重定价影响：**
- 发行价：$${Number(res.before_quote?.final_issue_price_usd).toFixed(2)} → $${Number(res.after_quote.final_issue_price_usd).toFixed(2)}
- 风险等级：${res.before_quote?.risk_level || '?'} → ${res.after_quote.risk_level}`;
      }
      return result;
    } catch (e) {
      return `世界风险情报获取失败：${e.message}`;
    }
  },

  async mintRWA(params) {
    if (!state.caseData) {
      return '请先用 selectCase 加载一个案例，并确保已执行定价分析。';
    }

    const quote = selectedQuote();
    if (!quote) {
      return '请先执行定价分析（analyzePricing 或 compareSpeeds），获取报价后再铸造。';
    }

    const financingUsd = params.financing_usd || quote.expected_cash_to_exporter_usd || quote.requested_cash_usd || 0;
    if (!financingUsd || financingUsd <= 0) {
      return '无法确定融资金额，请明确指定 financing_usd 参数。';
    }

    // 检查钱包
    if (!web3.isWalletConnected()) {
      try {
        const { address } = await web3.connectWallet();
        state.wallet = { address };
      } catch (e) {
        if (e.code === 'NO_WALLET') return '未检测到 MetaMask 钱包。请先安装 MetaMask 浏览器扩展。';
        if (e.code === 'REJECTED') return '用户拒绝了钱包连接请求。请重新尝试。';
        return `钱包连接失败：${e.message}`;
      }
    }

    // 执行铸造
    try {
      let result;
      const isReal = await web3.isRealChainConfigured();
      if (isReal && web3.isWalletConnected()) {
        result = await web3.mintOnChain(quote, financingUsd);
      } else {
        result = await web3.simulatedMint(state.caseId, quote, financingUsd);
      }

      state.mint = result;
      const modeLabel = result.mode === 'chain' ? '⛓️ Sepolia 测试网' : '🔬 模拟交易';

      return `**RWA 铸造${result.mode === 'chain' ? '成功' : '（模拟）'}！** ${modeLabel}

- 交易哈希：\`${result.txHash}\`
- 资金池 ID：${result.poolId}
- 铸造数量：${result.mintedAmount} RWA 代币
- 发行价：$${(Number(result.issuePriceE6) / 1e6).toFixed(2)}
- 融资金额：$${Number(financingUsd).toFixed(2)}
${result.explorerUrl ? `- 浏览器链接：${result.explorerUrl}` : ''}`;
    } catch (e) {
      if (e.code === 'REJECTED') return '用户在 MetaMask 中拒绝了交易。';
      return `RWA 铸造失败：${e.message}`;
    }
  },

  async searchKnowledge(params) {
    if (!params.query) return '请提供搜索关键词。';
    try {
      const res = await api.ragSearch(params.query);
      if (!res.matches || !res.matches.length) return `未找到与"${params.query}"相关的知识库内容。`;

      const lines = res.matches.slice(0, 5).map((m) =>
        `- [${m.severity?.toUpperCase() || 'INFO'}] **${m.title || m.id}**: ${m.summary?.slice(0, 120) || ''}`
      );
      return `**知识库搜索结果**（${res.match_count} 条匹配，展示前 5 条）：\n\n${lines.join('\n')}`;
    } catch (e) {
      return `知识库搜索失败：${e.message}`;
    }
  },

  async getWalletStatus() {
    const connected = web3.isWalletConnected();
    if (connected) {
      const addr = web3.connectedAddress();
      const isReal = await web3.isRealChainConfigured();
      return `钱包已连接 ✅
- 地址：\`${addr}\`
- 网络：${isReal ? 'Sepolia 测试网（合约已部署）' : 'Sepolia 测试网（模拟模式）'}
${isReal ? '- 可执行真实链上铸造' : '- 将使用模拟交易（合约未部署或未连接）'}`;
    }
    return `钱包未连接 ❌
- 需要安装 MetaMask 浏览器扩展
- 点击 MetaMask 图标连接后可执行链上 RWA 铸造`;
  }
};

// ===========================================================================
// 样式注入（自包含）
// ===========================================================================
const STYLES = /* css */`
/* ---- 悬浮按钮 ---- */
.pa-float {
  position: fixed; z-index: 9999; touch-action: none; user-select: none;
  transition: transform 0.22s ease;
  cursor: grab;
}
.pa-float:active { cursor: grabbing; }
.pa-float-icon {
  width: 100%; height: 100%; border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #5b9cff 0%, #1a4fc0 100%);
  box-shadow: 0 6px 24px rgba(79,140,255,0.40), 0 0 0 3px rgba(79,140,255,0.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 40px; color: #fff;
  transition: box-shadow 0.22s, transform 0.22s;
}
.pa-float:hover .pa-float-icon,
.pa-float.dragging .pa-float-icon {
  box-shadow: 0 8px 32px rgba(79,140,255,0.55), 0 0 0 5px rgba(79,140,255,0.25);
  transform: scale(1.06);
}
.pa-float-badge {
  position: absolute; top: -2px; right: -2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--ok, #34d399); border: 2px solid var(--bg, #070b16);
  animation: paPulse 1.8s infinite;
}
@keyframes paPulse {
  0%,100% { box-shadow: 0 0 0 0 #34d39988; }
  50% { box-shadow: 0 0 0 8px transparent; }
}

/* ---- 弹窗 ---- */
.pa-overlay {
  position: fixed; inset: 0; z-index: 10000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
}
.pa-dialog {
  width: 560px; max-width: 95vw; height: 660px; max-height: 88vh;
  display: flex; flex-direction: column;
  background: var(--panel, #0e1424);
  border: 1px solid var(--line, #1f2942);
  border-radius: 18px; box-shadow: 0 32px 80px rgba(0,0,0,0.55);
  overflow: hidden; animation: paPopIn 0.22s ease;
}
@keyframes paPopIn { from { opacity:0; transform:scale(0.94) translateY(10px); } to { opacity:1; transform:none; } }
.pa-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--line, #1f2942);
}
.pa-title { font-size: 16px; font-weight: 700; color: var(--accent, #4f8cff); margin: 0; }
.pa-close { background:none; border:none; color:var(--text-2); font-size:18px; cursor:pointer; padding:4px 8px; border-radius:6px; }
.pa-close:hover { color:var(--text); }
.pa-info {
  padding: 10px 18px; border-bottom: 1px solid var(--line, #1f2942);
  background: var(--bg-2, #0a0f1f);
}
.pa-info-row { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.pa-dot { width:10px; height:10px; background:var(--accent); border-radius:50%; }
.pa-info-text { font-size:12px; font-weight:600; color:var(--text-2); letter-spacing:0.04em; }
.pa-info-sub { display:flex; align-items:center; justify-content:space-between; }
.pa-version { font-size:11px; color:var(--text-3); }
.pa-status-dot { width:7px; height:7px; background:var(--ok); border-radius:50%; }
.pa-msgs { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; }
.pa-msg-row { display:flex; }
.pa-msg-user { justify-content:flex-end; }
.pa-msg-assistant { justify-content:flex-start; }
.pa-bubble { max-width:85%; padding:10px 14px; border-radius:12px; font-size:14px; line-height:1.55; word-break:break-word; white-space:pre-wrap; }
.pa-bubble-user { background:var(--accent); color:#fff; border-bottom-right-radius:4px; }
.pa-bubble-assistant { background:var(--card); color:var(--text); border:1px solid var(--line); border-bottom-left-radius:4px; }

/* ---- Action Card ---- */
.pa-action-card {
  max-width:90%; margin:0;
  background:var(--bg-2, #0a0f1f);
  border:1px solid var(--accent, #4f8cff);
  border-radius:12px; overflow:hidden;
  animation: paActionIn 0.25s ease;
}
@keyframes paActionIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
.pa-action-head {
  display:flex; align-items:center; gap:8px;
  padding:10px 14px;
  background:rgba(79,140,255,0.10);
  border-bottom:1px solid var(--line, #1f2942);
}
.pa-action-icon { font-size:18px; }
.pa-action-name { font-size:13px; font-weight:700; color:var(--accent); }
.pa-action-status {
  margin-left:auto; font-size:11px; font-weight:600;
  padding:2px 8px; border-radius:6px;
}
.pa-action-status.running { background:rgba(250,204,21,0.15); color:#facc15; }
.pa-action-status.done { background:rgba(52,211,153,0.15); color:#34d399; }
.pa-action-status.error { background:rgba(248,113,113,0.15); color:#f87171; }
.pa-action-body {
  padding:10px 14px;
  font-size:13px; color:var(--text-2);
  line-height:1.5; max-height:200px; overflow-y:auto;
}

/* ---- 结构化数据卡片 ---- */
.pa-data-card {
  max-width:90%;
  background:var(--bg-2, #0a0f1f);
  border:1px solid var(--line, #1f2942);
  border-radius:12px; overflow:hidden;
}
.pa-data-card .pa-data-head {
  padding:10px 14px;
  font-size:13px; font-weight:700; color:var(--text);
  border-bottom:1px solid var(--line, #1f2942);
  background:rgba(79,140,255,0.06);
}
.pa-data-card .pa-data-row {
  display:flex; justify-content:space-between; align-items:center;
  padding:8px 14px; font-size:13px;
  border-bottom:1px solid rgba(31,41,66,0.4);
}
.pa-data-card .pa-data-row:last-child { border-bottom:none; }
.pa-data-label { color:var(--text-3); }
.pa-data-value { color:var(--text); font-weight:600; }
.pa-data-value.price { color:var(--accent); }
.pa-data-value.risk-low { color:#34d399; }
.pa-data-value.risk-medium { color:#facc15; }
.pa-data-value.risk-high { color:#f97316; }
.pa-data-value.risk-critical { color:#f87171; }
.pa-data-highlight {
  margin:8px 14px 12px;
  padding:8px 12px;
  background:rgba(79,140,255,0.08);
  border-radius:8px;
  font-size:12px; color:var(--accent);
  line-height:1.5;
}

/* ---- Loading ---- */
.pa-loading { display:flex; align-items:center; gap:5px; padding:14px 18px; }
.pa-dot-bounce { width:7px; height:7px; background:var(--text-3); border-radius:50%; animation:paB 0.8s infinite ease-in-out; }
.pa-dot-bounce:nth-child(2) { animation-delay:0.2s; }
.pa-dot-bounce:nth-child(3) { animation-delay:0.4s; }
@keyframes paB { 0%,100%{transform:translateY(0);opacity:0.35} 50%{transform:translateY(-6px);opacity:1} }

/* ---- Quick Actions ---- */
.pa-quick-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:4px; }
.pa-quick-btn {
  padding:10px 14px; font-size:13px; line-height:1.45;
  background:var(--card); color:var(--text);
  border:1px solid var(--line); border-radius:10px;
  cursor:pointer; text-align:left; transition:background 0.15s,border-color 0.15s;
}
.pa-quick-btn:hover { background:var(--panel-2); border-color:var(--accent); }
.pa-input-row { display:flex; align-items:center; gap:8px; padding:14px 18px; border-top:1px solid var(--line); }
.pa-input {
  flex:1; padding:10px 14px;
  background:var(--bg-2); color:var(--text);
  border:1px solid var(--line); border-radius:10px;
  font-size:14px; outline:none; transition:border-color 0.15s;
}
.pa-input:focus { border-color:var(--accent); }
.pa-input::placeholder { color:var(--text-3); }
.pa-send {
  width:40px; height:40px; display:flex; align-items:center; justify-content:center;
  background:var(--accent); color:#fff; border:none; border-radius:10px; font-size:16px;
  cursor:pointer; transition:opacity 0.15s;
}
.pa-send:hover:not(:disabled) { opacity:0.85; }
.pa-send:disabled { opacity:0.35; cursor:not-allowed; }
`;

// ===========================================================================
// FloatingButton —— 可拖拽悬浮图标（保持不变）
// ===========================================================================
class FloatingButton {
  constructor({ size = 72, onClick } = {}) {
    this.size = size;
    this.onClick = onClick;
    this.left = 0; this.top = 0;
    this.dragging = false; this.moved = false; this.hovering = false;
    this._ptrId = null;
    this._startX = 0; this._startY = 0;
    this._offX = 0; this._offY = 0;
    this._el = null;
    this._create();
  }

  _clamp(v, mn, mx) { return Math.min(Math.max(v, mn), mx); }

  _create() {
    const self = this;
    const gap = 20;
    const peek = 16;

    this._el = el('div', { class: 'pa-float' });
    this._el.style.width = this._el.style.height = `${this.size}px`;

    const icon = el('div', { class: 'pa-float-icon', html: '🤖' });
    const badge = el('div', { class: 'pa-float-badge' });
    this._el.append(icon, badge);

    const place = () => {
      const w = document.documentElement.clientWidth;
      const h = document.documentElement.clientHeight;
      this.left = w - this.size - gap;
      this.top = Math.round(h * 0.62);
      this._applyPos();
    };

    const updateTransform = () => {
      if (this.dragging || this.hovering) {
        this._el.style.transform = 'translateX(0)';
      } else {
        this._el.style.transform = `translateX(calc(${this.size}px - ${peek}px))`;
      }
    };

    this._el.addEventListener('pointerdown', (e) => {
      if (self.dragging) return;
      self._ptrId = e.pointerId; self._el.setPointerCapture(e.pointerId);
      self.dragging = true; self.moved = false; self.hovering = true;
      self._el.style.transition = 'none';
      self._startX = e.clientX; self._startY = e.clientY;
      self._offX = e.clientX - self.left; self._offY = e.clientY - self.top;
      updateTransform();
    });
    this._el.addEventListener('pointermove', (e) => {
      if (!self.dragging || e.pointerId !== self._ptrId) return;
      const w = document.documentElement.clientWidth;
      const h = document.documentElement.clientHeight;
      self.left = self._clamp(e.clientX - self._offX, 10, w - self.size - 10);
      self.top = self._clamp(e.clientY - self._offY, 10, h - self.size - 10);
      self._applyPos();
      if (!self.moved && Math.hypot(e.clientX - self._startX, e.clientY - self._startY) > 4) self.moved = true;
    });
    const up = (e) => {
      if (!self.dragging) return;
      if (self._ptrId !== null) { try { self._el.releasePointerCapture(self._ptrId); } catch (_) {} }
      self._ptrId = null; self.dragging = false;
      self._el.style.transition = 'transform 0.22s ease, left 0.2s ease, top 0.2s ease';
      const w = document.documentElement.clientWidth;
      self.left = w - self.size - 20;
      self._applyPos();
      if (!self.moved) self.onClick?.();
      self.moved = false;
      updateTransform();
    };
    this._el.addEventListener('pointerup', up);
    this._el.addEventListener('pointercancel', up);
    this._el.addEventListener('pointerleave', up);

    this._el.addEventListener('mouseenter', () => { self.hovering = true; updateTransform(); });
    this._el.addEventListener('mouseleave', () => { self.hovering = false; updateTransform(); });

    const onResize = () => {
      const w = document.documentElement.clientWidth;
      const h = document.documentElement.clientHeight;
      self.left = self._clamp(self.left, 10, w - self.size - 10);
      self.top = self._clamp(self.top, 10, h - self.size - 10);
      self._applyPos();
    };
    window.addEventListener('resize', onResize, { passive: true });

    setTimeout(place, 10);
    setTimeout(updateTransform, 50);

    document.body.appendChild(this._el);
  }

  _applyPos() {
    if (!this._el) return;
    this._el.style.left = `${this.left}px`;
    this._el.style.top = `${this.top}px`;
  }

  destroy() {
    if (this._el) { this._el.remove(); this._el = null; }
  }
}

// ===========================================================================
// PopupAssistant —— AI 对话弹窗（DeepSeek + Function Calling）
// ===========================================================================
class PopupAssistant {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.isLoading = false;
    this._asstId = null;
    this._overlay = null;
    this._toolRound = 0;

    // 初始化对话历史（system prompt）
    this._chatHistory = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // 欢迎消息
    this.messages = [{
      id: 1,
      sender: 'assistant',
      type: 'text',
      text: '👋 你好！我是 TradeShield AI 助手，我可以帮你：\n\n🔍 **分析贸易案例** — 查看可用案例并执行 AI 定价\n📊 **对比定价方案** — 比较三种赔付速度的收益和风险\n🛡️ **风险评估** — 实时世界风险情报 + AI 风险评分\n⛓️ **一键铸造 RWA** — 将提单资产铸造为链上 RWA 代币\n\n试试说「帮我看看有哪些案例」或「分析铜矿案例并推荐融资金额」吧！'
    }];
    this._chatHistory.push({ role: 'assistant', content: this.messages[0].text });
  }

  get quickActions() {
    return [
      '📋 查看可用案例',
      '📊 对比三种定价方案',
      '⛓️ 一键铸造 RWA 上链',
      '🌍 获取实时风险情报'
    ];
  }

  open() {
    if (!this.isOpen) {
      this.isOpen = true;
      // 预加载案例列表
      if (!state.cases || !state.cases.length) {
        api.getCases().then((cases) => { state.cases = cases; }).catch(() => {});
      }
      this._render();
    }
  }

  close() {
    this.isOpen = false;
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
  }
  toggle() { this.isOpen ? this.close() : this.open(); }

  _render() {
    const self = this;
    this._overlay = el('div', { class: 'pa-overlay', onclick: (e) => { if (e.target === self._overlay) self.close(); } });

    const dlg = el('div', { class: 'pa-dialog' });

    // Header
    dlg.append(el('div', { class: 'pa-header' },
      el('h2', { class: 'pa-title', text: '◈ TradeShield AI 助手' }),
      el('button', { class: 'pa-close', text: '✕', onclick: () => self.close() })
    ));

    // Info bar
    dlg.append(el('div', { class: 'pa-info' },
      el('div', { class: 'pa-info-row' },
        el('span', { class: 'pa-dot' }),
        el('span', { class: 'pa-info-text', text: 'TRADESHIELD AI · FUNCTION CALLING' })
      ),
      el('div', { class: 'pa-info-sub' },
        el('span', { class: 'pa-version', text: 'Powered by DeepSeek · Workflow' }),
        el('span', { class: 'pa-status-dot' })
      )
    ));

    // Messages
    const msgList = el('div', { class: 'pa-msgs' });
    dlg.append(msgList);

    // Input
    const input = el('input', {
      class: 'pa-input', type: 'text', placeholder: '输入消息…',
      onkeydown: (e) => { if (e.key === 'Enter' && !self.isLoading) self._send(input.value); }
    });
    const sendBtn = el('button', {
      class: 'pa-send', disabled: true, html: '➤',
      onclick: () => self._send(input.value)
    });
    input.addEventListener('input', () => { sendBtn.disabled = self.isLoading || !input.value.trim(); });
    dlg.append(el('div', { class: 'pa-input-row' }, input, sendBtn));

    this._overlay.appendChild(dlg);
    document.body.appendChild(this._overlay);

    // Escape
    const esc = (e) => { if (e.key === 'Escape') { self.close(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);

    // 渲染消息
    const renderMsgs = () => {
      clear(msgList);
      for (const m of self.messages) {
        if (m.type === 'action') {
          // Action Card
          msgList.append(self._renderActionCard(m));
        } else if (m.type === 'data') {
          // 结构化数据卡片
          msgList.append(self._renderDataCard(m));
        } else {
          // 普通文本气泡
          msgList.append(el('div', { class: `pa-msg-row pa-msg-${m.sender}` },
            el('div', { class: `pa-bubble pa-bubble-${m.sender}` }, m.text)
          ));
        }
      }
      // Loading
      if (self.isLoading && self.messages[self.messages.length - 1]?.sender === 'assistant') {
        const lastMsg = self.messages[self.messages.length - 1];
        if (!lastMsg.text && lastMsg.type !== 'action' && lastMsg.type !== 'data') {
          msgList.append(el('div', { class: 'pa-msg-row pa-msg-assistant' },
            el('div', { class: 'pa-bubble pa-bubble-assistant pa-loading' },
              el('span', { class: 'pa-dot-bounce' }),
              el('span', { class: 'pa-dot-bounce' }),
              el('span', { class: 'pa-dot-bounce' })
            )
          ));
        }
      }
      // Quick actions
      if (!self.isLoading) {
        const grid = el('div', { class: 'pa-quick-grid' });
        for (const a of self.quickActions) {
          grid.append(el('button', { class: 'pa-quick-btn', text: a, onclick: () => self._send(a) }));
        }
        msgList.append(grid);
      }
      msgList.scrollTop = msgList.scrollHeight;
    };
    this._renderMsgs = renderMsgs;
    renderMsgs();
    setTimeout(() => input.focus(), 150);
  }

  /** Action Card 渲染 */
  _renderActionCard(m) {
    const statusClass = m.status === 'done' ? 'done' : m.status === 'error' ? 'error' : 'running';
    const statusText = m.status === 'done' ? '✓ 完成' : m.status === 'error' ? '✕ 失败' : '⏳ 执行中';
    const iconMap = {
      getCases: '📋', selectCase: '📌', analyzePricing: '💰', compareSpeeds: '📊',
      analyzeRisk: '🛡️', getWorldRisk: '🌍', mintRWA: '⛓️', searchKnowledge: '🔍', getWalletStatus: '🔑'
    };

    return el('div', { class: 'pa-msg-row pa-msg-assistant' },
      el('div', { class: 'pa-action-card' },
        el('div', { class: 'pa-action-head' },
          el('span', { class: 'pa-action-icon', text: iconMap[m.tool] || '🔧' }),
          el('span', { class: 'pa-action-name', text: m.label }),
          el('span', { class: `pa-action-status ${statusClass}`, text: statusText })
        ),
        m.result ? el('div', { class: 'pa-action-body', text: m.result }) : null
      )
    );
  }

  /** 结构化数据卡片渲染 */
  _renderDataCard(m) {
    return el('div', { class: 'pa-msg-row pa-msg-assistant' },
      el('div', { class: 'pa-data-card' },
        el('div', { class: 'pa-data-head', text: m.title }),
        ...(m.rows || []).map((r) => el('div', { class: 'pa-data-row' },
          el('span', { class: 'pa-data-label', text: r.label }),
          el('span', { class: `pa-data-value ${r.css || ''}`, text: r.value })
        )),
        m.highlight ? el('div', { class: 'pa-data-highlight', text: m.highlight }) : null
      )
    );
  }

  // ===========================================================================
  // 核心：发送消息 + Function Calling 循环
  // ===========================================================================
  async _send(text) {
    const txt = (text || '').trim();
    if (!txt || this.isLoading) return;
    this.isLoading = true;
    this._toolRound = 0;

    // 添加用户消息
    this.messages.push({ id: Date.now(), sender: 'user', type: 'text', text: txt });
    this._chatHistory.push({ role: 'user', content: txt });

    // 创建 assistant 占位
    const asstId = Date.now() + 1; this._asstId = asstId;
    const asstMsg = { id: asstId, sender: 'assistant', type: 'text', text: '' };
    this.messages.push(asstMsg);
    this._renderMsgs?.();

    try {
      await this._conversationLoop(asstMsg);
    } catch (e) {
      asstMsg.text = `抱歉，处理请求时出错：${e.message}`;
    } finally {
      this.isLoading = false; this._asstId = null;
      this._renderMsgs?.();
      const inp = this._overlay?.querySelector('.pa-input');
      if (inp) setTimeout(() => inp.focus(), 50);
    }
  }

  /**
   * Function Calling 对话循环
   * 最多循环 MAX_ROUNDS 次，每次：
   *   1. 调用 DeepSeek 流式获取回复
   *   2. 如果 AI 返回 tool_calls → 执行 → 结果追加到 history → 继续循环
   *   3. 如果 AI 返回纯文本 → 结束
   */
  async _conversationLoop(asstMsg) {
    const MAX_ROUNDS = 5;

    while (this._toolRound < MAX_ROUNDS) {
      this._toolRound++;

      // 调用 DeepSeek（流式）
      let content = '';
      let toolCalls = [];

      const result = await ds.streamChat(this._chatHistory, TOOLS, {
        onChunk: (chunk) => {
          content += chunk;
          asstMsg.text = content;
          asstMsg.type = 'text';
          this._updateBubble();
        }
      });

      content = result.content || '';
      toolCalls = result.tool_calls || [];

      // 如果 AI 返回了 tool_calls
      if (toolCalls && toolCalls.length > 0) {
        // 将 assistant 消息（含 tool_calls）加入 chatHistory
        const assistantMsg = {
          role: 'assistant',
          content: content || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
          }))
        };
        this._chatHistory.push(assistantMsg);

        // 执行每个 tool
        for (const tc of toolCalls) {
          await this._executeTool(tc);
        }

        // 重置 asstMsg 以便下一轮追加文本
        asstMsg.text = '';
        content = '';
        // 继续循环（AI 可能基于 tool 结果生成最终回复）
        continue;
      }

      // 纯文本回复 → 结束
      if (content) {
        asstMsg.text = content;
        asstMsg.type = 'text';
        this._chatHistory.push({ role: 'assistant', content });
      } else {
        // 没有任何内容也没有 tool call
        asstMsg.text = '（AI 未返回有效响应，请重试）';
        asstMsg.type = 'text';
        this._chatHistory.push({ role: 'assistant', content: asstMsg.text });
      }
      return;
    }

    // 超过最大轮数
    asstMsg.text = '操作已超过最大执行步骤，请简化你的请求。';
    asstMsg.type = 'text';
    this._chatHistory.push({ role: 'assistant', content: asstMsg.text });
  }

  /**
   * 执行单个 tool call
   */
  async _executeTool(toolCall) {
    const { id, name, arguments: args } = toolCall;

    // 创建 Action Card
    const actionMsg = {
      id: Date.now(),
      sender: 'assistant',
      type: 'action',
      tool: name,
      label: this._toolLabel(name, args),
      status: 'running',
      result: ''
    };
    this.messages.splice(this.messages.length - 1, 0, actionMsg);
    this._renderMsgs?.();

    // 执行
    const executor = toolExecutors[name];
    let result;
    if (executor) {
      try {
        result = await executor(args);
        actionMsg.status = 'done';
      } catch (e) {
        result = `执行失败：${e.message}`;
        actionMsg.status = 'error';
      }
    } else {
      result = `未知工具：${name}`;
      actionMsg.status = 'error';
    }

    actionMsg.result = result;
    this._renderMsgs?.();

    // 将 tool 结果加到 chatHistory
    this._chatHistory.push({
      role: 'tool',
      tool_call_id: id,
      content: String(result).slice(0, 2000) // 限制长度
    });
  }

  /** 工具调用的中文标签 */
  _toolLabel(name, args) {
    const labels = {
      getCases: '获取案例列表',
      selectCase: `加载案例 ${args.case_id || ''}`,
      analyzePricing: `定价分析 · ${args.payout_speed || 'BALANCED'}`,
      compareSpeeds: '对比三种赔付速度',
      analyzeRisk: 'AI 风险评分分析',
      getWorldRisk: '获取实时世界风险情报',
      mintRWA: `铸造 RWA 上链${args.financing_usd ? ' · $' + args.financing_usd : ''}`,
      searchKnowledge: `搜索知识库：${args.query || ''}`,
      getWalletStatus: '查询钱包状态'
    };
    return labels[name] || `调用 ${name}`;
  }

  /** 流式更新聊天气泡 */
  _updateBubble() {
    const bubbles = this._overlay?.querySelectorAll('.pa-bubble-assistant:not(.pa-loading)');
    if (!bubbles?.length) return;
    const last = bubbles[bubbles.length - 1];
    const m = this.messages.find((x) => x.id === this._asstId && x.sender === 'assistant');
    if (m && last && m.type === 'text') last.textContent = m.text;
    const msgs = this._overlay?.querySelector('.pa-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }
}

// ===========================================================================
// 初始化入口
// ===========================================================================
let _inst = null;

export function initPopupAssistant() {
  if (_inst) return _inst;

  // 注入样式
  if (!document.getElementById('pa-styles')) {
    const s = document.createElement('style'); s.id = 'pa-styles'; s.textContent = STYLES;
    document.head.appendChild(s);
  }

  const popup = new PopupAssistant();

  // 创建悬浮按钮
  new FloatingButton({
    size: 72,
    onClick: () => popup.open()
  });

  _inst = popup;
  return _inst;
}

export function getPopupAssistant() {
  return _inst;
}
