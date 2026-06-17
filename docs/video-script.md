# 🎬 TradeShield · 项目视频脚本（AI Agent × Blockchain · 安全 / Risk Agent）

> **用途**：黑客松提交视频的口播脚本，主线是 **「我们的想法 + AI 亮点」**，并刻意对齐
> 主赛道 **AI Agent × Blockchain** 与特别单项奖 **安全 / Risk Agent（Security / Risk Agent）**。
> **与 [`demo-script.md`](./demo-script.md) 的区别**：`demo-script.md` 是「投资者会不会亏」的
> 金融论证型 Demo 讲稿；**本文是面向评委的产品 pitch 视频**，把 AI 当成一个承担安全风控职责的
> Agent 来讲。两份可以二选一，也可以拼用（用本文做 pitch、用 demo-script 的「三种结算」做高潮）。
> **配套**：`npm run dev`（网页）、`npm run agent:value`（AI 工具调用轨迹）、`npm run demo:default`
> （三种结算）、`npm run qa`（评委问答）。**所有数字均为定价引擎实测值，可照念。**

---

## 🎯 一句话定位（整支视频的「赢点」）

> **大多数 Web3 项目里的「AI Agent」只是套了个聊天框；TradeShield 的 AI 是一个真正干脏活、
> 担责任的「安全与风控 Agent」——它在投资者下单【之前】，替他们识别贸易欺诈、给真实世界风险
> 定价，并把每一个决策写上链、由智能合约强制执行。AI 定价，链上执行。**

英文 pitch（片头/片尾字幕）：

> **TradeShield's AI isn't a chatbot — it's a Security & Risk Agent that prices real-world
> trade risk into an on-chain decision before investors are ever exposed.**
> *The AI prices the risk. The chain enforces it.*

---

## ⏱️ 30 秒电梯版（开场或单独投稿用）

> 国际贸易里，货一装船，钱要等一个多月才回来。出口商把代表货权的**电子提单**质押上链、发行
> 以货值为支撑的 RWA，资本方折价认购、目标兑付 1 美元。但链下的世界全是欺诈和风险——
> **谁在投资者下单前替他们看住这些？** TradeShield 的答案是一个 **AI 安全与风控 Agent**：
> 它审单反欺诈、调用工具估值、给战争和保险风险定价，把「该不该开盘、发行价多少」写进链上合约。
> 普通 DeFi 让市场猜价格；**我们让 AI 在认购前就把风险定成一个可解释、可上链的折价。**

🇬🇧 *Goods ship, cash is locked for 45 days. We turn an electronic bill of lading into an
RWA, and let an AI Security & Risk Agent detect fraud and price real-world risk into the
on-chain issue price — before investors buy. The AI prices the risk; the chain enforces it.*

---

## ⏱️ 90 秒精简版（想法 → 安全亮点 → 战争 → 收束）

**【0:00–0:20 想法】**
> 这是 TradeShield。痛点很简单：货已装船、钱还要 45 天才回。出口商质押电子提单、发行 RWA 融资，
> 投资者折价认购。但真正难的是——链下的欺诈和风险，谁来把关？我们的答案是一个 **AI 风控 Agent**。

**【0:20–0:50 安全亮点：反欺诈审单】**
> 在给 RWA 定任何价之前，Agent 先做**反欺诈审单**：把同一批货的电子提单、商业发票、保险单三份
> 文件交叉核验——数量对不对得上、发票单价有没有偏离市场（高开/低开发票）、保险够不够覆盖货值、
> 保单会不会在到港前就过期。每一个疑点都折算成风险基点，直接压低发行价。这是价格预言机永远做不到的。

**【0:50–1:15 战争：看穿欺骗性信号】**
> 最硬核的一手：战争爆发时铜价**上涨**，只看价格的预言机会以为「抵押更值钱、更安全」——完全看反。
> 我们的 Agent 知道这是脆弱的战争溢价，违约↑、保险因战争除外失效↓、回收↓，于是反向操作：货值
> haircut 21%、风险打到 1410 个基点、直接**暂停发行**，把投资者拦在爆雷之外。

**【1:15–1:30 上链 + 收束】**
> 每个决策连同**证据哈希**写进链上 RiskPricingOracle，可审计、防篡改。
> **普通 DeFi 让市场猜价格；TradeShield 让 AI 在投资者下单前，把贸易风险定成可上链的折价。**
> AI 定价，链上执行。

---

## 🎥 完整版（约 3 分 40 秒）

> 录制语言建议：**中文口播 + 英文字幕**（关键句给了 🇬🇧 英文，可直接做字幕或录英文版）。
> 镜头在 **网页两个界面** + 必要时 **终端** 之间切，所有数字照念即可。

### 片头字幕（3 秒）
```
TradeShield · AI 动态定价的 eBL-backed RWA 贸易融资协议
The AI prices the risk. The chain enforces it.
ETH Beijing 2026 · 主赛道 AI Agent × Blockchain · 单项奖 Security / Risk Agent
```

### [0:00–0:30] 开场：我们的想法 & 那个该被问的问题
**【画面】** 网页首页 / Logo（界面①顶部）
**【口播】**
> 大家好，这是 TradeShield。先看痛点：国际贸易里，货物一装船，出口商的钱要 30 到 45 天才回得来；
> 而全球贸易融资缺口高达 **2.5 万亿美元**。我们让出口商把代表在途货权的**电子提单**质押上链，
> 发行以这批货价值为支撑的 **RWA**，投资者折价认购、目标兑付 1 美元。
> 但真正的难题不是发个币——是**链下的世界全是欺诈和风险**：单据可能造假、保险可能不足额、
> 战争可能让一切归零。**谁在投资者下单之前，替他们把这些风险看准、定价？**
> 这就是 TradeShield 的全部答案：一个 **AI 安全与风控 Agent**。

🇬🇧 *The hard part isn't tokenizing a bill of lading — it's that the off-chain world is full of
fraud and risk. Who prices that for the investor, before they buy? That's our AI Risk Agent.*

### [0:30–1:00] 定位：这才是「AI Agent × Blockchain」该有的样子
**【画面】** README 架构图 / 简笔架构：`AI 引擎 → API → 智能合约`
**【口播】**
> TradeShield 是一个 **AI 动态定价的 RWA 贸易融资协议**。请记住一点：我们的 AI **不是聊天机器人**，
> 而是一个承担真实金融职责的 Agent——它**审单、估值、给风险定价、决定能融多少、该不该开盘**，
> 然后把每一个决策写上链，由智能合约强制执行。
> 这正是「AI Agent × Blockchain」最该有的分工：**AI 负责判断，区块链负责执行和存证。**
> 接下来用三个 AI 亮点，告诉你这个 Agent 到底厉害在哪。

🇬🇧 *The AI doesn't chat — it underwrites. It values cargo, prices risk, sets the financing cap
and the on-chain action. AI makes the call; the chain enforces and records it.*

### [1:00–1:45] ⭐ AI 亮点 ①｜安全：反欺诈审单（冲击单项奖的核心）
**【画面】** 界面① 顶部选 **「Copper · Shanghai → Hamburg (insurance gap)」** → 看「AI 货值估算 & 航线风险」卡，单据/保险项飘红 + 数据来源标签
**【口播】**
> 第一个亮点，也是我们冲击「安全 / Risk Agent」单项奖的核心：**在给 RWA 定任何价之前，
> Agent 先做反欺诈审单。** 贸易金融欺诈最常见的形态，就是同一批货的三份文件对不上——
> 电子提单、商业发票、保险单。我们的 Agent 像审单员一样逐项交叉核验：
> **数量是否一致**（对不上 +250bps）、**发票单价是否偏离市场价**——识别高开或低开发票（+150bps）、
> **保险是否覆盖货值**（不足额 +220bps）、**保单是否在到港前就过期**、**Incoterms 是否一致**……
> 每一个疑点都折算成具体的**风险基点**，直接压进发行价。
> 你看这个案例，AI 当场抓到：**保险金额低于货值、保单几乎卡在到港当天过期**——
> 这些都是只看 token 价格的预言机永远看不见的链下风险。**风控，从审单开始。**

🇬🇧 *Trade-finance fraud shows up as mismatches between the eBL, the invoice and the insurance
policy. The Agent cross-checks them — quantity, mis-invoicing vs market, under-insurance,
a policy expiring before arrival — and folds each into the price in basis points.*

> 💡 **导演提示**：这一段是单项奖的「题眼」，放慢、咬住「反欺诈 / fraud detection」这个词。
> 想更硬核可切终端补一刀：审单逻辑在 `src/agent/documentConsistency.js`，7 项交叉核验、最高 600bps 罚分。

### [1:45–2:25] ⭐ AI 亮点 ②｜有据可查：工具调用估值 + RAG 风险情报
**【画面】** 界面① 「AI 货值估算」卡 + 每项**数据来源**标签 + 「AI 定价台」瀑布图；可选切终端跑 `npm run agent:value` 展示 `tool_trace`
**【口播】**
> 第二个亮点：**Agent 的每个数字都有据可查，不是凭空生成的。** 估值时它像真人分析师一样**调用工具**——
> 拉**实时 LME 铜价**、查**目的港区域升水**、调 **UN Comtrade 历史同类成交价**做交叉验证，
> 最后在战争溢价的高位**主动打一个保守的波动性 haircut**，绝不在高点虚高估值。
> 与此同时，一个 **RAG 检索器**从风险情报库里拉出最相关的宏观事件，**每条都带信息来源**。
> 所有这些拼成一张**「证据图」**：发行价为什么从 1 美元一步步折到 0.85、0.80——
> 每一档折价背后挂的是哪条证据、哪个来源，清清楚楚。
> **可解释、可审计**——这就是一个负责任的 Agent 和一个黑箱模型的根本区别。

🇬🇧 *Every number is grounded. The Agent calls tools — live LME price, regional premium,
UN Comtrade historical comparables — applies a conservative war-premium haircut, and a RAG
retriever cites macro-risk intel with sources. The result is an auditable evidence graph.*

### [2:25–3:05] ⭐ AI 亮点 ③｜风控直觉：看穿「战争溢价」这个欺骗性信号
**【画面】** 界面② 航运追踪 → 点 **「⚔ 霍尔木兹冲突升级」**（价格当场下跌、风险飙红、AI 暂停）；或顶部切 **「Hormuz war crisis」** 案例对照（开盘即 CRITICAL / PAUSE）
**【口播】**
> 第三个亮点，是这个 Agent 最像「风控专家」的一手。**战争爆发时，铜价其实在涨。**
> 一个只看价格的预言机会得出致命的错误结论：抵押物更值钱了，这笔贷款更安全——**完全看反。**
> 而我们的 Agent 知道：这是一把**「相关性双刃剑」**——战争溢价同时意味着进口商违约概率上升、
> 保险因为「战争除外」条款失效、清算回收率下降，**所有保护一起塌掉。**
> 所以 Agent 反向操作：把核验货值 **haircut 掉 21%**、风险分打到 **1410 个基点**、
> 然后直接 **PAUSE 暂停发行**——把投资者拦在这趟注定爆雷的车之外。
> **这就是一个「风险 Agent」和一个「价格喂价」的本质区别。**

🇬🇧 *War spikes the copper price. A price oracle thinks the collateral is now safer — exactly
backwards. The Agent knows war premium is a correlated double-edge: default up, insurance void,
recovery down. So it does the opposite — haircut 21%, risk 1410bps, and PAUSE.*

> 💡 **可选加强（金融硬度）**：切终端 `npm run demo:default`，让同一笔铜跑三种结算——
> 还款 **0.80→1.00 赚 25%**、战争尾部违约只回收 **0.698 亏 12.8%**、轻度违约被超额抵押兜回本金。
> 一句话钉死：**1 美元是目标、不是保本；那 0.20 的折价，正是 AI 为违约尾部预收的保费。**

### [3:05–3:30] 安全闭环：上链存证 + 为什么必须「事前」定准
**【画面】** 界面① 点「⛓ 铸造 RWA 上链」（MetaMask 签名 / Sepolia 真实交易）→ 结果卡显示 `tx_hash` / `quote_hash` / `evidence_hash`；或合约时间线 `Funded → InTransit`
**【口播】**
> 最后，安全闭环落在链上。Agent 的**每一次定价决策，连同它依据的证据哈希**，都写进链上的
> **RiskPricingOracle**——可审计、防篡改、谁都改不了。
> 为什么必须在认购**之前**就定准？因为钱在 **Funded** 那一刻就打给出口商了，货还在海上漂着；
> 之后风险再升级、再怎么改价，**都保护不了已经建仓的老钱**——那笔折价，是投资者唯一的、
> **预先付清的**风险补偿。
> 还有一道安全护栏：**我们让 LLM 只负责写解释，最终价格由确定性引擎和 schema 校验**——
> 就算模型抽风，也乱定不了价。**148 个测试**守着这条不变量。

🇬🇧 *Every decision, with its evidence hash, is written to an on-chain RiskPricingOracle —
auditable and tamper-proof. And the LLM never sets the final price alone: a deterministic
policy and schema guardrail validate it. 148 tests guard that invariant.*

### [3:30–3:50] 收束
**【画面】** tagline 字幕全屏
**【口播】**
> 一句话总结：**普通 DeFi 让市场去猜价格、让清算去善后；TradeShield 让一个 AI 安全与风控 Agent，
> 在投资者下单之前，就把贸易欺诈和真实世界风险，定成一个可解释、可上链的 RWA 折价。**
> **AI 定价，链上执行。** 这就是 TradeShield。谢谢。

🇬🇧 *Ordinary DeFi lets the market guess the price and lets liquidation clean up the mess.
TradeShield lets an AI Security & Risk Agent price fraud and real-world risk into an explainable,
on-chain discount — before investors buy. The AI prices the risk. The chain enforces it.*

---

## 🏆 为什么这支视频能命中「Security / Risk Agent」单项奖

> 录制前，让全队对齐这 5 个「安全」证据点——评委要的就是这些，每一点视频里都有画面支撑：

| # | 安全 / 风控能力 | 视频段落 | 代码锚点 |
|---|---|---|---|
| 1 | **反欺诈审单**：eBL / 发票 / 保险三单交叉核验，识别高低开发票、不足额保险、保单过期 | 亮点 ① [1:00] | `src/agent/documentConsistency.js`（7 项核验，最高 600bps） |
| 2 | **风险定价**：把链下风险打成 bps，直接决定发行价、融资额度、开/暂停 | 亮点 ①②③ | `src/core/pricingEngine.js`（`scoreRisk` / `priceRwaOffering`） |
| 3 | **看穿欺骗性信号**：战争溢价的「相关性双刃」，反向 haircut + PAUSE | 亮点 ③ [2:25] | warcrisis 案例 → 1410bps / PAUSE |
| 4 | **链上存证防篡改**：每个决策带 `evidence_hash` / `quote_hash` 写入 RiskPricingOracle | 上链 [3:05] | `RiskPricingOracle.sol` · `oracle.js` |
| 5 | **AI 安全护栏**：LLM 只解释、不定价；确定性引擎 + schema 校验 + 离线兜底 | 上链 [3:05] | `pricingSchema.js` · `valuationAgent.js`（fallback） |

**一句话给评委**：*Our agent's job is to protect the investor — it detects trade-finance fraud,
prices correlated tail risk, and pauses the deal when the math says stop, with every decision
anchored on-chain.*

---

## 🗣️ 录制提示

- **数字念准**（全是引擎实测值）：审单罚分 `+250 / +220 / +150 / +120bps`；战争危机 `1410bps` /
  货值 `−21%` / `PAUSE`；三种结算 `+25%` / 回收 `0.698` 即 `−12.8%`；三档发行价 `0.80 / 0.85 / 0.89`；
  测试 `148 passing`。
- **节奏**：亮点 ①（反欺诈）和亮点 ③（战争）是命中单项奖的两个高潮，**放慢、咬重音**；亮点 ② 可略快。
- **关键词反复出现**：让「**反欺诈 / fraud detection**」「**风控 Agent / Risk Agent**」「**可解释、可上链**」
  在口播里至少各出现两次——评委是按单项奖关键词在听的。
- **英文版**：每段都给了 🇬🇧 句子，可整段录英文，或中文口播 + 英文字幕（推荐，受众更广）。
- **兜底**：网页若出问题，全程可用终端讲完——
  `npm run agent:value`（工具调用轨迹）、`npm run price`（一份定价）、`npm run demo:default`（三种结算）、
  `npm run qa`（评委问答），逻辑不缺一环。
- **真实上链加分**：若已部署 Sepolia（顶栏显示 `● 合约已部署`），亮点上链段落务必现场点 MetaMask 签名，
  展示真实 `tx_hash` + Etherscan，比模拟交易更有说服力。

---

## 🎬 画面 / 命令对照表

| 视频段落 | 网页画面 | 终端兜底命令 |
|---|---|---|
| 开场 / 定位 | 界面① 首页 + 架构图 | — |
| 亮点① 反欺诈审单 | 界面① 选 `Copper · Shanghai → Hamburg (insurance gap)`，看风险维度 + 数据来源 | `npm run price`（看 risk_factors / doc penalty） |
| 亮点② 工具估值 + RAG | 界面① 货值估算卡 + 数据来源 + 定价瀑布图 | `npm run agent:value`（tool_trace + 来源） |
| 亮点③ 战争 → 暂停 | 界面② 点「⚔ 霍尔木兹冲突升级」/ 切 `Hormuz war crisis` 案例 | `npm run demo:default`（三种结算损益） |
| 上链 + 护栏 | 界面① 「⛓ 铸造 RWA 上链」→ tx/quote/evidence hash | `npm run scenarios`（fast/balanced/reprice/pause） |
| 收束 | tagline 字幕全屏 | — |

---

## 🔤 双语 tagline & 字幕备选

**主 tagline（片头/片尾）**
- 中：**AI 定价风险，链上强制执行。**
- EN：**The AI prices the risk. The chain enforces it.**

**单项奖定位句（可做副标题）**
- 中：**不是聊天机器人，是一个上链的安全与风控 Agent。**
- EN：**Not a chatbot — an on-chain Security & Risk Agent.**

**收束金句**
- 中：**普通 DeFi 让市场猜价格；TradeShield 让 AI 在你下单前把风险定价。**
- EN：**Ordinary DeFi lets the market guess. TradeShield lets AI price the risk before you buy.**

---

## 🔗 与其他文档的对应

| 视频内容 | 文档锚点 |
|---|---|
| 我们的想法 / 定位 | `README.md`「✨ 这是什么」+「🎯 核心逻辑链」 |
| 亮点① 反欺诈审单 | `src/agent/documentConsistency.js` · `docs/background.md` §9.1 单据风险 |
| 亮点② 工具调用 + RAG | `docs/ai-valuation-tooling.md` · `src/agent/valuationAgent.js` · `src/agent/riskIntel.js` |
| 亮点③ 战争 → 暂停 | `docs/PRD.md` §2.4 · `data/cases/copper-sg-shanghai-warcrisis.case.json` |
| 上链存证 | `README.md`「⛓️ 智能合约」· `hardhat/contracts/RiskPricingOracle.sol` |
| 金融硬度（三种结算） | `docs/demo-script.md`「三种结算」高潮段 |
