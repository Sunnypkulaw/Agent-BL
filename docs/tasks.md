# TradeShield Agent MVP 任务拆分

任务状态：`Todo` / `In Progress` / `Review` / `Done` / `Blocked`

每个任务都必须有 Owner 和可验证方式。没有验证方式的任务不要认领。  
当前主线：**AI 动态定价的 eBL-backed RWA 折价发行协议**。

## 1. 本轮开发优先级

| Priority | 目标 | 说明 |
|---|---|---|
| P0 | 跑通 AI 定价主链路 | 出口商选择到账速度，AI 给出 RWA 发行价，投资者看到折价和风险 |
| P0 | 固定 PricingQuote schema | 让 AI、后端、前端、合约都围绕同一份结构化输出 |
| P0 | 完成 Investor RWA Offering 页面 | 评委必须看到“风险越高，价格越低，潜在收益越高” |
| P1 | 合约 mock / 最小 Solidity | RWAOfferingPool + RiskPricingOracle（WEB3-1~9 Done；WEB3-10~11 待做） |
| P1 | 多场景回归 | fast / balanced / high-risk repricing |
| P2 | MCP / RAG / Skill | 作为 Agent 能力加分项，不阻塞主 demo |

## 2. Product / Business / PM

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| PM-1 | 固定一句话 pitch：AI dynamically prices eBL-backed RWA | Bowen | Done | README / pitch 更新 | - |
| PM-2 | 明确 RWA 折价发行模型：0.80 / 0.90 / 1.00 target redemption | Bowen | Done | docs/PRD.md 已体现 | - |
| PM-3 | 准备 3 分钟 demo 脚本：出口商融资 -> AI 定价 -> 投资者认购 -> 风险改价 | Unassigned | Todo | script 文档或 README 更新 | - |
| PM-4 | 准备合规 Q&A：target redemption 不是保本承诺 | Unassigned | Todo | docs/PRD.md / pitch 更新 | - |
| PM-5 | 准备 investor-facing 文案：折价、风险、潜在收益、非保本 | Unassigned | Todo | 前端文案 review | - |
| PM-6 | 设计 3 个演示场景：快速到账、慢速到账、高风险降价/暂停 | Unassigned | Todo | `npm run scenarios` | - |
| PM-7 | 录制最终备份 demo 视频 | Unassigned | Todo | 视频链接 | - |

## 3. Agent / AI

AI 的目标不是“写一段解释”，而是产出可被后端、前端和合约使用的 **PricingQuote**。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| AI-1 | 固定 `PricingQuote` JSON schema | Bowen | Done | `npm run test` | src/core/pricingSchema.js `assertPricingQuote`（3 条不变量）+ tests/pricingEngine.test.js AI-1 |
| AI-2 | 实现 base issue price：根据 `payout_speed` 输出按速度单调的基础价格（铜参考案例 ≈0.80 / 0.85 / 0.89） | Bowen | Done | pricing unit test | src/core/pricingEngine.js `priceRwaOffering`（BASE_PROFIT_SHARE）；tests/pricingEngine.test.js AI-2 |
| AI-3 | 实现 urgency discount：出口商越急，发行价越低 | Bowen | Done | scenario test | pricingEngine urgency_discount_bps（LOW_COST 锚点）；tests/pricingEngine.test.js AI-3 |
| AI-4 | 实现 risk discount：天气、战争、港口、保险、价格波动影响发行价 | Bowen | Done | `npm run scenarios` | pricingEngine `scoreRisk`（macro war/weather/port/fx + shipment + 价格回落 + 单据折价）；接入 scripts/scenarios.mjs 的 4 个 pricing scenarios + tests/pricingScenarioRunner.test.js |
| AI-5 | 实现 collateral coverage guardrail：防止 100 万货物发行过高目标兑付敞口 | Bowen | Done | pricing invariant test | pricingEngine 抵押价格地板 + assertPricingQuote `redemption_exposure ≤ max_safe`；tests/pricingEngine.test.js AI-5 |
| AI-6 | 实现 investor explanation generator：解释为什么价格是 0.80 / 0.90 | Bowen | Done | `npm run demo` 输出包含 explanation | pricingEngine investor_explanation / exporter_explanation；scripts/demo.mjs 与 price.mjs 已打印 |
| AI-7 | 实现 evidence graph mock：列出每个折扣对应的证据 | Bowen | Done | schema test | pricingEngine `buildEvidenceGraph`（base/urgency/risk/collateral 节点+证据）；tests/pricingEngine.test.js AI-7 + assertPricingQuote evidence_graph 校验 |
| AI-8 | 实现 document consistency checker：eBL / invoice / insurance 字段一致性 | Bowen | Done | fixture test | src/agent/documentConsistency.js（数量/货值/单价vs市场/Incoterms/保险覆盖&到期/HS）；tests/documentConsistency.test.js；折价接入 scoreRisk |
| AI-9 | 接入 Qwen / DeepSeek 可选 provider，必须有 deterministic fallback | Bowen | Done | provider fallback test | src/agent/llm/openaiCompatClient.js（DeepSeek/Qwen/OpenAI/custom）+ valuationAgent deterministic fallback；tests/valuationAgent.test.js（AI-9 LLM error→fallback / resolveProvider） |
| AI-10 | 生成 high-risk scenario：战争 / 严重天气 / 保险缺口导致降价或暂停 | Bowen | Done | `npm run scenarios` | data/cases/copper-sg-shanghai-warcrisis.case.json + data/pricing-scenarios/03-high-risk-reprice、04-high-risk-pause；tests/pricingScenarioRunner.test.js（Repriced→Redeemed / CRITICAL→PAUSE） |
| AI-11 | 建立 RAG 风险情报知识库：项目文档 + mock macro risk feed | Bowen | Done | retrieval eval | src/agent/riskIntel.js + data/risk-intel/feed.json（10 docs）；tests/riskIntel.test.js（evaluateRetrieval precision@k ≥ 0.8） |
| AI-12 | 做 Judge Q&A assistant：解释 AI 定价、非保本、合约动作 | Bowen | Done | 彩排通过（`npm run qa`） | src/agent/judgeAssistant.js（6 个 grounded intents + RAG 引用 + 实时报价数字 + LLM polish/fallback）；scripts/judge-qa.mjs；tests/judgeAssistant.test.js |

## 4. Backend / Integration

后端目标：把 AI 定价结果变成稳定 API，并让前端和合约 mock 能复用同一套数据。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| BE-1 | 更新 demo case：加入 `requested_cash_usd`、`payout_speed`、`target_redemption_value_usd` | Bowen | Done | `npm run check` | data/demo-case.json 新增 financing.requested_cash_usd/payout_speed/target_redemption_value_usd/redemption_coverage_limit + trade_economics（保留全部 legacy 字段，assertTradeCase 仍通过）；scripts/check.mjs 断言新字段并校验 quoteFromCase→assertPricingQuote |
| BE-2 | 增加 `PricingQuote` schema validator | Bowen | Done | `npm run test` | tests/pricingSchema.test.js 直接覆盖 assertPricingQuote：正例 + 3 条不变量负例（exposure≤max_safe / base−urgency−risk=indicative / final≥indicative）+ 缺字段/非法枚举/0x hash/case_id 交叉校验；`npm run test` 63 passed |
| BE-3 | 实现 `/api/pricing/quote` | Bowen | Done | `npm run smoke` | src/app/server.js POST /api/pricing/quote（空 body→demo case，`?compare=true` 返回三速+推荐，payout_speed 非法→400）+ resolvePricingRequest 复用；scripts/smoke.mjs + tests/smoke.test.js 覆盖 |
| BE-4 | 实现 `/api/offering/simulate`：发行、认购、风险改价、暂停、结算 | Bowen | Done | `npm run smoke` | src/app/server.js POST /api/offering/simulate（基于 offeringSimulator：Created→…→Repriced/Paused→Redeemed，`events` 途中升级风险）；smoke + tests/smoke.test.js 覆盖 reprice→Redeemed 与 war-crisis→Paused |
| BE-5 | 增加 scenario fixtures：fast payout / balanced payout / high-risk repricing | Bowen | Done | `npm run scenarios` | data/pricing-scenarios/01-fast-payout、02-balanced-payout、03-high-risk-reprice（+04-high-risk-pause）经 src/core/pricingScenarioRunner.js 驱动；`npm run scenarios` 4 legacy + 4 pricing passed；tests/pricingScenarioRunner.test.js 锁定 |
| BE-6 | 把 PricingQuote 和 RiskReport 合并进 workflow simulation | Bowen | Done | `npm run test` | src/core/pricingWorkflow.js `simulatePricingWorkflow` 合并 pricing_quote + risk_report + offering（action/evidence_hash/risk_level 一致）；POST /api/workflow/pricing-simulate；tests/pricingWorkflow.test.js（reprice→Redeemed、war→Paused）；`npm run test` 80 passed |
| BE-7 | API 错误输入校验：发行数量过高、价格不合法、target redemption 超抵押覆盖 | Bowen | Done | invalid payload test | src/app/server.js resolvePricingRequest 校验 payout_speed / requested_cash_usd>0 / subscription_usd≥0 / target_redemption=1 / events 为数组 → 400；tests/apiValidation.test.js 6 个非法 payload 用例；抵押超额由引擎 AI-5 护栏 + assertPricingQuote 不变量兜底 |
| BE-8 | 输出 `quote_hash` / `evidence_hash`，供合约 oracle 使用 | Bowen | Done | `npm run test` | src/core/oracle.js `toOracleUpdate`（issue_price/risk/action/offering_state + evidence_hash + quote_hash + supply/target，对齐 RiskPricingOracle.updatePricing / RWAOfferingPool.createOffering）；POST /api/oracle/pricing-update；tests/oracle.test.js + smoke 覆盖 |
| BE-9 | 保持原有 `/api/health`、`/api/demo-data`、`/api/risk/analyze`、`/api/workflow/simulate` 可用 | Bowen | Done | `npm run smoke` | 四个 legacy 端点全部保留并未改动语义；scripts/smoke.mjs 现显式覆盖 health/demo-data/risk-analyze/workflow-simulate；`npm run smoke` 通过 |
| BE-10 | 集成最终 demo CLI：打印 RWA price、investor yield、risk factors | Bowen | Done | `npm run demo` | scripts/demo.mjs 打印 RWA issue price / investor yield / risk factors / 融资成本 + 链上 oracle hashes + AI 叙述；src/agent/pricingNarrator.js（确定性优先，可选 LLM 润色出错自动回退）；接入 Tencent **hy3-preview**（src/agent/llm/openaiCompatClient.js，model 锁定，优先级最高）；`npm run demo` 离线 + 实测 hy3-preview 均通过 |

## 5. Frontend

前端目标：让评委一眼看到“AI 正在给 RWA 定价”，而不是普通 dashboard。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| FE-1 | Exporter Financing Quote 页面：选择 FAST / BALANCED / LOW_COST | Bowen | Review | 手动访问 `npm run dev` | `public/index.html` #exporter-panel + topbar speed segmented control；`app.js` renderSpeedSelector/renderExporterCards 由 `POST /api/pricing/quote {compare:true}` 驱动三速对比；headless render harness 验证（3 张卡 + active 高亮 + 点击切换实时改价 0.848→0.800） |
| FE-2 | Exporter 页面展示：发行价、预计到账、融资成本、推荐发行数量 | Bowen | Review | 手动访问 `npm run dev` | `app.js` renderExporterCards 每速展示 issue price / cash to exporter / financing cost / % of trade profit / net profit / token supply + ★AI pick(recommended_payout_speed) + exporter_explanation |
| FE-3 | Investor RWA Offering 页面：展示 issue price、target redemption、implied gross yield | Bowen | Review | 手动访问 `npm run dev` | `app.js` renderInvestor #investor-panel：大号 issue price、$1.00 target redemption、implied gross yield badge、token supply、risk/action 徽章；headless 验证 $0.848 / supply / MEDIUM |
| FE-4 | Investor 页面展示 AI risk factors：战争、天气、港口、保险、价格波动 | Bowen | Review | 手动访问 `npm run dev` | `format.js` rollupRiskDimensions → 6 维(war/weather/port/insurance/price/docs)带 bps + 严重度配色 + RAG intel 引用(intelCitations)；doc:Insurance 归入 Insurance 维；war-crisis 用例 5 维全亮验证 |
| FE-5 | AI Pricing Console：base price、urgency discount、risk discount、final price | Bowen | Review | 手动访问 `npm run dev` | `app.js` renderWaterfall：$1.00 target → base anchor → −urgency → −risk → indicative → collateral floor → final 的 broken-axis 瀑布图；与 assertPricingQuote 加性不变量一致 |
| FE-6 | Smart Contract Timeline：Created -> Priced -> Open -> Repriced/Paused/Funded/Redeemed | Bowen | Review | `npm run smoke` + 手动验证 | `app.js` renderTimeline 由 `POST /api/offering/simulate` 驱动：生命周期 stepper + 事件日志；“Simulate in-transit risk” 注入事件 → 实时 reprice/pause callout（headless 验证 0.800→0.782 Repriced）；`npm run smoke` 通过 |
| FE-7 | Scenario selector：一键切换 fast / balanced / high-risk | Bowen | Review | 手动访问 `npm run dev` | 新增只读 `GET /api/cases`（src/app/server.js loadCaseCatalog）+ topbar 场景 segmented control；风险阶梯 clean→warning→critical 共 4 个真实 case（含 AI-10 war-crisis）；payout 速度独立切换 |
| FE-8 | Subscribe mock：投资者输入认购金额，显示获得 RWA 数量 | Bowen | Review | 手动访问 `npm run dev` | `app.js` renderSubscribe/computeSubscription：USDC 输入 → RWA tokens + cost / target redemption / target upside / gross yield；暂停态(PAUSE/FREEZE)禁用并提示 |
| FE-9 | Evidence hash / quote hash 展示 | Bowen | Review | 手动访问 `npm run dev` | `app.js` #oracle-panel 展示 quote_hash + evidence_hash + `updatePricing(...)`（来自 `POST /api/oracle/pricing-update`）；“Push to RiskPricingOracle” → MCP push_pricing_to_oracle 返回 PricingUpdated tx（headless 验证） |
| FE-10 | 合规提示 UI：target redemption is not guaranteed | Bowen | Review | 文案 review | investor 面板合规框 + subscribe 脚注：“$1.00 是 target 非保本，依赖进口商付款/货物结算/保险” + “permissioned investors only” |

## 6. Web3 / Contract

Web3 目标：把 AI 定价结果写成链上可验证事件，而不是只在前端展示。

**进度摘要（2026-06-05）**

| 范围 | 状态 | 说明 |
|---|---|---|
| WEB3-1 ~ WEB3-4 | Done | 冻结设计见 `docs/contracts.md` |
| WEB3-5 | Done | JS contract mock：`src/core/contractHarness.js` |
| WEB3-6 ~ WEB3-9 | Done | Hardhat 合约 + 测试：`hardhat/`，`hardhat test` 6 passing |
| WEB3-10 ~ WEB3-11 | Todo | 测试网部署 |

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| WEB3-1 | 设计 `EBLRegistry`：mint / pledge / release pledge | Sage | Done | docs/PRD.md 更新 | `docs/contracts.md` §3 + `docs/PRD.md` §9.3 |
| WEB3-2 | 设计 `RWAToken`：代表投资者 RWA 凭证 | Sage | Done | contract interface doc | `docs/contracts.md` §4 |
| WEB3-3 | 设计 `RWAOfferingPool`：createOffering / subscribe / settle / pause | Sage | Done | contract interface doc | `docs/contracts.md` §5 |
| WEB3-4 | 设计 `RiskPricingOracle`：updatePricing(poolId, issuePrice, riskLevel, action, evidenceHash) | Sage | Done | contract interface doc | `docs/contracts.md` §6 |
| WEB3-5 | 实现 JS contract mock：模拟发行、认购、改价、暂停 | Sage | Done | `npm run test` | `src/core/contractHarness.js` + `tests/contractHarness.test.js`，`npm run test` 10 passed，事件已对齐 `docs/contracts.md` |
| WEB3-6 | 建立 Hardhat 合约目录结构 | Sage | Done | `hardhat compile` | `hardhat/`（package.json + hardhat.config.cjs），`hardhat compile` 4 files OK |
| WEB3-7 | 实现最小 Solidity `RiskPricingOracle` 并 emit `PricingUpdated` | Sage | Done | `hardhat test` | `hardhat/contracts/RiskPricingOracle.sol`，`hardhat test` 6 passing |
| WEB3-8 | 实现最小 Solidity `RWAOfferingPool` | Sage | Done | `hardhat test` | `hardhat/contracts/RWAOfferingPool.sol`（+ EBLRegistry/RWAToken），`hardhat test` 6 passing |
| WEB3-9 | 把 `quote_hash` / `evidence_hash` 写入合约事件 | Sage | Done | contract event test | `PricingUpdated` + `OfferingRepriced` 含 evidence/quote hash，`latestQuoteHash/latestEvidenceHash` 持久化，测试已验证 |
| WEB3-10 | 部署到 Sepolia 测试网 | Sage | Todo | 部署地址 + tx hash | - |
| WEB3-11 | 前端展示合约地址和 PricingUpdated event | Sage | Todo | 手动演示 | - |

## 7. MCP / RAG / Skill

这些是加分项，必须服务 AI 定价主链路。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| MCP-1 | 设计 TradeShield MCP tools manifest | Xlen | Done | `npm run smoke` | merged from feature/mcp-server |
| MCP-2 | 实现 `get_trade_case` | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| MCP-3 | 实现 `generate_pricing_quote` | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| MCP-4 | 实现 `simulate_offering` | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| MCP-5 | 实现 `push_pricing_to_oracle` mock / real tx | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| RAG-1 | 建立风险情报资料：天气、战争、港口、保险、价格 mock feed | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| RAG-2 | 准备 4 个评委追问检索问题 | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| SKILL-1 | 创建 `tradeshield-pricing-analyst` skill | Xlen | Done | `npm run smoke` | merged from feature/mcp-server |
| SKILL-2 | 创建 `tradeshield-demo-operator` skill | Xlen | Done | `npm run smoke` | merged from feature/mcp-server |

## 8. QA / Integrator

QA 目标：任何新增功能都必须回到同一条主链路，不能散。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| QA-1 | 维护 `npm run check` | Unassigned | Todo | `npm run check` | - |
| QA-2 | 维护 `npm run test` | Unassigned | Todo | `npm run test` | - |
| QA-3 | 维护 `npm run smoke` | Unassigned | Todo | `npm run smoke` | - |
| QA-4 | 维护 `npm run scenarios` | Unassigned | Todo | `npm run scenarios` | - |
| QA-5 | 增加 pricing invariant tests：兑付敞口不能超过安全覆盖 | Unassigned | Todo | `npm run test` | - |
| QA-6 | 增加前端手动验收清单 | Unassigned | Todo | checklist 文档 | - |
| QA-7 | 最终演示前跑完整验证矩阵 | Unassigned | Todo | `npm run check && npm run test && npm run smoke && npm run scenarios && npm run demo` | - |
| QA-8 | 准备演示失败兜底：CLI demo、mock provider、contract mock | Unassigned | Todo | README / docs 更新 | contract mock 已完成（`contractHarness.js`）；CLI demo / README 兜底说明待补 |
| QA-9 | 最后 6 小时功能冻结协调 | Unassigned | Todo | 全员确认 | - |

## 9. 推荐并行分工

| 角色 | 负责人建议 | 主要任务 |
|---|---|---|
| PM / Pitch | 1 人 | PM-1 到 PM-7，demo script，合规 Q&A |
| AI | 1-2 人 | AI-1 到 AI-10，pricing model，risk discount，explanation |
| Backend | 1 人 | BE-1 到 BE-10，API，schema，scenario |
| Frontend | 1-2 人 | FE-1 到 FE-10，Exporter + Investor + AI Console |
| Web3 | 1 人 | WEB3-1 到 WEB3-11，合约 mock / Solidity |
| QA / Integrator | 1 人 | QA-1 到 QA-9，最终集成和兜底 |

## 10. 任务认领流程

1. 先拉最新 `main`。
2. 在本文件找到 `Unassigned` 任务。
3. 把 Owner 改成自己。
4. 把 Status 改成 `In Progress`。
5. 开分支开发。
6. 完成后跑验证命令。
7. 提 PR。
8. 合并后把 Status 改成 `Done`，Done Evidence 填 PR 或 commit。

## 11. 分支命名

```text
feature/ai-pricing-quote
feature/backend-pricing-api
feature/frontend-rwa-offering
feature/contract-risk-pricing-oracle
feature/scenario-high-risk-reprice
fix/pricing-invariant
docs/pitch-tokenomics
```

## 12. 合并标准

PR 必须满足：

```text
1. 有明确 Owner
2. 有对应任务 ID
3. 有验证命令
4. 不破坏 demo 主流程
5. 如果涉及 RWA 定价，必须说明 issue price / target redemption / risk discount 的关系
6. 如果涉及投资者收益，必须保留非保本文案
```

主流程相关改动必须跑：

```bash
npm run check
npm run test
npm run smoke
npm run scenarios
npm run demo
```

## 13. 最小可演示闭环

如果时间不够，只保这 8 个任务：

```text
AI-1 PricingQuote schema
AI-2 base issue price
AI-4 risk discount
BE-3 /api/pricing/quote
BE-5 pricing scenarios
FE-1 Exporter Financing Quote
FE-3 Investor RWA Offering
PM-3 3-minute demo script
```

这 8 个完成，项目就能讲清楚“AI 如何定价 RWA”。合约和 MCP/RAG 可以作为加分项继续堆。

