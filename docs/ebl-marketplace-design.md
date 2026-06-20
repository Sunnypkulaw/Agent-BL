# eBL 淘宝式市场 + AI 智能推荐

> **设计目标**：将 TradeShield 的电子提单（eBL）浏览体验从「实验室开关」升级为「淘宝式产品市场」——卡片化展示、多维度筛选、自然语言 AI 推荐，降低投资决策门槛。
>
> **关联赛题**：[Injective 新星计划 gap analysis](./injective-hackathon-gap-analysis.md) — 方向四（供应链金融产品化）、方向六（前端产品化）、5.3（AI 融资顾问）、5.4（AI 对话界面）
>
> **设计日期**：2026-06-20

---

## 一、问题与机会

### 1.1 当前状态

```
┌─────────────────────────────────────────────────┐
│  [铜矿·新加坡→上海] [铜矿·上海→汉堡]              │
│  [原油·新加坡→蔚山] [战争危机]                    │  ← 顶部 pill-button，一次只能看一个
└─────────────────────────────────────────────────┘
```

- 仅 4 个硬编码案例，通过顶部 `seg-btn` 切换
- 用户无法一次性浏览所有可投资的 eBL
- 没有筛选、排序、对比能力
- AI 助手（popup-assistant）独立浮窗，与案例浏览脱节

### 1.2 目标体验

```
┌──────────────────────────────────────────────────┐
│  🤖 "我希望收益高一些，风险最好在中等"  [搜索]      │  ← AI 自然语言搜索栏
├──────────────────────────────────────────────────┤
│  分类: [全部] [铜矿] [原油] [农产品]               │
│  风险: [🟢 低] [🟡 中] [🟠 高]                    │  ← 快捷筛选标签
│  排序: 推荐优先 | 收益↑ | 风险↓ | 金额↑             │
├──────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 🚢 铜矿  │ │ 🛢️ 原油  │ │ 🚢 铜矿  │  ...     │  ← 商品卡片网格
│  │ 收益8.5% │ │ 收益6.2% │ │ 收益12%  │          │
│  │ 风险🟡中 │ │ 风险🟢低 │ │ 风险🔴高 │          │
│  │ $0.87/枚 │ │ $0.93/枚 │ │ $0.72/枚 │          │
│  └──────────┘ └──────────┘ └──────────┘          │
└──────────────────────────────────────────────────┘
```

---

## 二、功能设计

### 2.1 AI 自然语言搜索栏

**交互方式**：

```
┌──────────────────────────────────────────────────────┐
│  🤖  请输入你的投资偏好…                              │  ← 主搜索栏
│  ─────────────────────────────────────────────────── │
│  💡 试试这样说：                                      │
│  · "收益高一点，风险不要太大"                          │
│  · "只看铜矿的提单"                                   │
│  · "金额在 200 万以内，风险低的"                       │
│  · "最近新加坡出发的航线"                              │
└──────────────────────────────────────────────────────┘
```

**处理流程**：

```
用户输入 NL 描述
    │
    ▼
┌─────────────────────┐
│ DeepSeek Function   │  ← 复用 popup-assistant.js 的 DeepSeekClient
│ Calling             │
│                     │
│ tool: recommendEBL  │  ← 新增工具
│   preference: "..." │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 结构化偏好提取       │  AI 从 NL 中提取：
│                     │  · risk_max: "MEDIUM"
│                     │  · yield_min: 5%
│                     │  · commodity: null
│                     │  · financing_max: null
│                     │  · sort_by: "risk_adjusted_yield"
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 逐单评分 + 排序      │  对 state.cases 中每单：
│                     │  1. 调用 /api/pricing/quote
│                     │  2. 计算「收益/风险比」
│                     │  3. 按偏好过滤
│                     │  4. 按分数排序
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 返回 Top N + 理由    │  渲染推荐卡片 + AI 解释文本
│                     │  "推荐铜矿·新加坡→上海：
│                     │   收益 8.53%，风险 MEDIUM，
│                     │   在中等风险中收益最高"
└─────────────────────┘
```

### 2.2 分类筛选栏

**筛选维度**：

| 筛选器 | 交互形式 | 数据字段 | 示例 |
|--------|---------|---------|------|
| 货物类型 | 标签选择（多选） | `bill_of_lading.cargo` | 铜矿、原油、农产品 |
| 风险等级 | 彩色标签（多选） | `risk_level` | 🟢LOW 🟡MEDIUM 🟠HIGH 🔴CRITICAL |
| 航线区域 | 下拉搜索 | `port_of_loading` → `port_of_discharge` | 新加坡出发、到上海 |
| 收益率范围 | 双滑块 | `implied_gross_yield_bps` | 5% – 12% |
| 融资金额 | 双滑块 | `financing.requested_cash_usd` | $1M – $5M |
| 发行价范围 | 双滑块 | `final_issue_price_usd` | $0.60 – $0.95 |
| 到账速度 | 单选标签 | `payout_speed` | FAST / BALANCED / SAFE |

**筛选器状态管理**：

```javascript
// 全局筛选状态
const filterState = {
  commodity: [],          // 货物类型多选
  riskLevel: [],          // 风险等级多选
  routeKeyword: '',       // 航线关键词
  yieldRange: [0, 15],    // 收益率范围 (%)
  financingRange: [0, 10000000], // 融资金额范围
  priceRange: [0, 1],     // 发行价范围
  payoutSpeed: null,      // 到账速度
  sortBy: 'recommended',  // 排序方式
  aiPreference: '',       // AI 自然语言偏好（优先级最高）
};
```

### 2.3 商品卡片设计

```
┌─────────────────────────────────────────┐
│                                         │
│  🚢 铜矿 · 新加坡 → 上海                 │  ← 标题行
│  ─────────────────────────────────────── │
│                                         │
│  📦 铜阴极 LME Grade A                   │  ← 货物详情
│     500 MT · EBL-2026-CU-04417          │
│                                         │
│  ┌──────────┬──────────┬──────────┐     │
│  │ 发行价   │ 预期收益  │ 风险等级  │     │  ← 核心指标三列
│  │ $0.87   │ 8.53%   │ 🟡 MEDIUM│     │
│  └──────────┴──────────┴──────────┘     │
│                                         │
│  💰 融资 $3,300,000 · ⚡ FAST 到账       │  ← 辅助信息
│                                         │
│  ⭐ AI: 收益风险比最优                    │  ← AI 推荐标签（如有）
│                                         │
│  [ 查看详情 ]    [ ⛓ 一键铸造 ]          │  ← 操作按钮
│                                         │
└─────────────────────────────────────────┘
```

**卡片状态变体**：

| 状态 | 视觉区别 | 触发条件 |
|------|---------|---------|
| 普通 | 默认样式 | 正常可投资 |
| AI 推荐 | 蓝色边框 + ⭐ 角标 | AI 推荐结果中排名靠前 |
| 已暂停 | 灰色遮罩 + 暂停图标 | `pricing_action = PAUSE_OFFERING` |
| 高风险 | 橙色边框 | `risk_level = CRITICAL` |
| 已售罄 | 半透明 | 认购完成 |

### 2.4 排序方式

| 排序选项 | 计算方式 | 适用场景 |
|---------|---------|---------|
| 🤖 推荐优先 | AI 综合评分（默认） | 用户输入 NL 描述后 |
| 📈 收益从高到低 | `implied_gross_yield_bps DESC` | 追求高收益 |
| 🛡️ 风险从低到高 | `risk_score_bps ASC` | 保守型投资者 |
| 💰 金额从大到小 | `requested_cash_usd DESC` | 大资金偏好 |
| 🏷️ 发行价从低到高 | `final_issue_price_usd ASC` | 抄底思维 |
| 📅 最新发布 | `issue_date DESC` | 看新货 |

---

## 三、技术实现

### 3.1 新增文件

```
AgentBL/
├── public/
│   ├── market.js          ← 新增：eBL 市场页面主逻辑
│   ├── market.css          ← 新增：市场页样式（或合入 styles.css）
│   ├── popup-assistant.js  ← 修改：新增 recommendEBL 工具
│   └── app.js              ← 修改：新增 View ⓪ 路由 + market 导入
│
└── docs/
    └── ebl-marketplace-design.md  ← 本文档
```

### 3.2 market.js 核心结构

```javascript
// public/market.js — eBL 淘宝式市场

import { state } from './store.js';
import { $, el, clear, toast } from './dom.js';
import * as api from './api.js';
import * as f from './format.js';
import { t } from './i18n.js';

// ==================== 筛选状态 ====================
const filter = {
  commodity: [],
  riskLevel: [],
  routeKeyword: '',
  yieldRange: [0, 15],
  financingRange: [0, 10_000_000],
  priceRange: [0, 1],
  payoutSpeed: null,
  sortBy: 'recommended',
  aiPreference: '',
};

// ==================== 数据缓存 ====================
let allQuotes = [];     // { case, quote }[]
let filteredQuotes = [];

// ==================== 渲染函数 ====================

/** 渲染 AI 搜索栏 */
function renderSearchBar(container) { /* ... */ }

/** 渲染分类/筛选标签 */
function renderFilterBar(container) { /* ... */ }

/** 渲染排序选择器 */
function renderSortSelector(container) { /* ... */ }

/** 渲染商品卡片网格 */
function renderCardGrid(container, quotes) { /* ... */ }

/** 渲染单张 eBL 卡片 */
function renderCard(container, item, index) { /* ... */ }

/** 渲染 AI 推荐横幅 */
function renderAiBanner(container, preference, results) { /* ... */ }

// ==================== 筛选逻辑 ====================

/** 应用全部筛选条件 */
function applyFilters() {
  let result = [...allQuotes];

  // 货物类型筛选
  if (filter.commodity.length) {
    result = result.filter(item => {
      const cargo = item.case?.bill_of_lading?.cargo || '';
      return filter.commodity.some(c => cargo.toLowerCase().includes(c.toLowerCase()));
    });
  }

  // 风险等级筛选
  if (filter.riskLevel.length) {
    result = result.filter(item =>
      filter.riskLevel.includes(item.quote?.risk_level));
  }

  // 航线关键词
  if (filter.routeKeyword) {
    const kw = filter.routeKeyword.toLowerCase();
    result = result.filter(item => {
      const route = item.case?.route || '';
      return route.toLowerCase().includes(kw);
    });
  }

  // 收益率范围
  result = result.filter(item => {
    const y = (item.quote?.implied_gross_yield_bps || 0) / 100;
    return y >= filter.yieldRange[0] && y <= filter.yieldRange[1];
  });

  // 融资金额范围
  result = result.filter(item => {
    const amt = item.quote?.requested_cash_usd
             || item.quote?.expected_cash_to_exporter_usd || 0;
    return amt >= filter.financingRange[0] && amt <= filter.financingRange[1];
  });

  // 排序
  result.sort(getSortFn(filter.sortBy));

  filteredQuotes = result;
  return result;
}

/** 获取排序函数 */
function getSortFn(sortBy) {
  switch (sortBy) {
    case 'yield_desc':
      return (a, b) => (b.quote?.implied_gross_yield_bps || 0) - (a.quote?.implied_gross_yield_bps || 0);
    case 'risk_asc':
      return (a, b) => (a.quote?.risk_score_bps || 0) - (b.quote?.risk_score_bps || 0);
    case 'amount_desc':
      return (a, b) => (b.quote?.requested_cash_usd || 0) - (a.quote?.requested_cash_usd || 0);
    case 'price_asc':
      return (a, b) => (a.quote?.final_issue_price_usd || 0) - (b.quote?.final_issue_price_usd || 0);
    case 'recommended':
    default:
      // 默认按收益风险比排序
      return (a, b) => {
        const scoreA = (a.quote?.implied_gross_yield_bps || 0) / Math.max(a.quote?.risk_score_bps || 1, 1);
        const scoreB = (b.quote?.implied_gross_yield_bps || 0) / Math.max(b.quote?.risk_score_bps || 1, 1);
        return scoreB - scoreA;
      };
  }
}

// ==================== AI 推荐 ====================

/** 处理 AI 自然语言搜索 */
async function handleAiSearch(preference) {
  if (!preference.trim()) return;

  filter.aiPreference = preference;

  // 方案 A：通过 popup-assistant 的 DeepSeek 客户端
  // 方案 B：纯前端关键词解析（离线 fallback）
  const parsed = parsePreferenceOffline(preference);
  applyParsedPreference(parsed);
  refreshMarket();

  // 异步获取 AI 精排
  try {
    const aiResults = await callAiRecommend(preference);
    if (aiResults) renderAiBanner($('#ai-banner'), preference, aiResults);
  } catch { /* AI 不可用时静默回退 */ }
}

/** 离线关键词解析（AI 不可用时的 fallback） */
function parsePreferenceOffline(text) {
  const result = {};

  // 风险偏好
  if (/低风险|风险低|风险不要大|稳健|保守/.test(text)) result.riskMax = 'LOW';
  else if (/中等风险|风险中等|风险不是那么高/.test(text)) result.riskMax = 'MEDIUM';
  else if (/高风险|风险高|激进/.test(text)) result.riskMax = 'HIGH';

  // 收益偏好
  const yieldMatch = text.match(/收益[高>]*(\d+)/);
  if (yieldMatch) result.yieldMin = parseInt(yieldMatch[1]);
  else if (/收益高|高收益|高回报/.test(text)) result.yieldMin = 7;

  // 货物类型
  if (/铜/.test(text)) result.commodity = '铜';
  else if (/原油|石油/.test(text)) result.commodity = '原油';
  else if (/农产品|大豆|小麦/.test(text)) result.commodity = '农产品';

  // 金额限制
  const amtMatch = text.match(/(\d+)\s*万/);
  if (amtMatch) result.financingMax = parseInt(amtMatch[1]) * 10000;

  // 排序
  if (/收益|回报/.test(text) && !/风险/.test(text)) result.sortBy = 'yield_desc';
  else if (/安全|保守|稳健/.test(text)) result.sortBy = 'risk_asc';

  return result;
}

// ==================== 市场初始化 ====================

/** 加载所有 eBL 的定价数据 */
async function loadAllQuotes() {
  if (!state.cases?.length) {
    state.cases = await api.getCases();
  }

  const results = await Promise.all(
    state.cases.map(async (c) => {
      try {
        const comp = await api.compareSpeeds(c.case);
        const quote = comp.quotes?.find(q => q.payout_speed === comp.recommended_payout_speed)
                   || comp.quotes?.[0];
        if (!quote) return null;
        return { case: c, quote, comparison: comp };
      } catch { return null; }
    })
  );

  allQuotes = results.filter(Boolean);
  return allQuotes;
}

/** 刷新市场视图 */
function refreshMarket() {
  const results = applyFilters();
  renderCardGrid($('#market-grid'), results);
  updateFilterCounts();
}

/** 初始化市场页 */
export async function initMarket() {
  // TODO: 渲染页面骨架
}
```

### 3.3 popup-assistant.js 扩展

新增 `recommendEBL` 工具和对应用执行器：

```javascript
// TOOLS 数组中追加
{
  name: 'recommendEBL',
  description: '根据用户的投资偏好（收益、风险、货物类型、航线、金额等），从可用 eBL 提单中智能推荐最匹配的。返回排序过滤后的推荐列表和每个提单的关键指标。',
  parameters: {
    type: 'object',
    properties: {
      preference: {
        type: 'string',
        description: '用户的自然语言偏好描述'
      },
      risk_max: {
        type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        description: '可接受最高风险等级'
      },
      yield_min: {
        type: 'number',
        description: '最低预期收益率 (bps)，例如 500 表示 5%'
      },
      commodity: {
        type: 'string',
        description: '货物类型关键词'
      },
      financing_max: {
        type: 'number',
        description: '最高融资金额 (USD)'
      },
      sort_by: {
        type: 'string',
        enum: ['yield_desc', 'risk_asc', 'score'],
        description: '排序方式'
      },
      max_results: {
        type: 'number',
        description: '最多返回结果数，默认 3'
      }
    },
    required: ['preference']
  }
}
```

```javascript
// toolExecutors 中新增
async recommendEBL(params) {
  if (!state.cases?.length) state.cases = await api.getCases();
  if (!state.cases?.length) return '暂无可用提单。';

  // 逐单获取定价
  const scored = (await Promise.all(state.cases.map(async (c) => {
    try {
      const comp = await api.compareSpeeds(c.case);
      const rec = comp.quotes?.find(q => q.payout_speed === comp.recommended_payout_speed)
               || comp.quotes?.[0];
      if (!rec) return null;
      return {
        case: c,
        quote: rec,
        yieldBps: rec.implied_gross_yield_bps,
        riskBps: rec.risk_score_bps,
        riskLevel: rec.risk_level,
        price: rec.final_issue_price_usd,
        financingUsd: rec.expected_cash_to_exporter_usd || rec.requested_cash_usd,
        score: rec.implied_gross_yield_bps / Math.max(rec.risk_score_bps, 1)
      };
    } catch { return null; }
  }))).filter(Boolean);

  // 筛选
  let results = scored;
  const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  if (params.risk_max) results = results.filter(r => riskOrder[r.riskLevel] <= riskOrder[params.risk_max]);
  if (params.yield_min) results = results.filter(r => r.yieldBps >= params.yield_min);
  if (params.commodity) {
    const kw = params.commodity.toLowerCase();
    results = results.filter(r =>
      (r.case.cargo || '').toLowerCase().includes(kw) ||
      (r.case.case?.bill_of_lading?.cargo || '').toLowerCase().includes(kw));
  }
  if (params.financing_max) results = results.filter(r => r.financingUsd <= params.financing_max);

  // 排序
  if (params.sort_by === 'yield_desc') results.sort((a, b) => b.yieldBps - a.yieldBps);
  else if (params.sort_by === 'risk_asc') results.sort((a, b) => a.riskBps - b.riskBps);
  else results.sort((a, b) => b.score - a.score);

  const top = results.slice(0, params.max_results || 3);
  if (!top.length) return '没有找到符合你条件的提单，试试放宽筛选条件？';

  return top.map((r, i) => {
    const stars = i === 0 ? ' ⭐ 首选推荐' : '';
    return `${i + 1}. **${r.case.label}**${stars}
   - 发行价: $${Number(r.price).toFixed(2)} | 收益率: ${(r.yieldBps / 100).toFixed(2)}%
   - 风险: ${r.riskLevel} (${r.riskBps} bps) | 收益风险比: ${r.score.toFixed(2)}
   - 路线: ${r.case.route} | 融资金额: $${(r.financingUsd / 1e6).toFixed(2)}M`;
  }).join('\n\n');
}
```

### 3.4 app.js 路由扩展

```javascript
// app.js 新增 View ⓪ 路由

import { initMarket, renderMarket, refreshMarket } from './market.js';

// setView() 中追加
function setView(name) {
  state.view = name;
  // ... existing logic ...

  $('#view-market').hidden = name !== 'market';
  $('#view-mint').hidden = name !== 'mint';
  $('#view-voyage').hidden = name !== 'voyage';

  if (name === 'market') renderMarket();
  // ...
}

// boot() 中追加
async function boot() {
  // ... existing ...
  initMarket();     // 预加载市场数据
}
```

### 3.5 index.html 新增 View

```html
<!-- View ⓪ — eBL 市场（新增） -->
<section class="view" id="view-market">
  <!-- AI 搜索横幅 -->
  <section class="panel market-search-panel">
    <div class="ai-search-bar">
      <span class="ai-search-icon">🤖</span>
      <input id="ai-search-input"
             class="ai-search-input"
             type="text"
             placeholder="用自然语言描述你的投资偏好…例如：收益高一些、风险中等"
             data-i18n-ph="ai_search_ph" />
      <button id="ai-search-btn" class="btn ai-search-btn">AI 推荐</button>
    </div>
    <div class="ai-search-hints" id="ai-hints">
      <span class="hint-label">💡 试试：</span>
      <button class="hint-chip">收益高但风险可控</button>
      <button class="hint-chip">只看铜矿提单</button>
      <button class="hint-chip">200万以内低风险</button>
    </div>
    <div id="ai-banner" class="ai-banner" hidden></div>
  </section>

  <!-- 筛选栏 -->
  <section class="panel filter-panel">
    <div class="filter-row">
      <!-- 货物类型 -->
      <div class="filter-group">
        <label>货物类型</label>
        <div id="filter-commodity" class="chip-group"></div>
      </div>
      <!-- 风险等级 -->
      <div class="filter-group">
        <label>风险等级</label>
        <div id="filter-risk" class="chip-group"></div>
      </div>
      <!-- 到账速度 -->
      <div class="filter-group">
        <label>到账速度</label>
        <div id="filter-speed" class="chip-group"></div>
      </div>
      <!-- 排序 -->
      <div class="filter-group">
        <label>排序</label>
        <select id="filter-sort" class="filter-select"></select>
      </div>
    </div>
    <!-- 高级筛选（可折叠） -->
    <div class="filter-advanced" id="filter-advanced" hidden>
      <div class="range-group">
        <label>收益率范围</label>
        <input type="range" id="range-yield-min" min="0" max="15" value="0" />
        <input type="range" id="range-yield-max" min="0" max="15" value="15" />
        <span id="range-yield-label">0% – 15%</span>
      </div>
      <div class="range-group">
        <label>融资金额范围</label>
        <input type="range" id="range-financing-min" min="0" max="10" step="0.5" value="0" />
        <input type="range" id="range-financing-max" min="0" max="10" step="0.5" value="10" />
        <span id="range-financing-label">$0M – $10M</span>
      </div>
    </div>
    <button id="filter-toggle" class="btn ghost sm">高级筛选 ▾</button>
  </section>

  <!-- 卡片网格 -->
  <section class="panel market-grid-panel">
    <div class="market-stats">
      <span id="market-count">共 0 个提单</span>
      <button id="market-reset" class="btn ghost sm">清除筛选</button>
    </div>
    <div id="market-grid" class="market-grid"></div>
    <div id="market-empty" class="market-empty" hidden>
      <span class="empty-icon">📭</span>
      <p>没有找到符合条件提单</p>
      <button class="btn ghost" onclick="resetAllFilters()">清除所有筛选</button>
    </div>
  </section>
</section>
```

---

## 四、AI 推荐 Prompt 设计

### 4.1 System Prompt 扩展

在 popup-assistant.js 的 `SYSTEM_PROMPT` 中追加市场推荐相关指令：

```
## eBL 市场推荐能力
你可以调用 recommendEBL 工具来为用户推荐合适的提单投资标的。
推荐时应：
- 理解用户的偏好表述（收益、风险、货物、金额等）
- 优先推荐收益风险比最优的提单
- 给出明确的推荐理由（为什么这个提单适合用户）
- 如果用户没有明确偏好，默认推荐风险 MEDIUM 以下、收益 5% 以上的提单
- 推荐时突出关键指标：发行价、收益率、风险等级、融资金额
```

### 4.2 推荐理由生成示例

| 用户输入 | AI 解析 | 推荐结果 |
|---------|--------|---------|
| "收益高一些，风险别太大" | risk_max=MEDIUM, sort=score | 铜矿·新加坡→上海（收益8.5%/风险MEDIUM/收益风险比最高） |
| "我就看铜矿的" | commodity=铜矿 | 两个铜矿提单，按收益排序 |
| "200万以内，安全的" | financing_max=2M, risk_max=LOW | 过滤后推荐原油·新加坡→蔚山 |
| "性价比最高的" | sort=score（默认） | 综合排序 Top 3 |

---

## 五、实现计划

### 5.1 分步开发

| 步骤 | 文件 | 内容 | 预估 |
|------|------|------|------|
| **Step 1** | `market.js` | 市场页面骨架：卡片网格 + 基础筛选 + 排序 | 半天 |
| **Step 2** | `styles.css` | 卡片样式 + 筛选栏样式 + AI 搜索栏 | 半天 |
| **Step 3** | `app.js` + `index.html` | View ⓪ 路由 + HTML 结构 + 导航栏新增入口 | 半天 |
| **Step 4** | `popup-assistant.js` | 新增 `recommendEBL` 工具 + 执行器 + Prompt | 1 天 |
| **Step 5** | `market.js` | AI 搜索联动：输入→AI解析→筛选→排序→渲染 | 半天 |
| **Step 6** | `i18n.js` | 市场页双语文案 | 半天 |

**总计：约 2–3 天**

### 5.2 与现有功能的关系

```
                   ┌────────────────────────┐
                   │     View ⓪ eBL 市场     │  ← 新增：浏览 + 筛选 + AI 推荐
                   └──────────┬─────────────┘
                              │ 点击「查看详情」
                              ▼
                   ┌────────────────────────┐
                   │  View ① 提单上链·铸造    │  ← 已有：详情 + 定价 + 铸造
                   └──────────┬─────────────┘
                              │ 点击「航运追踪」
                              ▼
                   ┌────────────────────────┐
                   │ View ② 航运追踪·实时定价 │  ← 已有：在途事件 + 重定价
                   └────────────────────────┘

        ┌──────────────────────────────────────┐
        │      popup-assistant.js              │  ← 已有 + 扩展
        │  · getCases / selectCase / ...       │
        │  · recommendEBL  ← 新增              │
        └──────────────────────────────────────┘
```

---

## 六、与 Injective 赛题的契合点

| 赛题方向 | 本项目直接贡献 |
|----------|---------------|
| **方向四 · 4.1 多参与方角色** | eBL 市场天然服务「投资者」角色，展示所有可投标的 |
| **方向四 · 4.2 融资产品矩阵** | 每个 eBL 卡片 = 一个产品，卡片网格 = 产品货架 |
| **方向六 · 6.1 新增页面** | View ⓪「eBL 市场」入口页，可直接作为 demo 首页 |
| **5.3 AI 融资顾问** | NL→结构化偏好→筛选排序→推荐理由 全链路 |
| **5.4 AI 对话界面** | AI 搜索栏嵌入市场页，上下文感知当前浏览 |
| **方向二 · 自主 AI Agent** | 未来可扩展为 Agent 自动推荐 + 定期推送 |

---

## 七、后续扩展方向

1. **用户个性化**：记录用户历史浏览/投资行为，推荐更精准
2. **对比模式**：选中 2-3 个提单并排对比关键指标
3. **价格走势图**：卡片内嵌入近期发行价曲线
4. **订阅通知**：符合条件的新 eBL 上线时推送
5. **社交证明**："已有 N 位投资者关注"热度标签
6. **AR 展示**：扫描提单二维码看到货物实时位置（配合 View ② 航运地图）
