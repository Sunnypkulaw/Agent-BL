# TradeShield Agent 拿奖路线与能力规划

这份文档回答一个问题：如果 TradeShield 不只是准备仓库，而是要在黑客松里冲奖，下一步应该补哪些任务、给 AI 什么能力、合约做到什么程度，以及 Harness 如何保证所有人没有跑偏。

当前主线：**AI 动态定价的 eBL-backed RWA 折价发行协议**（见 `docs/PRD.md` v0.2）。本文已对齐该模型——早期版本把项目讲成"RiskReport 风控 + 资金池放贷"，现在的核心是 **AI 决定 RWA 的发行折价**。

## 1. 最有竞争力的项目定位

推荐主叙事：

> TradeShield 把电子提单变成一个由 AI 动态定价的 RWA 折价发行池：AI Pricing & Risk Agent 把"出口商到账速度 + 货物估值 + 运输/天气/战争/保险/市场风险"折算成一个 RWA 发行折价，写入链上 RiskPricingOracle，RWAOfferingPool 据此开盘、改价、暂停或清算。

不要把项目讲成"又一个 RWA 融资 dApp"，也不要讲成"AI 写风险报告"。评委更想看到：

1. **AI 真正承担金融功能**：它不是打分或解释，而是决定发行价、发行额度和合约动作。
2. **折价可解释、可审计**：`final = base − urgency_discount − risk_discount`，每个折扣都有证据。
3. **合约不是摆设**：用 PricingQuote 改变真实状态机（Open → Repriced → Paused）。
4. **eBL 是核心 collateral primitive**：可转让单据 / 货权凭证，不是泛泛提法。
5. **知道合规边界**：permissioned、合格投资者、不公开募资、`1 RWA = 1 USD` 是目标兑付价而非保本。

## 2. 必须新增的任务

### P0：拿奖主链路

| ID | 任务 | 产物 | 验证 |
|---|---|---|---|
| P0-1 | 固定 `TradeCase` / `PricingQuote` / `OfferingState` schema | `src/core/schema.js` | `npm run check` / `npm run test` |
| P0-2 | 实现定价引擎：base price（按到账速度）+ urgency/risk discount | `src/core/pricingEngine.js` | pricing unit test |
| P0-3 | 实现 collateral coverage guardrail（兑付敞口 ≤ 安全覆盖） | pricing invariant test | `npm run test` |
| P0-4 | 增加定价多场景 fixtures（fast / balanced / high-risk reprice） | `data/scenarios/*.json` | `npm run scenarios` |
| P0-5 | 打通 `/api/pricing/quote` 和 `/api/offering/simulate` | `src/app/server.js` | `npm run smoke` |
| P0-6 | 实现 Solidity 两件套：`RWAOfferingPool` / `RiskPricingOracle` | contracts | `hardhat test` |
| P0-7 | PricingQuote `quote_hash` / `evidence_hash` 写入 RiskPricingOracle | contract event + ABI | `hardhat test` |
| P0-8 | 前端展示"AI 折价定价 → 链上改价"（Investor RWA Offering 页面） | timeline + event | 手动演示 |

### P1：AI Agent 能力

| ID | 任务 | 说明 | 验证 |
|---|---|---|---|
| AI-A | 估值 tool calling（实时行情 + 历史同类成交价 + 本地估值） | 已有示例 `src/agent/`，见 `docs/ai-valuation-tooling.md` | `npm run agent:value` |
| AI-B | Document consistency checker | eBL、商业发票、保险、融资请求字段一致性 | fixture test |
| AI-C | Pricing explanation generator | LLM 只生成投资者可读解释，不决定折价数字 | schema test |
| AI-D | Pricing policy guardrail | LLM 输出必须符合 PricingQuote schema，失败回退 deterministic 引擎 | provider fallback test |
| AI-E | RAG evidence retriever | 从团队文档、规则、合约 ABI、宏观风险 mock 中检索定价依据 | retrieval eval |
| AI-F | Judge Q&A assistant | 回答合规、eBL、定价模型、合约状态机问题 | demo rehearsal |

### P2：MCP / Skill

建议做一个轻量 MCP server，而不是为了"用了 MCP"而做。MCP 工具应该服务定价主链路：

| Tool | 输入 | 输出 | 用途 |
|---|---|---|---|
| `get_trade_case` | `case_id` | TradeCase JSON | 让 Agent 获取标准 case |
| `verify_document_bundle` | TradeCase | consistency findings | eBL / invoice / insurance 一致性 |
| `value_cargo` | TradeCase | 市场估值 + 历史同类成交价 | 估值地基（已有 tool calling 示例） |
| `generate_pricing_quote` | TradeCase + payout_speed | PricingQuote | 统一定价结果 |
| `simulate_offering` | PricingQuote | offering state result | 展示发行 / 改价 / 暂停 |
| `push_pricing_to_oracle` | PricingQuote | tx hash / mock receipt | 连接 RiskPricingOracle |
| `retrieve_trade_policy` | query | cited snippets | RAG 依据检索 |

Skill 建议只做 2 个：

1. `tradeshield-pricing-analyst`：固定审单 → 估值 → 折价定价 → 投资者解释的输出流程。
2. `tradeshield-demo-operator`：演示时按剧本运行 scenario、合约交易、Q&A。

### P3：RAG

RAG 的价值不是让 Agent 胡乱查资料，而是让它在评委追问时能引用团队规则和行业背景。

建议知识库只放：

1. `docs/background.md`
2. `docs/PRD.md`
3. `docs/award-roadmap.md`
4. `docs/ai-valuation-tooling.md`
5. 合约 ABI / NatSpec
6. 定价规则说明（base price / urgency / risk discount / coverage limit）
7. eBL / MLETR / DCSA / ICC DSI 的精简背景笔记

RAG 评测要小而硬：

| Query | 期望 |
|---|---|
| 为什么 eBL 可以作为 RWA 抵押物？ | 能解释可转让单据 / 货权凭证逻辑 |
| 为什么发行价是 0.85 不是 0.95？ | 能拆出 base / urgency / risk discount |
| 为什么 AI 输出能触发合约改价？ | 能指出 PricingQuote schema 和 RiskPricingOracle |
| 战争 / 保险快过期怎么影响价格？ | 能映射到 risk_discount 和 pricing_action |

## 3. 最小合约两件套

聚焦"AI 折价 → 链上发行"，不要一开始做复杂 NFT 市场或 AMM。

### 3.1 RiskPricingOracle

目的：让 AI 的 PricingQuote 变成链上可审计事件。

最小函数：

```solidity
function updatePricing(
    uint256 poolId,
    uint256 issuePriceE6,        // final issue price，6 位精度（0.85 = 850000）
    uint8   riskLevel,           // 0=LOW 1=MEDIUM 2=WARNING 3=CRITICAL
    uint8   pricingAction,       // 0=OPEN 1=OPEN_WITH_WARNING 2=REPRICE_DOWN 3=PAUSE 4=FREEZE 5=LIQUIDATION
    bytes32 evidenceHash
) external;
```

必须 emit：

```solidity
event PricingUpdated(uint256 indexed poolId, uint256 issuePriceE6, uint8 riskLevel, uint8 pricingAction, bytes32 evidenceHash);
```

### 3.2 RWAOfferingPool

目的：把折价发行状态机跑通。

最小状态：

```solidity
Created -> Priced -> Open -> Subscribed -> Funded -> InTransit -> Repaid/Redeemed
                      └-> Repriced -> Paused -> Frozen -> Liquidation/Defaulted
```

最小函数：

```solidity
function createOffering(uint256 eblId, uint256 tokenSupply, uint256 issuePriceE6, uint256 targetRedemptionE6) external returns (uint256 poolId);
function subscribe(uint256 poolId, uint256 rwaAmount) external;
function reprice(uint256 poolId, uint256 newIssuePriceE6) external;   // 由 oracle / 治理触发
function pauseOffering(uint256 poolId) external;
function settle(uint256 poolId) external;                            // 进口商付款后结算
```

（可选）`EBLRegistry`：`mintEBL` / `pledge` / `releasePledge` / `holderOf`；`RWAToken`：代表投资者认购份额。这两个是加分，不阻塞主 demo。

## 4. 测试链部署建议

不要一开始追求复杂多链。优先：

1. 本地 Hardhat：保证合约测试稳定。
2. Sepolia 或 Base Sepolia：部署 `RiskPricingOracle` + `RWAOfferingPool`。
3. 前端只需展示合约地址、交易 hash、`PricingUpdated` event（issue price 从 0.85 改到 0.78）。

目录可借鉴常见 Hardhat + Next.js 结构：

```text
packages/hardhat/contracts
packages/hardhat/deploy
packages/hardhat/test
packages/nextjs/contracts
```

但业务上不要照搬众筹逻辑。TradeShield 的核心是"eBL 凭证 + AI 折价发行 + RiskPricingOracle"，不是捐赠 / 众筹。

## 5. Harness 新规则

每个新增功能必须回答：

1. 它改变哪个 scenario？
2. 它输出哪个 schema（RiskReport 过渡期 / PricingQuote 目标）？
3. 它是否改变 `issue price` 或 `pricing_action`？
4. 它是否需要写入 RiskPricingOracle？
5. 它的失败兜底是什么（deterministic 引擎 / mock provider）？

当前 Harness 命令：

```bash
npm run check
npm run test
npm run smoke
npm run scenarios
npm run demo
npm run agent:value
```

推荐 PR 验证顺序：

```bash
npm run check
npm run test
npm run smoke
npm run scenarios
```

## 6. 最终演示结构

3 分钟版本：

1. 30 秒：出口商（新加坡铜贸易商）拿到 eBL，但要快钱，定价慢且不透明。
2. 40 秒：AI 调用工具拉实时 LME 铜价 + 历史同类成交价，给出估值和 PricingQuote（发行价 0.85）。
3. 40 秒：合约按折价开盘，RiskPricingOracle emit `PricingUpdated`，投资者认购。
4. 40 秒：霍尔木兹战争升级 + 铜价剧烈波动 → AI 把 risk_discount 拉大，发行价压到 0.78，状态进入 Repriced / Paused。
5. 30 秒：解释合规边界（目标兑付非保本）和未来可接真实行情 / AIS / 保险数据。
6. 10 秒：收尾——TradeShield lets AI price trade risk into an RWA discount before investors buy it.

## 7. 最后的取舍

如果时间只够做三件事，优先顺序是：

1. PricingQuote schema + 定价引擎 + scenario harness 稳定（base / urgency / risk discount + coverage guardrail）。
2. RiskPricingOracle + RWAOfferingPool 最小合约能测能部署，`PricingUpdated` 可演示。
3. 前端展示 AI 折价如何触发链上改价（0.85 → 0.78）。

AI 估值 tool calling、MCP、Skill、RAG 是加分项，但必须服务这条主链路，不要变成新的不稳定入口。
