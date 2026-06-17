# 拟真上传单据（Simulated User Uploads）

这里是**模拟用户上传**的贸易单据，给 TradeShield 的 AI 审单 / 估值 / 定价主链路当输入。两组货物都从**新加坡**起运。

> ⚠️ 全部为**虚构数据**：公司、人名、船名、单号、银行、地址均为 demo 编造，不指向任何真实实体或真实货运。价格基于 2026 年 6 月公开行情**校准**到真实量级（见下文），但具体成交价为模拟。

## 两组数据

| | 铜阴极板 | 原油 |
|---|---|---|
| 目录 | `copper-sg-shanghai/` | `crude-sg-ulsan/` |
| 货物 | LME Grade A 铜阴极板 (HS 7403.11) | Murban 原油 (HS 2709.00) |
| 路线 | Singapore → Shanghai (Yangshan) | Singapore (Jurong Island) → Ulsan, 韩国 |
| 出口商 | Strait Resources Trading Pte. Ltd. (新加坡铜贸易商) | Equator Energy Trading Pte. Ltd. (新加坡油贸易商) |
| 进口商 | Donghai Copper Materials Co., Ltd. (上海) | Hanbit Refining Co., Ltd. (蔚山) |
| 数量 | 500 MT（20×20'GP，200 bundles） | 600,000 bbl（≈ 78,221 MT，Aframax） |
| 计价基准 | LME 现金结算价(QP) + CIF 上海溢价 | Platts Dated Brent(QP) + 品质升贴水 |
| 单位 | USD / MT | USD / bbl（按桶） |
| **成交价（发票总额）** | **USD 6,875,000** (13,750 USD/MT, CIF) | **USD 57,900,000** (96.50 USD/bbl, CIF) |
| 保险金额 (110% CIF) | USD 7,562,500 | USD 63,690,000 |
| Incoterms | CIF Shanghai | CIF Ulsan |
| 付款 | 不可撤销即期 L/C | 即期 L/C（90% 暂付 / 10% 结清） |
| 到账速度档 | FAST | BALANCED |
| 期望融资 (USDC) | 5,500,000 | 46,000,000 |

每组包含：
- `bill-of-lading.md` —— 拟真电子提单（eBL，To Order 可转让货权凭证）
- `commercial-invoice.md` —— 拟真商业发票（含大宗商品计价条款，给出成交价）
- 对应结构化案例：`../cases/copper-sg-shanghai.case.json`、`../cases/crude-sg-ulsan.case.json`

## 价格怎么来的（真实校准）

模拟世界设为 **2026 年 6 月**，恰逢**中东 / 霍尔木兹海峡冲突**，铜和原油都被战争溢价推高且高波动（数据按当月公开行情校准）：

- **LME 铜**：约 **13,700 USD/吨**（近历史高位）。驱动：霍尔木兹战争溢价、智利产量 23 年最低、美国铜进口加税预期。
- **Brent 原油**：约 **95 USD/桶**（同比 +43%）。驱动：美伊冲突、霍尔木兹封锁威胁、美国库存连降。

这给 demo 一个绝佳叙事：**同一个地缘事件同时抬高了两种抵押物的"账面价值"，但也放大了波动和下行风险**——正是 AI 动态定价要解决的：把高位价格按波动/战争溢价做 haircut，再折算成 RWA 发行价。详见各 case 的 `macro_risk_events`。

## 两组的差异点（为什么各放一组）

- **计价单位不同**：铜按吨、油按桶 → AI 估值工具要做单位换算（桶 ↔ 吨）。
- **基准不同**：铜挂 LME + 区域溢价、油挂 Dated Brent + 升贴水 → 行情源要按品类切换。
- **提单形态不同**：铜是集装箱提单（箱号/铅封/件数）、油是油轮提单（API 度/含硫量/桶数）。
- **HS 编码不同**：740311 vs 270900 → 查历史同类成交价（UN Comtrade）时用不同编码。

## 怎么用

- 任务三的 AI 估值 tool calling 默认对**铜**这组跑：`npm run agent:value`（见 `docs/ai-valuation-tooling.md`）。
- 这些 case JSON 字段对齐 `docs/PRD.md` 的新模型（`requested_cash_usd` / `payout_speed` / `target_redemption_value_usd` / `macro_risk_events`），**不**走旧的 `assertTradeCase` 校验（旧 harness 数据在 `data/demo-case.json` 与 `data/scenarios/`）。
