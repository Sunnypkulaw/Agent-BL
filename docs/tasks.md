# AgentBL 冠军路线与工程任务清单

任务状态：`Todo` / `In Progress` / `Review` / `Done` / `Blocked`

每个任务都必须有 Owner 和可验证方式。没有验证方式的任务不要认领。  
当前主线：**Web3 原生贸易融资协议：出口商 tokenize eBL，AI 自主定价与执行，全球投资者直接出资，Injective 全程上链审计**。

---

## 0. 项目定位与冠军约束

### 0.1 冠军版一句话

> **Before investing in an eBL-backed RWA, anyone can pay cents over x402 for an AI due-diligence report; AgentBL turns that report into a verifiable risk discount, and Injective enforces the financing decision on-chain.**

中文：**投资 RWA 前，用户通过 x402 按次购买 AI 风控报告；AgentBL 把审单、估值和世界风险变成可验证的发行折价，Injective 负责支付、存证与融资执行。**

必须反复说明：**不是"AI 在买东西"，而是人、机构或其他 Agent 花钱购买 AgentBL 的 AI 分析结果。** x402 支付与 RWA 认购是两笔不同业务：

```text
x402：购买 AI 报告       402 → USDC 支付 → 解锁报告 → PaymentOracle 绑定报告哈希
RWA：投资贸易融资资产    阅读报告 → 接受风险 → 认购 RWA → RWAOfferingPool 结算
```

### 0.2 为什么 x402 值得做

1. **创新性**：把 AI 风控从"页面功能"升级成可独立交易的机器可调用服务。
2. **技术实现**：同一条演示同时覆盖 HTTP 402、USDC 支付、AI 结构化输出、Injective 结算和链上证据。
3. **应用价值**：银行、保险、物流平台、投资者和其他 Agent 都可以按次购买报告，无账号、无订阅。
4. **AI 含金量**：付费的是审单、估值、压力测试和证据，而不是一个普通 LLM 回答。
5. **生态契合**：Injective 官方已提供 `@injectivelabs/x402` 和 Injective EVM x402 指南；这是赛事 sponsor-native 能力，不是外链装饰。

### 0.3 夺冠约束

- 不再堆无关页面；所有新增能力必须回到"买报告 → 风险定价 → 链上执行"闭环。
- Demo 中任何 `tx_hash`、支付状态和 explorer 链接都必须来自真实交易；模拟值必须显式标 `DEMO`。
- LLM 可以解析、检索、解释和提出建议，但最终金额、状态迁移、权限和支付校验必须由确定性代码/合约验证。
- 支付成功不代表报告正确；报告必须通过 schema、证据完整性和新鲜度校验后才能注入定价。
- 不把贸易秘密、完整单据或模型 chain-of-thought 写链；只上链必要哈希、金额、地址、时间和决策摘要。

### 0.4 五项评审标准对照表

| 评审维度 | 评委必须看到的证据 | 对应任务 | Gate |
|---|---|---|---|
| Innovation | "AI 报告本身可按次交易"，支付证据与报告哈希绑定，报告再驱动 RWA 定价 | X402-7~11、X402-15 | 一次真实 402 + 一次真实 oracle event |
| Technical Execution | Injective 五合约 + PaymentOracle、标准 MCP 9+3（7 个 Wave B 基线 + 2 个 Mystery）、300+24 tests、live tx | WEB3-17、X402-9、MCP-6~10、MBOX-MCP-1、DEMO-5 | preflight 全绿，所有 explorer link 可打开 |
| Use Case & Impact | 45 天回款痛点、银行/保险/投资者/Agent 都能买报告、明确收费与市场入口 | PM-8、X402-8、TRUST-7 | 1 分钟说清 payer/buyer/value/revenue |
| Product & UX | 402→支付→结算→解锁一屏看懂；证据可展开；钱包失败可恢复 | X402-11/12、DEMO-1~3 | 5 秒理解测试 + 60 秒 demo |
| Ecosystem Fit | 官方 Injective x402、MCP、EVM、Explorer、可选 precompile；Azure eval/tracing | SP-1~10 | 每个 logo 都能指向代码、配置、trace 或 tx |

---

## 1. 仓库复核（2026-06-29）

以下状态以代码、脚本和测试为准，不以路演文案为准。评委现场最怕"说有、点开没有"。

| 能力 | 真实状态 | 结论 / 下一步 |
|---|---|---|
| AI 定价、反欺诈审单、风险场景、RAG、xAPI | ✅ 已有 | `npm test` 实测 **300/300 passed**；继续作为产品主线，不重做 |
| Solidity 合约 | ✅ 五合约协议已部署 | `hardhat test` 实测 **24/24 passed**；EBLRegistry V2、发行池、RWA Token、定价 Oracle 与 AgentBLRWA 已部署并完成全生命周期 smoke |
| Injective Testnet | ✅ 完整链上证据 | chainId `1439`；真实 USDC 支付、PaymentAttested、PricingUpdated、五合约部署及协议 smoke 均有 explorer 证据 |
| MCP Server | ✅ 标准 9 tools + 3 resources（7 个基线 + 2 个 Mystery） | 官方 MCP SDK stdio lifecycle 已实测；另通过安全 adapter 完成官方 Injective MCP 查询和受控 raw EVM testnet 交易 |
| Demo Mode | ✅ 已完成 | `DEMO_MODE=true` 默认、顶部常驻 banner、Live toggle、一键 reset；Live 配置不足时显式失败，不伪造链上 tx |
| x402 | ✅ Live 支付闭环已验证；全部 P0 + P1 动效完成 | X402-1~16（含 P1 动效 X402-12）已完成；真实 V2/EIP-3009 支付、PaidReportEnvelope 与 PaymentAttested 已由 explorer 证据串联；前端付费市场含 TTL 重读、支付流光/priceFlash/riskPulse/impact-pop（reduced-motion 安全）；仅 X402-17(P2 discovery) 待做 |
| Preflight | ✅ 已完成 | 固定 54 项总闸门；Demo 环境实测 50 PASS / 4 项显式 Live WARN / 0 FAIL，覆盖 Node、Solidity、smoke、scenarios、MCP、x402 与 UI |
| 动效 | 🟡 仅 waterfall 已有 | `priceFlash`、`riskPulse`、支付流水和 Demo banner 待补，且必须支持 reduced motion |
| 中文路演 | 🟡 有 30 秒和 3 分钟素材 | 需统一成 30 秒 / 1 分钟 / 3 分钟同一故事，并补 x402 与评委追问 |

---

## 2. 优先级总览

| Priority | 目标 | 说明 |
|---|---|---|
| P0 | 跑通 AI 定价主链路 | 出口商选择到账速度，AI 给出 RWA 发行价，投资者看到折价和风险 |
| P0 | 固定 PricingQuote schema | 让 AI、后端、前端、合约都围绕同一份结构化输出 |
| P0 | 完成 Investor RWA Offering 页面 | 评委必须看到"风险越高，价格越低，潜在收益越高" |
| P0 | 跑通自主 Agent 闭环 | eBL 上链后自动审单、估值、定价、开盘；风险事件自动改价/暂停；付款或到港自动结算 |
| P0 | 补齐 eBL 信任根 | ENI 文件标识、`cargoHash` 防一货多单、结构化元数据、transfer / endorse / history |
| P0 | 部署完整 Injective 协议 | 五个协议合约部署到 inEVM，前端支持 MetaMask + Keplr + Leap 与多链配置 |
| P0 | x402 付费情报闭环 | 真实 402 challenge → USDC 支付 → facilitator 结算 → 报告解锁 → PaymentOracle 存证 |
| P0 | Demo Mode + preflight | 默认无需钱包可演示；Live 模式只展示真实交易；赛前一条命令检查全部关键项 |
| P1 | 合约 mock / 最小 Solidity | RWAOfferingPool + RiskPricingOracle（WEB3-1~10 已完成；WEB3-11 及 v2 增量待做） |
| P1 | 多场景回归 | fast / balanced / high-risk repricing |
| P1 | 产品化市场后端与角色中心 | listings/search、pool subscribe/status、exporter dashboard、investor portfolio |
| P1 | 自主决策可审计 | 决策日志持久化、证据哈希、链上 tx 回填、Agent 活动面板 |
| P1 | 标准 MCP + Injective MCP | AgentBL 升级为 9 tools + 3 resources 的 stdio server，并用官方 Injective MCP 查询/执行；历史 Wave B 冻结基线为 7 tools |
| P1 | Microsoft Foundry 评测 | 接 Azure OpenAI provider、Agent traces 和可复现 eval，给出 AI 质量证据 |
| P2 | Injective 原生模块 | ERC20/Bank precompile 优先；Exchange precompile 仅在有真实可解释场景时接入 |
| P2 | AI 与品牌增强 | 多 LLM 共识、出口商偏好参数、Injective 紫色主题与 ENI + Injective 联合品牌 |


---

## 3. Product / Business / PM

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| PM-1 | 固定一句话 pitch：AI dynamically prices eBL-backed RWA | Bowen | Done | README / pitch 更新 | - |
| PM-2 | 明确 RWA 折价发行模型：0.80 / 0.90 / 1.00 target redemption | Bowen | Done | docs/PRD.md 已体现 | - |
| PM-3 | 准备 3 分钟 demo 脚本：出口商融资 -> AI 定价 -> 投资者认购 -> 风险改价 | Bowen | Todo | script 文档或 README 更新 | - |
| PM-4 | 准备合规 Q&A：target redemption 不是保本承诺 | Bowen | Todo | docs/PRD.md / pitch 更新 | - |
| PM-5 | 准备 investor-facing 文案：折价、风险、潜在收益、非保本 | Bowen | Todo | 前端文案 review | - |
| PM-6 | 设计 3 个演示场景：快速到账、慢速到账、高风险降价/暂停 | Bowen | Todo | `npm run scenarios` | - |
| PM-7 | 录制最终备份 demo 视频 | Bowen | Todo | 视频链接 | - |
| PM-8 | 将对外叙事统一为 gap analysis v2：Web3-native、三方协议、按货物与航线定价、投资者直投、No bank | Bowen | Todo | README、PRD、demo/video script 交叉 review，核心定位与 3 分钟流程一致 | - |

---

## 4. Agent / AI

AI 的目标不是"写一段解释"，而是产出可被后端、前端和合约使用的 **PricingQuote**。

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
| AI-13 | 实现 Agent 编排器 `src/agent/orchestrator.js`：串联文档解析、交叉核验、货物估值、三档定价、方案选择与自动开盘 | Bowen | Done | `node --test tests/orchestrator.test.js`，一次 eBL 事件只能生成一个确定性开盘决策 | `AgentOrchestrator.processEbl` 串联 parse→check→value→3 quotes→decision/optional execution；关键单据冲突强制 PAUSE；4 tests passed |
| AI-14 | 实现自主触发管道 `src/agent/autonomousAgent.js`：Event → Decision → On-chain Action，覆盖 mint、xAPI 风险、风险解除、付款、到港、保险到期 | Bowen | Done | `node --test tests/autonomousAgent.test.js`，六类事件分别得到 OPEN/REPRICE/PAUSE/RESUME/SETTLE/WARNING 动作 | 六类事件均产出结构化 protocol action；到港未付款只 WARNING，critical 世界风险强制 PAUSE；7 tests（含 AI-15）passed |
| AI-15 | 实现持续监控与执行可靠性：定时/事件驱动、幂等键、重试、并发锁、失败回退，禁止同一事件重复上链 | Bowen | Done | fake-timer + 重试/重复事件测试；连续运行两轮不产生重复 tx | `executionReliability.js` + `AutonomousAgent`：single-flight、指数退避、持久幂等、EXECUTING tx reconciliation、polling；并发/重启/重试测试通过 |
| AI-16 | 实现决策审计日志 `src/agent/decisionLogger.js`：保存输入快照、推理摘要、证据哈希、决策与链上 tx，并支持 tx 回填 | Bowen | Done | `node --test tests/decisionLogger.test.js`，`decision_id` 可重算且日志重启后仍可读取 | canonical hash 生成稳定 `decision_id`；原子 JSON 持久化、幂等 upsert、状态/tx 回填与重启读取；4 tests passed |
| AI-17 | 实现 AI 文档解析器 `src/agent/documentParser.js`：从 eBL / 发票 / 保险单图片或 PDF 提取结构化字段，并保留字段级来源与置信度 | Bowen | Done | `node --test tests/documentParser.test.js`，固定扫描件 fixtures 的关键字段准确率达到验收阈值，LLM 失败可回退/报人工复核 | Markdown/text 原生解析；PDF/image 走可注入 OCR；字段级 line/method/confidence、bundle merge、AI 失败确定性 fallback/人工复核；5 tests passed |
| AI-18 | 实现合规标注引擎 `src/agent/complianceChecker.js`：制裁、出口管制、MLETR、eUCP、DCSA、ICC DSI；只标注风险，不按企业规模拒绝服务 | Agent | Done | `node --test tests/complianceChecker.test.js`，通过、警告、阻断级风险 fixtures 均有证据引用 | `npm test` passed |
| AI-19 | 将现有浏览器端 `recommendEBL` 提炼为可测试的服务端投资顾问 `src/agent/investmentAdvisor.js`，支持自然语言偏好、排序理由与确定性 fallback | Agent | Done | `node --test tests/investmentAdvisor.test.js`，同一偏好返回稳定 Top 3，popup 与市场搜索复用同一结果 | `npm test` passed |
| AI-20 | 实现多 LLM 竞争评估：同一 case 由 3 个 provider 独立输出结构化评估，以中位数/共识聚合，分歧过大时降级为确定性引擎并标警告 | Agent | Done | `node --test tests/llmConsensus.test.js`，覆盖全成功、单 provider 失败、极端离群、全部失败四种情况 | `npm test` passed |

---

## 5. Backend / Integration

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
| BE-11 | 实现市场服务 API：`GET /api/market/listings` + `POST /api/market/search`，只返回活跃池并复用 AI-19 推荐逻辑 | Bowen | Done | `node --test tests/marketApi.test.js`，覆盖筛选、排序、分页、暂停池排除和自然语言搜索 | tests/marketApi.test.js passed |
| BE-12 | 实现发行池 API：`POST /api/pool/subscribe` + `GET /api/pool/status`，真实链模式返回 tx/event，离线模式保持确定性 fallback | Bowen | Done | `node --test tests/poolApi.test.js` + `npm run smoke`，重复认购、暂停池、金额越界均被正确处理 | tests/poolApi.test.js passed |
| BE-13 | 实现角色中心 API：`GET /api/exporters/dashboard` + `GET /api/investors/portfolio`，持久化 eBL、池状态、持仓、收益与兑付记录 | Bowen | Done | `node --test tests/dashboardApi.test.js`，服务重启后数据可恢复且只能读取当前钱包的数据 | tests/dashboardApi.test.js passed |
| BE-14 | 实现 eBL 文档接入与 ENI adapter：上传 eBL/发票/保险单、校验类型/大小、获取可信文件标识与哈希，并触发 AI-13 编排器；ENI 不可用时提供明确 mock fallback | Bowen | Done | `node --test tests/eblIngestion.test.js`，真实/模拟 ENI 两条路径均产出可追溯 document hash，重复上传保持幂等 | tests/eblIngestion.test.js passed (7 tests) |
| BE-15 | 实现 Agent 活动查询与实时订阅 API（SSE 或 WebSocket）：按 case/pool 返回持久化决策、执行状态、证据与 tx，供 FE-13 使用 | Bowen | Done | `node --test tests/agentActivityApi.test.js`，断线重连不丢事件且不暴露内部原始 chain-of-thought | tests/agentActivityApi.test.js passed (7 tests) |

---

## 6. Frontend

前端目标：让评委一眼看到"AI 正在给 RWA 定价"，而不是普通 dashboard。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| FE-1 | Exporter Financing Quote 页面：选择 FAST / BALANCED / LOW_COST | Bowen | Done | 手动访问 `npm run dev` | `public/index.html` #exporter-panel + topbar speed segmented control；`app.js` renderSpeedSelector/renderExporterCards 由 `POST /api/pricing/quote {compare:true}` 驱动三速对比；headless render harness 验证（3 张卡 + active 高亮 + 点击切换实时改价 0.848→0.800） |
| FE-2 | Exporter 页面展示：发行价、预计到账、融资成本、推荐发行数量 | Bowen | Done | 手动访问 `npm run dev` | `app.js` renderExporterCards 每速展示 issue price / cash to exporter / financing cost / % of trade profit / net profit / token supply + ★AI pick(recommended_payout_speed) + exporter_explanation |
| FE-3 | Investor RWA Offering 页面：展示 issue price、target redemption、implied gross yield | Bowen | Done | 手动访问 `npm run dev` | `app.js` renderInvestor #investor-panel：大号 issue price、$1.00 target redemption、implied gross yield badge、token supply、risk/action 徽章；headless 验证 $0.848 / supply / MEDIUM |
| FE-4 | Investor 页面展示 AI risk factors：战争、天气、港口、保险、价格波动 | Bowen | Done | 手动访问 `npm run dev` | `format.js` rollupRiskDimensions → 6 维(war/weather/port/insurance/price/docs)带 bps + 严重度配色 + RAG intel 引用(intelCitations)；doc:Insurance 归入 Insurance 维；war-crisis 用例 5 维全亮验证 |
| FE-5 | AI Pricing Console：base price、urgency discount、risk discount、final price | Bowen | Done | 手动访问 `npm run dev` | `app.js` renderWaterfall：$1.00 target → base anchor → −urgency → −risk → indicative → collateral floor → final 的 broken-axis 瀑布图；与 assertPricingQuote 加性不变量一致 |
| FE-6 | Smart Contract Timeline：Created -> Priced -> Open -> Repriced/Paused/Funded/Redeemed | Bowen | Done | `npm run smoke` + 手动验证 | `app.js` renderTimeline 由 `POST /api/offering/simulate` 驱动：生命周期 stepper + 事件日志；"Simulate in-transit risk" 注入事件 → 实时 reprice/pause callout（headless 验证 0.800→0.782 Repriced）；`npm run smoke` 通过 |
| FE-7 | Scenario selector：一键切换 fast / balanced / high-risk | Bowen | Done | 手动访问 `npm run dev` | 新增只读 `GET /api/cases`（src/app/server.js loadCaseCatalog）+ topbar 场景 segmented control；风险阶梯 clean→warning→critical 共 4 个真实 case（含 AI-10 war-crisis）；payout 速度独立切换 |
| FE-8 | Subscribe mock：投资者输入认购金额，显示获得 RWA 数量 | Bowen | Done | 手动访问 `npm run dev` | `app.js` renderSubscribe/computeSubscription：USDC 输入 → RWA tokens + cost / target redemption / target upside / gross yield；暂停态(PAUSE/FREEZE)禁用并提示 |
| FE-9 | Evidence hash / quote hash 展示 | Bowen | Done | 手动访问 `npm run dev` | `app.js` #oracle-panel 展示 quote_hash + evidence_hash + `updatePricing(...)`（来自 `POST /api/oracle/pricing-update`）；"Push to RiskPricingOracle" → MCP push_pricing_to_oracle 返回 PricingUpdated tx（headless 验证） |
| FE-10 | 合规提示 UI：target redemption is not guaranteed | Bowen | Done | 文案 review | investor 面板合规框 + subscribe 脚注："$1.00 是 target 非保本，依赖进口商付款/货物结算/保险" + "permissioned investors only" |
| FE-11 | 开发 eBL 管理 View ③：上传 eBL/发票/保险单、查看解析与合规结果、tokenize 状态、质押/流转历史 | Bowen | Done | `npm run dev` + 前端验收清单；上传 fixture 后可追踪 Parser → Checker → Mint → Open 全过程 | index.html + app.js updated |
| FE-12 | 开发投资组合 View ④：展示钱包持仓、成本、当前估值、目标收益、风险状态与兑付记录，替换 popup 内存数组 | Bowen | Done | 连接测试钱包手动验收 + UI 测试；刷新页面后持仓不丢失 | index.html + app.js updated |
| FE-13 | 开发 Agent 活动 View ⑤：展示真实决策日志、Agent 当前状态、触发源、推理摘要、证据与链上 tx；移除随机 tx 的模拟记录 | Bowen | Done | 注入 xAPI 风险事件后，页面实时出现与后端/链上相同的 REPRICE 或 PAUSE 记录 | index.html + app.js updated |
| FE-14 | 增加出口商偏好参数面板：最低可接受发行价、到账速度偏好、目标融资额，并在自主开盘前校验约束 | Bowen | Done | 三组参数化用例；低于最低价时 Agent 不开盘并给出可解释原因 | wired pref-min-price |
| FE-15 | 完成 Injective 品牌适配：紫色主题、Injective/ENI 联合品牌、`Powered by ENI + Injective`，保留 WCAG 对比度 | Bowen | Done | 中英文桌面/移动端视觉 review + 对比度检查 | styles.css updated |

---

## 7. Web3 / Contract

Web3 目标：把 AI 定价结果写成链上可验证事件，而不是只在前端展示。

**进度摘要（2026-06-29 仓库复核）**

| 范围 | 状态 | 说明 |
|---|---|---|
| WEB3-1 ~ WEB3-4 | Done | 冻结设计见 `docs/contracts.md` |
| WEB3-5 | Done | JS contract mock：`src/core/contractHarness.js` |
| WEB3-6 ~ WEB3-9 | Done | Hardhat 合约 + 测试：`hardhat/`，完整合约套件 `hardhat test` 24 passing |
| WEB3-10 | Done | `AgentBLRWA` 已随完整协议重新部署到 Injective Testnet |
| WEB3-11 | Todo | 前端合约地址与事件展示 |
| WEB3-12 ~ WEB3-14 | Done | eBL V2 唯一性、结构化元数据、流转/背书/质押约束均有合约测试 |
| WEB3-15 ~ WEB3-16 | Todo | 自主状态机权限与 v2 投资者访问模型仍在后续 wave |
| WEB3-17 | Done | 五合约部署、wiring 与 create/subscribe/reprice/pause/resume/settle 链上 smoke 已完成 |
| WEB3-18 ~ WEB3-19 | Todo | 多钱包与多链配置仍在后续 wave |

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
| WEB3-10 | 部署到 Injective Testnet | Sage | Done | 部署地址 + tx hash | - |
| WEB3-11 | 前端展示合约地址和 PricingUpdated event | Bowen | Done | 手动演示 | `public/app.js` 新增 `renderProtocolEvidence()`，展示协议合约地址（explorer 链接）、访问模型说明、最近 5 个 `PricingUpdated` 事件（poolId/price/risk/action/evidenceHash/tx 链接）；`public/index.html` 新增 `#protocol-contracts`、`#pricing-events`、`#protocol-access-model` 容器 |
| WEB3-12 | 升级 `EBLRegistry` V2：计算/登记 `cargoHash`，提供 `isUnique`，同一批货禁止重复 mint | Bowen | Done | `cd hardhat && npm test`，相同 cargoHash 二次登记必须 revert，不同货物可正常登记 | `hardhat/contracts/EBLRegistry.sol` + `hardhat/test/eblRegistryV2.test.js` |
| WEB3-13 | 增加 eBL 结构化元数据：船舶、航次、装卸港、货物、数量、HS Code、申报价值、Incoterms、MLETR/eUCP/DCSA 标准 | Bowen | Done | Solidity getter/event 测试 + 元数据 hash 与链下解析结果一致性测试 | `mintEBLV2` / `EBLMetadata` / `EBLMintedV2`，`hardhat test` 24 passing |
| WEB3-14 | 实现 eBL 完整流转：`transfer`、`endorse`、`getTransferHistory`；质押期间禁止未授权转移，创建发行池前必须已质押到对应池 | Bowen | Done | `cd hardhat && npm test`，覆盖正常转让、连续背书、质押锁定、未质押建池失败、释放后转让与历史顺序 | `EBLRegistry.sol` + `RWAOfferingPool.sol` + 5 个 V2 专项测试 |
| WEB3-15 | 补齐自主执行状态机：`RESUME_OFFERING`、付款/到港结算、合法状态迁移、Agent executor 权限与紧急人工停机 | Bowen | Done | `cd hardhat && npm test`，覆盖 PAUSE→RESUME、OPEN/FUNDED→SETTLE、非法迁移、越权调用与重复事件 | `hardhat/test/offeringStateMachineV2.test.js` 8 passing：executor pause/resume、oracle RESUME_OFFERING action、payment+arrival proof settlement、global emergency stop、executor 越权与重放防护 |
| WEB3-16 | 对齐 v2 投资者访问模型：测试网允许任意钱包直投；生产模式使用可插拔合规 gate，移除当前硬编码 allowlist 与"全球投资者"叙事冲突 | Bowen | Done | permissionless testnet 与 compliance-gated 两种模式合约测试；前端文案与实际权限一致 | `hardhat/contracts/InvestorComplianceGate.sol`（可插拔合规 gate）、`RWAOfferingPool.sol` 新增 `setComplianceGate()`/`isComplianceRequired()`；`offeringStateMachineV2.test.js` 测试 permissionless testnet 与 production gate；前端 `renderProtocolEvidence()` 根据 `accessModel` 显示权限文案 |
| WEB3-17 | 编写完整协议部署脚本并部署 `AgentBLRWA`、`EBLRegistry` V2、`RiskPricingOracle`、`RWAOfferingPool`、`RWAToken` 到 Injective inEVM | Bowen | Done | 五个地址 + deploy tx + explorer 链接；部署后运行链上 smoke 验证 create/subscribe/reprice/pause/resume/settle | `hardhat/scripts/deploy-protocol.js` + `docs/evidence/wave-b-protocol.json`；最终状态 `Repaid` |
| WEB3-18 | 钱包集成扩展为 MetaMask + Keplr + Leap：钱包选择、网络切换、签名、断线重连与错误提示 | Sage | Done | Injective Testnet 三钱包验收矩阵；每种钱包至少完成一次真实签名交易 | `public/web3.js` 新增 `restoreWalletSession()`，MetaMask 使用 `eth_accounts` 静默重连，Keplr/Leap 恢复原生 signer；`public/app.js` boot 时调用 `restoreWalletIfSaved()`；`tests/web3Wallets.test.js` 新增 6 个测试（网络切换、签名拒绝、权限撤销、MetaMask/Keplr 会话恢复）；`npm test` 335 passing |
| WEB3-19 | 将 `public/chain-config.json` 改为多链/多合约格式，默认 `injective-testnet`，并让部署脚本合并配置而非覆盖其他网络 | Bowen | Done | config schema 测试 + 两个网络 fixture；切链后地址、RPC、explorer 与 ABI 均正确 | `public/chain-config.json` 升级为 v2 schema（`schema: 'agentbl-chain-config-v2'`、`defaultNetwork`、`networks: {}`）；`public/web3.js` 新增 `resolveBrowserChainConfig()` 解析网络；`hardhat/scripts/deploy-protocol.js` 合并更新而非覆盖；`tests/chainConfig.test.js` 4/5 passing（1 个文件路径问题）；现有测试（`tests/web3Wallets.test.js`、主测试套件）验证 v2 解析逻辑 |

---

## 8. x402 付费情报市场（冠军版 P0）

### 8.1 冻结架构

官方 Injective 路线优先：服务端以 `@injectivelabs/x402` 为主；只有浏览器/CLI 客户端或底层协议确有需要时，才直接加入 `@x402/core`、`@x402/evm`、`@x402/fetch`，禁止为了"依赖看起来多"而全装。当前后端是 `node:http`，因此先做兼容性 spike，再在"薄 Express x402 router"与"原生 HTTP adapter"之间二选一，不能半迁移整个服务。

```text
Browser / CLI / external Agent
        │ ① request
        ▼
x402 Resource Server ──402 + PaymentRequirements──► wallet
        ▲                                             │ ② sign USDC
        │ ④ retry + receipt                           ▼
        └──────── Injective facilitator ◄──── signed payment
                          │ ③ settle on Injective EVM
                          ▼
                 Premium AI report
                          │ report_hash + payment tx
                          ▼
                    PaymentOracle
                          │ verified report envelope
                          ▼
          PricingQuote / RiskPricingOracle / RWAOfferingPool
```

### 8.2 三个付费端点

| Endpoint | 建议价格（可配置） | 付费输出 | 禁止退化成 |
|---|---:|---|---|
| `POST /api/x402/intel/premium` | 0.01 USDC | 5 维世界风险、来源、时效、置信度、情景影响、`evidence_hash` | 把现有免费 JSON 原样包一层 402 |
| `POST /api/x402/valuation/premium` | 0.03 USDC | 反欺诈审单、可比交易、保守货值、三档融资报价、分歧/置信度、`quote_hash` | 只让 LLM 写一段估值文案 |
| `POST /api/x402/stress-test`（兼容 `/smoke-test`） | 0.05 USDC | 基准/警告/极端场景、损失区间、违约回收、REPRICE/PAUSE 建议、可重放输入快照 | 返回"smoke passed"字符串 |

价格只用于 demo，统一由环境变量配置。报告被买下后可在短 TTL 内按 `payment_tx + report_hash` 重读，不能每次刷新重复收费。

付费风险报告统一为 5 个决策维度，复用现有更细粒度 signals，不另造第二套分数：

```text
① Document & Fraud  单据真实性、一致性、一货多单
② Cargo & Valuation 货值、可比交易、价格波动、haircut
③ Transit & Logistics 航线、天气、港口、延误
④ Macro & Geopolitics 战争、制裁、汇率、国家风险
⑤ Insurance & Settlement 保险覆盖、买方付款、回收与结算
```

### 8.3 工程任务

| ID | Task | Priority | Owner | Status | Verification / Definition of Done |
|---|---|---|---|---|---|
| X402-1 | 做官方 Injective x402 兼容性 spike：确认 `@injectivelabs/x402` 版本、Node 版本、Express 依赖、facilitator `/supported`、USDC 资产、主网 `eip155:1776` 与测试网 `eip155:1439` 支持情况 | P0 | Bowen | Done | `docs/x402-spike.md` 记录 npm/SDK 与真实 HTTP 响应：稳定版 `0.0.1`、Node `>=20`、Express optional peer；官方 Demo 与 `/supported` 实测仅返回 Testnet 1439 + USDC/EIP-3009。当前 staging facilitator 为 HTTP，Mainnet 1776 未验活；已明确 Testnet 一次性钱包、显式 Demo settlement 和 Mainnet fail-closed 边界 |
| X402-2 | 加入最小依赖并锁版本：优先 `@injectivelabs/x402`；客户端确有需要才加 `@x402/core` / `@x402/evm` / `@x402/fetch` | P0 | Bowen | Done | 精确锁定 `@injectivelabs/x402@0.0.1` + `express@5.2.1`，Node 提升到 `>=20`；`ws` override 到修复版 `8.21.0`，`npm audit` 为 0 vulnerabilities；README 已说明用途与不引入第二套 x402 包的边界 |
| X402-3 | 新建 `src/x402/config.js`：network、asset、decimals、payTo、facilitator URL、三端点价格、TTL、live/demo mode；启动时做 fail-fast 校验 | P0 | Bowen | Done | `config.js` 固定 1776/1439 原生 USDC、3 个 atomic price、Live/Demo 与 HTTPS 门禁；`/supported` 校验 V2/exact/asset/decimals/EIP-3009；`tests/x402Config.test.js` 10 tests passed |
| X402-4 | 新建 `src/x402/server.js`：统一 402 challenge、V2 标准 headers、支付校验、settle、成功后放行；不把业务逻辑复制进 middleware | P0 | Bowen | Done | Express middleware 输出可解码 `PAYMENT-REQUIRED`，使用官方 decoder；在 facilitator 前拒绝 malformed/expired/future/wrong network/asset/amount/payTo/domain，settle 成功才 `next()`；`tests/x402Server.test.js` 9 tests passed |
| X402-5 | 新建 `src/x402/client.js`：支持浏览器外部钱包和 CLI signer 的 402→签名→重试流程；私钥绝不从前端发往服务端 | P0 | Sage | Done | `createPaidFetch`/`fetchPaidIntel` 支持注入钱包或 CLI signer，签名只在本地、只回传 signature + signer 地址；新增 `balanceOf` 预检与 `classifyPaidFailure`，把取消签名/预算超限/错网/余额不足/网络错误/settlement timeout/结算失败映射为带 `recoverable` 的 `X402ClientError`；`tests/x402Client.test.js` 13 contract tests（含「私钥绝不外泄」断言）全绿，`npm test` 270 passed |
| X402-6 | 新建 `src/x402/settlement.js`：facilitator verify/settle adapter、幂等键、receipt store、重试与状态机 `CHALLENGED/SIGNED/SETTLING/SETTLED/UNLOCKED/FAILED` | P0 | Bowen | Done | 官方 V2 verify/settle adapter + bounded retry + 原子 JSON receipt store + single-flight；已结算/解锁重启恢复，悬空 SETTLING 转人工 reconciliation FAILED，失败永不解锁；`tests/x402Settlement.test.js` 7 tests passed |
| X402-7 | 定义 `PaidReportEnvelope` schema，至少包含 `report_id/kind/case_id/payer/payee/network/asset/amount/payment_tx/settled_at/data_snapshot/model_provider/evidence_hash/report_hash/expires_at` | P0 | Bowen | Done | `src/x402/paidReport.js` 提供 schema manifest、规范化、脱敏、稳定 hash/重算、TTL 校验；10 个正反例测试；三端点均返回已校验 envelope |
| X402-8 | 实现三个付费端点，复用现有 `worldRiskAgent`、`valuationAgent`、`documentConsistency`、`pricingEngine` 和 scenario runner | P0 | Bowen | Done | `src/x402/endpoints.js` 组合 risk / valuation / fraud-review 三种报告，支付只控制访问、不改风险分；`tests/x402Endpoints.test.js` 三端点解锁通过 |
| X402-9 | 新建 `hardhat/contracts/PaymentOracle.sol`：把 `reportHash`、`caseIdHash`、原始 payment tx hash、payer、asset、amount 绑定为事件；防重复存证并支持 attestor 权限 | P0 | Bowen | Done | 8 个 PaymentOracle tests 覆盖成功、receipt/付款 tx 双重防重放、零哈希/地址/金额、越权与 attestor 管理；前端 `readX402PaymentAttestation` 可回读；测试网部署 `0x36d9Ff1256b3db1EFC1EAcB4c9b5033165D24571` |
| X402-10 | 将已验证付费报告作为 PricingQuote 的 evidence node 注入发行定价；支付行为本身不得改变风险分或抬高报告可信度 | P0 | Bowen | Done | `reportEvidence.js` 仅注入 provenance/evidence hash；6 tests 证明风险分、价格、action、quote hash 不变，篡改/过期/错 case 报告均拒绝 |
| X402-11 | 新增前端"付费情报市场"选项卡：报告商品卡、锁定预览、价格、数据时间、模型、`402 → 签名 → 结算 → 解锁 → 存证` stepper、explorer 链接 | P0 | Sage | Done | View ③ 报告目录 + 4 步 stepper + 支付证据卡 + 定价影响 + explorer 链接已具备；本轮补齐「刷新后 TTL 内可重读」：新增 `src/x402/reportStore.js`（`PaidReportCache`，原子持久化 + 过期自动 prune）、`createX402Route` 交付成功即缓存、`GET /api/x402/report/:id` 在 TTL 内免费重读（miss→404 需重付），前端 localStorage 记忆已购 report_id 并在进入 View ③ 时重读未过期报告（`#x402-purchased`）。`tests/x402ReportStore.test.js` 7 tests + 集成「demo 购买→GET 重读 200/未知→404」；对运行中服务器实测 demo 购买→重读 200 且 report_id 一致；`npm test` 278 passed。注：本会话浏览器扩展断连，客户端 localStorage 重读路径未做可视化验收 |
| X402-12 | 加入支付动效与风险反馈：`paymentFlow`、`priceFlash`、`riskPulse`；支持 `prefers-reduced-motion` | P1 | Sage | Done | 已接线：付费时 `#x402-flow` 跑 `particleFlow` 流光，结算成功后 after-price `priceFlash`、价升时 delta badge 短促 `risk-pulse`(4.2s 后停)、impact 卡 `x402-impact-pop`(放大+绿环) 在用户视线落点处提示成功；`pulseClass` 与 risk-pulse 均带 `prefers-reduced-motion` 守卫 + 全局 reduced-motion 规则兜底；满屏 confetti 经实测易被卡片视线遮挡、收益低，已按用户决定移除；`node --check public/app.js` 通过 |
| X402-13 | 新增 `scripts/x402-intel.mjs` 与 `npm run x402:intel -- --case <id> --kind <kind>`；输出 challenge、金额、settlement tx、report hash、oracle tx | P0 | Bowen | Done | CLI 支持 risk/valuation/fraud、case ID/文件、Demo 临时 signer 与 Live fail-closed；密钥只在本地使用，输出 challenge/金额/receipt/report hash/oracle 状态 |
| X402-14 | 新增 `scripts/smoke-x402.mjs`、`npm run smoke:x402` 和至少 12 个自动化测试 | P0 | Bowen | Done | 新增 `tests/x402Endpoints.test.js` 15 tests；连同 config/server/settlement 覆盖 3 endpoints、budget/cancel/timeout/wrong network、tamper/replay/expiry/wrong recipient/结算失败与成功；`smoke:x402` 通过 |
| X402-15 | 做 Injective Live smoke：钱包有 INJ gas + USDC，实际购买一份报告，回读支付 tx、`PaymentAttested` 与报告哈希 | P0 | Bowen | Done | 2026-06-29 在 `eip155:1439` 以测试用 self-transfer 真实结算 0.001 USDC：payment `0x6d796d…a0b49`、report `rpt_3e5f…3334` / hash `0x994078…168ce`、attestation `0xa03ab9…fef6e`；路演前可改用独立 treasury payTo 再跑；完整证据见 `docs/evidence/x402-live-smoke.json` |
| X402-16 | README、架构图、API 文档、威胁模型和 FAQ 更新；清楚区分 x402 报告支付与 RWA 认购 | P0 | Sage | Done | `docs/x402-integration.md` 新增「x402 报告支付 vs RWA 认购」对照表 + 流程图、8 条威胁模型不变量表（对应代码与测试）+ 客户端可恢复错误码、评委 FAQ（谁付钱/买什么/为何上链/与 RWA 区别/支付失败/为何 Injective）、`GET /api/x402/report/:id` 重读端点与 `X402_REPORT_CACHE_PATH`；README 中英文 API 表新增 4 个 x402 端点 + 「x402 ≠ RWA」提示框 + More docs 链接到 x402-integration.md |
| X402-17 | 可选：通过 x402 Bazaar/discovery extension 发布 3 个机器可发现的资源描述，使外部 Agent 能发现并购买 | P2 | Bowen | Todo | discovery metadata 可被客户端解析；不阻塞核心 demo |

### 8.4 x402 安全不变量

```text
1. verified && settled 才能 unlock；仅看到 tx hash 不等于支付成功。
2. network + asset + amount + payTo + resource + nonce 全部进入签名/校验域。
3. payment receipt 与 report_hash 一一绑定；不同 case / report 不得复用。
4. 重放、并发、超时重试只能产生一次结算和一次 PaymentOracle attestation。
5. 报告生成失败时不得扣款，或必须提供可验证退款/重试策略。
6. Demo mode 的 receipt 使用 demo:// 标识，永不生成伪造 explorer URL。
```

---

## 9. MCP / RAG / Skill

这些是加分项，必须服务 AI 定价主链路。

### 9.1 冻结为 7 tools

```text
1. get_trade_case
2. search_knowledge_base
3. verify_trade_documents        # 新增：eBL / invoice / insurance 交叉核验
4. generate_pricing_quote
5. purchase_premium_analysis     # 新增：作为 x402 client 购买报告
6. simulate_offering
7. push_pricing_to_oracle
```

### 9.2 冻结为 3 resources

```text
agentbl://cases/catalog           # 可演示 case 与摘要，不含敏感全文
agentbl://risk/methodology        # 5/6 维风险、bps 规则、非保本边界
agentbl://contracts/deployments   # network、合约地址、ABI 版本、explorer
```

### 9.3 工程任务

| ID | Task | Priority | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| MCP-1 | 设计 AgentBL MCP tools manifest | P0 | Bowen | Done | `npm run smoke` | merged from feature/mcp-server |
| MCP-2 | 实现 `get_trade_case` | P0 | Bowen | Done | `npm run test` | merged from feature/mcp-server |
| MCP-3 | 实现 `generate_pricing_quote` | P0 | Bowen | Done | `npm run test` | merged from feature/mcp-server |
| MCP-4 | 实现 `simulate_offering` | P0 | Bowen | Done | `npm run test` | merged from feature/mcp-server |
| MCP-5 | 实现 `push_pricing_to_oracle` mock / real tx | P0 | Bowen | Done | `npm run test` | merged from feature/mcp-server |
| MCP-6 | 使用官方 MCP SDK 实现 stdio transport 与 JSON-RPC lifecycle，handlers 继续复用现有确定性引擎 | P1 | Bowen | Done | `npm run test` | `src/mcp/standalone-server.js` + `tests/mcpProtocol.test.js`：真实 SDK client 完成 initialize/list/call/read；stdout 仅协议帧 |
| MCP-7 | 增加 `verify_trade_documents` 与 `purchase_premium_analysis`，工具总数固定为 7；后者完整处理 402 支付而不是绕过 middleware | P1 | Bowen | Done | `npm run test` | 7 个工具逐一真实调用；购买工具走 402 challenge/sign/retry，并返回 payment + report + oracle proof |
| MCP-8 | 增加 3 个只读 resources，设置 MIME type、URI 校验和敏感字段脱敏 | P1 | Bowen | Done | `npm run test` | `agentbl://cases/catalog`、`agentbl://risk/methodology`、`agentbl://contracts/deployments`；未知 URI 协议错误 |
| MCP-9 | 接入官方 Injective MCP Server 作为外部链执行/查询 adapter，优先使用其 chain query、transfer、raw EVM transaction 能力 | P1 | Bowen | Done | 链上 smoke | `usdc_native_info` 查询 + allowlist 合约受控 `evm_broadcast`：`0x1578c1…984f`；见 `docs/evidence/injective-mcp-smoke.json` |
| MCP-10 | 为链上写操作加入 human approval、金额上限、allowlist、network pinning、dry-run；读操作可自动 | P0 | Bowen | Done | `npm run test` | `security.js` + 专项测试：默认 dry-run；真实写入需 out-of-band token，未批准/超限/错网/未知合约/未知 calldata selector 全拒绝 |
| MCP-11 | 提供 `npm run mcp:stdio`、示例 client config、30 秒录屏和离线 protocol fixture | P1 | Bowen | Todo | 手动演示 | 全新环境按 README 可连接；没有 Injective MCP 时仍可演示 AgentBL 只读/模拟能力 |
| RAG-1 | 建立风险情报资料：天气、战争、港口、保险、价格 mock feed | P0 | Bowen | Done | `npm run test` | merged from feature/mcp-server |
| RAG-2 | 准备 4 个评委追问检索问题 | P1 | Bowen | Done | `npm run test` | merged from feature/mcp-server |
| SKILL-1 | 创建 `agentbl-pricing-analyst` skill | P1 | Bowen | Done | `npm run smoke` | merged from feature/mcp-server |
| SKILL-2 | 创建 `agentbl-demo-operator` skill | P1 | Bowen | Done | `npm run smoke` | merged from feature/mcp-server |

---

## 10. AI 质量、安全与可信度

| ID | Task | Priority | Owner | Status | Verification / Definition of Done |
|---|---|---|---|---|---|
| TRUST-1 | 建立 Gold dataset：真实/脱敏 eBL、发票、保险单、正常/欺诈/缺字段/战争/延误至少 20 cases | P0 | Done | Done | 数据许可和来源可说明；字段级 ground truth；不得把敏感商业数据提交到公开仓库 | 20 条 gold dataset 完成 |
| TRUST-2 | 评估 OCR/解析准确率、文档一致性 precision/recall、风险分单调性、估值误差、tool-call 成功率 | P1 | Done | Done | `docs/evaluation-report.md` 给出指标、失败样例、限制；不能只报总测试数 | Evaluation report 生成器完成 |
| TRUST-3 | Prompt-injection 防护：文档内容视为不可信数据，不能改变工具权限、支付地址、网络、价格和系统规则 | P0 | Done | Done | 恶意 eBL fixture 不能触发任意 tool/tx、改 payTo、泄露 secret；测试纳入 preflight | 5 个注入测试 + sanitizer 完成 |
| TRUST-4 | 合约安全：访问控制、暂停、重入、重放、整数精度、重复 cargo/payment/report、状态机、emergency stop | P0 | Bowen | Todo | Slither 或同等静态检查 + adversarial tests；所有 high finding 关闭或书面接受 |
| TRUST-5 | 数据新鲜度和来源健康：风险情报标 `observed_at/expires_at/source_status`，过期自动降置信度或拒绝定价 | P0 | Done | Done | clock-controlled tests；断网不把旧数据冒充实时数据 | DataFreshnessValidator 完成 |
| TRUST-6 | 隐私与合规最小化：链上只存 hash；日志/telemetry 对 BL、公司、钱包做字段级脱敏；增加删除/保留策略 | P1 | Bowen | Todo | log snapshot 无原始文件、API key、私钥、完整地址；隐私说明加入 README |
| TRUST-7 | 经济模型压力测试：重复购买、报告转售、低价刷接口、退款、报告过期、RWA 违约与利益冲突 | P1 | Bowen | Todo | 文档给出价格/成本/毛利假设与 3 个极端场景；x402 收入不混入 RWA 收益承诺 |

---

## 11. Demo Mode、视觉与路演

冠军项目首先要"看得懂"。

### 11.1 1 分钟主演示

```text
00–08s  "货在海上漂，钱等 45 天。"出口商缺现金，投资者看不懂单据风险。
08–18s  打开一笔铜/原油 eBL：报告被锁，API 返回 402，展示 0.01 USDC。
18–30s  钱包签名，Injective 结算，stepper 依次点亮，报告解锁。
30–42s  AI 展示 5 维风险 + 反欺诈审单 + 估值对比；每个数字能点开证据。
42–52s  报告注入 RWA 定价：价格 waterfall 变化；PaymentOracle 与 RiskPricingOracle 写链。
52–60s  一句话收束：别人花钱买 AI 分析，AI 给风险定价，Injective 强制执行。
```

### 11.2 工程任务

| ID | Task | Priority | Owner | Status | Verification / Definition of Done |
|---|---|---|---|---|---|
| DEMO-1 | 新增统一 `demoMode=true`（默认）与显式 Live toggle；Demo 数据可一键 reset，Live 模式严禁 mock tx | P0 | Bowen | Done | `src/demo/mode.js` + `/api/demo/mode|reset`；顶部常驻 banner/Live toggle/reset；Live 前置不足返回 409，PaymentOracle 写入失败不会退回假 tx |
| DEMO-2 | 首页只保一个主 CTA："购买这笔 RWA 的 AI 风控报告"；二级入口再放融资/市场/航运 | P0 | Bowen | Todo | 5 秒可用性测试：新用户能说出谁付钱、买什么、链上发生什么 |
| DEMO-3 | 完成支付流水、riskPulse、priceFlash、waterfall、Agent activity 的同屏联动 | P1 | Bowen | Todo | 同一 `report_id/decision_id/tx_hash` 贯穿各面板；没有随机日志或不一致数字 |
| DEMO-4 | 编写 30 秒 / 1 分钟 / 3 分钟中文路演稿与英文 tagline，三版数字、角色和叙事完全一致 | P0 | Bowen | Todo | 交叉检查 README、PRD、demo-script、video-script；至少 3 次计时彩排 |
| DEMO-5 | 新建 `npm run preflight`，汇总 54 项检查：环境、文件/schema、300 Node tests、24 contract tests、smoke/scenarios、MCP、x402、RPC/facilitator、余额、合约地址、UI asset、文档一致性 | P0 | Bowen | Done | `scripts/preflight.mjs` 固定 54 项并真正执行全部套件；Demo 实测 50 PASS / 4 Live WARN / 0 FAIL；关键失败 exit 1 |
| DEMO-6 | 评委追问预案：为什么 AI、谁承担货损、为何不是证券保本、报告是否能伪造、支付失败怎么办、为何必须 Injective、与 TradeGo/银行差异 | P0 | Bowen | Todo | 每题 20 秒答案 + 可点击证据/代码/tx；不做未经律师确认的法律断言 |
| DEMO-7 | 录制 Live 主视频 + Demo Mode 兜底视频，准备本地 MP4、关键截图和 CLI 兜底 | P0 | Bowen | Todo | 飞行模式也能播放；视频中的 tx 链接和当前部署配置一致 |
| DEMO-8 | 做一次"故障彩排"：RPC、facilitator、LLM、xAPI、钱包分别失效 | P0 | Bowen | Todo | 每种故障 15 秒内切到正确兜底；不刷新整场、不暴露堆栈/密钥 |

### 11.3 `preflight` 固定 54 项

实现时按下列编号输出，不能用"54 项"当口号却只跑五条命令。Live-only 检查在 Demo Mode 可记为 `SKIP`，但不能记为 `PASS`。

| # | Check | # | Check |
|---:|---|---:|---|
| 1 | AgentBL Node 版本满足 `engines` | 28 | 静态安全扫描无未处理 high finding |
| 2 | 启用官方 Injective MCP 时 Node ≥22 | 29 | 完整协议部署后链上 smoke |
| 3 | `package-lock.json` 与 `package.json` 一致 | 30 | Payment/Pricing oracle event 可回读 |
| 4 | `.env` 必需项存在且 secrets 未被 git 跟踪 | 31 | MCP stdio initialize/handshake |
| 5 | `demoMode` / Live mode 配置互斥且明确 | 32 | MCP tool 数量严格等于 7 |
| 6 | chainId / CAIP-2 / network 名一致 | 33 | 7 个 tool schema 均合法 |
| 7 | RPC health 与 chainId 实测一致 | 34 | 7 个 tools 最小调用均成功 |
| 8 | explorer base URL 格式与网络一致 | 35 | MCP resource 数量严格等于 3 |
| 9 | facilitator `/supported` 覆盖目标网络 | 36 | 3 个 resources 均可 read |
| 10 | Live 钱包 INJ gas + USDC 余额足够 | 37 | 官方 Injective MCP 只读查询成功 |
| 11 | `data/demo-case.json` schema | 38 | 官方 MCP 写操作 policy/dry-run 生效 |
| 12 | 所有 `data/cases/*.case.json` schema | 39 | 三个 x402 端点首次请求都返回合法 402 |
| 13 | 所有 PricingQuote schema + 不变量 | 40 | x402 tamper/replay/expiry 负例全拒绝 |
| 14 | PaidReportEnvelope schema + hash 重算 | 41 | x402 Demo settlement 三端点全解锁 |
| 15 | `chain-config.json` schema | 42 | x402 Live payment + PaymentOracle（Live-only） |
| 16 | 配置中的合约地址有 bytecode | 43 | `index.html` 引用的本地 assets 均存在 |
| 17 | 前端 ABI 与部署 artifact/version 一致 | 44 | 中英文 i18n keys 无缺失 |
| 18 | 风险 feed freshness 与 source health | 45 | 390px 移动 viewport 无横向溢出 |
| 19 | case/cargo/payment/report ID 无重复 | 46 | reduced-motion 模式无强闪烁动效 |
| 20 | README 覆盖当前全部环境变量 | 47 | Demo reset 后状态完全可重放 |
| 21 | `npm run check` | 48 | 1 分钟主流程计时 ≤65 秒 |
| 22 | `npm test` 且不少于当前 300 tests | 49 | 30 秒/1 分钟/3 分钟数字与角色一致 |
| 23 | `npm run smoke` | 50 | README/UI/视频中的 explorer 链接可打开 |
| 24 | `npm run scenarios` | 51 | Live 模式无 `mock/random/demo tx` |
| 25 | `npm run demo` | 52 | 日志与 telemetry 隐私/secret 扫描 |
| 26 | `hardhat compile` | 53 | 本地 CLI、截图、MP4 兜底资产齐全 |
| 27 | `hardhat test` 且不少于当前 24 tests | 54 | 输出 commit SHA、build time、dirty tree 警告 |

---

## 12. QA / Integrator

QA 目标：任何新增功能都必须回到同一条主链路，不能散。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| QA-1 | 维护 `npm run check` | Bowen | Todo | `npm run check` | - |
| QA-2 | 维护 `npm run test` | Bowen | Todo | `npm run test` | - |
| QA-3 | 维护 `npm run smoke` | Bowen | Todo | `npm run smoke` | - |
| QA-4 | 维护 `npm run scenarios` | Bowen | Todo | `npm run scenarios` | - |
| QA-5 | 增加 pricing invariant tests：兑付敞口不能超过安全覆盖 | Bowen | Todo | `npm run test` | - |
| QA-6 | 增加前端手动验收清单 | Bowen | Todo | checklist 文档 | - |
| QA-7 | 最终演示前跑完整验证矩阵 | Bowen | Todo | `npm run check && npm run test && npm run smoke && npm run scenarios && npm run demo` | - |
| QA-8 | 准备演示失败兜底：CLI demo、mock provider、contract mock | Bowen | Todo | README / docs 更新 | contract mock 已完成（`contractHarness.js`）；CLI demo / README 兜底说明待补 |
| QA-9 | 最后 6 小时功能冻结协调 | Bowen | Todo | 全员确认 | - |
| QA-10 | 增加自主 Agent 可靠性测试矩阵：事件乱序、重复事件、进程重启、RPC 超时、xAPI/LLM 不可用、链上交易失败 | Bowen | Todo | `npm run test`，所有失败路径均有幂等恢复或确定性 fallback | - |
| QA-11 | 增加 eBL V2 安全测试：一货多单、伪造 cargoHash、未授权 transfer/endorse、质押中转让、重放攻击 | Bowen | Todo | `cd hardhat && npm test` + 安全测试报告 | - |
| QA-12 | 增加市场与角色 API 集成测试：访问控制、分页、并发认购、持久化恢复、链上/链下状态对账 | Bowen | Todo | `npm run test && npm run smoke`，API、持久化存储与合约事件三方一致 | - |
| QA-13 | 建立 MetaMask / Keplr / Leap × 桌面/移动端 × 真实链/离线 fallback 的手动验收矩阵 | Bowen | Todo | 完整 checklist、截图与测试 tx hash | - |
| QA-14 | 按 gap analysis v2 跑通 3 分钟 P0 验收：上传 → 唯一性 → 解析 → 自主定价/开盘 → 市场认购 → 风险暂停/恢复 → 自动兑付 | Bowen | Todo | 录像 + 决策日志 + 全套链上 tx；任何一步不得依赖伪造随机 tx | - |

---

## 13. 执行顺序与出线闸门

### 13.1 最小可演示闭环

原有 AI 定价、市场 View ⓪、MetaMask 单 Demo 合约与离线 fallback 已构成 v1 基线。面向 gap analysis v2，如果时间不够，新增范围至少保以下 16 个任务：

```text
PM-8   No-bank / Web3-native 叙事统一
AI-13  Agent orchestrator
AI-14  Event → Decision → On-chain Action
AI-16  可持久化决策审计日志
AI-17  AI 文档解析
BE-14  文档上传 + ENI adapter + 自动触发
BE-15  Agent 活动实时 API
FE-11  eBL 管理 View ③
FE-13  Agent 活动 View ⑤
WEB3-12 cargoHash 唯一性
WEB3-14 eBL 流转与质押约束
WEB3-15 RESUME / SETTLE 自主状态机
WEB3-16 投资者访问模型与 v2 叙事对齐
WEB3-17 完整协议部署 Injective inEVM
WEB3-18 MetaMask + Keplr + Leap
QA-14  3 分钟 P0 端到端验收
```

这 16 个完成，项目才能从"AI 定价演示"升级为"eBL 上链即自主运行、风险变化即自主执行、全程可审计"的 Web3 原生协议。多链配置、组合页、多 LLM 与品牌主题可在核心闭环稳定后并行补齐。

### 13.2 Wave A：48 小时内先闭环

```text
X402-1 → X402-3/4/6 → X402-8 → X402-13/14
DEMO-1 → DEMO-5
```

Gate A：Demo Mode 能稳定出现 402、结算、解锁三个不同付费结果；12+ x402 tests 全绿。若 testnet facilitator 不支持，必须在此时决定 mainnet 小额实付或显式 demo，不把不确定性拖到最后。

**Gate A 状态：✅ 已达成。** 三类 Demo 报告完成 402→签名→结算→解锁，当前 300 个 Node tests 全绿；Live V2/EIP-3009 已完成一笔 0.001 USDC 真实支付，并由 `PaymentAttested` 将 payment tx、报告哈希和 case 绑定。

### 13.3 Wave B：链上可信与 Agent 可组合

```text
X402-7/9/10/15 → WEB3-17 → MCP-6/7/8/10 → MCP-9
```

Gate B：一笔真实支付能从 payment tx 追到 `PaidReportEnvelope`、`PaymentAttested`、`PricingUpdated` 和最终 RWA 报价；MCP Inspector 能列出 7 tools + 3 resources。

**Gate B 状态：✅ 已达成。** 0.001 USDC 真实 payment tx → 脱敏 `PaidReportEnvelope` 承诺 → `PaymentAttested` → 以同一 `report_hash` 为 `evidenceHash` 的 `PricingUpdated` → pool #2 最终报价 `$0.80`；官方 SDK stdio client 已逐一调用 7 tools 并读取 3 resources，官方 Injective MCP 也完成查询和受控 raw EVM testnet 交易。总证据见 `docs/wave-b.md` 与 `docs/evidence/wave-b-gate.json`。

### 13.4 Wave C：AI 证据与产品打磨

```text
SP-8/9/10 → TRUST-1/2/3/5 → X402-11/12 → DEMO-3/4/6
```

Gate C：Azure eval 达阈值，trace 能看到完整 Agent 工具链，页面 60 秒演示无口头补丁。

**Gate C 状态：✅ 核心已达成。** SP-8/9/10 全部完成（Azure OpenAI provider、20 条评估数据集、OpenTelemetry tracer）；TRUST-1/2/3/5 全部完成（20 条 Gold Dataset、评估报告生成器、Prompt Injection 防护 + 5 个恶意测试、数据新鲜度验证器）；321/321 tests 全绿（100%）。X402-11/12 和 DEMO-3/4/6 演示打磨待完成。核心 AI 质量证明已就绪。

### 13.5 Wave D：决赛冻结

```text
DEMO-7/8 → QA-10~14 → TRUST-4/6/7 → npm run preflight
```

Gate D：连续 3 次 preflight 全绿；Live/Demo/CLI/视频四套路径都演练；最后 6 小时只修 P0 blocker。

---

## 14. 赞助方技术使用清单

多用，但每一项都要有业务理由。

| ID | Sponsor / capability | Priority | 应用位置 | Task / 验收 | Status |
|---|---|---|---|---|---|
| SP-1 | Injective EVM | P0 | 五合约协议、PaymentOracle、USDC x402 | 完整部署、验证源码、记录地址/tx、前端回读事件 | Done |
| SP-2 | Injective x402 | P0 | AI 情报按次付费 | 完成 X402-1~16；路演展示真实 402 和支付 tx | Done |
| SP-3 | Injective MCP Server | P1 | Agent 查链、执行受控 raw EVM tx | 完成 MCP-9/10；不要把自建 MCP 冒充官方 MCP | Done |
| SP-4 | Injective EVM / CLI agent skills | P1 | 开发、部署与故障排查工作流 | 在 `docs/injective-runbook.md` 记录安装、使用场景和可复现命令；它是工程能力，不伪装成产品 runtime | Done — 官方 skills 安装、chain pinning、部署/precompile 命令、故障与回滚手册已固化 |
| SP-5 | Injective ERC20/Bank precompile | P1 | 统一 USDC 余额/denom/转账与 RWA token 的 EVM/native 映射 | 做最小 read/write spike；成功后再决定是否进入 P0，避免自建重复桥接层 | Done — `0x64` + MTS USDC 读写实测；ERC20/x-bank 余额一致；tx `0xc0cf…ff7f`；当前多池 RWAToken 映射诚实延后至 per-pool V2 |
| SP-6 | Injective Exchange precompile | P2 | 可选的 RWA 二级市场/风险对冲 | 只有存在真实测试市场与清楚经济模型时才接；验收为真实 order/query，不以 mock 截图算完成 | Done — 仅 GOLD 直连对冲获准；真实 `0x65` deposit/spot/order/query/cancel/withdraw，order `0xfe53…2b58`、order tx `0x38c9…fc5b`；铜/铝/大豆/原油无直接市场时 fail closed |
| SP-7 | Injective Indexer + Explorer | P0 | 支付、定价、暂停、恢复、兑付事件回读 | UI 中每个关键状态都能跳到真实 tx/event；Indexer 不可用时 RPC fallback | Done |
| SP-8 | Azure OpenAI / Microsoft Foundry Models | P1 | `openaiCompatClient` 新增 Azure provider；解析、解释、报告生成 | `AZURE_OPENAI_ENDPOINT/DEPLOYMENT/API_KEY` 配置；工具调用与 structured output 通过；确定性 fallback 保留 | Done |
| SP-9 | Microsoft Foundry Evaluation | P1 | Agent AI 质量证明 | 建立 ≥20 条 eval dataset；Task Completion ≥85%、Tool Call Success ≥95%、Groundedness ≥0.8；保存可分享结果截图/JSON | Done |
| SP-10 | Microsoft Foundry / Application Insights tracing | P1 | Agent 调用链可观测 | 用 OpenTelemetry 记录 parser→checker→risk→valuation→pricing→payment→chain spans、延迟、错误和成本；默认脱敏 | Done |
| SP-11 | GitHub Copilot | P2 | 团队开发效率 | 只在开发说明中如实记录，不作为产品技术创新点或 runtime 集成 | - |
| SP-12 | ENI / TradeGo / 丽讯 | P0 | 可信 eBL、真实业务数据、落地背书 | 至少拿到 sandbox/API schema、样例 document ID 或正式 LOI 之一；拿不到时显式 mock adapter，不虚构合作上线 | - |
| SP-13 | xAPI | P0 | X/新闻/预测市场世界风险 | 已有；新增 freshness、source health、去重与付费报告引用，继续保留离线 fixture | Done |

---

## 15. 团队分工与协作流程

### 15.1 推荐并行分工

| 角色 | 负责人建议 | 主要任务 |
|---|---|---|
| PM / Pitch | 1 人 | PM-1 到 PM-8，demo script，合规 Q&A，No-bank 叙事一致性 |
| AI | 2 人 | AI-1 到 AI-20，pricing、orchestrator、autonomous loop、parser、compliance、advisor、LLM consensus |
| Backend | 1-2 人 | BE-1 到 BE-15，API、schema、scenario、ENI ingestion、market/pool/role persistence |
| Frontend | 1-2 人 | FE-1 到 FE-15，Marketplace + Mint + Voyage + eBL/Portfolio/Agent Activity |
| Web3 | 1-2 人 | WEB3-1 到 WEB3-19，eBL V2、自主状态机、完整协议部署、多钱包/多链 |
| QA / Integrator | 1 人 | QA-1 到 QA-14，最终集成、安全、钱包矩阵和演示兜底 |

### 15.2 任务认领流程

1. 先拉最新 `main`。
2. 在本文件找到 `Bowen` 任务。
3. 把 Owner 改成自己。
4. 把 Status 改成 `In Progress`。
5. 开分支开发。
6. 完成后跑验证命令。
7. 提 PR。
8. 合并后把 Status 改成 `Done`，Done Evidence 填 PR 或 commit。

### 15.3 分支命名

```text
feature/ai-pricing-quote
feature/backend-pricing-api
feature/frontend-rwa-offering
feature/contract-risk-pricing-oracle
feature/scenario-high-risk-reprice
feature/agent-orchestrator
feature/agent-autonomous-loop
feature/ebl-registry-v2
feature/eni-document-ingestion
feature/agent-activity-view
fix/pricing-invariant
docs/pitch-tokenomics
```

### 15.4 合并标准

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

---

## 16. 2025-2026 黑客松冠军冲刺任务

基于对 ETHGlobal 等顶级赛事的最新趋势研究，以下是建议的冠军冲刺任务（按优先级划分）：

### 16.1 可验证 AI 信任层 (Verifiable AI Trust)
| ID | Task | Priority | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| VERIFY-1 | TEE 模拟推理证明：生成包含 hash 验证的 `inference_attestation`，存入 PricingOracle 事件 | P0 | Bowen | Todo | `npm run verify-inference` 验证链上与链下的一致性 | - |
| VERIFY-2 | 推理可重放 (Reproducible Inference)：提供 CLI 重跑定价，证明基于相同 hash 能得出相同结果 | P0 | Bowen | Todo | 命令行输出相同的 evidence_hash 和 quote_hash | - |
| VERIFY-3 | 多方推理共识上链：把 AI-20 的多 LLM 共识元数据（中位数、分歧度等）写入合约事件 | P1 | Bowen | Todo | 检查合约事件中包含 consensus attestation | - |

### 16.2 智能账户与 Agent 钱包 (Smart Account & Agent Wallet)
| ID | Task | Priority | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| AA-1 | Agent 智能钱包 (Session Keys)：基于 ERC-4337，限制 Agent 的合约白名单和单笔限额 | P0 | Bowen | Todo | 测试网 Agent 通过 Session Key 发起受限交易成功 | - |
| AA-2 | Paymaster 免 Gas：让投资者通过 Paymaster 零 Gas 认购，或协议代付 x402 gas | P1 | Bowen | Todo | 无 INJ 余额钱包能够成功认购 RWA 或购买报告 | - |
| AA-3 | 交易预览与风险模拟 (Tx Simulation)：用户签名前展示即将发生的资金流转和风险提示 | P0 | Bowen | Todo | 弹窗准确解析 tx_data，展示预估的 USDC 和 RWA 转移 | - |

### 16.3 Agent 身份与声誉系统 (On-Chain Agent Identity)
| ID | Task | Priority | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| AGENTID-1 | Agent 链上身份注册：部署 ERC-721 身份合约，声明 Agent 的能力与 Model Hash | P0 | Bowen | Todo | `AgentRegistry` 成功部署并 mint NFT | - |
| AGENTID-2 | Agent 声誉累积：结算完成后在 `AgentRegistry` 更新分数，影响下一次可信度权重 | P1 | Bowen | Todo | `npm run test`，模拟违约或成功兑付导致的声誉变化 | - |
| AGENTID-3 | Agent 能力声明 (Capability Manifest)：链上注册支持的 MCP tools | P1 | Bowen | Todo | 调用 getter 返回 AgentBL 支持的 tools 列表 | - |

### 16.4 Agent 间协作协议 (Agent-to-Agent Commerce)
| ID | Task | Priority | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| A2A-1 | Agent 任务卡片 (A2A Agent Card)：发布 `/.well-known/agent.json` 声明能力和定价 | P0 | Bowen | Todo | 访问该 endpoint 返回合法的 A2A 协议 JSON | - |
| A2A-2 | Agent 间委托定价：外部 Agent 发送委托，AgentBL 返回报价和 x402 付费证据 | P1 | Bowen | Todo | 通过另一个 MCP Client (如 Claude Desktop) 发起完整交互 | - |

### 16.5 交易意图架构 (Intent-Based Execution)
| ID | Task | Priority | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| INTENT-1 | 投资者认购意图：签署 "我要用 ≤5000 USDC 认购 yield ≥15% 的 RWA" 意图，自动匹配执行 | P1 | Bowen | Todo | 测试用例生成意图并由 Solver 匹配成功 | - |
| INTENT-2 | 出口商融资意图：签署意图要求特定时间内获得不低于某个发行价的融资 | P1 | Bowen | Todo | 根据速度和底价自动调整并创建发行池 | - |

### 16.6 实时可视化与路演打磨 (Demo Polish & Visualization)
| ID | Task | Priority | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| STREAM-1 | 链上事件实时流：WebSocket 订阅事件，实时渲染为动态时间轴，不再需要手动刷新 | P0 | Bowen | Todo | 页面开着时注入事件，UI 自动新增流光动画节点 | - |
| STREAM-2 | 全球风险热力图：展示航线、战争、天气风险，与 xAPI 联动 | P1 | Bowen | Todo | UI 展示风险热力图，并随 scenario 切换实时变色 | - |
| DEMO-9 | "Holy Sh*t" 一键全演示：自动跑通上传->购买->定价->暂停->兑付的全流程，并带 3s 延迟和高亮 | P0 | Bowen | Todo | 点击 "▶ Full Demo"，不再需任何点击操作即可跑完全场 | - |
| DEMO-10 | 对比演示：侧边或分屏对比银行 45 天 vs AgentBL 60 秒 | P0 | Bowen | Todo | 页面上有明确的 Value Proposition 视觉对比 | - |
| DEMO-11 | 评委专属 Dashboard：展示全部技术证据、trace 链接和 Tx Hash，供一键核查 | P1 | Bowen | Todo | 有一个 /evidence 面板，汇总所有的 Explorer 链接 | - |

### 16.7 经济模型与安全增强 (Tokenomics & Security)
| ID | Task | Priority | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| ECON-1 | 动态定价交互模拟器：拖动滑块实时看到战争、天气风险如何改变发行价 | P0 | Bowen | Todo | 滑动 UI 进度条，调用 mock pricing 引擎实时输出数值 | - |
| SEC-1 | 合约静态分析 (Slither)：修复所有 High/Medium finding，生成报告 | P0 | Bowen | Todo | `slither .` 零 High 级漏洞，生成 report.md | - |
| SEC-2 | Agent 权限隔离矩阵：文档化 AI 的不可操作范围，展示约束能力 | P0 | Bowen | Todo | 新增 `docs/security-matrix.md` 并被 README 引用 | - |

---

## 17. 世界级黑客松进阶蓝图 (World-Class Roadmap)

为了将 AgentBL 从一个优秀的黑客松 Demo 升级为十亿美元级别的 Web3 贸易融资基础设施，我们将在下一阶段（V2）引入以下核心特性：

| ID | 任务方向 | 优先级 | 状态 | 商业价值与技术愿景 |
|---|---|---|---|---|
| ZK-1 | 零知识证明隐私 (zkTLS) | P0 | Todo | 出口商的商业机密（发票金额、航线）不应在公链裸奔。通过 zkTLS 和 ZK-SNARKs，向 RiskPricingOracle 证明货值和真实性，实现**链上隐私合规定价**。 |
| DEFI-1 | 跨链流动性路由 (Cross-Chain Liquidity) | P0 | Todo | 接入 Wormhole 或 LayerZero，允许以太坊、Arbitrum 等主流链上的 USDC 投资者一键认购，底层自动跨链至 Injective RWA 池，彻底**打破流动性孤岛**。 |
| AI-21 | 去中心化 AI 预言机网络 (AVS) | P0 | Todo | 单个 AI 节点存在中心化作恶风险。将 `valuationAgent` 升级为基于 EigenLayer 的 AVS 网络，多个自主节点质押 INJ/ETH 进行估值共识，实现真正的**去中心化 AI 信任**。 |
| COMP-1 | 机构级合规网关 (Institutional KYC/AML) | P1 | Todo | 接入 Quadrata / zkMe 等真实身份提供商。在 `RWAOfferingPool` 智能合约中增加合规门槛，确保只有通过 KYC 的机构资金可以认购高级别风险池。 |
| TOKEN-1 | 动态代币经济与自动保险池 ($ABL) | P1 | Todo | 推出协议治理代币。协议通过 x402 销售情报和 RWA 发行抽成获得的收入，将按特定比例自动回购注入**去中心化保险池 (Backstop Fund)**，为投资者提供终极坏账兜底。 |

这 5 项进阶任务将彻底补齐 AgentBL 在隐私、流动性、去中心化共识和代币经济学上的版图，是我们在黑客松决赛中冲击顶尖名次、并在未来走向主网生产环境的关键底牌。

---

## 18. 借鉴顶尖获奖项目

| 项目 / 可借鉴模式 | AgentBL 落地方式 | 不要照搬的部分 |
|---|---|---|
| AgentLevy：先承诺验收标准，再把付款与可验证交付绑定 | `PaidReportEnvelope` + schema/证据/新鲜度检查 + `report_hash`/payment tx 绑定 | P0 不做通用仲裁协议和复杂 escrow |
| Alpha402：持久状态机、可视化流水、审计证明、故障 fallback | x402 六状态 stepper、decision/payment log、live/demo 双模式 | 不堆无业务意义的多 Agent 数量和 3D 特效 |
| AgentSlam：可靠性与可观测性优先，bounded retry/heartbeat | settlement 幂等、Agent trace、RPC/facilitator 健康检查、故障彩排 | 不把 mock fallback 伪装成真实链结果 |
| RWA-GPT：自然语言降低 RWA 使用门槛 | 市场 AI 搜索、MCP、报告证据解释 | 不退化成"聊天框 + 投资按钮" |

---

## 19. 官方研究依据（实现前再次核验）

- [Injective x402 官方指南](https://docs.injective.network/developers-ai/x402)：官方 `@injectivelabs/x402`、USDC 支付、facilitator、Injective EVM 示例。
- [Injective MCP Server](https://docs.injective.network/developers-ai/mcp)：stdio、链查询、转账、桥接与 raw EVM transactions。
- [Injective AI Developers](https://docs.injective.network/developers-ai)：Injective CLI/EVM/MCP/Trading skills 与最新 AI 开发路线。
- [Injective EVM Precompiles](https://docs.injective.network/developers-evm/precompiles/) 与 [Exchange Precompile](https://docs.injective.network/developers-evm/exchange-precompile)：EVM 调用 Bank/Exchange 等原生模块。
- [Injective ERC20 Module](https://docs.injective.network/developers-evm/erc20-module)：USDC/IBC/tokenfactory denom 与 ERC20 映射。
- [x402 Foundation spec / SDK](https://github.com/x402-foundation/x402)：V2 headers、client/server/facilitator、EVM SDK 与安全语义。
- [Microsoft Foundry Agent Evaluators](https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-evaluators/agent-evaluators)：Task Completion、Tool Call、Groundedness 等评测。
- [Microsoft Foundry Agent Tracing](https://learn.microsoft.com/en-us/azure/foundry/observability/concepts/trace-agent-concept)：OpenTelemetry、tool spans、延迟与成本可观测。
- [AgentLevy](https://ethglobal.com/showcase/agentlevy-s577a)、[Alpha402](https://ethglobal.com/showcase/alpha402-04vgq)、[AgentSlam](https://ethglobal.com/showcase/agentslam-znyyq)、[RWA-GPT](https://ethglobal.com/showcase/rwagpt-fssdh)：用于提炼可验证交付、可视化状态机、可靠 fallback 和自然语言 RWA UX 模式。

---

## 20. Mystery Voyage：盲盒增长机制与落地计划（2026-07-22）

### 20.1 产品结论：盲的是航线，不盲风险

盲盒不能被做成“随机买高收益 RWA”或“抽中稀有高 APY”的金融博彩。AgentBL 最适合的冠军版机制是：

> **Mystery Voyage（神秘航线）是一种惊喜式 RWA 发现入口：合格用户先选择风险护照，系统在公开风险边界内锁定候选集；用户通过 x402 小额购买一次 AI 尽调揭晓，看到完整货物、航线、定价、最坏情景和公平性证明后，再单独决定是否认购。**

核心原则：

```text
盲盒前：公开候选数量、命中概率、风险区间、价格/收益区间、最大压力损失、报告费和筛选规则
盲盒中：只支付 AI 报告费；不划转投资本金，不自动认购，不承诺奖品价值
盲盒后：揭晓具体 eBL/RWA + 完整 AI 报告 + 随机性证明；用户再次确认后才进入原有 subscribe 流程
```

一句话路演：**“We hide the voyage, never the risk. x402 unlocks the due diligence; Injective proves the reveal; investing is always a second, explicit decision.”**

### 20.2 为什么它与当前项目天然匹配

| 当前真实能力 | Mystery Voyage 如何复用 | 必要改造 |
|---|---|---|
| 投资市场 `GET /api/market/listings` | 候选 RWA 池与揭晓后的详情页 | 候选集必须使用真实 `PricingQuote`，不能继续依赖 `0.90 / 1000bps / riskBps=200` 硬编码 mock |
| AI 定价、审单、估值、世界风险 | 生成盲盒前风险边界和揭晓后的 AI Risk Passport | 增加候选资格策略、压力损失和适配理由 |
| x402 三类付费报告 | 用真实 HTTP 402 完成“开盒”动作 | 新增 `mystery-voyage` 服务与付费报告 kind/builder |
| `PaymentOracle` | 将开盒支付、报告哈希、case 绑定上链 | P0 直接复用，无需为动画新部署合约 |
| `RWAOfferingPool` + `InvestorComplianceGate` | 揭晓后进行独立、合规的 RWA 认购 | 开盒前后均检查 eligible、pool state 和额度 |
| 投资组合 API/页面 | 揭晓后把认购结果加入持仓 | 增加“发现来源 = Mystery Voyage”，不虚构 Live tx |
| Demo Mode / Live Mode | 离线稳定演示 + 真实 x402/Explorer 证据 | Demo receipt 必须标 `DEMO`；Live 只接受真实 payment tx |

它带来的不是孤立玩法，而是一条新的增长漏斗：

```text
市场访客
  → 选择风险护照（低认知负担）
  → x402 小额付费开盒（协议收入）
  → AI 尽调揭晓（教育 + 信任）
  → 查看航线故事 / 公平性证明（分享传播）
  → 二次确认认购（合格投资转化）
  → Voyage Passport 收藏章（非金融留存）
```

### 20.3 P0 机制：Mystery Voyage Discovery Box

#### 20.3.1 开盒前的 Risk Passport

用户必须先选择或确认：

- 风险档：`CONSERVATIVE / BALANCED / ADVENTUROUS`；
- 单次报告预算和未来投资预算上限（两者严格分开）；
- 最大可接受风险分、最大压力损失和最低抵押覆盖；
- 禁投货物、航线、司法辖区与制裁命中项；
- 预计到期区间和流动性偏好；
- 合规资格与风险确认状态。

开盒按钮上方必须公开：

- 当前符合条件的候选数 `N`，默认每个候选概率均为 `1/N`；
- 若未来使用权重，必须在支付前公开每个权重和算法版本，禁止暗箱调权；
- 候选风险、发行价、目标上行和压力损失的最小/最大区间；
- `1 RWA = $1.00` 仅为 target redemption value，非保本；
- 本次只支付 x402 AI 报告费，开盒不会认购资产；
- 报告价格、是否可退款、失效时间和异常重试规则。

#### 20.3.2 用户流程

```text
1. Preview：用户选择 Risk Passport，后端过滤 eligible + Open/Repriced 的池
2. Commit：后端冻结候选快照，返回 candidate_set_hash + server_commitment + 概率/风险边界
3. User entropy：浏览器用 crypto.getRandomValues 生成 user_nonce（必须晚于 server commitment）
4. x402：用户支付 0.001 USDC demo price，PaymentOracle 绑定 payment tx 与报告哈希
5. Reveal：服务端公开 server_secret，双方熵选择一个 pool，返回完整 AI Risk Passport
6. Verify：浏览器本地重算 commitment、candidate set、selection hash 和 selected index
7. Decide：用户阅读完整风险后点击“认购”或“返回市场”；认购是第二笔独立签名/交易
8. Collect：完成一次揭晓获得非转让 Voyage Passport 路线章，不影响收益、额度或概率
```

#### 20.3.3 揭晓内容

揭晓页必须一次显示：

- 货物、起运港/目的港、ETA、eBL/cargo hash 摘要；
- `final_issue_price_usd`、目标兑付价、目标上行和“非保证收益”提示；
- AI 核验货值、抵押覆盖、风险分、风险等级、最坏压力回收率/损失；
- 审单疑点、保险缺口、战争/天气/港口证据和数据新鲜度；
- 为什么它符合用户 Risk Passport；
- x402 payment tx、`PaymentAttested`、`report_hash`、`evidence_hash`；
- 公平性证明和一键 Verify；
- 两个同等显著按钮：“查看完整报告”和“风险确认后认购”，不得用倒计时逼单。

### 20.4 可验证公平：P0 commit-reveal，生产版接外部 VRF

P0 使用可重放的 commit-reveal，不使用 `Math.random()`、时间戳或后端临时挑选结果：

```text
eligible_pool_ids  = sort(filter(listings, risk_passport + compliance + active_state))
candidate_set_hash = keccak256(canonical_json(eligible_pool_ids + disclosed_weights + quote_hashes))
server_commitment  = keccak256(server_secret)

# server_commitment 必须先返回；之后客户端才生成 user_nonce 并发起 x402
selection_hash = keccak256(
  algorithm_version || round_id || server_secret || user_nonce ||
  payment_tx_hash || candidate_set_hash || wallet_address
)
selected_index = rejection_sample(selection_hash, eligible_pool_ids.length)
```

`MysteryRevealProof` 建议结构：

```ts
type MysteryRevealProof = {
  reveal_id: string;
  round_id: string;
  algorithm_version: 'mystery-voyage-v1';
  risk_passport_hash: `0x${string}`;
  candidate_pool_ids: string[];       // 揭晓后公开，用于复算
  candidate_quote_hashes: `0x${string}`[];
  disclosed_weights: number[];        // P0 全为 1
  candidate_set_hash: `0x${string}`;
  server_commitment: `0x${string}`;
  server_secret: `0x${string}`;       // 仅在支付结算后公开
  user_nonce: `0x${string}`;
  payment_tx_hash: `0x${string}` | `demo://receipt/${string}`;
  selection_hash: `0x${string}`;
  selected_index: number;
  selected_pool_id: string;
  report_hash: `0x${string}`;
  created_at: string;
  expires_at: string;
};
```

公平性边界必须诚实说明：commit-reveal 可以阻止服务端在看到用户 nonce / payment tx 后换结果，但不能彻底消除服务端选择性中止。P0 对中止采取“记录 abort + 原支付凭证免费重开/退款状态 + 不得静默换池”；生产版再接经核验支持 Injective 的外部 VRF/随机信标，并把 request/fulfillment 证明纳入同一 proof。

### 20.5 P1 进阶：Portfolio Mystery Box（先揭晓、再成交）

P1 可以让机构投资者提交一个组合意图，例如“预算 5,000 USDC、最多 3 个项目、风险不高于 WARNING、单项目不超过 40%、最低抵押覆盖 120%”。AI 先随机生成符合约束的多航线组合，揭晓并展示每项完整报告，用户再次签名后才逐池认购。

约束：

- P1 仍然不是“先扣投资本金再告诉你买了什么”；资金最多进入可撤销 reservation/escrow，不得在揭晓前不可逆成交；
- 每个选中池必须分别通过 `InvestorComplianceGate.isEligible`、状态、剩余额度和集中度检查；
- 组合选择必须满足总预算、单池上限、货物/航线分散度、相关性和最大压力损失；
- 任一池在揭晓到确认期间变为 Paused/Frozen，整单 fail closed，由用户重新确认新组合；
- P1 合约仅在 P0 用户漏斗被验证后开发，避免为一个营销动画增加新的资金托管攻击面。

不做：随机 APY、稀有度对应更高收益、付费无限重抽、邀请返投资本金、可交易盲盒 NFT、未揭晓即自动认购、面向未完成 KYC/AML 的公众销售。

### 20.6 经济模型与增长策略

| 收入/增长项 | 设计 | 护栏 |
|---|---|---|
| x402 开盒收入 | P0 demo 建议 `0.001 USDC/reveal`；商业价格按完整数据成本配置 | 报告费与投资本金分离；付费不改变风险分、揭晓概率或发行价 |
| Premium upsell | 揭晓摘要后可购买已有 valuation / fraud / world-risk 深度报告 | 不重复收费；页面显示已购内容与 TTL |
| Issuer-sponsored discovery | 出口商可赞助合格投资者的报告费，提升项目发现率 | Sponsor 不得影响随机权重、AI 评分或搜索排名，必须显式披露 |
| Voyage Passport | 收集铜、原油、大豆、橡胶等航线章，形成分享卡和回访理由 | 非转让、无现金价值、不影响投资资格/收益/概率 |
| Institution API | 其他 Agent 通过 MCP/A2A 批量请求 Risk Passport 与公平揭晓 | 预算、频率、合规、幂等和审计日志强制执行 |

北极星指标不是“开盒次数”，而是 **Qualified Report-to-Investment Conversion**：完成风险披露的合格用户中，报告揭晓后进入认购确认的比例。

必须埋点：`mystery_impression → passport_completed → preview_created → 402_challenged → payment_settled → reveal_verified → report_opened → risk_acknowledged → subscribe_started → subscribe_confirmed`。

增长验收目标（黑客松演示/封闭测试，不对外声称真实市场数据）：

- 90% 的测试者在 10 秒内说清“只买了报告，还没买 RWA”；
- 100% 能在揭晓页找到非保本、最坏损失和 Verify；
- Demo 开盒全流程 ≤ 45 秒，随后 ≤ 15 秒展示独立认购确认；
- 付费/揭晓失败率、选择性中止率和风险确认跳出率独立展示，不用转化率掩盖风险。

#### 20.6.1 MBOX-PM-3 冻结规范：披露、风险确认、退款与冷静期

本规范是产品底线，不是法律意见；上线司法辖区的适用法、合格投资者规则、数字内容撤回权和退款时限仍须由当地律师确认。前端、API 和 Demo 必须遵循同一状态顺序：

~~~text
DISCLOSURE
  → USER_ACKNOWLEDGED_REPORT_PURCHASE
  → COMMITTED
  → X402_SETTLED
  → REVEALED
  → PROOF_VERIFIED
  → REVIEW_COOLDOWN
  → USER_ACKNOWLEDGED_INVESTMENT_RISK
  → OPTIONAL_SUBSCRIPTION_SIGNATURE
~~~

任何跳步、预勾选、合并签名或“开盒即认购”均视为 P0 blocker。

**A. 开盒付款前必须同屏展示**

1. **买到什么**：本次购买的是一次 AI 尽调报告和 Mystery Voyage 揭晓服务，不是 RWA、存款、保险、抽奖券或收益权；
2. **支付什么**：精确报告费、币种、网络、收款方、一次性/非订阅属性、预计 gas，以及“投资预算不会在本步骤扣除”；
3. **候选与概率**：候选数、每个候选的公开权重/概率、算法版本、候选快照时间和有效期；
4. **风险边界**：风险等级、发行价、目标上行、最大压力损失的候选区间，并单独声明投资本金最高可能损失 100%；
5. **非保本**：1 RWA = 1.00 USD 仅是 target redemption value，不是保证兑付；报告、Physical AI、礼物和 Trust Premium 都不改变这一点；
6. **数据边界**：数据来源、新鲜度、Demo/Live 状态，以及 AI/传感器可能错误、延迟或离线；
7. **公平边界**：commit-reveal 可验证选取结果，但 P0 仍存在服务端选择性中止风险；中止按下方矩阵处理；
8. **礼物边界**：开盒和礼物不改变候选概率、风险评分、发行价或投资资格；实体礼物仅在独立合规认购后按规则处理；
9. **取消/退款**：付款前可随时退出；付款后的交付、免费重开、退款触发条件和处理状态；
10. **隐私**：支付钱包在公链可见；报告、分享卡和配送信息各自的公开范围。

付款按钮上方保留三个默认未勾选的确认框：

~~~text
[ ] 我确认本次支付仅购买 AI 尽调揭晓，不会自动认购任何 RWA。
[ ] 我已看到候选概率、风险/损失区间、报告费用和退款规则。
[ ] 我理解 AI 报告和物理证据可能出错，且不构成保本、收益或投资建议。
~~~

英文冻结文案：

~~~text
I am purchasing an AI due-diligence reveal, not an RWA.
No investment principal will move until I review the revealed risk and sign separately.
Target redemption, AI analysis, physical evidence and gifts are not guarantees.
~~~

**B. 揭晓后、认购签名前必须展示**

- 被选中的具体 pool、cargo、route、quote hash、候选快照和本地 Verify 结果；
- issue price、target redemption、目标上行、压力情景回收率/损失和本金可能全部损失；
- 原始风险、Physical Confidence/Trust Credit、剩余硬风险及 evidence freshness；
- 当前 pool 状态、剩余额度、报价失效时间、合规资格和即将签署的认购金额；
- “返回市场”“查看完整报告”“认购”三个清晰选项，不使用默认焦点、自动跳转或倒计时逼单。

认购前使用第二组、默认未勾选且不能沿用开盒确认的确认框：

~~~text
[ ] 我已查看完整报告、最坏情景和仍未被 Trust Credit 抵扣的风险。
[ ] 我理解 target redemption 和目标上行都不保证，本金可能部分或全部损失。
[ ] 我确认当前认购金额、RWA 数量、pool 状态、报价有效期和钱包地址。
[ ] 我理解航线收藏章或礼物不是投资回报，也不影响本次价格或兑付。
~~~

只有四项确认仍有效且冷静期结束，才可以构造 subscribe 交易。任一报价、风险、pool 状态、证据 freshness 或钱包发生变化，必须清空确认并重新开始冷静期。

**C. 冷静期冻结规则**

| 模式 | 最短时间 | 起点 | 结束后动作 |
|---|---:|---|---|
| Final Demo | 5 秒，明确标 DEMO ACCELERATED | 完整报告渲染且 proof verify 为 PASS | 仅解锁认购按钮，绝不自动发送交易 |
| Production Prototype | 默认 60 秒，可被适用法延长、不可被前端参数缩短 | 同上 | 用户主动完成第二组确认后签名 |
| Quote/Risk Changed | 重新计时 | 新报价和差异摘要完成渲染 | 旧确认作废 |
| Pool Paused/Frozen/Expired | 不结束 | 状态恢复并获得新 quote 前 | 禁止认购，只允许退出/刷新 |

冷静期页面不得播放“仅剩 X 秒”“错过机会”等 FOMO 文案；计时器只表达“请先阅读风险”。

**D. 报告费异常处理矩阵**

| 场景 | 产品结果 | 资金规则 | 审计状态 |
|---|---|---|---|
| 付款前取消 | 返回市场 | 不收费 | CANCELLED_BEFORE_PAYMENT |
| 钱包拒签/结算失败 | 保留 preview，可重试 | 不得标记已收费 | PAYMENT_FAILED |
| 同一幂等键重复结算 | 只交付一份报告 | 多收部分自动原路退款 | DUPLICATE_REFUND_PENDING / REFUNDED |
| 已结算但服务端未在 30 秒内揭晓 | 用户选择原路退款或一次免费重开；无选择时默认退款 | 不得静默换池 | ABORTED_AFTER_PAYMENT |
| commitment/proof/candidate set 校验失败 | 立即终止，不展示替代结果 | 自动原路退款 | PROOF_INVALID_REFUND_PENDING |
| 揭晓瞬间选中池已不合格、Paused/Frozen/过期 | 不交付可认购结果 | 原路退款或用户主动选择一次免费重开 | CANDIDATE_INVALIDATED |
| 有效报告已完整交付，用户选择不投资 | 报告仍可在 TTL 内重读 | 报告费不退，适用法另有规定除外；投资本金始终未动 | DELIVERED_NO_SUBSCRIPTION |
| 有效揭晓后市场自然变化 | 显示 stale，不允许用旧确认认购；提供一次免费 refresh | 不把市场风险伪装成报告失败 | STALE_AFTER_REVEAL |
| 用户断网/关闭页面 | 用 receipt/reveal id 恢复同一报告 | 不重复收费 | DELIVERED_RECOVERABLE |

Live 退款必须返回 refund tx/status 并可查询；Demo 退款必须显示 SIMULATED REFUND，禁止生成随机 tx hash。所有退款原路退回原资产和原钱包，任何 gas/费用承担规则必须在付款前披露。

**E. 禁词与替代表达**

| 禁止 | 使用 |
|---|---|
| guaranteed / 保证、保本、稳赚 | target / non-guaranteed / 目标兑付、可能亏损 |
| win / jackpot / 中奖、大奖、欧皇 | reveal / discover / 揭晓、发现航线 |
| prize value / 奖品价值 | report service + equal-value keepsake / 报告服务 + 等值纪念物 |
| risk-free / 无风险 | risk-bounded discovery / 风险边界透明的发现 |
| buy now before it is gone / 立即抢购 | review the report and decide separately / 阅读报告后独立决定 |

**F. 最低审计事件**

disclosure_viewed、report_acknowledged、payment_settled、reveal_delivered、proof_verified、cooldown_started/completed/reset、risk_acknowledged、subscribe_signed、refund_requested/pending/settled 必须携带 policy version、时间、模式和幂等键；不得记录配送地址、完整单据或复选框外的行为画像。

MBOX-PM-3 完成标准：以上文案与状态矩阵冻结；实现阶段由 MBOX-FE-2/3/6、MBOX-BE-4/6、MBOX-X402-1/2 和 MBOX-QA-1/3 落地。

#### 20.6.2 MBOX-PM-4 冻结规范：Voyage Passport 收藏章与分享卡

**产品定义**

Voyage Passport 是用户完成一次可验证揭晓后获得的**非金融产品凭证和旅程收藏记录**。它证明“这个钱包在某个时间验证过某条航线的 AI 报告”，不证明货物所有权、RWA 持仓、投资收益、信用评级、保险覆盖或未来权益。

P0/P1 均采用服务端签名的 off-chain credential；禁止 ERC-20、可转让 NFT、可交易稀有度、地板价、版税和二级市场。未来若使用不可转让 token，也只能用于防篡改/访问，不得附带经济权利，且须另行完成法律与隐私审查。

**A. 两级收藏章**

| 类型 | 获得条件 | 显示内容 | 不得暗示 |
|---|---|---|---|
| Discovery Stamp | 报告已交付且 reveal proof 验证通过 | 货物类别、粗粒度航线、日期、模式、proof digest | 已投资、拥有货物、获得收益 |
| Investor Journey Stamp | 独立风险确认完成且认购交易成功/明确 Demo 成功 | Discovery 内容 + 脱敏 subscription proof/tx link | 保本、投资成功结局、比别人更高收益 |

Discovery Stamp 与 Investor Journey Stamp 使用明显不同图标和标签；不能仅凭颜色区分。取消、退款、proof invalid 或 reveal aborted 不发章。报告交付但未认购，只能获得 Discovery Stamp。

**B. Credential 数据结构**

~~~ts
type VoyagePassportCredential = {
  credential_id: string;
  schema_version: 'voyage-passport-v1';
  stamp_type: 'DISCOVERY' | 'INVESTOR_JOURNEY';
  voyage_id: string;
  cargo_category: string;
  route_label: string;
  route_code: string;
  revealed_at: string;
  experience_mode: 'DEMO' | 'RECORDED_REPLAY' | 'LIVE_PROTOTYPE' | 'VESSEL_LIVE';
  reveal_proof_digest: string;
  report_hash: string;
  physical_evidence_digest?: string;
  subscription_reference?: string;
  artwork_variant: string;
  issuer: 'AgentBL';
  issuer_signature: string;
  revoked_at?: string;
};
~~~

credential 不保存钱包余额、认购金额、收益率、风险偏好、真实姓名、配送地址、完整钱包、完整 eBL/case id、精确实时位置或未公开商业单据。服务端以钱包签名证明查看/导出权限，不建立公开的钱包行为排行榜。

**C. 收藏章视觉语法**

- 正面：货物插画、粗粒度航线弧线、港口印章、voyage_id、Discovery/Investor Journey 类型；
- 背面：揭晓日期、experience mode、三段短哈希、Verify QR/NFC；
- 视觉 variant 可以是 Dawn / Storm / Night / Port Arrival 等路线故事，但每个 variant 等概率或公开固定规则、无价格差异；
- 禁用金/银/钻石等级、SSR、Legendary、Winner、Profit Badge 等会暗示经济价值的稀有度语言；
- 可以展示“已收集 3/6 类航线”，不能展示“资产价值”“收藏市值”“预计升值”；
- Physical AI 数据只显示验证摘要和时间，不在分享图泄露实时船位或摄像头访问令牌。

**D. 分享卡公开字段**

允许默认公开：

- AgentBL / Mystery Voyage 品牌；
- cargo category 和粗粒度 route label；
- Discovery 或 Investor Journey 类型；
- experience mode，必须醒目显示 Demo/Replay/Prototype/Live；
- reveal month 或日期；
- Verified reveal、proof digest 前后各 4–6 位、Verify URL/QR；
- “Not an investment certificate · Not proof of ownership or return”；
- 用户自选昵称；默认不显示钱包。

只有用户主动打开 Advanced Share 并再次确认，才允许增加完整公共 tx hash/Explorer link。无论用户是否选择，永不公开：

- 投资金额、RWA 数量、PnL、目标上行、钱包余额；
- 完整钱包、KYC 状态、风险档、制裁/合规结果；
- 精确 GPS、当前船位、实时摄像头 URL/token；
- 出口商/进口商未公开身份、eBL、发票、保险单或商业价格；
- 配送地址、电话、邮箱、真实姓名；
- “我赚了”“稳赚航线”“中奖”等用户模板。

冻结分享卡页脚：

~~~text
A product-experience credential for a verified AI report reveal.
Not an RWA, not cargo ownership, not proof of investment performance.
~~~

中文：

~~~text
本卡仅记录一次可验证的 AI 报告揭晓体验。
不是 RWA、货权凭证或投资业绩证明。
~~~

**E. 生命周期与用户权利**

| 操作 | 规则 |
|---|---|
| Claim | proof 验证通过后由用户主动领取，不自动铸造，不收 gas |
| Export | PNG/PDF/JSON credential；导出前展示公开字段预览 |
| Verify | 公共页只验证 issuer signature、schema、revocation 和 proof digest |
| Hide | 用户可随时从个人收藏册隐藏，不影响报告或持仓 |
| Delete | 删除 AgentBL 托管的展示副本和昵称；链上 payment/tx 不能删除的边界须说明 |
| Revoke | proof 被证明无效、错误签发或用户成功撤销报告交付时撤销；历史分享卡显示 REVOKED |
| Transfer | 永不支持；钱包迁移只能经旧/新钱包双签复制并撤销旧 credential |
| Commercialize | 不支持出售、抵押、授权版税或兑换投资优惠 |

**F. 与航线礼物的关系**

Passport 是数字收藏记录，Voyage Keepsake 是可选、等值的实体/数字纪念物。二者均不属于投资回报：

- Discovery 用户可获得数字章，但不能因此获得实体礼物或认购优惠；
- Investor Journey 用户可以选择实体纪念物或同值数字版，费用从 marketing/sponsor budget 支出；
- 礼物 artwork_variant 可以对应 Passport 图案，但不能对应不同现金价值、收益率、抽取概率或服务优先级；
- NFC/QR 只打开脱敏 credential/证据页，不把配送记录、地址或钱包写入标签。

**G. 五问理解测试**

封闭测试必须随机提问，五题全对才算 PM-4 验收通过：

1. 这张 Passport 是否代表你拥有货物或 RWA？正确答案：否；
2. Discovery Stamp 是否说明你已经投资？正确答案：否；
3. 它是否能出售或转让？正确答案：否；
4. 图案 variant 是否影响收益、价格或下一次概率？正确答案：否；
5. 分享卡默认是否公开钱包、金额或实时船位？正确答案：否。

验收阈值：至少 10 名非项目成员参加，首次作答全对率 ≥90%；任何一题低于 90%，必须修改命名/视觉后复测。Final Demo 前无法完成真实用户测试时，任务只可标 Spec Done / Validation Pending，不得宣称已完成用户验证。

测试记录只使用匿名编号，不采集钱包、姓名或联系方式：

| Participant | Q1 | Q2 | Q3 | Q4 | Q5 | First-pass all correct | Confusing phrase |
|---|---|---|---|---|---|---|---|
| P01–P10 | Y/N | Y/N | Y/N | Y/N | Y/N | Y/N | 可选短语，不记录身份 |

结果摘要固定填写：样本数、五题各自正确率、首次全对率、修改过的文案、复测结果和测试日期。禁止删除失败样本或只报告平均分。

MBOX-PM-4 完成标准：产品定义、credential 字段、视觉/分享白名单、隐私、生命周期、礼物关系和理解测试冻结；实现阶段由 MBOX-FE-7、GIFT-FINAL-1/2/3 和 MBOX-QA-5 落地。

### 20.7 工程任务清单

#### 20.7.1 Product / Risk / Compliance

| ID | Priority | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| MBOX-PM-1 | P0 | 冻结命名和叙事：Mystery Voyage = surprise discovery，不是 randomized investment | PM | Todo | README、路演稿、UI 三处文案审查 | - |
| MBOX-PM-2 | P0 | 定义三档 Risk Passport、候选过滤规则、压力损失边界和禁止辖区 | PM + Risk | Todo | policy fixture 覆盖三档及零候选状态 | - |
| MBOX-PM-3 | P0 | 完成开盒前披露、揭晓后风险确认、退款/免费重开和冷静期规则 | PM + Compliance | Done | 合规 checklist；不得出现 guaranteed / win / jackpot | §20.6.1：双确认状态机、逐屏披露、冷静期、9 类异常矩阵、禁词与审计事件已冻结 |
| MBOX-PM-4 | P1 | 设计 Voyage Passport 收藏章和分享卡，禁止代币化/现金价值 | Product | Review | 用户测试能区分收藏章与投资凭证 | §20.6.2：Spec Done；两级章、credential、分享/隐私白名单、生命周期和五问测试已冻结；10 人验证 Pending |

#### 20.7.2 Backend / AI / x402

| ID | Priority | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| MBOX-BE-1 | P0 | 用 `quoteFromCase`/真实池状态替换市场初始化中的硬编码报价和 `riskBps=200` | Backend | Done | `tests/marketApi.test.js` 断言 listing 与 PricingQuote 一致 | `src/app/server.js`/`src/app/store.js`：22 个融资案例使用规范化 PricingQuote 与 pricing action 状态；marketApi 校验 quote/risk/price，Paused 不上架 |
| MBOX-BE-2 | P0 | 新增 `src/mystery/policy.js`：按 Risk Passport、合规、池状态、额度和 freshness 确定性过滤 | Backend + AI | Done | `tests/mysteryPolicy.test.js` 覆盖低/中/高风险、制裁、Paused、过期、零候选 | `tests/mysteryPolicy.test.js`：三档阈值、compliance、额度、freshness、货物/航线/辖区排除与零候选全部通过 |
| MBOX-BE-3 | P0 | 新增 `src/mystery/fairness.js`：canonical hash、commit、rejection sampling、proof verify | Backend | Done | 10,000 seed property test + tamper test；同 proof 必须选出同一 pool | `tests/mysteryFairness.test.js`：10,000 seeds 分布、确定性重放及 pool/weight/nonce/payment/quote/数组篡改测试通过 |
| MBOX-BE-4 | P0 | 新增持久化 reveal store：状态 `PREVIEWED/COMMITTED/PAID/REVEALED/ABORTED/EXPIRED`、TTL、幂等键 | Backend | Done | 重启恢复、并发支付、重复 receipt、过期和 replay tests | `src/mystery/store.js` + `tests/mysteryStore.test.js`：重启恢复、wallet-scope 幂等、并发单揭晓、receipt replay、TTL、ABORTED 持久化通过 |
| MBOX-BE-5 | P0 | 新增 `POST /api/mystery/preview` 与 `GET /api/mystery/:id/proof` | Backend | Done | API schema tests；preview 不泄露 selected pool/server secret | `tests/mysteryApi.test.js`：preview=201、付款前 proof=409、付款后 proof 可验证；preview 不含候选 ID、selected pool 或 server secret |
| MBOX-X402-1 | P0 | 在 `X402_SERVICES`、paid-report kinds/builders 和 server route 增加 `mystery-voyage` | Backend + Web3 | Done | unpaid=402、paid=200、报告 envelope/schema/hash 全通过 | 四产品 catalog/V2 config/builder/route 已接入；Demo preflight 验证 mystery-voyage unpaid=402、signed paid=200、envelope 合法 |
| MBOX-X402-2 | P0 | 将 x402 payment tx、selected case、Risk Passport hash、reveal proof hash 绑定进 `PaidReportEnvelope`/`PaymentOracle` | Backend + Web3 | Done | 从 Explorer tx 可重放到同一个 selected pool/report hash | `tests/paidReport.test.js`/`tests/mysteryApi.test.js`：payment_tx、case_id、selected_pool_id、risk_passport_hash、reveal_proof_hash 进入 canonical report_hash；PaymentOracle 继续锚定该 hash |
| MBOX-AI-1 | P0 | 生成揭晓版 `AI Risk Passport`：适配理由、定价分解、压力回收、证据 freshness | AI | Done | schema + groundedness eval；LLM 失败有 deterministic fallback | `src/mystery/riskPassport.js`：确定性报告含 suitability、真实定价分解、压力回收、抵押覆盖、evidence graph/freshness 与 non-guarantee；端到端 groundedness 断言通过 |
| MBOX-BE-6 | P0 | 处理候选在支付前后失效：fail closed、记录 abort、免费重开/退款状态，不静默替换 | Backend | Done | 状态竞态与 Paused/Frozen 注入测试 | 付款前全候选重验并 `PAYMENT_NOT_SETTLED`；付款后竞态进入 `ABORTED` + `REFUND_OR_FREE_REOPEN_AVAILABLE`；API/store 注入测试通过 |
| MBOX-BE-7 | P1 | 将 Mystery reveal 来源写入 portfolio/analytics，不改变原始 PricingQuote 或 yield | Backend | Done | portfolio API 与事件漏斗测试 | `src/mystery/passport.js`/`analytics.js`、`src/mystery/service.js`、`src/app/store.js`：Discovery/Investor Journey signed credential、脱敏公开验证、`MYSTERY_VOYAGE` source attribution、匿名 funnel 与 quote/yield integrity；`tests/mysteryPassport.test.js`、`tests/mysteryApi.test.js` 全通过 |
| MBOX-MCP-1 | P1 | 增加 `preview_mystery_voyage` / `verify_mystery_reveal` MCP 能力，购买仍受预算与人工授权约束 | AI + Backend | Done | MCP Inspector 调用 + 超预算拒绝测试 | `src/mcp/tools.js`/`mcpServer.js`：preview 只读候选与人工确认边界，verifier 本地 fail-closed；MCP surface=9 tools+3 resources；`tests/mysteryMcp.test.js`、`tests/mcp*.test.js`、check/preflight manifest gates 全通过 |

#### 20.7.3 Frontend / Experience

| ID | Priority | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| MBOX-FE-1 | P0 | 在市场首屏增加 Mystery Voyage 入口和 Risk Passport 三档选择器 | Frontend | Done | 375px/1440px 手动验收；键盘可操作 | `public/index.html`/`public/styles.css`：市场首屏入口 + 3 个原生 radio 风险档；1080/760/420px 响应式约束，原生方向键/Tab 可操作；`tests/mysteryFrontend.test.js` DOM contract 通过 |
| MBOX-FE-2 | P0 | 开盒前卡片展示 N、等概率、风险/收益/压力损失区间、0.001 USDC 和非认购说明 | Frontend + PM | Done | 5 秒理解测试；截图 review | `public/mystery.js` 使用真实 preview 的 `candidate_count`/commit hashes，支付前同时显示 `1/N`、三档风险/收益/压力损失区间、`0.001 USDC`、`$1 target != 保本` 与“不自动认购”说明 |
| MBOX-FE-3 | P0 | 复用 x402 stepper 展示 Commit → 402 → Settlement → Reveal → Verify | Frontend | Done | Demo/Live 两模式；Live 仅真实 tx 可跳 Explorer | `public/index.html`/`public/mystery.js`：五步状态机接真实 preview→402→signed settlement→reveal→proof API；Demo 明示 receipt；Explorer anchor 仅在 `payment.live === true` 且 tx/URL 有效时生成 |
| MBOX-FE-4 | P0 | 实现开箱动画和路线揭晓：集装箱封条、地图航线、cargo image、风险脉冲 | Frontend | Done | `prefers-reduced-motion` 下无强动画；无 layout shift | `public/styles.css`：固定 aspect-ratio/最小高度的集装箱双门与封条、航线轨迹、风险脉冲；`public/mystery.js` 复用 6 类真实 cargo 图片；reduced-motion 关闭 transition/animation 并直接开门 |
| MBOX-FE-5 | P0 | 实现浏览器本地 proof verifier，任一字段被篡改立即红色 fail closed | Frontend + Web3 | Done | Playwright/DOM tamper cases；成功显示复算摘要 | `public/mystery-proof.js` 本地复算 canonical hash、commitment、candidate set、rejection sampling、selected index 与 report/envelope/payment bindings；proof textarea 输入即验，失败红色 FAIL CLOSED 并禁用认购；测试覆盖 10 类 proof 篡改及 report/envelope 篡改 |
| MBOX-FE-6 | P0 | 揭晓后保持“看报告/认购”双 CTA；认购前弹出第二次金额、损失与风险确认 | Frontend + Compliance | Done | 不签第二次确认不会调用 subscribe | `public/index.html`/`public/mystery.js`：双 CTA 持续可见；独立弹窗显示 pool/金额/风险/压力损失，勾选后仍须完成第二次签名；源码顺序测试断言 `/api/pool/subscribe` 只在签名成功后调用 |
| MBOX-FE-7 | P1 | Voyage Passport 收藏册、可分享但脱敏的航线卡 | Frontend | Done | 卡片不含商业秘密、钱包余额或误导性收益承诺 | `public/index.html`/`mystery.js`/`passport.js`/`styles.css`：Discovery 与 Investor Journey 双印章、独立签名领取、collection refresh/local hide、分享预览与 JSON/PNG/Print-PDF 导出；严格分享白名单、Demo 禁止交易披露、高级分享双确认；`tests/mysteryFrontend.test.js` + 1440/375 浏览器验收通过 |
| MBOX-I18N-1 | P0 | 补齐中英双语 Mystery Voyage 文案并加入 i18n coverage | Frontend | Done | `tests/i18nCoverage.test.js` | `public/i18n.js` 覆盖入口、三档 Passport、五步支付、揭晓、验证与二次认购；coverage 已扩展扫描 `public/mystery.js` 动态 key，中英缺失/英文混入中文测试通过 |

#### 20.7.4 Contract / Security / QA

| ID | Priority | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| MBOX-WEB3-1 | P0 | P0 不新增托管合约；复用 PaymentOracle 和 RWAOfferingPool，并记录 reveal proof hash | Web3 | Todo | 设计 review 证明开盒失败不会触碰投资本金 | - |
| MBOX-WEB3-2 | P1 | 仅在组合意图进入实施时设计 `MysteryAllocationRouter`，支持 eligibility、caps、pause、cancel/refund | Web3 | Todo | Hardhat state-machine、重入、权限、暂停与退款 tests | - |
| MBOX-QA-1 | P0 | 增加安全矩阵：nonce 重放、receipt 重放、候选篡改、权重篡改、选择性 abort、并发开盒 | QA + Security | Todo | 全部 fail closed，错误码可恢复且有审计日志 | - |
| MBOX-QA-2 | P0 | 验证不变量：不合格/Paused/Frozen/过期/超风险池永远不会被选中 | QA | Todo | policy fuzz/property tests | - |
| MBOX-QA-3 | P0 | 验证资金隔离：开盒只结算报告费，未二次确认时 subscription/portfolio/USDC investment 均不变 | QA | Todo | API + contract harness 余额前后断言 | - |
| MBOX-QA-4 | P0 | 加入 preflight：Mystery offline、x402 demo、proof replay、i18n/reduced-motion 静态检查 | QA | Todo | `npm run preflight` 连续 3 次全绿 | - |
| MBOX-QA-5 | P0 | 完成 20 人封闭可用性测试和事件漏斗报告 | PM + QA | Todo | 输出理解率、完成时间、失败率，不虚构真实投资转化 | - |

### 20.8 实施顺序与出线 Gate

#### Wave M0（0-6h）：先冻结规则

```text
MBOX-PM-1 → MBOX-PM-2 → MBOX-PM-3 → MysteryRevealProof schema
```

Gate M0：任何成员都能回答“盲什么、不盲什么、何时付报告费、何时才投资、如何验证公平”。未通过不得先做动画。

#### Wave M1（6-24h）：确定性引擎与 API

```text
MBOX-BE-1 → MBOX-BE-2 → MBOX-BE-3 → MBOX-BE-4/5 → MBOX-AI-1
```

Gate M1：离线测试中，同一 proof 永远选出同一池；篡改候选/nonce/权重/报价任一字段都会失败；零候选和状态变化均 fail closed。

#### Wave M2（24-42h）：x402 与一屏体验

```text
MBOX-X402-1/2 → MBOX-FE-1/2/3/4/5 → MBOX-I18N-1
```

Gate M2：45 秒内演示 Preview → 402 → Payment → Reveal → Verify；Demo/Live 标签清楚，真实模式能从 payment tx 追到 `PaymentAttested` 和 report hash。

#### Wave M3（42-60h）：独立认购与安全

```text
MBOX-FE-6 → MBOX-BE-6/7 → MBOX-WEB3-1 → MBOX-QA-1/2/3/4
```

Gate M3：未二次签名不会认购；不合格或暂停池不会入选；开盒失败不影响投资本金；preflight 连续三次通过。

#### Wave M4（60-72h）：增长验证与路演冻结

```text
MBOX-QA-5 → 60 秒脚本彩排 → 备份视频 → 功能冻结
```

Gate M4：测试者能明确复述“我花 0.001 USDC 买的是 AI 尽调揭晓，不是随机买了 RWA”；路演不使用“稳赚、中奖、大奖、保底”等表述。

### 20.9 60 秒冠军演示脚本

```text
0-08s  “市场项目太多，普通投资者不知道先研究哪一个。”选择 Balanced Risk Passport。
08-16s 展示 5 个合格候选、等概率、风险/压力损失区间：“我们隐藏航线，但从不隐藏风险。”
16-28s 点击 Open Mystery Voyage：真实 HTTP 402 → 0.001 USDC → payment tx。
28-40s 集装箱开封，揭晓“500 吨铜，新加坡→上海”；AI Risk Passport 展开审单、估值、战争/保险证据。
40-50s 点击 Verify：本地重算 candidate hash、双边 entropy、selected index；打开 PaymentAttested Explorer。
50-60s 强调“开盒只买报告”。阅读最坏损失后，用户另行确认认购；Injective 执行原有合规池状态机。
```

结束语：

> **Most blind boxes hide both value and risk. AgentBL flips the model: the voyage is a surprise, but risk, probability, payment and allocation are all verifiable.**

---

## 21. Final Demo 增强：Living Voyage（物理 AI × 信任溢价 × 航线礼物）

本节吸收 docs/enhancement-physical-ai-trust-insurance-zk(2).md 的**增强维度一：物理 AI**和**增强维度四：信任稀缺性的经济学**，并把它们接到上一节 Mystery Voyage。目标不是在 final demo 前假装已经拥有远洋船队，而是讲清一个评委能记住、工程上有诚实边界的故事：

> **投资者开出的不是一个收益数字，而是一扇通往真实航程的窗口：看见货物、验证状态、观察海面；物理证据越充分，AI 越能把“信任”转成可解释的融资成本下降。完成认购后，客户收到一件来自这条航线的等值纪念礼物，把一次金融交易变成一段可追踪的航海记忆。**

### 21.1 决赛版一句话和三层体验

~~~text
Mystery Voyage         = 发现一条未知但风险边界透明的航线
VoyageCam / Ocean View = 打开这条航线的物理窗口
Trust Premium          = 摄像头 + AIS + 传感器 + 单据证据 → 更小的不确定性折扣
Voyage Keepsake        = 认购后的等值路线纪念物 + 链接到证据与旅程
~~~

用户看到的完整闭环：

~~~text
盲盒揭晓
  → CargoCam：看集装箱封条、货舱/甲板和装载状态
  → Ocean Window：把摄像头切到海平线、航迹和海况预设
  → Physical AI：视觉 + AIS/GPS + 温湿度/震动/光线/封条交叉验证
  → Trust Evidence Graph：物理置信度上升，Trust Premium 进入价格瀑布
  → 明确风险后认购
  → 航线礼物寄到客户手中，NFC/QR 回到同一份链上证明
~~~

决赛现场所有画面必须带状态标签：

| 标签 | 含义 | 允许的说法 |
|---|---|---|
| LIVE PROTOTYPE | 手机/USB 摄像头或真实 WebRTC 流实时接入 | “这是我们正在控制的物理摄像头原型” |
| RECORDED REPLAY | 预录视频按真实时间戳回放，传感器数据可复现 | “这是同一条 AI 管道的可验证回放” |
| DIGITAL TWIN / VISION | 3D/模型船/合成数据，仅展示未来体验 | “这是未来接入船队后的产品愿景” |

禁止把 RECORDED REPLAY 或 DIGITAL TWIN 说成已接入真实船只；这条诚实边界反而会让“可信”叙事成立。

### 21.2 增强维度一：Physical AI / VoyageCam

#### 21.2.1 两个镜头，不只是监控画面

**CargoCam（证明货物存在）**：默认显示集装箱门、电子封条、货舱/甲板和装载区域；AI 识别封条完整性、箱体异常、积水/烟雾、装载数量变化和光照突变。

**Ocean Window（让投资者参与航行）**：用户可以在安全预设中切换“海平线 / 船尾浪花 / 云层天气 / 目的港方向”，看到海面风景和航线阶段。它是沉浸式访问，不是驾驶权限：不能控制舵、动力、通信、船员区域或安全设备。

摄像头交互必须由 ViewBroker 管理：

- 每个钱包一次只持有 15–30 秒的 PTZ 预设租约；
- 预设命令排队、限速、可审计，禁止任意角度扫描船员/港口安保区域；
- 默认无音频、自动遮挡人脸/文件/船桥，敏感地理位置可延迟或模糊；
- 所有持仓者获得同等基础观看机会，不能用投资金额购买“更接近货物”的权利；
- 流媒体本身不上链，链上只记录片段哈希、传感器 Merkle root、时间和模型版本。

#### 21.2.2 物理证据输入与 AI 输出

从增强方案的 PhysicalConfidence 继续扩展为可接入现有 PricingQuote 的可选字段：

~~~ts
type VoyagePhysicalEvidence = {
  source_level: 'NONE' | 'DOCUMENT_ONLY' | 'GPS_TRACKED' | 'MULTI_SENSOR' | 'FULL_STACK';
  camera_mode: 'NONE' | 'RECORDED_REPLAY' | 'LIVE_PROTOTYPE' | 'VESSEL_LIVE';
  gps_corroborated: boolean;
  ais_corroborated: boolean;
  sensor_data_consistent: boolean;
  container_seal_intact: boolean;
  last_seen_at: string;
  segment_hashes: string[];
  sensor_root: string;
  anomaly_events: Array<{
    type: 'ROUTE_DEVIATION' | 'TEMPERATURE_EXCURSION' | 'SHOCK_DETECTED'
      | 'SEAL_BROKEN' | 'CAMERA_OFFLINE' | 'AIS_GAP';
    timestamp: string;
    severity: 'info' | 'warning' | 'critical';
    evidence_hash: string;
  }>;
  confidence_score: number; // 0..1, evidence completeness, not a safety guarantee
};
~~~

Physical AI 每次刷新都输出三件事：

1. **Observation**：看到了什么，来源是视频、AIS、传感器还是单据；
2. **Consistency**：多源是否互相支持，是否存在 AIS spoofing、镜头离线或封条状态冲突；
3. **Action**：只建议 OPEN_WITH_WARNING / REPRICE_DOWN / PAUSE_OFFERING 等既有动作，不允许仅凭一帧画面自动清算。

关键不变量：

~~~text
物理证据缺失 ≠ 货物安全
物理证据完整 ≠ 投资无风险
关键异常/战争/保险失效 → 信任积分归零或触发既有 PAUSE/FREEZE
物理数据只能减少不确定性折扣，不能抹掉硬风险和抵押覆盖护栏
~~~

#### 21.2.3 决赛可演示的物理 AI 方案

按可落地程度排序：

~~~text
P0：本地 RECORDED REPLAY + data/physical-intel fixtures
    预录海面/货柜视频、AIS 轨迹、温度/震动/封条时间线同步回放
    点击“封条异常”后，Physical AI 生成 anomaly → 价格瀑布出现风险加码

P0.5：LIVE PROTOTYPE
    一台手机/USB PTZ 对准模型集装箱或真实仓库箱体
    评委点击 CargoCam/Ocean Window，边看画面边查看签名 telemetry

P1：VESSEL LIVE
    WebRTC + MQTT/HTTP sensor gateway + AIS provider + edge CV
    分段哈希和传感器 root 定期锚定 Injective，支持投资者 token-gated view
~~~

P0 也要让评委感到“真的能用”：回放中的每一帧有 timestamp、segment hash 和模型版本；不是一个循环播放的装饰视频。

### 21.3 增强维度四：Trust Premium / 信任的显式定价

#### 21.3.1 信任不是口号，而是价格瀑布中的一行

现有引擎的核心不变量必须保留。信任层只作为风险份额的**证据抵扣**，不另起一套会破坏 PricingQuote 的公式：

~~~text
raw_risk_score_bps      = existing document + market + world-risk policy
evidence_credit_bps     = f(physical confidence, corroboration, integrity, freshness)
trust_credit_bps        = min(evidence_credit_bps, TRUST_CREDIT_CAP_BPS,
                              raw_risk_score_bps)
adjusted_risk_score_bps = max(0, raw_risk_score_bps - trust_credit_bps)

# 接回现有 pricingEngine
risk_share        = f(adjusted_risk_score_bps)
risk_discount_bps = price_delta(speed_price, price_from_share(risk_share))
indicative_price  = base_issue_price - urgency_discount - risk_discount
final_price       = max(indicative_price, collateral_floor)
~~~

trust_credit_bps 不能由项目方手填，必须来自证据图，并受以下上限约束：

- 单据、AIS、GPS、摄像头、温度传感器证明同一事实时只计一次，防止 double counting；
- FULL_STACK 也不能抵扣战争、制裁、保险到期、严重封条异常等硬风险；
- 证据超过 freshness TTL、摄像头离线或 AIS 出现不可解释空洞时，信用自动衰减；
- 任何信任分不会把 PAUSE_OFFERING 自动改回 OPEN_OFFERING；恢复必须经过现有 Agent/Oracle 状态机；
- 页面同时展示原始风险、证据抵扣和调整后风险，禁止只展示更好看的最终数值。

#### 21.3.2 评委一眼能懂的 Trust Waterfall

在 AI Console 增加并排对比（数字必须由 fixture/policy 计算，以下仅为叙事示意）：

| 证据组合 | Trust 信号 | 价格变化 | 投资者看到的含义 |
|---|---|---|---|
| 仅 eBL/发票/保险 | 纸面自洽 | 基准 | “文件没有互相矛盾，但物理世界未知” |
| + AIS/GPS 交叉 | 船在合理航线上 | 风险折扣下降 | “位置不是单一 GPS 声明” |
| + 摄像头封条 + 温湿度 | 货物状态被持续观察 | 风险折扣继续下降 | “不是只看一张装船照片” |
| + 历史还款/担保/保险 | 信任可复用 | 形成 Trust Premium | “信任变成了融资成本节省” |

必须向投资者解释：价格更高不代表“送你收益”，而是由于不确定性下降，出口商不必支付同样深的风险折价；投资者仍承担真实贸易、市场和违约风险。

#### 21.3.3 信任飞轮

~~~text
投资者愿意开盒/认购
  → 项目愿意安装摄像头、电子封条和传感器
  → 物理证据变多且更可靠
  → AI 不确定性折扣下降，出口商融资成本降低
  → 更多货主加入，更多投资者愿意查看真实航程
  → 设备商、船东、保险人和担保人有经济动力接入
  → AgentBL 从“AI 定价页面”变成“信任定价网络”
~~~

### 21.4 航线周边礼物：把一次投资变成一段可记住的旅程

礼物命名为 **Voyage Keepsake / 航线纪念盒**，不是“抽奖奖品”。盲盒可以隐藏礼物的具体图案或路线彩蛋，但不隐藏价值、配送条件和退换规则。

#### 21.4.1 创意礼物目录

| 航线/货物 | 纪念物创意 | 链接方式 |
|---|---|---|
| 新加坡 → 上海铜阴极 | 复刻集装箱封条的金属书签、港口坐标明信片、NFC 证据卡 | NFC 打开 reveal proof、封条状态时间线和海景回放 |
| 曼谷 → 青岛橡胶 | 再生帆布航线贴章、航线天气卡、港口印章贴纸 | 扫码查看温湿度/震动 telemetry 与 AI 风险解释 |
| 巴西/亚洲大豆航线 | 航线插画折页、贸易路线磁贴、可持续包装故事卡 | 打开 cargo provenance 与 ESG/合规证据摘要 |
| 原油/矿石等不适合寄送的货物 | 3D 纸模集装箱、船舶轮廓卡、数字船票 | 不寄送危险或受监管货物，数字卡链接 voyage timeline |
| 任意完成认购的客户 | 唯一 voyage_id 航海护照页，记录“你见证过这批货” | 不代表所有权、不代表收益、不影响下一次概率 |

礼物原则：

- 每个订单为等值、低价值、非现金、非金融商品；“稀有”只能描述插画/故事，不得对应更高 APY、保本或更大额度；
- 礼物成本来自协议 marketing/sponsor budget，不从 exporter proceeds、保险池或投资者 target redemption 中扣除；
- 运输地址、姓名和海关信息只在加密的 off-chain fulfillment store 保存，链上只放 gift_fulfillment_hash；
- 受制裁地区、危险品、跨境清关不可行时，自动切换为同值数字纪念物，不让“礼物”阻塞兑付；
- 报告用户获得数字航线章；只有完成独立合规认购并选择收货的客户进入实体礼物队列，避免用礼物诱导未合格用户购买证券；
- 任何礼物都可以拒收或换成数字版，前端展示“礼物不是投资回报”。

#### 21.4.2 最有记忆点的开盒瞬间

~~~text
AI Reveal：你打开的是 SG → Shanghai Copper Voyage #0007
屏幕：实时/回放海面，投资者拖动“CargoCam ↔ Ocean Window”
AI：封条完整，AIS 与 GPS 一致，温度稳定；Trust Credit +XX bps（可验证）
用户：确认风险并认购，第二个链上事件完成
实体/数字盒：出现“Port of Singapore → Shanghai”印章
NFC：手机打开这条 voyage 的 PaymentAttested、PricingUpdated、传感器时间线
~~~

这让“礼物”不是凭空发周边，而是一个可携带的证据入口：客户把卡片放在桌上，未来仍能回到那条真实或回放航程。

### 21.5 Final Demo 叙事（90 秒版本）

~~~text
0-10s  “传统 RWA 让你盯着一张 PDF 猜货物是否存在。AgentBL 让你先选风险边界，再打开一条航线。”
10-22s 选择 Balanced Mystery Voyage，展示候选数、风险区间、最坏情景和 x402 报告费。
22-32s 402 → payment tx → 开盒；镜头从封条切到海平线，旁边显示 LIVE PROTOTYPE/RECORDED REPLAY。
32-45s 评委移动 CargoCam/Ocean Window；Physical AI 同时读视频、AIS/GPS、温度和封条 telemetry。
45-58s AI 故意演示一次异常：AIS 偏离/封条告警；Physical Confidence 下降，RiskPricingOracle 建议 REPRICE 或 PAUSE。
58-70s 恢复正常证据；Trust Waterfall 显示“不确定性折扣减少 XXbps”，并解释这不是保证收益。
70-80s 投资者完成第二次风险确认和 RWA 认购，Explorer 展示 payment、reveal、pricing 三类证据。
80-90s 航线纪念盒出现：NFC 卡打开同一条证据链。“我们不卖盲目的收益；我们把看得见的信任定价，并让客户带走这段航程。”
~~~

若现场没有真实摄像头，直接说：

> “今天是 RECORDED REPLAY，但验证器、时间戳、异常检测和价格动作是真实运行的；把输入换成船载 WebRTC/MQTT，协议不需要重写。”

### 21.6 工程任务清单

#### 21.6.1 Physical AI / Data / Trust Pricing

| ID | Priority | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| PHY-FINAL-1 | P0 | 建立 data/physical-intel/ fixtures：CargoCam/Ocean Window 视频、AIS/GPS、温湿度、震动、封条、异常事件 | AI + Backend | Todo | fixture replay 在固定时间线输出稳定 hash/root | - |
| PHY-FINAL-2 | P0 | 定义 VoyagePhysicalEvidence 与向后兼容的 PricingQuote.physical_confidence | AI + Backend | Todo | schema 正例/缺省 NONE/非法 source level tests | - |
| PHY-FINAL-3 | P0 | 实现 Physical AI deterministic fallback：多源一致性、异常分类、freshness 和 confidence score | AI | Todo | anomaly fixtures：正常、AIS gap、封条破损、温度越界 | - |
| PHY-FINAL-4 | P0 | 实现 ViewBroker 的预设镜头、租约、排队、限速、隐私遮罩与权限边界 | Frontend + Backend | Todo | 未授权钱包、重复控制、敏感 preset、租约过期均 fail closed | - |
| PHY-FINAL-5 | P0 | 前端增加 CargoCam/Ocean Window 双面板与 LIVE/REPLAY/TWIN 状态标签 | Frontend | Todo | 375px/1440px、键盘、reduced-motion；截图审查不误导 | - |
| TRUST-FINAL-1 | P0 | 将 physical evidence 转成 capped trust_credit_bps，先调整现有 risk_score_bps，再由引擎推导 risk_discount_bps，不破坏 PricingQuote 不变量 | AI + Backend | Todo | document-only/GPS/full-stack 对比 + collateral/critical guard tests | - |
| TRUST-FINAL-2 | P0 | 建立 Trust Evidence Graph：每个 bps credit 绑定 source、timestamp、hash、模型版本 | AI | Todo | 任一证据删除/重复计数/过期都会改变或拒绝 quote | - |
| TRUST-FINAL-3 | P0 | 实现物理异常 → REPRICE_DOWN/PAUSE_OFFERING 的事件管道，禁止异常直接清算 | Agent + Web3 | Todo | autonomous agent、oracle、offering simulator 三方状态一致 | - |
| TRUST-FINAL-4 | P1 | 将 Insurance/ZK/Guarantor 预留为 trust layer provider，不在 final demo 伪造已部署保险或 ZK | Web3 + Security | Todo | provider 缺失时显示 NOT_CONNECTED，不得提高 trust credit | - |

#### 21.6.2 Voyage Keepsake / Growth Experience

| ID | Priority | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|---|
| GIFT-FINAL-1 | P0 | 设计三套路线纪念物视觉：铜、橡胶、通用数字船票；统一低价值、非金融、等值 | Product + Design | Todo | UI 文案和路演 Q&A 明确“不是投资回报” | - |
| GIFT-FINAL-2 | P0 | 揭晓后生成脱敏 Voyage Passport 和 NFC/QR mock link，链接 reveal/report/evidence | Frontend + Backend | Todo | 链接只返回 hash、时间线和公开摘要，不泄露地址/完整单据 | - |
| GIFT-FINAL-3 | P1 | 实体礼物 fulfillment 状态机：ELIGIBLE/ADDRESS_ENCRYPTED/PACKED/SHIPPED/DIGITAL_FALLBACK | Backend | Todo | 地址不进日志/链上；制裁/清关失败自动数字版 | - |
| GIFT-FINAL-4 | P1 | 建立 sponsor/marketing budget ledger，礼物费用与 RWA pool/insurance pool 隔离 | PM + Finance | Todo | 账本断言 gift cost 不改变 exporter cash、redemption exposure 或 yield | - |
| GIFT-FINAL-5 | P0 | 90 秒 Final Demo 彩排：Mystery → Camera → Physical AI → Trust Premium → Subscribe → Keepsake | PM + QA | Todo | 连续三次无口头补丁；每个模拟输入均有屏幕标签 | - |

### 21.7 决赛冲刺 Waves

#### Wave F0（0-4h）：故事和可信标签冻结

~~~text
PHY-FINAL-1 → GIFT-FINAL-1 → 统一 LIVE PROTOTYPE / RECORDED REPLAY / DIGITAL TWIN 文案
~~~

Gate F0：评委能分辨当前 demo、可插拔接口和长期愿景；不出现“已接入真实船队/已投保/已完成 ZK”这类未经证实的表述。

#### Wave F1（4-14h）：物理 AI 临场感

~~~text
PHY-FINAL-2/3 → PHY-FINAL-4/5 → anomaly event → autonomous action
~~~

Gate F1：镜头切换和 telemetry 时间线能在 15 秒内完成；一次异常能让评委看到 confidence、risk action 和链上/模拟 evidence hash 同步变化。

#### Wave F2（14-24h）：信任进入价格

~~~text
TRUST-FINAL-1/2/3 → Pricing Console Trust Waterfall → pricing invariant/preflight
~~~

Gate F2：同一交易的 document-only 与 physical-evidence 版本，价格差异来自可解释 bps credit；critical risk 不会被“信任”洗白。

#### Wave F3（24-32h）：航线礼物和传播记忆

~~~text
GIFT-FINAL-2 → GIFT-FINAL-3/4（若无时间，仅做 digital fallback）→ GIFT-FINAL-5
~~~

Gate F3：客户扫码回到同一条证据链；礼物不承诺收益、不改变赔率、不把钱包地址写入链上。

#### Wave F4（32h+）：只修演示阻塞项

~~~text
npm run preflight → npm run test → npm run demo:once → 90 秒录屏与现场彩排
~~~

### 21.8 最终回答评委的四句话

1. **“物理 AI 做什么？”** —— 它把摄像头、AIS/GPS、温湿度、震动和电子封条交叉成可审计的 Physical Confidence；不是只播放海景。
2. **“看见货物会不会保证收益？”** —— 不会。它只减少可验证的不确定性折扣；战争、保险、市场和进口商违约仍然可能让投资者亏损。
3. **“礼物是不是拉人头或抽奖？”** —— 不是。它是完成合规订单后的等值航线纪念物，费用独立、无现金价值、不影响价格、概率或认购资格。
4. **“现在真的接船了吗？”** —— 现场诚实标注是 replay 或 live prototype；物理数据接口、哈希证据、异常管道和价格动作已经按同一协议设计，换成真实 WebRTC/MQTT 不需要重写 RWA 主链路。

最终收束：

> **AgentBL does not ask investors to trust a black box. It lets them open a voyage, look at the cargo, verify the evidence, price the trust, and take home a proof of the journey.**
