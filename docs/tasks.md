# AgentBL 冠军路线与工程任务清单

任务状态：`Todo` / `In Progress` / `Review` / `Done` / `Blocked`

每个任务都必须有 Owner 和可验证方式。没有验证方式的任务不要认领。  
当前主线：**Web3 原生贸易融资协议：出口商 tokenize eBL，AI 自主定价与执行，全球投资者直接出资，Injective 全程上链审计**。

## 0. 先讲真话：2026-06-29 仓库复核

以下状态以代码、脚本和测试为准，不以路演文案为准。评委现场最怕“说有、点开没有”。

| 能力 | 真实状态 | 结论 / 下一步 |
|---|---|---|
| AI 定价、反欺诈审单、风险场景、RAG、xAPI | ✅ 已有 | `npm test` 实测 **257/257 passed**；继续作为产品主线，不重做 |
| Solidity 合约 | 🟡 部分已有 | `hardhat test` 实测 **19/19 passed**；硬化 PaymentOracle 已部署，完整五合约协议仍待补齐 |
| Injective Testnet | 🟡 已有单合约真实交易 | 已有 chainId `1439`、合约地址和 explorer；仍需完整协议部署与事件回读 |
| MCP Server | 🟡 只有 5-tool mock | 当前是自定义 handler + HTTP mock，不是标准 MCP stdio server；没有 resources，不能宣称“7 工具 + 3 资源” |
| Demo Mode | ✅ 已完成 | `DEMO_MODE=true` 默认、顶部常驻 banner、Live toggle、一键 reset；Live 配置不足时显式失败，不伪造链上 tx |
| x402 | ✅ Live 支付闭环已验证；全部 P0 + P1 动效完成 | X402-1~16（含 P1 动效 X402-12）已完成；真实 V2/EIP-3009 支付、PaidReportEnvelope 与 PaymentAttested 已由 explorer 证据串联；前端付费市场含 TTL 重读、支付流光/priceFlash/riskPulse/impact-pop（reduced-motion 安全）；仅 X402-17(P2 discovery) 待做 |
| Preflight | ✅ 已完成 | 固定 54 项总闸门；Demo 环境实测 50 PASS / 4 项显式 Live WARN / 0 FAIL，覆盖 Node、Solidity、smoke、scenarios、MCP、x402 与 UI |
| 动效 | 🟡 仅 waterfall 已有 | `priceFlash`、`riskPulse`、支付流水和 Demo banner 待补，且必须支持 reduced motion |
| 中文路演 | 🟡 有 30 秒和 3 分钟素材 | 需统一成 30 秒 / 1 分钟 / 3 分钟同一故事，并补 x402 与评委追问 |

### 0.1 冠军版一句话

> **Before investing in an eBL-backed RWA, anyone can pay cents over x402 for an AI due-diligence report; AgentBL turns that report into a verifiable risk discount, and Injective enforces the financing decision on-chain.**

中文：**投资 RWA 前，用户通过 x402 按次购买 AI 风控报告；AgentBL 把审单、估值和世界风险变成可验证的发行折价，Injective 负责支付、存证与融资执行。**

必须反复说明：**不是“AI 在买东西”，而是人、机构或其他 Agent 花钱购买 AgentBL 的 AI 分析结果。** x402 支付与 RWA 认购是两笔不同业务：

```text
x402：购买 AI 报告       402 → USDC 支付 → 解锁报告 → PaymentOracle 绑定报告哈希
RWA：投资贸易融资资产    阅读报告 → 接受风险 → 认购 RWA → RWAOfferingPool 结算
```

### 0.2 为什么 x402 值得做

1. **创新性**：把 AI 风控从“页面功能”升级成可独立交易的机器可调用服务。
2. **技术实现**：同一条演示同时覆盖 HTTP 402、USDC 支付、AI 结构化输出、Injective 结算和链上证据。
3. **应用价值**：银行、保险、物流平台、投资者和其他 Agent 都可以按次购买报告，无账号、无订阅。
4. **AI 含金量**：付费的是审单、估值、压力测试和证据，而不是一个普通 LLM 回答。
5. **生态契合**：Injective 官方已提供 `@injectivelabs/x402` 和 Injective EVM x402 指南；这是赛事 sponsor-native 能力，不是外链装饰。

### 0.3 夺冠约束

- 不再堆无关页面；所有新增能力必须回到“买报告 → 风险定价 → 链上执行”闭环。
- Demo 中任何 `tx_hash`、支付状态和 explorer 链接都必须来自真实交易；模拟值必须显式标 `DEMO`。
- LLM 可以解析、检索、解释和提出建议，但最终金额、状态迁移、权限和支付校验必须由确定性代码/合约验证。
- 支付成功不代表报告正确；报告必须通过 schema、证据完整性和新鲜度校验后才能注入定价。
- 不把贸易秘密、完整单据或模型 chain-of-thought 写链；只上链必要哈希、金额、地址、时间和决策摘要。

### 0.4 如果 2026-06-29 就是提交硬截止

不要同时开 eBL V2、多钱包、全市场后端、多 LLM、Azure tracing、Exchange precompile 六条战线。当天只保以下顺序：

```text
1. X402-1/3/4/6/8/11/14：先让付费情报流水可演示、可测试
2. X402-9/15：能真实上链就绑定 PaymentOracle；facilitator 不支持 1439 时明确展示 Demo 标签
3. MCP-6/7/8：把“5-tool mock”升级成可验证的 7 tools + 3 resources stdio server
4. DEMO-1/4/5/6/7：Demo Mode、preflight、路演和视频兜底
5. 其余任务提交后按 Wave B/C/D 继续，不在最后数小时重构核心协议
```

## 1. 本轮开发优先级

| Priority | 目标 | 说明 |
|---|---|---|
| P0 | 跑通 AI 定价主链路 | 出口商选择到账速度，AI 给出 RWA 发行价，投资者看到折价和风险 |
| P0 | 固定 PricingQuote schema | 让 AI、后端、前端、合约都围绕同一份结构化输出 |
| P0 | 完成 Investor RWA Offering 页面 | 评委必须看到“风险越高，价格越低，潜在收益越高” |
| P0 | 跑通自主 Agent 闭环 | eBL 上链后自动审单、估值、定价、开盘；风险事件自动改价/暂停；付款或到港自动结算 |
| P0 | 补齐 eBL 信任根 | ENI 文件标识、`cargoHash` 防一货多单、结构化元数据、transfer / endorse / history |
| P0 | 部署完整 Injective 协议 | 五个协议合约部署到 inEVM，前端支持 MetaMask + Keplr + Leap 与多链配置 |
| P0 | x402 付费情报闭环 | 真实 402 challenge → USDC 支付 → facilitator 结算 → 报告解锁 → PaymentOracle 存证 |
| P0 | Demo Mode + preflight | 默认无需钱包可演示；Live 模式只展示真实交易；赛前一条命令检查全部关键项 |
| P1 | 合约 mock / 最小 Solidity | RWAOfferingPool + RiskPricingOracle（WEB3-1~10 已完成；WEB3-11 及 v2 增量待做） |
| P1 | 多场景回归 | fast / balanced / high-risk repricing |
| P1 | 产品化市场后端与角色中心 | listings/search、pool subscribe/status、exporter dashboard、investor portfolio |
| P1 | 自主决策可审计 | 决策日志持久化、证据哈希、链上 tx 回填、Agent 活动面板 |
| P1 | 标准 MCP + Injective MCP | AgentBL 升级为 7 tools + 3 resources 的 stdio server，并用官方 Injective MCP 查询/执行 |
| P1 | Microsoft Foundry 评测 | 接 Azure OpenAI provider、Agent traces 和可复现 eval，给出 AI 质量证据 |
| P2 | Injective 原生模块 | ERC20/Bank precompile 优先；Exchange precompile 仅在有真实可解释场景时接入 |
| P2 | AI 与品牌增强 | 多 LLM 共识、出口商偏好参数、Injective 紫色主题与 ENI + Injective 联合品牌 |

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
| PM-8 | 将对外叙事统一为 gap analysis v2：Web3-native、三方协议、按货物与航线定价、投资者直投、No bank | Unassigned | Todo | README、PRD、demo/video script 交叉 review，核心定位与 3 分钟流程一致 | - |

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
| AI-13 | 实现 Agent 编排器 `src/agent/orchestrator.js`：串联文档解析、交叉核验、货物估值、三档定价、方案选择与自动开盘 | Bowen | Done | `node --test tests/orchestrator.test.js`，一次 eBL 事件只能生成一个确定性开盘决策 | `AgentOrchestrator.processEbl` 串联 parse→check→value→3 quotes→decision/optional execution；关键单据冲突强制 PAUSE；4 tests passed |
| AI-14 | 实现自主触发管道 `src/agent/autonomousAgent.js`：Event → Decision → On-chain Action，覆盖 mint、xAPI 风险、风险解除、付款、到港、保险到期 | Bowen | Done | `node --test tests/autonomousAgent.test.js`，六类事件分别得到 OPEN/REPRICE/PAUSE/RESUME/SETTLE/WARNING 动作 | 六类事件均产出结构化 protocol action；到港未付款只 WARNING，critical 世界风险强制 PAUSE；7 tests（含 AI-15）passed |
| AI-15 | 实现持续监控与执行可靠性：定时/事件驱动、幂等键、重试、并发锁、失败回退，禁止同一事件重复上链 | Bowen | Done | fake-timer + 重试/重复事件测试；连续运行两轮不产生重复 tx | `executionReliability.js` + `AutonomousAgent`：single-flight、指数退避、持久幂等、EXECUTING tx reconciliation、polling；并发/重启/重试测试通过 |
| AI-16 | 实现决策审计日志 `src/agent/decisionLogger.js`：保存输入快照、推理摘要、证据哈希、决策与链上 tx，并支持 tx 回填 | Bowen | Done | `node --test tests/decisionLogger.test.js`，`decision_id` 可重算且日志重启后仍可读取 | canonical hash 生成稳定 `decision_id`；原子 JSON 持久化、幂等 upsert、状态/tx 回填与重启读取；4 tests passed |
| AI-17 | 实现 AI 文档解析器 `src/agent/documentParser.js`：从 eBL / 发票 / 保险单图片或 PDF 提取结构化字段，并保留字段级来源与置信度 | Bowen | Done | `node --test tests/documentParser.test.js`，固定扫描件 fixtures 的关键字段准确率达到验收阈值，LLM 失败可回退/报人工复核 | Markdown/text 原生解析；PDF/image 走可注入 OCR；字段级 line/method/confidence、bundle merge、AI 失败确定性 fallback/人工复核；5 tests passed |
| AI-18 | 实现合规标注引擎 `src/agent/complianceChecker.js`：制裁、出口管制、MLETR、eUCP、DCSA、ICC DSI；只标注风险，不按企业规模拒绝服务 | Agent | Done | `node --test tests/complianceChecker.test.js`，通过、警告、阻断级风险 fixtures 均有证据引用 | `npm test` passed |
| AI-19 | 将现有浏览器端 `recommendEBL` 提炼为可测试的服务端投资顾问 `src/agent/investmentAdvisor.js`，支持自然语言偏好、排序理由与确定性 fallback | Agent | Done | `node --test tests/investmentAdvisor.test.js`，同一偏好返回稳定 Top 3，popup 与市场搜索复用同一结果 | `npm test` passed |
| AI-20 | 实现多 LLM 竞争评估：同一 case 由 3 个 provider 独立输出结构化评估，以中位数/共识聚合，分歧过大时降级为确定性引擎并标警告 | Agent | Done | `node --test tests/llmConsensus.test.js`，覆盖全成功、单 provider 失败、极端离群、全部失败四种情况 | `npm test` passed |

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
| BE-11 | 实现市场服务 API：`GET /api/market/listings` + `POST /api/market/search`，只返回活跃池并复用 AI-19 推荐逻辑 | Unassigned | Done | `node --test tests/marketApi.test.js`，覆盖筛选、排序、分页、暂停池排除和自然语言搜索 | tests/marketApi.test.js passed |
| BE-12 | 实现发行池 API：`POST /api/pool/subscribe` + `GET /api/pool/status`，真实链模式返回 tx/event，离线模式保持确定性 fallback | Unassigned | Done | `node --test tests/poolApi.test.js` + `npm run smoke`，重复认购、暂停池、金额越界均被正确处理 | tests/poolApi.test.js passed |
| BE-13 | 实现角色中心 API：`GET /api/exporters/dashboard` + `GET /api/investors/portfolio`，持久化 eBL、池状态、持仓、收益与兑付记录 | Unassigned | Done | `node --test tests/dashboardApi.test.js`，服务重启后数据可恢复且只能读取当前钱包的数据 | tests/dashboardApi.test.js passed |
| BE-14 | 实现 eBL 文档接入与 ENI adapter：上传 eBL/发票/保险单、校验类型/大小、获取可信文件标识与哈希，并触发 AI-13 编排器；ENI 不可用时提供明确 mock fallback | Unassigned | Todo | `node --test tests/eblIngestion.test.js`，真实/模拟 ENI 两条路径均产出可追溯 document hash，重复上传保持幂等 | - |
| BE-15 | 实现 Agent 活动查询与实时订阅 API（SSE 或 WebSocket）：按 case/pool 返回持久化决策、执行状态、证据与 tx，供 FE-13 使用 | Unassigned | Todo | `node --test tests/agentActivityApi.test.js`，断线重连不丢事件且不暴露内部原始 chain-of-thought | - |

## 5. Frontend

前端目标：让评委一眼看到“AI 正在给 RWA 定价”，而不是普通 dashboard。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| FE-1 | Exporter Financing Quote 页面：选择 FAST / BALANCED / LOW_COST | Bowen | Done | 手动访问 `npm run dev` | `public/index.html` #exporter-panel + topbar speed segmented control；`app.js` renderSpeedSelector/renderExporterCards 由 `POST /api/pricing/quote {compare:true}` 驱动三速对比；headless render harness 验证（3 张卡 + active 高亮 + 点击切换实时改价 0.848→0.800） |
| FE-2 | Exporter 页面展示：发行价、预计到账、融资成本、推荐发行数量 | Bowen | Done | 手动访问 `npm run dev` | `app.js` renderExporterCards 每速展示 issue price / cash to exporter / financing cost / % of trade profit / net profit / token supply + ★AI pick(recommended_payout_speed) + exporter_explanation |
| FE-3 | Investor RWA Offering 页面：展示 issue price、target redemption、implied gross yield | Bowen | Done | 手动访问 `npm run dev` | `app.js` renderInvestor #investor-panel：大号 issue price、$1.00 target redemption、implied gross yield badge、token supply、risk/action 徽章；headless 验证 $0.848 / supply / MEDIUM |
| FE-4 | Investor 页面展示 AI risk factors：战争、天气、港口、保险、价格波动 | Bowen | Done | 手动访问 `npm run dev` | `format.js` rollupRiskDimensions → 6 维(war/weather/port/insurance/price/docs)带 bps + 严重度配色 + RAG intel 引用(intelCitations)；doc:Insurance 归入 Insurance 维；war-crisis 用例 5 维全亮验证 |
| FE-5 | AI Pricing Console：base price、urgency discount、risk discount、final price | Bowen | Done | 手动访问 `npm run dev` | `app.js` renderWaterfall：$1.00 target → base anchor → −urgency → −risk → indicative → collateral floor → final 的 broken-axis 瀑布图；与 assertPricingQuote 加性不变量一致 |
| FE-6 | Smart Contract Timeline：Created -> Priced -> Open -> Repriced/Paused/Funded/Redeemed | Bowen | Done | `npm run smoke` + 手动验证 | `app.js` renderTimeline 由 `POST /api/offering/simulate` 驱动：生命周期 stepper + 事件日志；“Simulate in-transit risk” 注入事件 → 实时 reprice/pause callout（headless 验证 0.800→0.782 Repriced）；`npm run smoke` 通过 |
| FE-7 | Scenario selector：一键切换 fast / balanced / high-risk | Bowen | Done | 手动访问 `npm run dev` | 新增只读 `GET /api/cases`（src/app/server.js loadCaseCatalog）+ topbar 场景 segmented control；风险阶梯 clean→warning→critical 共 4 个真实 case（含 AI-10 war-crisis）；payout 速度独立切换 |
| FE-8 | Subscribe mock：投资者输入认购金额，显示获得 RWA 数量 | Bowen | Done | 手动访问 `npm run dev` | `app.js` renderSubscribe/computeSubscription：USDC 输入 → RWA tokens + cost / target redemption / target upside / gross yield；暂停态(PAUSE/FREEZE)禁用并提示 |
| FE-9 | Evidence hash / quote hash 展示 | Bowen | Done | 手动访问 `npm run dev` | `app.js` #oracle-panel 展示 quote_hash + evidence_hash + `updatePricing(...)`（来自 `POST /api/oracle/pricing-update`）；“Push to RiskPricingOracle” → MCP push_pricing_to_oracle 返回 PricingUpdated tx（headless 验证） |
| FE-10 | 合规提示 UI：target redemption is not guaranteed | Bowen | Done | 文案 review | investor 面板合规框 + subscribe 脚注：“$1.00 是 target 非保本，依赖进口商付款/货物结算/保险” + “permissioned investors only” |
| FE-11 | 开发 eBL 管理 View ③：上传 eBL/发票/保险单、查看解析与合规结果、tokenize 状态、质押/流转历史 | Unassigned | Done | `npm run dev` + 前端验收清单；上传 fixture 后可追踪 Parser → Checker → Mint → Open 全过程 | index.html + app.js updated |
| FE-12 | 开发投资组合 View ④：展示钱包持仓、成本、当前估值、目标收益、风险状态与兑付记录，替换 popup 内存数组 | Unassigned | Done | 连接测试钱包手动验收 + UI 测试；刷新页面后持仓不丢失 | index.html + app.js updated |
| FE-13 | 开发 Agent 活动 View ⑤：展示真实决策日志、Agent 当前状态、触发源、推理摘要、证据与链上 tx；移除随机 tx 的模拟记录 | Unassigned | Done | 注入 xAPI 风险事件后，页面实时出现与后端/链上相同的 REPRICE 或 PAUSE 记录 | index.html + app.js updated |
| FE-14 | 增加出口商偏好参数面板：最低可接受发行价、到账速度偏好、目标融资额，并在自主开盘前校验约束 | Unassigned | Done | 三组参数化用例；低于最低价时 Agent 不开盘并给出可解释原因 | wired pref-min-price |
| FE-15 | 完成 Injective 品牌适配：紫色主题、Injective/ENI 联合品牌、`Powered by ENI + Injective`，保留 WCAG 对比度 | Unassigned | Done | 中英文桌面/移动端视觉 review + 对比度检查 | styles.css updated |

## 6. Web3 / Contract

Web3 目标：把 AI 定价结果写成链上可验证事件，而不是只在前端展示。

**进度摘要（2026-06-29 仓库复核）**

| 范围 | 状态 | 说明 |
|---|---|---|
| WEB3-1 ~ WEB3-4 | Done | 冻结设计见 `docs/contracts.md` |
| WEB3-5 | Done | JS contract mock：`src/core/contractHarness.js` |
| WEB3-6 ~ WEB3-9 | Done | Hardhat 合约 + 测试：`hardhat/`，`hardhat test` 6 passing |
| WEB3-10 | Done | `AgentBLRWA` Demo 合约已部署 Injective Testnet；不等同于完整协议合约部署 |
| WEB3-11 | Todo | 前端合约地址与事件展示 |
| WEB3-12 ~ WEB3-19 | Todo | gap analysis v2：eBL V2、自主动作、访问模型、完整协议部署、多钱包与多链配置 |

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
| WEB3-11 | 前端展示合约地址和 PricingUpdated event | Sage | Todo | 手动演示 | - |
| WEB3-12 | 升级 `EBLRegistry` V2：计算/登记 `cargoHash`，提供 `isUnique`，同一批货禁止重复 mint | Unassigned | Todo | `cd hardhat && npm test`，相同 cargoHash 二次登记必须 revert，不同货物可正常登记 | - |
| WEB3-13 | 增加 eBL 结构化元数据：船舶、航次、装卸港、货物、数量、HS Code、申报价值、Incoterms、MLETR/eUCP/DCSA 标准 | Unassigned | Todo | Solidity getter/event 测试 + 元数据 hash 与链下解析结果一致性测试 | - |
| WEB3-14 | 实现 eBL 完整流转：`transfer`、`endorse`、`getTransferHistory`；质押期间禁止未授权转移，创建发行池前必须已质押到对应池 | Unassigned | Todo | `cd hardhat && npm test`，覆盖正常转让、连续背书、质押锁定、未质押建池失败、释放后转让与历史顺序 | - |
| WEB3-15 | 补齐自主执行状态机：`RESUME_OFFERING`、付款/到港结算、合法状态迁移、Agent executor 权限与紧急人工停机 | Unassigned | Todo | `cd hardhat && npm test`，覆盖 PAUSE→RESUME、OPEN/FUNDED→SETTLE、非法迁移、越权调用与重复事件 | - |
| WEB3-16 | 对齐 v2 投资者访问模型：测试网允许任意钱包直投；生产模式使用可插拔合规 gate，移除当前硬编码 allowlist 与“全球投资者”叙事冲突 | Unassigned | Todo | permissionless testnet 与 compliance-gated 两种模式合约测试；前端文案与实际权限一致 | - |
| WEB3-17 | 编写完整协议部署脚本并部署 `AgentBLRWA`、`EBLRegistry` V2、`RiskPricingOracle`、`RWAOfferingPool`、`RWAToken` 到 Injective inEVM | Unassigned | Todo | 五个地址 + deploy tx + explorer 链接；部署后运行链上 smoke 验证 create/subscribe/reprice/pause/resume/settle | - |
| WEB3-18 | 钱包集成扩展为 MetaMask + Keplr + Leap：钱包选择、网络切换、签名、断线重连与错误提示 | Unassigned | Todo | Injective Testnet 三钱包验收矩阵；每种钱包至少完成一次真实签名交易 | - |
| WEB3-19 | 将 `public/chain-config.json` 改为多链/多合约格式，默认 `injective-testnet`，并让部署脚本合并配置而非覆盖其他网络 | Unassigned | Todo | config schema 测试 + 两个网络 fixture；切链后地址、RPC、explorer 与 ABI 均正确 | - |

## 7. MCP / RAG / Skill

这些是加分项，必须服务 AI 定价主链路。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| MCP-1 | 设计 AgentBL MCP tools manifest | Xlen | Done | `npm run smoke` | merged from feature/mcp-server |
| MCP-2 | 实现 `get_trade_case` | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| MCP-3 | 实现 `generate_pricing_quote` | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| MCP-4 | 实现 `simulate_offering` | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| MCP-5 | 实现 `push_pricing_to_oracle` mock / real tx | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| RAG-1 | 建立风险情报资料：天气、战争、港口、保险、价格 mock feed | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| RAG-2 | 准备 4 个评委追问检索问题 | Xlen | Done | `npm run test` | merged from feature/mcp-server |
| SKILL-1 | 创建 `agentbl-pricing-analyst` skill | Xlen | Done | `npm run smoke` | merged from feature/mcp-server |
| SKILL-2 | 创建 `agentbl-demo-operator` skill | Xlen | Done | `npm run smoke` | merged from feature/mcp-server |

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
| QA-10 | 增加自主 Agent 可靠性测试矩阵：事件乱序、重复事件、进程重启、RPC 超时、xAPI/LLM 不可用、链上交易失败 | Unassigned | Todo | `npm run test`，所有失败路径均有幂等恢复或确定性 fallback | - |
| QA-11 | 增加 eBL V2 安全测试：一货多单、伪造 cargoHash、未授权 transfer/endorse、质押中转让、重放攻击 | Unassigned | Todo | `cd hardhat && npm test` + 安全测试报告 | - |
| QA-12 | 增加市场与角色 API 集成测试：访问控制、分页、并发认购、持久化恢复、链上/链下状态对账 | Unassigned | Todo | `npm run test && npm run smoke`，API、持久化存储与合约事件三方一致 | - |
| QA-13 | 建立 MetaMask / Keplr / Leap × 桌面/移动端 × 真实链/离线 fallback 的手动验收矩阵 | Unassigned | Todo | 完整 checklist、截图与测试 tx hash | - |
| QA-14 | 按 gap analysis v2 跑通 3 分钟 P0 验收：上传 → 唯一性 → 解析 → 自主定价/开盘 → 市场认购 → 风险暂停/恢复 → 自动兑付 | Unassigned | Todo | 录像 + 决策日志 + 全套链上 tx；任何一步不得依赖伪造随机 tx | - |

## 9. 推荐并行分工

| 角色 | 负责人建议 | 主要任务 |
|---|---|---|
| PM / Pitch | 1 人 | PM-1 到 PM-8，demo script，合规 Q&A，No-bank 叙事一致性 |
| AI | 2 人 | AI-1 到 AI-20，pricing、orchestrator、autonomous loop、parser、compliance、advisor、LLM consensus |
| Backend | 1-2 人 | BE-1 到 BE-15，API、schema、scenario、ENI ingestion、market/pool/role persistence |
| Frontend | 1-2 人 | FE-1 到 FE-15，Marketplace + Mint + Voyage + eBL/Portfolio/Agent Activity |
| Web3 | 1-2 人 | WEB3-1 到 WEB3-19，eBL V2、自主状态机、完整协议部署、多钱包/多链 |
| QA / Integrator | 1 人 | QA-1 到 QA-14，最终集成、安全、钱包矩阵和演示兜底 |

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
feature/agent-orchestrator
feature/agent-autonomous-loop
feature/ebl-registry-v2
feature/eni-document-ingestion
feature/agent-activity-view
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

这 16 个完成，项目才能从“AI 定价演示”升级为“eBL 上链即自主运行、风险变化即自主执行、全程可审计”的 Web3 原生协议。多链配置、组合页、多 LLM 与品牌主题可在核心闭环稳定后并行补齐。

## 14. x402 付费情报市场（冠军版 P0）

### 14.1 冻结架构

官方 Injective 路线优先：服务端以 `@injectivelabs/x402` 为主；只有浏览器/CLI 客户端或底层协议确有需要时，才直接加入 `@x402/core`、`@x402/evm`、`@x402/fetch`，禁止为了“依赖看起来多”而全装。当前后端是 `node:http`，因此先做兼容性 spike，再在“薄 Express x402 router”与“原生 HTTP adapter”之间二选一，不能半迁移整个服务。

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

### 14.2 三个付费端点

| Endpoint | 建议价格（可配置） | 付费输出 | 禁止退化成 |
|---|---:|---|---|
| `POST /api/x402/intel/premium` | 0.01 USDC | 5 维世界风险、来源、时效、置信度、情景影响、`evidence_hash` | 把现有免费 JSON 原样包一层 402 |
| `POST /api/x402/valuation/premium` | 0.03 USDC | 反欺诈审单、可比交易、保守货值、三档融资报价、分歧/置信度、`quote_hash` | 只让 LLM 写一段估值文案 |
| `POST /api/x402/stress-test`（兼容 `/smoke-test`） | 0.05 USDC | 基准/警告/极端场景、损失区间、违约回收、REPRICE/PAUSE 建议、可重放输入快照 | 返回“smoke passed”字符串 |

价格只用于 demo，统一由环境变量配置。报告被买下后可在短 TTL 内按 `payment_tx + report_hash` 重读，不能每次刷新重复收费。

付费风险报告统一为 5 个决策维度，复用现有更细粒度 signals，不另造第二套分数：

```text
① Document & Fraud  单据真实性、一致性、一货多单
② Cargo & Valuation 货值、可比交易、价格波动、haircut
③ Transit & Logistics 航线、天气、港口、延误
④ Macro & Geopolitics 战争、制裁、汇率、国家风险
⑤ Insurance & Settlement 保险覆盖、买方付款、回收与结算
```

### 14.3 工程任务

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
| X402-11 | 新增前端”付费情报市场”选项卡：报告商品卡、锁定预览、价格、数据时间、模型、`402 → 签名 → 结算 → 解锁 → 存证` stepper、explorer 链接 | P0 | Sage | Done | View ③ 报告目录 + 4 步 stepper + 支付证据卡 + 定价影响 + explorer 链接已具备；本轮补齐「刷新后 TTL 内可重读」：新增 `src/x402/reportStore.js`（`PaidReportCache`，原子持久化 + 过期自动 prune）、`createX402Route` 交付成功即缓存、`GET /api/x402/report/:id` 在 TTL 内免费重读（miss→404 需重付），前端 localStorage 记忆已购 report_id 并在进入 View ③ 时重读未过期报告（`#x402-purchased`）。`tests/x402ReportStore.test.js` 7 tests + 集成「demo 购买→GET 重读 200/未知→404」；对运行中服务器实测 demo 购买→重读 200 且 report_id 一致；`npm test` 278 passed。注：本会话浏览器扩展断连，客户端 localStorage 重读路径未做可视化验收 |
| X402-12 | 加入支付动效与风险反馈：`paymentFlow`、`priceFlash`、`riskPulse`；支持 `prefers-reduced-motion` | P1 | Sage | Done | 已接线：付费时 `#x402-flow` 跑 `particleFlow` 流光，结算成功后 after-price `priceFlash`、价升时 delta badge 短促 `risk-pulse`(4.2s 后停)、impact 卡 `x402-impact-pop`(放大+绿环) 在用户视线落点处提示成功；`pulseClass` 与 risk-pulse 均带 `prefers-reduced-motion` 守卫 + 全局 reduced-motion 规则兜底；满屏 confetti 经实测易被卡片视线遮挡、收益低，已按用户决定移除；`node --check public/app.js` 通过 |
| X402-13 | 新增 `scripts/x402-intel.mjs` 与 `npm run x402:intel -- --case <id> --kind <kind>`；输出 challenge、金额、settlement tx、report hash、oracle tx | P0 | Bowen | Done | CLI 支持 risk/valuation/fraud、case ID/文件、Demo 临时 signer 与 Live fail-closed；密钥只在本地使用，输出 challenge/金额/receipt/report hash/oracle 状态 |
| X402-14 | 新增 `scripts/smoke-x402.mjs`、`npm run smoke:x402` 和至少 12 个自动化测试 | P0 | Bowen | Done | 新增 `tests/x402Endpoints.test.js` 15 tests；连同 config/server/settlement 覆盖 3 endpoints、budget/cancel/timeout/wrong network、tamper/replay/expiry/wrong recipient/结算失败与成功；`smoke:x402` 通过 |
| X402-15 | 做 Injective Live smoke：钱包有 INJ gas + USDC，实际购买一份报告，回读支付 tx、`PaymentAttested` 与报告哈希 | P0 | Bowen | Done | 2026-06-29 在 `eip155:1439` 以测试用 self-transfer 真实结算 0.001 USDC：payment `0x6d796d…a0b49`、report `rpt_3e5f…3334` / hash `0x994078…168ce`、attestation `0xa03ab9…fef6e`；路演前可改用独立 treasury payTo 再跑；完整证据见 `docs/evidence/x402-live-smoke.json` |
| X402-16 | README、架构图、API 文档、威胁模型和 FAQ 更新；清楚区分 x402 报告支付与 RWA 认购 | P0 | Sage | Done | `docs/x402-integration.md` 新增「x402 报告支付 vs RWA 认购」对照表 + 流程图、8 条威胁模型不变量表（对应代码与测试）+ 客户端可恢复错误码、评委 FAQ（谁付钱/买什么/为何上链/与 RWA 区别/支付失败/为何 Injective）、`GET /api/x402/report/:id` 重读端点与 `X402_REPORT_CACHE_PATH`；README 中英文 API 表新增 4 个 x402 端点 + 「x402 ≠ RWA」提示框 + More docs 链接到 x402-integration.md |
| X402-17 | 可选：通过 x402 Bazaar/discovery extension 发布 3 个机器可发现的资源描述，使外部 Agent 能发现并购买 | P2 | Unassigned | Todo | discovery metadata 可被客户端解析；不阻塞核心 demo |

### 14.4 x402 安全不变量

```text
1. verified && settled 才能 unlock；仅看到 tx hash 不等于支付成功。
2. network + asset + amount + payTo + resource + nonce 全部进入签名/校验域。
3. payment receipt 与 report_hash 一一绑定；不同 case / report 不得复用。
4. 重放、并发、超时重试只能产生一次结算和一次 PaymentOracle attestation。
5. 报告生成失败时不得扣款，或必须提供可验证退款/重试策略。
6. Demo mode 的 receipt 使用 demo:// 标识，永不生成伪造 explorer URL。
```

## 15. 标准 MCP 与 Agent 可组合性（P1）

当前 `src/mcp/mcpServer.js` 是好用的内部工具注册表，但不是可被 Claude/Bowen/其他 Agent 直接连接的标准 MCP server。保留核心 handlers，新增协议 transport，不重写业务逻辑。

### 15.1 冻结为 7 tools

```text
1. get_trade_case
2. search_knowledge_base
3. verify_trade_documents        # 新增：eBL / invoice / insurance 交叉核验
4. generate_pricing_quote
5. purchase_premium_analysis     # 新增：作为 x402 client 购买报告
6. simulate_offering
7. push_pricing_to_oracle
```

### 15.2 冻结为 3 resources

```text
agentbl://cases/catalog           # 可演示 case 与摘要，不含敏感全文
agentbl://risk/methodology        # 5/6 维风险、bps 规则、非保本边界
agentbl://contracts/deployments   # network、合约地址、ABI 版本、explorer
```

| ID | Task | Priority | Owner | Status | Verification / Definition of Done |
|---|---|---|---|---|---|
| MCP-6 | 使用官方 MCP SDK 实现 stdio transport 与 JSON-RPC lifecycle，handlers 继续复用现有确定性引擎 | P1 | Unassigned | Todo | MCP Inspector/真实 client 可 initialize、listTools、callTool、listResources、readResource；stdout 不混入日志 |
| MCP-7 | 增加 `verify_trade_documents` 与 `purchase_premium_analysis`，工具总数固定为 7；后者完整处理 402 支付而不是绕过 middleware | P1 | Unassigned | Todo | `tests/mcpProtocol.test.js` 对 7 工具逐一 schema/call；购买工具返回 payment + report + oracle proof |
| MCP-8 | 增加 3 个只读 resources，设置 MIME type、URI 校验和敏感字段脱敏 | P1 | Unassigned | Todo | list/read 正常；未知 URI 返回标准错误；资源与当前部署配置一致 |
| MCP-9 | 接入官方 Injective MCP Server 作为外部链执行/查询 adapter，优先使用其 chain query、transfer、raw EVM transaction 能力 | P1 | Unassigned | Todo | 由 Agent 发起一次真实 Injective 查询和一次受控 raw EVM testnet 交易；日志含 tool name、参数摘要、tx hash |
| MCP-10 | 为链上写操作加入 human approval、金额上限、allowlist、network pinning、dry-run；读操作可自动 | P0 | Unassigned | Todo | 未批准写入、超限金额、错网、未知合约全部拒绝；不能让 prompt injection 任意转账 |
| MCP-11 | 提供 `npm run mcp:stdio`、示例 client config、30 秒录屏和离线 protocol fixture | P1 | Unassigned | Todo | 全新环境按 README 可连接；没有 Injective MCP 时仍可演示 AgentBL 只读/模拟能力 |

## 16. 赞助方技术使用清单（多用，但每一项都要有业务理由）

| ID | Sponsor / capability | Priority | 应用位置 | Task / 验收 |
|---|---|---|---|---|
| SP-1 | Injective EVM | P0 | 五合约协议、PaymentOracle、USDC x402 | 完整部署、验证源码、记录地址/tx、前端回读事件 |
| SP-2 | Injective x402 | P0 | AI 情报按次付费 | 完成 X402-1~16；路演展示真实 402 和支付 tx |
| SP-3 | Injective MCP Server | P1 | Agent 查链、执行受控 raw EVM tx | 完成 MCP-9/10；不要把自建 MCP 冒充官方 MCP |
| SP-4 | Injective EVM / CLI agent skills | P1 | 开发、部署与故障排查工作流 | 在 `docs/injective-runbook.md` 记录安装、使用场景和可复现命令；它是工程能力，不伪装成产品 runtime |
| SP-5 | Injective ERC20/Bank precompile | P1 | 统一 USDC 余额/denom/转账与 RWA token 的 EVM/native 映射 | 做最小 read/write spike；成功后再决定是否进入 P0，避免自建重复桥接层 |
| SP-6 | Injective Exchange precompile | P2 | 可选的 RWA 二级市场/风险对冲 | 只有存在真实测试市场与清楚经济模型时才接；验收为真实 order/query，不以 mock 截图算完成 |
| SP-7 | Injective Indexer + Explorer | P0 | 支付、定价、暂停、恢复、兑付事件回读 | UI 中每个关键状态都能跳到真实 tx/event；Indexer 不可用时 RPC fallback |
| SP-8 | Azure OpenAI / Microsoft Foundry Models | P1 | `openaiCompatClient` 新增 Azure provider；解析、解释、报告生成 | `AZURE_OPENAI_ENDPOINT/DEPLOYMENT/API_KEY` 配置；工具调用与 structured output 通过；确定性 fallback 保留 |
| SP-9 | Microsoft Foundry Evaluation | P1 | Agent AI 质量证明 | 建立 ≥20 条 eval dataset；Task Completion ≥85%、Tool Call Success ≥95%、Groundedness ≥0.8；保存可分享结果截图/JSON |
| SP-10 | Microsoft Foundry / Application Insights tracing | P1 | Agent 调用链可观测 | 用 OpenTelemetry 记录 parser→checker→risk→valuation→pricing→payment→chain spans、延迟、错误和成本；默认脱敏 |
| SP-11 | GitHub Copilot | P2 | 团队开发效率 | 只在开发说明中如实记录，不作为产品技术创新点或 runtime 集成 |
| SP-12 | ENI / TradeGo / 丽讯 | P0 | 可信 eBL、真实业务数据、落地背书 | 至少拿到 sandbox/API schema、样例 document ID 或正式 LOI 之一；拿不到时显式 mock adapter，不虚构合作上线 |
| SP-13 | xAPI | P0 | X/新闻/预测市场世界风险 | 已有；新增 freshness、source health、去重与付费报告引用，继续保留离线 fixture |

## 17. Demo Mode、视觉与路演（冠军项目首先要“看得懂”）

### 17.1 1 分钟主演示

```text
00–08s  “货在海上漂，钱等 45 天。”出口商缺现金，投资者看不懂单据风险。
08–18s  打开一笔铜/原油 eBL：报告被锁，API 返回 402，展示 0.01 USDC。
18–30s  钱包签名，Injective 结算，stepper 依次点亮，报告解锁。
30–42s  AI 展示 5 维风险 + 反欺诈审单 + 估值对比；每个数字能点开证据。
42–52s  报告注入 RWA 定价：价格 waterfall 变化；PaymentOracle 与 RiskPricingOracle 写链。
52–60s  一句话收束：别人花钱买 AI 分析，AI 给风险定价，Injective 强制执行。
```

### 17.2 工程任务

| ID | Task | Priority | Owner | Status | Verification / Definition of Done |
|---|---|---|---|---|---|
| DEMO-1 | 新增统一 `demoMode=true`（默认）与显式 Live toggle；Demo 数据可一键 reset，Live 模式严禁 mock tx | P0 | Bowen | Done | `src/demo/mode.js` + `/api/demo/mode|reset`；顶部常驻 banner/Live toggle/reset；Live 前置不足返回 409，PaymentOracle 写入失败不会退回假 tx |
| DEMO-2 | 首页只保一个主 CTA：“购买这笔 RWA 的 AI 风控报告”；二级入口再放融资/市场/航运 | P0 | Unassigned | Todo | 5 秒可用性测试：新用户能说出谁付钱、买什么、链上发生什么 |
| DEMO-3 | 完成支付流水、riskPulse、priceFlash、waterfall、Agent activity 的同屏联动 | P1 | Unassigned | Todo | 同一 `report_id/decision_id/tx_hash` 贯穿各面板；没有随机日志或不一致数字 |
| DEMO-4 | 编写 30 秒 / 1 分钟 / 3 分钟中文路演稿与英文 tagline，三版数字、角色和叙事完全一致 | P0 | Unassigned | Todo | 交叉检查 README、PRD、demo-script、video-script；至少 3 次计时彩排 |
| DEMO-5 | 新建 `npm run preflight`，汇总 54 项检查：环境、文件/schema、257 Node tests、19 contract tests、smoke/scenarios、MCP、x402、RPC/facilitator、余额、合约地址、UI asset、文档一致性 | P0 | Bowen | Done | `scripts/preflight.mjs` 固定 54 项并真正执行全部套件；Demo 实测 50 PASS / 4 Live WARN / 0 FAIL；关键失败 exit 1 |
| DEMO-6 | 评委追问预案：为什么 AI、谁承担货损、为何不是证券保本、报告是否能伪造、支付失败怎么办、为何必须 Injective、与 TradeGo/银行差异 | P0 | Unassigned | Todo | 每题 20 秒答案 + 可点击证据/代码/tx；不做未经律师确认的法律断言 |
| DEMO-7 | 录制 Live 主视频 + Demo Mode 兜底视频，准备本地 MP4、关键截图和 CLI 兜底 | P0 | Unassigned | Todo | 飞行模式也能播放；视频中的 tx 链接和当前部署配置一致 |
| DEMO-8 | 做一次“故障彩排”：RPC、facilitator、LLM、xAPI、钱包分别失效 | P0 | Unassigned | Todo | 每种故障 15 秒内切到正确兜底；不刷新整场、不暴露堆栈/密钥 |

### 17.3 `preflight` 固定 54 项

实现时按下列编号输出，不能用“54 项”当口号却只跑五条命令。Live-only 检查在 Demo Mode 可记为 `SKIP`，但不能记为 `PASS`。

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
| 22 | `npm test` 且不少于当前 257 tests | 49 | 30 秒/1 分钟/3 分钟数字与角色一致 |
| 23 | `npm run smoke` | 50 | README/UI/视频中的 explorer 链接可打开 |
| 24 | `npm run scenarios` | 51 | Live 模式无 `mock/random/demo tx` |
| 25 | `npm run demo` | 52 | 日志与 telemetry 隐私/secret 扫描 |
| 26 | `hardhat compile` | 53 | 本地 CLI、截图、MP4 兜底资产齐全 |
| 27 | `hardhat test` 且不少于当前 19 tests | 54 | 输出 commit SHA、build time、dirty tree 警告 |

## 18. AI 质量、安全与可信度

| ID | Task | Priority | Owner | Status | Verification / Definition of Done |
|---|---|---|---|---|---|
| TRUST-1 | 建立 Gold dataset：真实/脱敏 eBL、发票、保险单、正常/欺诈/缺字段/战争/延误至少 20 cases | P0 | Unassigned | Todo | 数据许可和来源可说明；字段级 ground truth；不得把敏感商业数据提交到公开仓库 |
| TRUST-2 | 评估 OCR/解析准确率、文档一致性 precision/recall、风险分单调性、估值误差、tool-call 成功率 | P1 | Unassigned | Todo | `docs/evaluation-report.md` 给出指标、失败样例、限制；不能只报总测试数 |
| TRUST-3 | Prompt-injection 防护：文档内容视为不可信数据，不能改变工具权限、支付地址、网络、价格和系统规则 | P0 | Unassigned | Todo | 恶意 eBL fixture 不能触发任意 tool/tx、改 payTo、泄露 secret；测试纳入 preflight |
| TRUST-4 | 合约安全：访问控制、暂停、重入、重放、整数精度、重复 cargo/payment/report、状态机、emergency stop | P0 | Unassigned | Todo | Slither 或同等静态检查 + adversarial tests；所有 high finding 关闭或书面接受 |
| TRUST-5 | 数据新鲜度和来源健康：风险情报标 `observed_at/expires_at/source_status`，过期自动降置信度或拒绝定价 | P0 | Unassigned | Todo | clock-controlled tests；断网不把旧数据冒充实时数据 |
| TRUST-6 | 隐私与合规最小化：链上只存 hash；日志/telemetry 对 BL、公司、钱包做字段级脱敏；增加删除/保留策略 | P1 | Unassigned | Todo | log snapshot 无原始文件、API key、私钥、完整地址；隐私说明加入 README |
| TRUST-7 | 经济模型压力测试：重复购买、报告转售、低价刷接口、退款、报告过期、RWA 违约与利益冲突 | P1 | Unassigned | Todo | 文档给出价格/成本/毛利假设与 3 个极端场景；x402 收入不混入 RWA 收益承诺 |

## 19. 五项评审标准对照表

| 评审维度 | 评委必须看到的证据 | 对应任务 | Gate |
|---|---|---|---|
| Innovation | “AI 报告本身可按次交易”，支付证据与报告哈希绑定，报告再驱动 RWA 定价 | X402-7~11、X402-15 | 一次真实 402 + 一次真实 oracle event |
| Technical Execution | Injective 五合约 + PaymentOracle、标准 MCP 7+3、257+19 tests、live tx | WEB3-17、X402-9、MCP-6~10、DEMO-5 | preflight 全绿，所有 explorer link 可打开 |
| Use Case & Impact | 45 天回款痛点、银行/保险/投资者/Agent 都能买报告、明确收费与市场入口 | PM-8、X402-8、TRUST-7 | 1 分钟说清 payer/buyer/value/revenue |
| Product & UX | 402→支付→结算→解锁一屏看懂；证据可展开；钱包失败可恢复 | X402-11/12、DEMO-1~3 | 5 秒理解测试 + 60 秒 demo |
| Ecosystem Fit | 官方 Injective x402、MCP、EVM、Explorer、可选 precompile；Azure eval/tracing | SP-1~10 | 每个 logo 都能指向代码、配置、trace 或 tx |

## 20. 执行顺序与出线闸门

### Wave A：48 小时内先闭环

```text
X402-1 → X402-3/4/6 → X402-8 → X402-13/14
DEMO-1 → DEMO-5
```

Gate A：Demo Mode 能稳定出现 402、结算、解锁三个不同付费结果；12+ x402 tests 全绿。若 testnet facilitator 不支持，必须在此时决定 mainnet 小额实付或显式 demo，不把不确定性拖到最后。

**Gate A 状态：✅ 已达成。** 三类 Demo 报告完成 402→签名→结算→解锁，专项测试与 257 个 Node tests 全绿；Live V2/EIP-3009 已完成一笔 0.001 USDC 真实支付，并由 `PaymentAttested` 将 payment tx、报告哈希和 case 绑定。

### Wave B：链上可信与 Agent 可组合

```text
X402-7/9/10/15 → WEB3-17 → MCP-6/7/8/10 → MCP-9
```

Gate B：一笔真实支付能从 payment tx 追到 `PaidReportEnvelope`、`PaymentAttested`、`PricingUpdated` 和最终 RWA 报价；MCP Inspector 能列出 7 tools + 3 resources。

### Wave C：AI 证据与产品打磨

```text
SP-8/9/10 → TRUST-1/2/3/5 → X402-11/12 → DEMO-3/4/6
```

Gate C：Azure eval 达阈值，trace 能看到完整 Agent 工具链，页面 60 秒演示无口头补丁。

### Wave D：决赛冻结

```text
DEMO-7/8 → QA-10~14 → TRUST-4/6/7 → npm run preflight
```

Gate D：连续 3 次 preflight 全绿；Live/Demo/CLI/视频四套路径都演练；最后 6 小时只修 P0 blocker。

## 21. 借鉴顶尖获奖项目，但不照搬

| 项目 / 可借鉴模式 | AgentBL 落地方式 | 不要照搬的部分 |
|---|---|---|
| AgentLevy：先承诺验收标准，再把付款与可验证交付绑定 | `PaidReportEnvelope` + schema/证据/新鲜度检查 + `report_hash`/payment tx 绑定 | P0 不做通用仲裁协议和复杂 escrow |
| Alpha402：持久状态机、可视化流水、审计证明、故障 fallback | x402 六状态 stepper、decision/payment log、live/demo 双模式 | 不堆无业务意义的多 Agent 数量和 3D 特效 |
| AgentSlam：可靠性与可观测性优先，bounded retry/heartbeat | settlement 幂等、Agent trace、RPC/facilitator 健康检查、故障彩排 | 不把 mock fallback 伪装成真实链结果 |
| RWA-GPT：自然语言降低 RWA 使用门槛 | 市场 AI 搜索、MCP、报告证据解释 | 不退化成“聊天框 + 投资按钮” |

## 22. 官方研究依据（实现前再次核验）

- [Injective x402 官方指南](https://docs.injective.network/developers-ai/x402)：官方 `@injectivelabs/x402`、USDC 支付、facilitator、Injective EVM 示例。
- [Injective MCP Server](https://docs.injective.network/developers-ai/mcp)：stdio、链查询、转账、桥接与 raw EVM transactions。
- [Injective AI Developers](https://docs.injective.network/developers-ai)：Injective CLI/EVM/MCP/Trading skills 与最新 AI 开发路线。
- [Injective EVM Precompiles](https://docs.injective.network/developers-evm/precompiles/) 与 [Exchange Precompile](https://docs.injective.network/developers-evm/exchange-precompile)：EVM 调用 Bank/Exchange 等原生模块。
- [Injective ERC20 Module](https://docs.injective.network/developers-evm/erc20-module)：USDC/IBC/tokenfactory denom 与 ERC20 映射。
- [x402 Foundation spec / SDK](https://github.com/x402-foundation/x402)：V2 headers、client/server/facilitator、EVM SDK 与安全语义。
- [Microsoft Foundry Agent Evaluators](https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-evaluators/agent-evaluators)：Task Completion、Tool Call、Groundedness 等评测。
- [Microsoft Foundry Agent Tracing](https://learn.microsoft.com/en-us/azure/foundry/observability/concepts/trace-agent-concept)：OpenTelemetry、tool spans、延迟与成本可观测。
- [AgentLevy](https://ethglobal.com/showcase/agentlevy-s577a)、[Alpha402](https://ethglobal.com/showcase/alpha402-04vgq)、[AgentSlam](https://ethglobal.com/showcase/agentslam-znyyq)、[RWA-GPT](https://ethglobal.com/showcase/rwagpt-fssdh)：用于提炼可验证交付、可视化状态机、可靠 fallback 和自然语言 RWA UX 模式。
