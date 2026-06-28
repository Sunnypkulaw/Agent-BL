# AgentBL — AI 动态定价的 eBL-backed RWA 贸易融资协议

> 🎯 **5 秒理解：你的货在海上漂，钱还要等 45 天。谁来替你盯风险？AgentBL 的 AI 风控 Agent——在投资者下单之前就把风险定准价。**

---

## 一句话简介（推荐直接用）

AgentBL 是一个 AI 驱动的 eBL（电子提单）RWA 折价发行协议：出口商质押电子提单 → AI 审单/估值/风控/定价 → 投资者折价认购 → 链上强制执行。让 AI 承担真正的金融职责——不是聊天，是承保。

---

## 1. 背境与痛点

### 一个真实场景

新加坡港，500 吨铜阴极板装船发往上海。发票货值 450 万美元。出口商急需现金周转采购下一批原料——但按传统贸易融资，钱要 30-45 天才到账。

**全球贸易融资缺口高达 2.5 万亿美元。** 问题不是没钱——是风险看不准、定价不透明。

### 三个要命的链下风险

1. **单据欺诈**：eBL 写 500 吨、发票写 480 吨、保险只保了 300 万——三份文件对不上
2. **保险陷阱**：保单在到港前 3 天过期，战争除外条款让一切归零
3. **欺骗性信号**：战争爆发铜价涨了 → 只看价格的预言机以为"更安全"——完全看反

**谁在投资者下单之前，替他们把这些风险看准、定价？** 这就是 AgentBL 的全部答案。

---

## 2. 产品愿景与解决方案

### 主流程（白话版）

```
出口商质押电子提单
    → AI 审单反欺诈（交叉核验 eBL/发票/保险）
    → AI 估值（实时 LME 铜价 + UN Comtrade 历史成交 + 波动性 haircut）
    → AI 风险打分（战争/天气/港口/保险/价格波动 五维）
    → AI 定发行折价（要钱越急 + 风险越大 = 折价越深）
    → 投资者折价认购（如 $0.80 买，目标兑付 $1.00）
    → 链上 RiskPricingOracle 锚定决策 + 证据哈希
    → 航运途中风险升级 → AI 实时改价/暂停/清算
```

### 核心定价公式

```
出口商毛利 P = 发票货值 − 进货成本
融资成本   = share × P                                        ← 投资者赚的 = 出口商付出的
发行价     = 现金 / (现金 + share × P)                         ← $0.80 到 $0.89
share      = 到账速度份额 + 风险份额                           ← 两个杠杆驱动折价
```

### 为什么非有 AI 不可？

**钱在 Funded 那一刻就打给出口商了，货还在海上漂。事后改价保护不了已建仓的钱。** 那笔折价，是投资者唯一的、预付的风险补偿。而谁定这笔折价？AI——**在投资者认购之前。**

$1.00 是**目标兑付价，不是保本承诺。** 同一笔铜三种结局：
- ✅ 还款：$0.80 → $1.00，赚 25%
- ❌ 战争尾部违约：$0.80 → 只回收 $0.698，亏 12.8%
- 🟡 轻度违约：被超额抵押兜回本金

**那 $0.20 折价 = AI 为违约尾部预收的保费。**

---

## 3. 与赛题匹配及创新点

| 评判标准 | AgentBL 如何命中 |
|---------|----------------|
| **AI Agent × Blockchain** | AI 决定发行价/额度/链上动作——真正的金融 Agent，不是聊天框 |
| **安全 / Risk Agent** | 反欺诈审单（7 项交叉核验）+ 五维风险打分 + 战争溢价陷阱识别 |
| **可审计/可解释** | 每个折价挂证据来源 + 决策哈希上链 RiskPricingOracle |
| **链上存证** | Injective Testnet 已部署 AgentBLRWA + RiskPricingOracle + PaymentOracle |
| **x402 付费情报** | AI 自动支付解锁高级数据（HTTP 402 → EIP-3009 → 链上结算） |
| **MCP Server** | 7 个工具 + 3 个资源，可被 Claude Code / Cursor 直接接入 |
| **真实用例** | 铜/原油/铁矿石/橡胶/铝 9 个结构化案例，含 warcrisis 极端场景 |
| **测试覆盖** | 154 个 JS 测试 + 11 个 Solidity 测试 + preflight 赛前检查 |

---

## 4. 技术创新亮点

### 🤖 AI 审单反欺诈——价格预言机做不到的事

在定价前，AI 先做审单员的工作：**eBL / 商业发票 / 保险单三单交叉核验**：
- 数量是否一致（对不上 +250bps）
- 发票单价是否偏离市场（高开/低开发票 +150bps）
- 保险是否覆盖货值（不足额 +220bps）
- 保单是否在到港前过期（+120bps）
- Incoterms 是否一致

**每一个疑点折成风险基点，直接压低发行价。**

### 🔭 看穿欺骗性信号——战争溢价的"相关性双刃剑"

战争爆发时铜价上涨 → 价格预言机认为"抵押物更值钱" → **完全看反。**

AgentBL 的 AI 知道：
- 违约概率 ↑（进口商弃货）
- 保险失效（战争除外条款）
- 清算回收率 ↓
- **所有保护一起塌掉**

于是反向操作：货值 haircut 21%、风险 1410bps、**直接 PAUSE 暂停发行。**

### 💎 x402 付费情报——AI 为情报付费，链上存证

免费情报不够用时，AI 通过 x402 协议自动购买高级数据：
1. 请求付费端点 → HTTP 402 Payment Required
2. AI 自动签名 EIP-3009 TransferWithAuthorization
3. 链上结算 → PaymentOracle 记录支付证据
4. 高级情报解锁 → 流入定价引擎 → 价格可能因此改变

**完整闭环：付费→结算→存证→定价变化，每一步都可审计。**

### 🔗 MCP Server——AI Agent 的原生接口

7 个 MCP 工具（get_trade_case / generate_pricing_quote / simulate_offering / push_pricing_to_oracle / search_knowledge_base / assess_world_risk / fetch_premium_x402_intel）+ 3 个 Resources，可直接接入 Claude Code / Cursor。Agent 自然语言驱动机器支付——不需要人类按按钮。

---

## 5. 系统架构

```
前端 Dashboard (SPA)
    ↕ fetch (PricingQuote)
API Server (Node.js http)
    ↕
┌──────────────────────┬──────────────────────┐
│ AI 定价引擎           │ MCP / x402 / RAG      │
│ pricingEngine        │ 7 tools + 3 resources │
│ scoreRisk            │ HTTP 402 付费情报     │
│ offeringSimulator    │ 5 维风险情报检索      │
└──────────────────────┴──────────────────────┘
    ↕ quote_hash / evidence_hash
Injective Testnet 合约
├── AgentBLRWA (RWA 铸造)
├── RiskPricingOracle (定价存证)
├── PaymentOracle (x402 支付证据)
├── RWAOfferingPool (发行/认购/结算)
└── EBLRegistry (提单注册)
```

---

## 6. 快速开始

```bash
# 1. 安装
npm install

# 2. 启动
npm run dev
# → http://localhost:3000

# 3. 一键演示
npm run demo:once

# 4. 赛前全量检查
npm run preflight
```

**环境要求**：Node.js ≥ 18.18.0 · 现代浏览器 · **无需 API Key（离线 fallback 保证 demo 永远能跑）**

---

## 7. 演示命令清单

| 命令 | 什么效果 |
|------|---------|
| `npm run demo:once` | 🔥 一键 1 分钟完整闭环演示 |
| `npm run dev` | Web Dashboard（评委可互动） |
| `npm run demo:default` | 三种结算结局对比（赚/亏/回本） |
| `npm run agent:value` | AI 估值工具调用轨迹 |
| `npm run qa` | 评委 Q&A 彩排 |
| `npm run smoke:x402` | x402 付费情报全链路 |
| `npm run preflight` | 赛前全量检查（对标 hermes-pay） |

---

## 8. 合约地址（Injective Testnet）

| 合约 | 地址 |
|------|------|
| AgentBLRWA | `0x4a03B5707eEBFc88f56f6E6a99b5D98466B31c94` |
| RiskPricingOracle | 待部署 |
| PaymentOracle | 待部署 |

---

## 9. 一句话收束

> **普通 DeFi 让市场猜价格、让清算善后。AgentBL 让 AI 在投资者下单之前，把贸易欺诈和真实世界风险，定成一个可解释、可上链的 RWA 折价。**
>
> **AI 定价风险，链上强制执行。**
