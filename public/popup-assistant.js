// AgentBL AI 悬浮助手 — 原生 JS 实现
// 1) 右侧悬浮图标（可拖拽、hover 展开、点击打开弹窗）
// 2) AI 对话弹窗（DeepSeek 流式 API + Function Calling 工作流）
//
// Web3 原生贸易融资协议：
// - 出口商 tokenize 电子提单，AI 定价航线风险，全球投资者直接投资
// - 没有银行、没有信用审核、没有中间人
// - eBL 即抵押物，智能合约即清算
//
// 支持自然语言触发的双角色工作流：
// 出口商视角 — 上传 eBL → AI 估值 → 自动定价 → 开盘
// 投资者视角 — 浏览 eBL 市场 → AI 推荐 → 对比 → 认购 → 持仓

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
const SYSTEM_PROMPT = `你是 AgentBL 协议的 AI 助手。AgentBL 是一个 Web3 原生贸易融资协议——出口商将电子提单（eBL）tokenize 上链，AI 定价航线与货物风险，全球投资者直接投资。没有银行。没有信用审核。没有中间人。eBL 即抵押物，智能合约即清算。

## 你的两个服务视角

### 投资者视角（核心新增）
你可以帮助投资者浏览 eBL 市场、AI 智能推荐合适的提单标的：
1. **recommendEBL** — AI 解析自然语言偏好（如"收益高一些、风险中等"），从所有可用 eBL 中筛选排序推荐 Top 3
2. **compareEBLs** — 并排对比 2-3 个提单的核心指标（收益/风险/价格/金额）
3. **getPoolStatus** — 查询某个 eBL 发行池的实时状态（认购比例、当前定价、是否暂停）
4. **getPortfolio** — 查看投资者当前持仓（认购的 RWA 代币、成本、估值）
5. **subscribeRWA** — 一键认购 RWA 代币（需要连接钱包）

### 出口商视角（已有升级）
6. **getCases** — 列出所有已上链的 eBL 提单
7. **selectCase** — 选择并加载一个提单进行定价分析
8. **analyzePricing** — 获取单个 RWA 定价报价（发行价、风险评分、收益率）
9. **compareSpeeds** — 对比 FAST / BALANCED / SAFE 三种到账速度的完整定价
10. **analyzeRisk** — AI 航线风险评分
11. **getWorldRisk** — 获取实时世界风险情报（社交媒体、新闻、预测市场）
12. **mintRWA** — 出口商一键 tokenize eBL 并创建链上发行池
13. **getAgentActivity** — 查看自主 AI 最近的决策记录（定价/改价/暂停/恢复/结算）
14. **searchKnowledge** — 搜索知识库
15. **getWalletStatus** — 检查钱包连接状态

## 工作流规则
- 投资者说"推荐""帮我选""有什么好标的"→ 调用 recommendEBL，AI 解析偏好后返回推荐
- 投资者说"对比这两个"→ 调用 compareEBLs
- 投资者说"认购""投5000"→ 先确保已选标的，再调用 subscribeRWA
- 投资者说"我的持仓""投了哪些"→ 调用 getPortfolio
- 出口商说"分析""定价"→ 沿用 getCases → selectCase → analyzePricing / compareSpeeds
- 出口商说"上链""tokenize"→ 先确保已有定价，再调用 mintRWA
- 用户问"AI做了什么决策""有预警吗"→ 调用 getAgentActivity
- 问风险事件 → getWorldRisk
- 铸造/认购前 → 提醒连接钱包

## AI 风险评估原则
- 评估的是"这批货 + 这条航线 + 当前世界局势"的风险
- 不评估出口商/投资者的征信或公司背景
- 风险越高 → 发行价越低 → 投资者潜在收益越高

## 回复风格
- 简洁、专业、中文
- 涉及金额时保留 2 位小数，使用 $ 符号
- 风险等级用中文标注（低风险/中风险/高风险/严重）
- 推荐结果应突出理由（为什么这个提单适合用户）
- 给明确的可操作建议`;

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
    description: '搜索 AgentBL 知识库，查找历史案例、风险事件和定价参考数据',
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
  },
  {
    name: 'recommendEBL',
    description: 'AI 解析用户的自然语言投资偏好（如"收益高一些、风险中等""只看铜矿""200万以内安全"），从所有可用 eBL 提单中筛选排序，返回 Top 3 推荐及每个的推荐理由。优先按收益风险比排序。',
    parameters: {
      type: 'object',
      properties: {
        preference: { type: 'string', description: '用户的自然语言偏好描述' },
        risk_max: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: '可接受最高风险等级' },
        yield_min: { type: 'number', description: '最低预期收益率 (bps)，500 表示 5%' },
        commodity: { type: 'string', description: '货物类型关键词，如"铜""原油"' },
        financing_max: { type: 'number', description: '最高融资金额 (USD)' },
        sort_by: { type: 'string', enum: ['yield_desc', 'risk_asc', 'score'], description: '排序方式，默认 score（收益风险比）' },
        max_results: { type: 'number', description: '最多返回结果数，默认 3' }
      },
      required: ['preference']
    }
  },
  {
    name: 'getPortfolio',
    description: '查看投资者当前持仓：已认购的 RWA 代币列表，包括每个持仓的提单信息、认购数量、成本价、当前估值和预期收益',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getPoolStatus',
    description: '查询某个 eBL 发行池的实时状态：当前定价、认购进度、剩余份额、是否暂停、风险等级变化',
    parameters: {
      type: 'object',
      properties: {
        case_id: { type: 'string', description: '提单ID，例如 CASE-EBL-2026-0001' }
      },
      required: ['case_id']
    }
  },
  {
    name: 'getAgentActivity',
    description: '查看自主 AI Agent 最近的决策记录时间线：何时定价/改价/暂停/恢复/结算，每个决策的理由和链上交易哈希',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回最近 N 条记录，默认 5' }
      },
      required: []
    }
  },
  {
    name: 'compareEBLs',
    description: '并排对比 2-3 个 eBL 提单的核心投资指标：发行价、预期收益率、风险等级、融资金额、收益风险比，帮助投资者做出选择',
    parameters: {
      type: 'object',
      properties: {
        case_ids: {
          type: 'array',
          items: { type: 'string' },
          description: '要对比的提单ID列表，例如 ["CASE-EBL-2026-0001", "CASE-EBL-2026-CU-SG-SHA"]'
        }
      },
      required: ['case_ids']
    }
  },
  {
    name: 'subscribeRWA',
    description: '投资者一键认购指定 eBL 发行池的 RWA 代币。需要先连接钱包（MetaMask），然后按当前发行价认购指定金额的 RWA 代币',
    parameters: {
      type: 'object',
      properties: {
        case_id: { type: 'string', description: '要认购的提单ID' },
        amount_usd: { type: 'number', description: '认购金额（美元），默认 5000' },
        payout_speed: { type: 'string', enum: ['FAST', 'BALANCED', 'SAFE'], description: '使用的定价速度，默认 BALANCED' }
      },
      required: ['case_id']
    }
  }
];

// ===========================================================================
// Tool 执行层 —— 对接 api.js / web3.js / store.js
// ===========================================================================

// 模块级状态：投资者持仓 & Agent 决策日志
const portfolio = [];         // [{ case_id, label, amount_usd, token_count, price, yield_bps, risk_level, subscribed_at }]
const agentDecisions = [];    // [{ id, timestamp, trigger, decision, reasoning, tx_hash, case_id }]

// 辅助：对提单逐一定价并返回带评分的列表
async function _scoreAllCases() {
  if (!state.cases?.length) state.cases = await api.getCases();
  const results = await Promise.all(state.cases.map(async (c) => {
    try {
      const comp = await api.compareSpeeds(c.case);
      const rec = comp.quotes?.find(q => q.payout_speed === comp.recommended_payout_speed)
               || comp.quotes?.[0];
      if (!rec) return null;
      return {
        caseEntry: c,
        caseData: c.case,
        quote: rec,
        comparison: comp,
        yieldBps: rec.implied_gross_yield_bps || 0,
        riskBps: rec.risk_score_bps || 0,
        riskLevel: rec.risk_level || 'UNKNOWN',
        price: rec.final_issue_price_usd || 0,
        financingUsd: rec.expected_cash_to_exporter_usd || rec.requested_cash_usd || 0,
        score: (rec.implied_gross_yield_bps || 0) / Math.max(rec.risk_score_bps || 1, 1)
      };
    } catch { return null; }
  }));
  return results.filter(Boolean);
}

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
        if (e.code === 'NO_WALLET') return '未检测到钱包。请先安装 MetaMask 或 OKX 浏览器扩展。';
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
      const modeLabel = result.mode === 'chain' ? '⛓️ Injective 测试网' : '🔬 模拟交易';

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
- 网络：${isReal ? 'Injective 测试网（合约已部署）' : 'Injective 测试网（模拟模式）'}
${isReal ? '- 可执行真实链上铸造' : '- 将使用模拟交易（合约未部署或未连接）'}`;
    }
    return `钱包未连接 ❌
- 需要安装浏览器钱包扩展（MetaMask / OKX 等）
- 连接后可执行链上 RWA 铸造`;
  },

  // ======================== 新增：投资者视角工具 ========================

  async recommendEBL(params) {
    if (!params.preference) return '请描述你的投资偏好，例如"收益高一些、风险中等"。';

    const all = await _scoreAllCases();
    if (!all.length) return '当前没有可投资的 eBL 提单。';

    let results = [...all];
    const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

    // 应用筛选
    if (params.risk_max) results = results.filter(r => riskOrder[r.riskLevel] <= riskOrder[params.risk_max]);
    if (params.yield_min) results = results.filter(r => r.yieldBps >= params.yield_min);
    if (params.commodity) {
      const kw = params.commodity.toLowerCase();
      results = results.filter(r =>
        (r.caseEntry.cargo || '').toLowerCase().includes(kw) ||
        (r.caseData?.bill_of_lading?.cargo || '').toLowerCase().includes(kw));
    }
    if (params.financing_max) results = results.filter(r => r.financingUsd <= params.financing_max);

    if (!results.length) return `没有找到完全匹配「${params.preference}」的提单。试试放宽条件？例如扩大风险接受范围或降低收益要求。`;

    // 排序
    if (params.sort_by === 'yield_desc') results.sort((a, b) => b.yieldBps - a.yieldBps);
    else if (params.sort_by === 'risk_asc') results.sort((a, b) => a.riskBps - b.riskBps);
    else results.sort((a, b) => b.score - a.score); // 默认收益风险比

    const top = results.slice(0, params.max_results || 3);
    const riskLabel = (lvl) => ({ LOW: '🟢 低风险', MEDIUM: '🟡 中风险', HIGH: '🟠 高风险', CRITICAL: '🔴 严重' })[lvl] || lvl;

    const lines = top.map((r, i) => {
      const stars = i === 0 ? ' ⭐ 首选推荐' : '';
      const bl = r.caseData?.bill_of_lading || {};
      return `${i + 1}. **${r.caseEntry.label}**${stars}
   - 路线：${r.caseEntry.route}
   - 货物：${bl.cargo || r.caseEntry.cargo || '未指定'} · ${bl.quantity_mt ? bl.quantity_mt + ' MT' : ''}
   - 发行价：$${Number(r.price).toFixed(2)} / 代币
   - 预期收益率：**${(r.yieldBps / 100).toFixed(2)}%**
   - 风险等级：${riskLabel(r.riskLevel)} (${r.riskBps} bps)
   - 融资金额：$${(r.financingUsd / 1e6).toFixed(2)}M
   - 收益风险比：${r.score.toFixed(2)}${i === 0 ? ' ← 同类最优' : ''}`;
    });

    const reasonText = params.risk_max
      ? `筛选条件：风险 ≤ ${params.risk_max}${params.yield_min ? '、收益 ≥ ' + (params.yield_min / 100).toFixed(1) + '%' : ''}`
      : `按"${params.preference}"综合排序`;

    return `**🔍 AI 推荐结果**（${reasonText}，共 ${results.length} 个匹配）\n\n${lines.join('\n\n')}\n\n💡 点击提单名称可查看详情，说「对比前两个」可并排比较。`;
  },

  async getPortfolio() {
    if (!portfolio.length) {
      return `📭 你还没有任何持仓。\n\n试试对我说「帮我推荐收益高、风险中等的提单」，让我帮你找到合适的投资标的。`;
    }

    const lines = portfolio.map((p, i) => {
      const riskEmoji = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴' }[p.risk_level] || '⚪';
      return `${i + 1}. **${p.label}**
   - 认购：${p.token_count} RWA × $${Number(p.price).toFixed(2)} = $${Number(p.amount_usd).toFixed(2)}
   - 预期收益：${(p.yield_bps / 100).toFixed(2)}% | 风险：${riskEmoji} ${p.risk_level}
   - 认购时间：${p.subscribed_at || '未知'}`;
    });

    const totalUsd = portfolio.reduce((s, p) => s + Number(p.amount_usd), 0);
    const avgYield = portfolio.length ? (portfolio.reduce((s, p) => s + p.yield_bps, 0) / portfolio.length / 100) : 0;

    return `**📊 我的持仓**（${portfolio.length} 个标的，总投入 $${totalUsd.toFixed(2)}）\n\n${lines.join('\n\n')}\n\n平均预期收益：**${avgYield.toFixed(2)}%** | 可对任意持仓说「查看状态」获取实时进展。`;
  },

  async getPoolStatus(params) {
    if (!params.case_id) return '请提供提单 ID。';
    if (!state.cases?.length) state.cases = await api.getCases();

    const entry = state.cases.find(c => c.case_id === params.case_id);
    if (!entry) return `未找到提单 ${params.case_id}。`;

    try {
      const comp = await api.compareSpeeds(entry.case);
      const rec = comp.quotes?.find(q => q.payout_speed === comp.recommended_payout_speed)
               || comp.quotes?.[0];
      if (!rec) return `未能获取 ${params.case_id} 的发行池数据。`;

      const riskLabel = (lvl) => ({ LOW: '🟢 低风险', MEDIUM: '🟡 中风险', HIGH: '🟠 高风险', CRITICAL: '🔴 严重' })[lvl] || lvl;
      const paused = ['PAUSE_OFFERING', 'FREEZE_POOL'].includes(rec.pricing_action);

      return `**📦 发行池状态：${params.case_id}**
- 提单：${entry.label}
- 路线：${entry.route}
- 当前发行价：$${Number(rec.final_issue_price_usd).toFixed(2)} / 代币
- 预期收益率：${(rec.implied_gross_yield_bps / 100).toFixed(2)}%
- 风险等级：${riskLabel(rec.risk_level)} (${rec.risk_score_bps} bps)
- 推荐到账速度：${comp.recommended_payout_speed || 'BALANCED'}
- 状态：${paused ? '⏸️ 暂停中' : '✅ 开放认购'} (${rec.pricing_action})
- 推荐代币供应量：${rec.recommended_token_supply || 'N/A'}
- AI 核验货值：$${Number(rec.ai_verified_collateral_value_usd || 0).toFixed(2)}${paused ? '\n\n⚠️ 该发行池当前暂停，可能是 AI 检测到风险升级。说「查看 Agent 活动」了解原因。' : '\n\n💡 说「认购 ' + params.case_id + '」即可投资。'}`;
    } catch (e) {
      return `查询发行池状态失败：${e.message}`;
    }
  },

  async getAgentActivity(params) {
    const limit = params.limit || 5;
    if (!agentDecisions.length) {
      // 模拟一些初始决策记录
      const now = new Date();
      const cases = state.cases?.length ? state.cases : [];
      if (cases.length) {
        agentDecisions.push({
          id: 'dec-001', timestamp: new Date(now - 3600000).toISOString(),
          trigger: 'eBL 上链事件', decision: 'OPEN_OFFERING',
          reasoning: `AI 交叉核验提单/发票/保险单通过。货物估值 $${(cases[0]?.case?.bill_of_lading?.declared_value_usd / 1e6 || 5).toFixed(1)}M。航线风险评估 MEDIUM。自动开盘。`,
          tx_hash: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
          case_id: cases[0]?.case_id || 'CASE-EBL-2026-0001'
        });
      }
      agentDecisions.push({
        id: 'dec-002', timestamp: new Date(now - 1800000).toISOString(),
        trigger: 'xAPI 检测地缘风险信号', decision: 'REPRICE_DOWN',
        reasoning: 'Strait of Hormuz 冲突升级警告。AI 上调航线风险从 215bps → 280bps。发行价自动下调 3%。',
        tx_hash: null, case_id: cases[0]?.case_id || 'CASE-EBL-2026-0001'
      });
      agentDecisions.push({
        id: 'dec-003', timestamp: new Date(now - 600000).toISOString(),
        trigger: '定时巡检 (5min)', decision: 'MONITORING',
        reasoning: '当前所有发行池状态正常。风险无变化。无需干预。',
        tx_hash: null, case_id: null
      });
    }

    const recent = agentDecisions.slice(-limit).reverse();
    const decisionIcon = { OPEN_OFFERING: '🟢 开盘', PAUSE_OFFERING: '⏸️ 暂停', REPRICE_DOWN: '📉 降价', REPRICE_UP: '📈 涨价', SETTLE: '✅ 结算', MONITORING: '👀 监控中' };

    const lines = recent.map(d => {
      const time = new Date(d.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const icon = decisionIcon[d.decision] || '🔧 ' + d.decision;
      return `**[${time}] ${icon}**
   触发：${d.trigger}
   决策：${d.reasoning.slice(0, 150)}${d.reasoning.length > 150 ? '...' : ''}
   ${d.tx_hash ? '链上交易：`' + d.tx_hash.slice(0, 18) + '...`' : ''}${d.case_id ? ' · ' + d.case_id : ''}`;
    });

    return `**🤖 自主 AI Agent 活动记录**（最近 ${recent.length} 条）\n\n${lines.join('\n\n')}\n\n💡 AI Agent 每 5 分钟巡检一次，检测到风险变化时自主决策并上链执行。所有决策可审计。`;
  },

  async compareEBLs(params) {
    const ids = params.case_ids || [];
    if (ids.length < 2) return '请至少提供 2 个提单 ID 进行对比。';
    if (ids.length > 3) return '最多同时对比 3 个提单。';

    const all = await _scoreAllCases();
    const selected = ids.map(id => all.find(s => s.caseEntry.case_id === id)).filter(Boolean);
    if (selected.length < 2) return '部分提单未找到或无法获取定价数据。';

    const riskLabel = (lvl) => ({ LOW: '🟢 低', MEDIUM: '🟡 中', HIGH: '🟠 高', CRITICAL: '🔴 严重' })[lvl] || lvl;
    const best = { yield: selected.reduce((b, s) => s.yieldBps > (b?.yieldBps || 0) ? s : b, null),
                   risk: selected.reduce((b, s) => s.riskBps < (b?.riskBps || Infinity) ? s : b, null),
                   score: selected.reduce((b, s) => s.score > (b?.score || 0) ? s : b, null) };

    const lines = selected.map((s, i) => {
      const tags = [];
      if (s === best.score) tags.push('⭐ 收益风险比最优');
      if (s === best.yield) tags.push('📈 收益最高');
      if (s === best.risk) tags.push('🛡️ 风险最低');
      const tagStr = tags.length ? '  ← ' + tags.join(' · ') : '';
      return `**${i + 1}. ${s.caseEntry.label}**${tagStr}
   | 发行价 | 收益 | 风险 | 融资金额 | 收益风险比 |
   | $${Number(s.price).toFixed(2)} | ${(s.yieldBps / 100).toFixed(2)}% | ${riskLabel(s.riskLevel)} (${s.riskBps}bps) | $${(s.financingUsd / 1e6).toFixed(2)}M | ${s.score.toFixed(2)} |`;
    });

    const recIdx = selected.indexOf(best.score);
    const recName = best.score?.caseEntry.label || '';

    return `**⚖️ eBL 对比分析**\n\n${lines.join('\n\n')}\n\n🏆 **推荐：${recName}** — 综合收益风险比最优（${best.score?.score.toFixed(2) || 'N/A'}）。\n说「查看 ${ids[recIdx]}」了解详情，或「认购」直接投资。`;
  },

  async subscribeRWA(params) {
    if (!params.case_id) return '请提供要认购的提单 ID。';
    if (!state.cases?.length) state.cases = await api.getCases();

    const entry = state.cases.find(c => c.case_id === params.case_id);
    if (!entry) return `未找到提单 ${params.case_id}。`;

    // 先获取定价
    let quote;
    try {
      const comp = await api.compareSpeeds(entry.case);
      const speed = params.payout_speed || comp.recommended_payout_speed || 'BALANCED';
      quote = comp.quotes?.find(q => q.payout_speed === speed) || comp.quotes?.[0];
      if (!quote) return `未能获取 ${params.case_id} 的当前发行价。`;
    } catch (e) {
      return `获取定价失败：${e.message}`;
    }

    const amountUsd = params.amount_usd || 5000;
    const tokenCount = Math.floor(amountUsd / Number(quote.final_issue_price_usd));
    if (tokenCount <= 0) return `认购金额 $${amountUsd} 不足以购买至少 1 枚 RWA 代币（当前发行价 $${Number(quote.final_issue_price_usd).toFixed(2)}）。请提高认购金额。`;

    // 检查钱包
    if (!web3.isWalletConnected()) {
      try {
        const { address } = await web3.connectWallet();
        state.wallet = { address };
      } catch (e) {
        if (e.code === 'NO_WALLET') return '未检测到钱包。请先安装 MetaMask 或 OKX 浏览器扩展。';
        if (e.code === 'REJECTED') return '用户拒绝了钱包连接请求。请重新尝试。';
        return `钱包连接失败：${e.message}`;
      }
    }

    // 记录认购到持仓
    const position = {
      case_id: params.case_id,
      label: entry.label,
      amount_usd: amountUsd,
      token_count: tokenCount,
      price: Number(quote.final_issue_price_usd),
      yield_bps: quote.implied_gross_yield_bps || 0,
      risk_level: quote.risk_level || 'UNKNOWN',
      subscribed_at: new Date().toISOString()
    };
    portfolio.push(position);

    // 记录 Agent 决策
    agentDecisions.push({
      id: 'dec-' + Date.now(),
      timestamp: new Date().toISOString(),
      trigger: '投资者认购',
      decision: 'SUBSCRIPTION',
      reasoning: `投资者认购 ${entry.label}：$${amountUsd} → ${tokenCount} RWA 代币，发行价 $${Number(quote.final_issue_price_usd).toFixed(2)}。`,
      tx_hash: null,
      case_id: params.case_id
    });

    return `**🎉 认购成功！**

- 提单：${entry.label}
- 认购金额：$${Number(amountUsd).toFixed(2)}
- 获得 RWA 代币：**${tokenCount} 枚**
- 发行价：$${Number(quote.final_issue_price_usd).toFixed(2)} / 代币
- 预期收益：${(position.yield_bps / 100).toFixed(2)}%
- 风险等级：${position.risk_level}

💡 已加入你的持仓。说「我的持仓」可以随时查看。进口商付款到港后合约将自动兑付。`;
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
      text: '👋 你好！我是 AgentBL 协议的 AI 助手。\n\nAgentBL 是一个 **Web3 原生贸易融资协议**：出口商 tokenize 电子提单，AI 定价航线风险，全球投资者直接投资。\n**没有银行。没有信用审核。没有中间人。**\n\n🔍 **投资者视角** — 说「帮我推荐收益高、风险中等的提单」试试 AI 智能推荐\n📊 **对比标的** — 说「对比前两个」并排比较\n💰 **一键认购** — 说「投 5000 美元」直接认购\n🛡️ **出口商视角** — 说「分析铜矿案例」执行 AI 定价\n\n试试对我说「推荐几个好标的」吧！'
    }];
    this._chatHistory.push({ role: 'assistant', content: this.messages[0].text });
  }

  get quickActions() {
    return [
      '🤖 推荐收益高风险中等的提单',
      '📊 对比所有可投标的',
      '💼 我的持仓',
      '🛡️ AI 最近有什么预警'
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
      el('h2', { class: 'pa-title', text: '◈ AgentBL AI 助手' }),
      el('button', { class: 'pa-close', text: '✕', onclick: () => self.close() })
    ));

    // Info bar
    dlg.append(el('div', { class: 'pa-info' },
      el('div', { class: 'pa-info-row' },
        el('span', { class: 'pa-dot' }),
        el('span', { class: 'pa-info-text', text: 'TRADESHIELD PROTOCOL · AI POWERED' })
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
      analyzeRisk: '🛡️', getWorldRisk: '🌍', mintRWA: '⛓️', searchKnowledge: '🔍', getWalletStatus: '🔑',
      recommendEBL: '🤖', getPortfolio: '💼', getPoolStatus: '📦', getAgentActivity: '📜',
      compareEBLs: '⚖️', subscribeRWA: '💳'
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
      getCases: '获取提单列表',
      selectCase: `加载提单 ${args.case_id || ''}`,
      analyzePricing: `定价分析 · ${args.payout_speed || 'BALANCED'}`,
      compareSpeeds: '对比三种到账速度',
      analyzeRisk: 'AI 风险评分分析',
      getWorldRisk: '获取实时世界风险情报',
      mintRWA: `tokenize eBL 上链${args.financing_usd ? ' · $' + args.financing_usd : ''}`,
      searchKnowledge: `搜索知识库：${args.query || ''}`,
      getWalletStatus: '查询钱包状态',
      recommendEBL: `AI 智能推荐：${args.preference || ''}`,
      getPortfolio: '查看我的持仓',
      getPoolStatus: `发行池状态：${args.case_id || ''}`,
      getAgentActivity: `AI 决策记录（最近 ${args.limit || 5} 条）`,
      compareEBLs: `对比 ${(args.case_ids || []).length || 0} 个提单`,
      subscribeRWA: `认购 RWA：${args.case_id || ''}${args.amount_usd ? ' · $' + args.amount_usd : ''}`
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
