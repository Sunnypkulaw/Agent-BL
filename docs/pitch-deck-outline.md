# AgentBL 5 分钟投资人路演 PPT 大纲

> 版本：2026-07-23
>
> 用途：5 分钟现场路演 / 黑客松决赛 / 天使投资人快速判断。
>
> 核心原则：PPT 只讲一件事——**AgentBL 在投资者认购前，把电子提单背后的链下贸易风险，定价成可解释、可审计、可执行的 RWA 发行折价。**

---

## 0. 先给讲述者的结论

### 0.1 投资人应该记住的三句话

1. **痛点**：货物装船后，出口商的现金流要等 30–45 天；真实贸易有抵押物，却没有足够快、足够透明的风险定价。
2. **产品**：出口商质押 eBL，AgentBL 的 AI 承销代理读取单据、估值、运输和世界风险，在认购前输出发行价、融资上限和动作；Injective 合约负责执行。
3. **差异化**：普通 DeFi 让市场事后猜价格；AgentBL 让 AI 事前给风险定价，并把证据哈希、付款证明和状态转移固定在链上。

### 0.2 绝对不能混淆的两条交易闭环

```text
闭环 A：RWA 贸易融资
eBL / 发票 / 保险单 → AI 定价 → 投资者认购 RWA → 在途监控 → 结算 / 清算

闭环 B：x402 付费情报
请求报告 → HTTP 402 → EIP-3009 USDC 支付 → PaymentOracle 绑定报告哈希 → 解锁报告
```

- x402 的买方买的是**风险/估值/反欺诈报告**，不是 RWA；价格是微额 USDC。
- RWA 的买方承担的是**已经被定价的贸易风险**，认购金额是融资资本。
- 付费报告只能增加可验证的 provenance/evidence，**不能因为付费而改变风险分数或发行价**。

### 0.3 本版 PPT 的证据边界

- 已实现且可演示：确定性定价引擎、文档解析/一致性校验、风险情报与重定价、x402 402→签名→结算→解锁、MCP server、Injective 测试网合约和状态机。
- Demo 数据边界：部分行情、物流、世界风险是离线 fixture / mock fallback；LLM 可配置 Azure OpenAI，也支持 Tencent、DeepSeek、Qwen 和确定性 fallback。
- 生产化未完成：真实 ENI 生产接入、真实物流/保险数据、KYC/AML 和合格投资者门槛、司法辖区与追偿合作。
- 说法要求：用“测试网已验证”“可接入”“生产路线”分别表达，不能把 mock、adapter 或设计目标说成生产合作和真实资金。

---

## 1. 整体节奏

| 页 | 时间 | 目的 | 观众脑中留下的结论 |
|---|---:|---|---|
| 1 | 0:00–0:15 | 记住一句话 | AI 定价风险，链上执行 |
| 2 | 0:15–0:45 | 建立痛点 | 45 天现金流断层是可量化问题 |
| 3 | 0:45–1:10 | 让人看懂产品 | 一张 eBL 如何变成可融资的 RWA |
| 4 | 1:10–1:55 | 展示核心 AI | 风险不是文字报告，而是价格/额度/动作 |
| 5 | 1:55–2:45 | 打出高潮 | 同一笔资产会盈利也会亏损，折价就是尾部风险的价格 |
| 6 | 2:45–3:20 | 证明链上闭环 | AI 决策、支付和证据能被验证和执行 |
| 7 | 3:20–4:00 | 说明收入与增长 | 报告先变现，融资规模再放大收入 |
| 8 | 4:00–4:35 | 说明市场与壁垒 | 先做许可型机构试点，再扩成风险情报网络 |
| 9 | 4:35–4:55 | 给出里程碑和融资用途 | 投资人知道钱换来什么验证 |
| 10 | 4:55–5:00 | 收束和 CTA | 不是把文件上链，而是给风险定价 |

> 原则：现场只演示一条主线（Clean copper，Singapore → Shanghai），不要在 5 分钟内切换多个 cargo、Mystery Voyage 或复杂页面。

---

## 2. 逐页 PPT 规格

### Slide 1｜封面：AI 定价风险，链上执行

**时间：0:00–0:15｜15 秒**

#### 屏幕内容

```text
AgentBL
AI-priced eBL-backed trade finance

AI prices the risk. The chain enforces settlement.
AI 为风险定价，区块链强制执行结算。
```

右下角只放三个标签：`eBL-backed RWA` · `Injective` · `x402 paid intelligence`。

视觉：一条货船航线从 Singapore 指向 Shanghai；航线末端同时出现 `$0.80 issue price` 和 `1.00 target redemption`。不要使用“收益保证”或“稳赚”视觉。

#### 口播

> 国际贸易里，货物已经装船，出口商的现金却还要等一个多月。AgentBL 把电子提单作为抵押物，让 AI 在投资者认购之前给贸易风险定价，再由 Injective 上的合约执行整个生命周期。

#### 本页投资人结论

这是一个**承销与结算基础设施**，不是一个聊天机器人，也不是一个公开募资页面。

#### 操作/设计要求

- Logo、产品名和一句话主张占据第一视线。
- 不放团队介绍、不放技术栈墙、不放市场规模；第一 15 秒只建立定位。

---

### Slide 2｜问题：货在海上，现金流被锁住

**时间：0:15–0:45｜30 秒**

#### 屏幕内容

左侧用一条时间线：

```text
下单 → 装船 / eBL 签发 → 30–45 天运输与回款 → 到港 / 付款
                         ▲
                 现金流断层
```

右侧只放三组数字：

```text
2.5T USD     全球贸易融资缺口（ADB 口径，需在最终稿附来源）
30–45 天      典型在途回款等待
中小出口商   有真实货物，却常常无法获得快速融资
```

底部一句：`不是没有货，也不是没有钱，而是风险无法被快速、透明地定价。`

#### 口播

> 以一批新加坡出口到上海的铜为例，货物离港后，出口商要继续支付采购、人工和下一批订单，但货款要到港后才回来。银行的人工尽调慢、固定门槛高；投资者又看不懂提单、保险、航线和进口商风险。于是抵押物在海上，资本却无法流动。

#### 本页投资人结论

AgentBL 解决的是一个**现金流与信息不对称叠加的金融基础设施问题**，不是单纯的“把资产做成 Token”。

#### 证据/来源

- 背景和数字口径：[`docs/background.md`](./background.md)、[`README.md`](../README.md)。
- 最终 PPT 必须在数字旁写清来源和年份；不要在不同页混用 `$1.7T` 与 `$2.5T`。

---

### Slide 3｜产品：一张 eBL，四步变成可融资交易

**时间：0:45–1:10｜25 秒**

#### 屏幕内容

用四个横向步骤，控制每步不超过 6 个词：

```text
1  Upload & verify       eBL / invoice / insurance
          ↓
2  AI underwrite         value + consistency + world risk
          ↓
3  Price & open           issue price / cap / action
          ↓
4  Fund & monitor         subscribe → reprice → settle
```

右下角放一个交易卡片：

```text
Cargo: 500 MT copper cathode
Route: Singapore → Shanghai
AI-verified collateral: USD 6.53M（示例）
FAST issue price: USD 0.80 / target USD 1.00
```

#### 口播

> 出口商上传电子提单、商业发票和保险单。AgentBL 先解析字段并做跨单据一致性校验，再调用估值、风险和宏观情报模块，输出结构化 PricingQuote：抵押物价值、可融资上限、发行价、风险等级和下一步动作。投资者看到的是一笔有证据、有折价、有状态机的许可型贸易融资交易。

#### 本页投资人结论

产品价值在于把“复杂的链下贸易文件”转成“投资者可比较、合约可执行的报价”。

#### Demo 操作

- 打开 Dashboard 的 `提单上链 · 铸造 RWA` 视图。
- 选择 `Clean copper · Singapore → Shanghai`。
- 只展示上传、AI 估值和定价卡片，不在此页展示所有导航。

---

### Slide 4｜核心能力：AI 不是写报告，而是作出承销动作

**时间：1:10–1:55｜45 秒**

#### 屏幕内容

中心是“定价瀑布图”，从 `target redemption = 1.00` 向下减：

```text
1.00 target redemption
  − payout-speed / urgency discount
  − verified trade-risk discount
  − collateral / price guardrails
  = final issue price
```

旁边只放三种输入：

```text
Documents     quantity / value / insurance / duplicate pledge
Market        spot / comparable trades / volatility
World risk    war / port / weather / route / sanctions
```

最右侧放 AI 输出：

```text
price      supply      risk level      action
$0.800     4,125,000   MEDIUM          OPEN_OFFERING
```

底部用小字写：`Schema-validated · evidence hash · deterministic fallback`。

#### 口播

> 关键不在于 AI 能不能写一份漂亮报告，而在于它必须给出金融决策。它把出口商的到账速度偏好、可验证贸易利润、单据风险、商品波动和航线风险，计算成一个发行折价，并同时决定发行额度和动作：开盘、警告、改价、暂停或进入清算。模型输出经过 schema、边界和确定性规则校验；AI 不可用时，系统也不会凭空放行，而是使用可复现的 fallback。

#### 本页投资人结论

AgentBL 的 AI 直接作用于**融资价格、融资上限和资金池状态**，因此 AI 是承销层，而不是 UI 装饰。

#### Demo 操作

- 先展示 `FAST / BALANCED / LOW_COST` 三档报价。
- 现场只说 FAST 与 BALANCED 的差异，避免解释全部规则。
- 口播不要说“AI 秒级取代银行”，说“把一部分标准化承销工作自动化，并保留许可与人工治理边界”。

---

### Slide 5｜高潮：同一笔交易，正常时盈利，尾部时会亏损

**时间：1:55–2:45｜50 秒**

#### 屏幕内容

用三列损益卡片，标题必须大：

| 场景 | 投资者结果 | 解释 |
|---|---:|---|
| Repaid | `0.800 → 1.000`，`+25.0%` | 进口商付款，按目标兑付 |
| Mild default | `0.800 → 1.000`，仍可回收 | 货物完好，抵押物覆盖损失 |
| Tail default | `0.800 → 0.698`，`−12.8%` | 战争溢价反转、保险争议、强制出售 |

底部用红色边框强调：

```text
1.00 是目标，不是保本。
折价就是 AI 对尾部风险的预先定价。
```

#### 口播

> 这里是 AgentBL 最重要的产品逻辑。相同的 0.80 发行价，在正常结算时投资者赚 25%；在温和违约时，完好的货物仍可能覆盖本金；但在战争尾部情景下，保险因战争除外条款产生争议、铜价回撤、货物被迫出售，最终只能回收 0.698，投资者亏 12.8%。所以 1.00 是目标兑付，不是保证；AI 的工作是把这类尾部风险在认购前折算进价格，而不是事后写一段解释。

#### 本页投资人结论

这页回答两个最难的问题：

1. 为什么投资者愿意买？因为有清晰的抵押物、价格和风险缓冲。
2. 为什么必须要 AI？因为没有动态风险定价，折价会错配，安全交易被过度收费，危险交易又无法补偿损失。

#### Demo 操作

- 运行 `npm run demo:default`，镜头只停在三段 Investor P&L。
- 不要把“25%”说成年化收益；这是该示例的单笔 gross upside / target outcome。
- 说清“演示/模型结果”，不要暗示历史业绩或未来收益。

#### 合规屏幕文字

`Hackathon prototype · permissioned investors · no public fundraising · target redemption is not guaranteed`。

---

### Slide 6｜链上闭环：AI 决策、付款和证据都能验证

**时间：2:45–3:20｜35 秒**

#### 屏幕内容

用一张简化架构图，最多 4 层：

```text
Evidence layer       eBL hash · quote hash · paid report hash
        ↓
AI / x402 layer      Pricing Agent · HTTP 402 · EIP-3009 USDC
        ↓
Injective layer      RiskPricingOracle · RWAOfferingPool · RWAToken
        ↓
Lifecycle            Created → Priced → Open → Funded → InTransit
                              → Repriced / Paused → Settled
```

右侧放一个可点击的测试网证据条：

```text
Injective EVM testnet · Chain ID 1439
PaymentAttested → PricingUpdated → Offering state
```

#### 口播

> 在链上，eBL 的唯一性和质押关系、报价和证据哈希、投资者份额、在途改价、暂停和结算都被记录。x402 是独立的情报商业闭环：请求方先收到 402，再用 EIP-3009 签名 USDC，PaymentOracle 将支付交易和报告哈希绑定，验证后才解锁报告。支付不会买来更好的分数；它只买访问权和可验证 provenance。

#### 本页投资人结论

区块链的作用是**证明、执行和审计**，而不是把现实贸易风险魔法般消除。

#### 可展示证据

- `docs/evidence/x402-live-smoke.json`：0.001 USDC 测试网支付与 `PaymentAttested`。
- `docs/evidence/wave-b-gate.json`：`PaymentAttested → PricingUpdated → RWA offering` 追踪。
- `docs/evidence/injective-mcp-smoke.json`：官方 Injective MCP 工具调用和测试网交易。
- 合约测试：`npm --prefix hardhat test` 当前 `32 passing`。

#### 说法边界

- 说“测试网交易可验证”，不要说“主网已承载真实融资”。
- 说“5 个核心 RWA 合约 + PaymentOracle 组件”，不要在不同页面随意写成“只有 5 个合约”或混淆部署版本。

---

### Slide 7｜商业模式：先卖情报，再从融资规模中收费

**时间：3:20–4:00｜40 秒**

#### 屏幕内容

左侧是两条收入曲线：

```text
Now: Intelligence API
Risk / valuation / fraud report via x402
Price hypothesis: 0.001–0.002 USDC per machine-call

Scale: Financing protocol
Permissioned RWA issuance fee: 0.1–0.3%（当前模型假设）
Enterprise API / monitoring: contract-based pricing
```

右侧是买方地图：

```text
Exporters    faster liquidity
Banks        faster due diligence
Insurers     route / cargo risk
Investors    priced, auditable opportunities
AI agents    machine-callable evidence
```

底部一句：`One risk report can be sold many times; every financed shipment creates a higher-value protocol event.`

#### 口播

> 我们不把商业模式押在一次 RWA 发行上。第一层是 x402 付费情报：银行、保险公司、投资者和其他 Agent 按次购买风险、估值和反欺诈报告，机器无需注册账号即可调用。第二层是融资协议费，按许可型资金池的发行规模收费。第三层是机构 API 和持续风险监控。这样报告收入可以先验证需求，融资规模扩大后再放大协议收入。

#### 本页投资人结论

产品有一个较轻的“数据/情报切入点”，再向高客单价的机构承销和融资基础设施扩展，降低直接启动 RWA 资金池的商业阻力。

#### 重要口径

- `$0.001–$0.002` 是当前 x402 测试服务的机器调用价格，不是最终企业报价。
- `0.1–0.3%` 是当前文档中的模型假设，不是已签署的费率。
- 不要承诺 `90–97% gross margin`，除非已经把真实 LLM、数据、合规、链上和销售成本纳入测算。

---

### Slide 8｜市场与壁垒：从许可型试点开始，形成风险情报网络

**时间：4:00–4:35｜35 秒**

#### 屏幕内容

上半部：市场楔子

```text
Beachhead
Singapore / Hong Kong / ADGM style corridors
High-value commodity trade · eBL-ready · institution-led
```

下半部：四层壁垒，不放技术名词堆：

```text
1  Data moat       document + route + outcome history
2  Decision moat   pricing rules + evaluated agent + evidence graph
3  Execution moat  Injective state machine + payment/report binding
4  Distribution    banks / insurers / logistics / other agents via MCP & x402
```

右侧画一条 3 阶段路线：

```text
Pilot → Permissioned network → Cross-corridor intelligence standard
```

#### 口播

> 我们不会从面对公众的开放式 Token 募资开始，而是从合规司法辖区里的许可型机构试点切入：先服务一个高价值、文件结构清晰、eBL 渗透率高的贸易走廊。每一次单据核验、风险决策、运输结果和结算结果，都会沉淀成下一次更好的风险情报。长期价值不是某一个资金池，而是成为机构和 AI Agent 都能调用的贸易风险定价层。

#### 本页投资人结论

真正的护城河是“**数据结果闭环 + 可审计决策 + 机构分发**”，不是单独的 Token 合约或某个 LLM。

#### 不要讲的内容

- 不要说“取代所有银行”或“绕开监管”。
- 不要把 ENI、丽讯、TradeLens、Maersk 等写成已签署生产合作，除非现场能出示合同/LOI/API 证据。
- 不要把“全球首个”作为未经验证的事实；用“我们把……做成可机器调用的产品”即可。

---

### Slide 9｜路线图与融资诉求：投资人买的是下一组验证

**时间：4:35–4:55｜20 秒**

#### 屏幕内容

左侧路线图：

```text
现在（Hackathon）
✅ 定价引擎 + eBL demo + x402 + MCP
✅ Injective testnet lifecycle & evidence

未来 3 个月
□ 真实 ENI / eBL 试点适配
□ 物流、保险、商品数据接入
□ KYC/AML + 合格投资者 gate

未来 6–12 个月
□ 2–3 个机构联合承销 pilot
□ 受监管的 permissioned pools
□ 结果数据回流，形成风险评分网络
```

右侧是融资卡片，现场替换方括号：

```text
Raising: [US$___] pre-seed / strategic round
Runway: [__] months
Use of funds:
40% data + compliance + eBL pilot
35% product + agent reliability
25% institutional distribution
Milestones:
[__] pilot shipments · [__] paying data buyers · [__] signed partners
```

#### 口播

> 这轮资金不是用来把一个 Demo 包装成公开理财产品，而是用来完成三个可验收的里程碑：真实 eBL 和数据源试点、机构合规与许可型资金池、以及能证明风险预测价值的结算结果数据。融资金额、跑道和里程碑数量请根据团队成本和已谈合作填写，不要在现场临时编数字。

#### 本页投资人结论

这是一笔“用资本换取监管、数据和机构分发验证”的早期投资，而不是为流动性挖矿买单。

---

### Slide 10｜结尾：风险先被定价，资金才值得被执行

**时间：4:55–5:00｜5 秒**

#### 屏幕内容

```text
普通 DeFi：市场事后猜价格
AgentBL：AI 在认购前给风险定价，Injective 链上执行

AgentBL
AI prices the risk. The chain enforces settlement.
```

下方放 QR：Demo / GitHub / Testnet evidence（只放一个主链接，避免观众扫码选择困难）。

#### 口播

> AgentBL 不是把贸易文件变成炒作 Token，而是让 AI 在投资者下单前，把真实贸易风险定成一个透明、可解释、可上链的 RWA 折价。谢谢。

---

## 3. 现场 Demo 编排（与 PPT 一一对应）

### 3.1 只准备一个主场景

```text
Case: CASE-EBL-2026-CU-SG-SHA
Cargo: Copper Cathode, 500 MT
Route: Singapore → Shanghai (Yangshan)
```

主场景演示顺序：

1. 进入 Mint / Valuation：展示 eBL、发票、保险单和估值。
2. 展示 Pricing Console：FAST `0.80`、BALANCED 约 `0.848`、LOW_COST 约 `0.889`。
3. 运行三种结局：`npm run demo:default`，停在 `+25% / break-even-like recovery / -12.8%`。
4. 进入 Voyage / in-transit event：模拟战争风险，展示 risk score、reprice / pause 和 evidence hash。
5. 进入 Intel Market：展示 402 challenge；如有可靠钱包和网络，再完成 live x402 支付；否则用明确标注的 Demo Mode。
6. 展示 Injective explorer 的一条已准备好的测试网交易，不在现场临时搜索多个地址。

### 3.2 现场口播数字卡

| 口播数字 | 含义 | 证据/来源 | 口径 |
|---:|---|---|---|
| `500 MT` | 示例货物数量 | `data/cases/copper-sg-shanghai.case.json` | Demo fixture |
| `USD 6.531M` | 定价引擎示例 AI-verified collateral | `npm run price` 输出 | 示例，不是审计估值 |
| `0.800` | FAST issue price | `npm run price` / `npm run demo:default` | 示例报价 |
| `0.848` | BALANCED indicative issue price | `npm run price` | 示例报价 |
| `1.000` | target redemption | `src/core/pricingEngine.js` / scenarios | 目标，不保证 |
| `+25.0%` | 正常结算单笔 gross upside | `npm run demo:default` | 不是年化、不是承诺 |
| `0.698 / -12.8%` | 尾部清算回收 / 损益 | `npm run demo:default` | 压力情景示例 |
| `0.001 USDC` | live x402 smoke payment | `docs/evidence/x402-live-smoke.json` | 测试网、自付测试 |
| `1439` | Injective EVM testnet chain ID | `public/chain-config.json` | 测试网 |

### 3.3 兜底方案

```text
网络 / 钱包不可用 → 直接播放本地录屏或运行 npm run demo:default
LLM 不可用        → 解释 deterministic fallback，不伪造“实时 AI”
Live x402 不可用  → 展示 HTTP 402 + 测试证据 JSON，明确 Demo / Live
页面卡顿          → 切换到预先截取的三张图：quote / tail loss / explorer
```

现场不要因为网络故障临时声称交易成功；Demo receipt 不能写成 explorer tx。

---

## 4. 投资人问答：15 秒回答模板

### Q1：这是不是保本产品？

> 不是。`1.00` 是目标兑付，不是保证；投资者会承担进口商、货物、保险和处置风险。我们的核心价值正是让 AI 在认购前把这些风险折进发行折价，并把证据和动作记录在链上。MVP 面向许可型资金池，不做公众募资。

### Q2：为什么不直接用商品价格预言机？

> 价格预言机只能告诉你铜价是多少，不能告诉你提单是否重复质押、保险是否覆盖、路线是否被战争影响、进口商是否会付款。AgentBL 将文件、市场、运输和世界风险合并成 issue price、融资上限和 pause/reprice 动作。

### Q3：AI 判断错了谁负责？

> 生产架构不是把责任交给一个黑盒模型。输出要经过 schema、数值边界、抵押物上限、合规 gate、来源新鲜度和幂等执行约束；高风险动作可要求人工/机构审批。测试网 Demo 展示的是自动执行能力，不代表已完成真实金融责任和司法追偿。

### Q4：x402 和 RWA 是不是同一笔钱？

> 不是。x402 是几厘美分级别的报告访问费；RWA 是投资者对已经定价的贸易融资份额的认购资本。前者验证 AI 情报的机器商业化，后者验证贸易融资的资金闭环。

### Q5：你们现在有真实客户和真实货物吗？

> 当前仓库是黑客松可复现原型，使用脱敏/合成案例和测试网资金；已完成协议和支付链路的技术验证。真实生产需要 eBL 平台、物流、保险、KYC/AML、托管和持牌机构共同试点，这正是下一阶段融资要完成的验证。

### Q6：为什么是 Injective？

> 我们需要同一条 EVM 兼容网络承载 RWA 状态机、USDC/x402 支付证明、风险 Oracle 和 Agent 可调用接口；Injective 测试网、EVM、官方 x402 路径和 MCP 生态让这条闭环可以被实际验证。不是为了把一个普通网页换成另一条链。

### Q7：你们的市场数字为什么有两个版本？

> 公开报告的统计口径不同，当前产品统一采用 ADB 约 `$2.5T` 的融资缺口作为问题规模；最终路演只保留一个数字，并在页脚标来源和年份。`$1.7T` 只在有对应原始出处和年份时再使用。

---

## 5. 事实校验与演示前清单

### 5.1 当前可引用的实现证据

| 能力 | 当前证据 |
|---|---|
| AI 定价与三档到账速度 | `src/core/pricingEngine.js`、`scripts/price.mjs` |
| 文档解析与跨单据一致性 | `src/agent/documentParser.js`、`src/agent/documentConsistency.js`、`tests/document*.test.js` |
| 世界风险与在途重定价 | `src/agent/worldRiskAgent.js`、`src/core/worldRiskPricing.js`、`public/voyage.js` |
| eBL 上传与 hash / adapter | `src/app/eniAdapter.js`、`POST /api/ebl/upload` |
| x402 402→settle→unlock | `src/x402/server.js`、`src/x402/client.js`、`src/x402/settlement.js` |
| 付费报告 hash / PaymentOracle | `src/x402/paidReport.js`、`src/x402/reportEvidence.js`、`hardhat/contracts/PaymentOracle.sol` |
| MCP | `src/mcp/mcpServer.js`、`src/mcp/standalone-server.js`、`docs/evidence/injective-mcp-smoke.json` |
| RWA lifecycle | `hardhat/contracts/RWAOfferingPool.sol`、`hardhat/contracts/RiskPricingOracle.sol`、`hardhat/contracts/EBLRegistry.sol`、`hardhat/contracts/RWAToken.sol` |
| Agent 活动与决策日志 | `src/agent/autonomousAgent.js`、`src/agent/orchestrator.js`、`src/agent/decisionLogger.js`、`/api/agent/activity` |
| 评估/安全 | `src/agent/evaluation/`、`src/agent/security/`、`src/agent/tracing/` |

### 5.2 路演前必须完成的 P0

1. **修复 x402 premium-valuation 超时**：最近一次 `npm test` 为 `372 tests / 371 pass / 1 fail`，失败在 `tests/x402Endpoints.test.js` 的 30 秒 timeout。不要在 PPT 写“全量测试全绿”，直到连续复测通过。
2. **固定演示模式**：当前本地 `.env` 是 Live 配置；正式演示要显式选择 Demo 或 Live，并在页面显示状态。Demo 不得伪造交易哈希。
3. **核对部署证据版本**：`README.md`、`public/chain-config.json` 与 `docs/evidence/` 中存在不同时间的合约地址/部署记录；最终 PPT 只放一组由最新 smoke 验证的地址和 tx。
4. **统一市场数字**：全套 PPT 只用一个融资缺口口径；建议使用 `$2.5T`，并附 ADB 来源和年份。
5. **统一 AI provider 说法**：代码支持 Azure OpenAI，但当前本地运行可能选择 Tencent/DeepSeek/Qwen；只有在 Azure 环境真实运行并能出示 trace 时，才把“本次 Demo 使用 Azure”写成事实。否则说“Azure-compatible provider 已集成”。
6. **移除未经证实的合作措辞**：ENI、丽讯、物流和保险合作写成“adapter / 场景 / pilot target”，除非有可展示的 API、LOI 或合同。
7. **确认团队页信息**：仓库材料没有稳定、可供投资人核验的团队履历。本版故意不编造；请补充姓名、分工、行业/技术凭证和可公开联系方式。
8. **补充融资诉求**：确定金额、工具（SAFE/股权/战略合作）、runway、资金用途和 3 个可量化里程碑；不要用“欢迎投资”收尾。
9. **准备合规脚注**：`permissioned / KYC-AML / accredited investors / not a guarantee / hackathon prototype` 至少在 Slide 5、9 出现。
10. **连续跑一遍演练**：产品页 → 三种结局 → 在途风险 → 证据页，全程不超过 4 分钟，留 1 分钟给投资故事和 Q&A。

### 5.3 推荐验收命令

```bash
npm run check
npm run smoke
npm --prefix hardhat test
npm test
npm run preflight
```

记录日期、模式（Demo/Live）、通过数和失败数；最终 PPT 的“Traction / Evidence”页只引用这次记录。

---

## 6. 设计和口播规范

### 6.1 视觉规则

- 主色使用深墨色 + Injective 蓝/紫 + 风险红；正常、警告、清算三种状态必须一眼区分。
- 每页只保留一个主数字，不要把 9 个工具、5 个合约、20 个指标同时做成图标墙。
- 所有金额都写单位，所有收益都写“示例/目标/压力情景”标签。
- 图表上直接标注 `not guaranteed`，不要靠口头补救。
- explorer 链接只展示一条主证据，其余放 QR 落地页或附录。

### 6.2 口播规则

- 开头直接讲“货在海上，现金流被锁”，不要从团队和技术栈开始。
- 先讲一个真实动作，再讲名词：先说“保险金额不足导致暂停”，再说 RiskPricingOracle。
- 每次出现“AI”都跟一个动词：解析、核验、估值、定价、改价、暂停、结算。
- 不说“无风险”“保本”“稳赚”“取代监管”“全球首个”这类高风险或不可证明表述。
- 结尾重复同一句主张，避免新增功能点。

### 6.3 评委/投资人应看到的证据顺序

```text
可理解的问题
→ 可操作的产品
→ 可解释的价格
→ 可失败的压力情景
→ 可验证的链上证据
→ 可执行的商业化路线
```

---

## 7. 一页式讲稿（现场忘词时照读）

> AgentBL 解决的是贸易融资里的现金流断层：货物装船后，出口商要等 30–45 天才能回款。我们让出口商质押电子提单，AI 读取提单、发票、保险、商品价格、运输和世界风险，在投资者认购前输出抵押物价值、融资上限、发行折价和链上动作。以 500 吨新加坡—上海铜为例，FAST 报价是 0.80，目标兑付 1.00；正常结算时投资者可能赚 25%，但战争尾部清算时也可能只回收 0.698、亏 12.8%。这正说明 1.00 不是保证，折价是 AI 对尾部风险的定价。Injective 上的 RWA 合约记录 eBL 质押、报价、改价、暂停和结算；x402 则让银行、保险公司和其他 Agent 用微额 USDC 购买风险报告，PaymentOracle 把报告哈希和支付绑定。我们先以许可型机构试点为切入点，收入来自情报 API、协议费和机构监控。AgentBL 不是把贸易文件变成炒作 Token，而是让风险先被定价，资金才值得被执行。

