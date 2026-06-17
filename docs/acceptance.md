# TradeShield Agent 验收标准

本文定义项目准备阶段和 MVP 开发阶段的验收标准。所有新增功能必须能被至少一个 harness 命令验证。

当前主线：**AI 动态定价的 eBL-backed RWA 折价发行协议**（见 `docs/PRD.md` v0.2）。

> 状态说明：
> - **Current** = 当前 harness 已经能验证（旧 `RiskReport` 引擎仍在跑）。
> - **Target** = 新模型（`PricingQuote` / RWA 折价发行）的目标验收项，随 `tasks.md` 的 AI-1 / BE-2 / BE-3 等任务落地后转为 Current。
> 代码正在从 `RiskReport`（contract_action）迁移到 `PricingQuote`（pricing_action），两套验收在过渡期并存。

## 1. 准备阶段验收

| ID | 标准 | 验证命令 | 状态 |
|---|---|---|---|
| A1 | 仓库包含 README | `npm run check` | Current |
| A2 | 仓库包含快速入门背景文档 | `npm run check` | Current |
| A3 | 仓库包含 PRD（AI 动态定价 RWA） | `npm run check` | Current |
| A4 | 仓库包含任务拆分 | `npm run check` | Current |
| A5 | 仓库包含 demo seed 数据 | `npm run check` | Current |
| A6 | 仓库包含最小测试框架 | `npm run test` | Current |
| A7 | 仓库包含 smoke test | `npm run smoke` | Current |
| A8 | 空壳应用可以启动 | `npm run dev` | Current |
| A9 | 仓库包含多场景 scenario harness | `npm run scenarios` | Current |
| A10 | 仓库包含拟真上传单据（eBL + 商业发票） | 人工查看 `data/uploads/` | Current |
| A11 | 仓库包含 AI 估值 tool calling 示例 | `npm run agent:value` | Current |

## 2. 主流程验收（AI 定价折价发行）

| ID | 标准 | 验证命令 | 状态 |
|---|---|---|---|
| F1 | 可以读取电子提单 + 商业发票 demo 数据 | `npm run smoke` | Current |
| F2 | 可以生成结构化定价输出（过渡期为 `RiskReport`，目标为 `PricingQuote`） | `npm run test` | Current → Target |
| F3 | 定价输出包含 `evidence_hash` / `quote_hash` | `npm run test` | Current → Target |
| F4 | 定价输出包含 `pricing_action`（OPEN / REPRICE_DOWN / PAUSE / FREEZE / LIQUIDATION） | `npm run smoke` | Target |
| F5 | 修改到账速度（FAST / BALANCED / LOW_COST），`base_issue_price` 会变化 | `npm run scenarios` | Target |
| F6 | 修改风险事件（战争 / 天气 / 保险 / 价格），`risk_discount` 和 `final_issue_price` 会变化 | `npm run scenarios` | Target |
| F7 | offering 状态会随风险进入 `Repriced` / `Paused` / `Frozen` / `Liquidation` | `npm run smoke` / `npm run scenarios` | Target |
| F8 | collateral coverage guardrail：目标兑付敞口不超过安全覆盖 | `npm run test` | Target |
| F9 | CLI demo 可以展示完整状态机（Created → Priced → Open → ... → Redeemed） | `npm run demo` | Current → Target |
| F10 | Web 页面展示发行价、目标兑付价、隐含收益和风险来源 | 手动访问 `npm run dev` | Target |
| F11 | API 可以返回 scenario harness 摘要 | `npm run smoke` | Current |
| F12 | AI 估值工具能输出市场估值 + 历史同类成交价（带 deterministic fallback） | `npm run agent:value` | Current |

## 3. 定价不变量验收（Pricing Invariants）

这些是防止"AI 拍脑袋"和"虚高发行"的硬约束，必须有测试覆盖。

| ID | 不变量 | 验证 | 状态 |
|---|---|---|---|
| P1 | `token_supply = expected_cash_to_exporter / final_issue_price` | pricing unit test | Target |
| P2 | `target_redemption_exposure = token_supply × 1 USD` | pricing unit test | Target |
| P3 | `target_redemption_exposure ≤ ai_verified_collateral_value × redemption_coverage_limit` | pricing invariant test | Target |
| P4 | `0 < final_issue_price ≤ base_issue_price ≤ 1.0` | pricing invariant test | Target |
| P5 | `final_issue_price = base_issue_price − urgency_discount − risk_discount`（bps 一致） | pricing unit test | Target |
| P6 | 风险升高时 `final_issue_price` 单调不升 | scenario test | Target |

## 4. 文档验收

| ID | 标准 | 文件 |
|---|---|---|
| D1 | 非国际贸易专业成员能理解提单、贸易融资、eBL、RWA、折价发行 | `docs/background.md` |
| D2 | PRD 描述 AI 动态定价折价发行模型和 PricingQuote schema | `docs/PRD.md` |
| D3 | 明确写出不做什么 | `docs/PRD.md` §7 |
| D4 | 明确写出 48 小时开发计划 | `docs/PRD.md` §12 |
| D5 | 明确写出技术风险和备选方案 | `docs/PRD.md` §13 |
| D6 | README 包含团队协作方式 | `README.md` |
| D7 | 文档包含拿奖路线、AI/MCP/RAG/合约任务规划 | `docs/award-roadmap.md` |
| D8 | 文档说明 AI 估值 tool calling 需要哪些外部 API | `docs/ai-valuation-tooling.md` |

## 5. 黑客松演示验收

演示时必须让评委在 3 分钟内看懂：

1. 用户是谁（出口商 / 投资者）；
2. 痛点是什么（要快钱，但定价慢、不透明）；
3. 电子提单为什么能作为 RWA 抵押物；
4. AI Pricing & Risk Agent 做了什么（估值 + 把速度和风险折算成发行折价）；
5. AI 的折价如何改变链上状态（Open → Repriced / Paused）；
6. 为什么这是 AI Pricing Oracle，而不是聊天机器人；
7. 为什么 `1 RWA = 1 USD` 是目标兑付价、不是保本承诺。

## 6. 功能冻结标准

进入最后 6 小时时：

- 不再新增功能；
- 只修复会影响演示的 bug；
- `npm run check`、`npm run test`、`npm run smoke` 必须全部通过；
- `npm run scenarios` 必须通过，并覆盖 fast payout / balanced payout / high-risk reprice；
- `npm run agent:value` 必须能在无 API key 时用 deterministic fallback 跑通；
- 保留 CLI demo 作为 Web 页面失败时的兜底方案；
- 保留 mock provider 作为 DeepSeek / Qwen API 失败时的兜底方案。

## 7. 每个新增功能的验收模板

新增功能必须在 PR 中填写：

```text
Feature name:
Owner:
Task ID:
Changed files:
How to run:
Verification command:
Expected output:
影响哪个 scenario / 是否改变 issue price / 是否写入 RiskPricingOracle:
Fallback plan:
```

没有验证命令的功能不得合并到主分支。如果涉及 RWA 定价，必须说明 `issue price / target redemption / risk discount` 三者关系；如果涉及投资者收益，必须保留非保本文案。
