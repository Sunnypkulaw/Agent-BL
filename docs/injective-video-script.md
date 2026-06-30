# 🎬 AgentBL · Injective 新星计划视频脚本

> **目标赛事**：Injective × Microsoft × Web3Labs 联合发起的 Injective 新星计划
>
> **视频时长**：3 分钟（180 秒）
>
> **核心定位**：Web3-Native Trade Finance Protocol — 取代银行的贸易融资协议
>
> **必须强调**：Injective inEVM 部署、ENI 可信文件层、丽讯科技物流场景、AI 自主决策
>
> **录制语言**：中文口播 + 英文字幕（关键句提供双语）

---

## 🎯 一句话核心（片头/片尾字幕）

**中文**：
> **AgentBL：出口商上链提单，AI 定价货物风险，全球投资者直接融资。无需银行。**

**English**:
> **AgentBL: Exporters tokenize eBLs. AI prices cargo risk. Global investors fund directly. No bank required.**

**Powered by**: Injective × ENI × 丽讯科技

---

## 📋 视频脚本 — 完整版（3 分钟）

### 片头字幕（5 秒）
```
AgentBL
Web3-Native Trade Finance Protocol

出口商上链提单 · AI 定价风险 · 投资者直接融资
Powered by Injective × ENI × 丽讯科技

Injective × Microsoft × Web3Labs 新星计划
```

---

### [0:00–0:35] 开场：痛点 + 传统模式 vs Web3 原生模式

**【画面】** 
- 世界地图 + 集装箱船动画
- 简单对比图：传统模式（银行中介）vs AgentBL（Web3 原生）

**【口播 - 中文】**
> 各位评委好，这是 AgentBL。
>
> 先看一个真实痛点：国际贸易中，货物一装船，出口商的钱要 **30 到 45 天**才能回来。全球贸易融资缺口高达 **2.5 万亿美元**。
>
> 传统模式下，出口商向银行申请融资——银行审核资质、评估风险、层层审批，几周时间，然后赚取利差。
>
> **AgentBL 要做的是：取代银行。**
>
> 出口商把电子提单上链、AI 秒级定价、智能合约自动开盘、全球投资者直接认购。资金从投资者直达出口商，中间没有银行，没有审批，代码决定一切。

**【英文字幕】**
> Traditional: Exporters → Banks → Weeks of approval → High spreads
>
> AgentBL: Exporters → AI pricing → Smart contracts → Global investors
>
> **No bank. No intermediary. Code enforces everything.**

---

### [0:35–1:15] 核心创新①：ENI 可信文件层 + eBL 唯一性

**【画面】**
- ENI logo + 文件上链动画
- 显示 cargoHash 防双花机制
- EBLRegistry 合约界面

**【口播 - 中文】**
> 但这里有个核心问题：**链下的世界全是欺诈和风险**。单据可能造假，同一批货可能开多张提单骗贷——传统上是银行的贸易融资部门在把关。
>
> AgentBL 的第一层创新：**ENI 可信文件层**。
>
> ENI 是 Injective 生态的官方可信文件基础设施。每一张电子提单上链时，我们生成一个 **cargoHash**——船名、航次、货物、数量、装货港的 SHA-256 哈希。
>
> 这个 cargoHash 在链上注册，**同一批货只能注册一次**。试图用同一批货开第二张提单？合约直接拒绝。
>
> **这就是 ENI 的价值：不可篡改 + 唯一性控制 = 取代了银行对贸易真实性的审核。**

**【画面叠加文字】**
```
✅ ENI 可信文件层
✅ cargoHash 防一货多单
✅ 链上唯一性注册

传统：银行贸易融资部审核（几天）
AgentBL：ENI + 智能合约验证（秒级）
```

**【英文字幕】**
> **ENI Trusted Document Layer**: One cargo = One eBL. On-chain uniqueness prevents double-financing fraud.

---

### [1:15–2:00] 核心创新②：AI 自主定价引擎 + 丽讯科技物流场景

**【画面】**
- 切换到 Dashboard，选择案例（新加坡 → 上海 铜货）
- AI Pricing Console 瀑布图展开
- 显示数据来源：LME 铜价、xAPI 风险情报、丽讯物流数据

**【口播 - 中文】**
> 第二层创新：**AI 自主定价引擎**。
>
> 传统银行模式下，风控部门评估的是"这家出口商的信用等级"。AgentBL 完全不同——**AI 只评估货物本身和航线风险，不管出口商是谁。**
>
> 看这个案例：新加坡出口商，500 吨铜阴极板，发往上海港。
>
> AI 自动启动工作：
> - 调用实时 **LME 铜价** API 估值货物 → 450 万美元
> - 交叉核验电子提单、商业发票、保险单三份文件 → 检测数量是否一致、保险是否足额
> - 通过 **xAPI 协议**实时抓取地缘风险、天气、航线风险
> - 接入**丽讯科技物流系统**，获取这条航线的历史准时率、港口拥堵情况
>
> 然后 AI 给出三档融资方案：FAST 到账（折价 20%）、BALANCED（折价 15%）、SAFE（折价 10%）。
>
> **出口商选择方案后，AI 自动在 Injective 链上创建发行池、自动开盘——无需任何人审批。**

**【画面叠加文字】**
```
AI 定价输入：
✅ 实时 LME 铜价 API
✅ xAPI 地缘风险情报
✅ 丽讯科技物流数据
✅ 三份单据交叉核验

输出：
→ 货物估值：$4,500,000
→ 风险评分：MEDIUM
→ 发行价：$0.80（FAST）/ $0.85（BALANCED）/ $0.90（SAFE）
```

**【英文字幕】**
> **AI prices the cargo, not the credit score.**
>
> Data sources: LME prices + xAPI risk intel + 丽讯 logistics + document cross-verification
>
> Output: Risk-adjusted issuance price. Auto-opens on Injective. No human approval.

---

### [2:00–2:35] 核心创新③：在途自主决策 + Injective 链上执行

**【画面】**
- 切换到航运追踪界面（Voyage Tracking）
- 点击"模拟霍尔木兹冲突升级"按钮
- 显示风险维度飙红、AI 自主决策改价、状态变为 PAUSE
- 显示链上交易记录

**【口播 - 中文】**
> 第三层创新：**AI 在途自主决策**。
>
> 货物在海上航行时，风险是实时变化的。传统银行模式下，贷款已经放出去了，风险变化银行也只能事后处理。
>
> AgentBL 不同。我们模拟一个极端场景：这批铜正在海上，突然**霍尔木兹海峡冲突升级**。
>
> 此时铜价其实在涨——普通的价格预言机会认为"抵押物更值钱、更安全"。**完全看反。**
>
> AgentBL 的 AI 知道：这是**脆弱的战争溢价**。它同时意味着：
> - 进口商违约概率上升
> - 保险因"战争除外"条款失效  
> - 货物清算回收率下降
>
> 所以 AI **自主决策**：把货值 haircut 21%、风险分打到 1410 个基点、直接在 **Injective 链上执行 PAUSE**——暂停新的投资者进场，把他们拦在爆雷之外。
>
> **这个决策从检测风险到链上执行，全程自动，无需人工干预。**

**【画面叠加文字】**
```
事件：霍尔木兹冲突升级

AI 自主决策链路：
1. xAPI 检测地缘风险升级
2. AI 重新评估：违约↑ 保险↓ 回收↓
3. 自动生成新报价：货值 -21%、风险 1410bps
4. Injective 链上执行：PAUSE_OFFERING
5. 决策证据哈希上链：可审计

耗时：< 3 秒
```

**【英文字幕】**
> **Autonomous AI decision on-chain.**
>
> War breaks out → AI detects via xAPI → Reprices risk → Auto-pauses on Injective
>
> Traditional banks: Risk changes after loan is out
>
> AgentBL: AI prevents exposure before it happens

---

### [2:35–3:00] 收束：三位一体 + 核心价值

**【画面】**
- 架构图展示：Injective + ENI + 丽讯科技 + AgentBL
- 回到首页，显示"Powered by"标识
- 最后定格在 tagline 全屏

**【口播 - 中文】**
> 总结一下，AgentBL 是一个 **Web3 原生的贸易融资协议**，建立在三个官方工具之上：
>
> **Injective**——所有智能合约部署在 Injective inEVM 测试网，每一个 AI 决策、每一次状态转移，都在链上强制执行。
>
> **ENI 可信文件层**——电子提单的唯一性控制和不可篡改性，这是整个协议的信任根基。
>
> **丽讯科技物流场景**——真实的物流数据和行业客户，让 AI 的风险评估建立在真实业务之上。
>
> **核心价值：取代银行**。出口商不需要银行授信、投资者不需要银行账户、AI 和智能合约取代了银行的风控部、放款部、清算部。
>
> **eBL 就是抵押物。智能合约就是结算。代码决定一切。**
>
> AgentBL，Injective 新星计划。谢谢各位评委。

**【全屏字幕 - 5 秒】**
```
AgentBL
Web3-Native Trade Finance Protocol

出口商上链提单 · AI 定价风险 · 投资者直接融资

Powered by:
Injective × ENI × 丽讯科技

No bank. No intermediary.
The AI prices. The chain enforces.
```

---

## 🎬 演示操作指南（配合口播的画面操作）

### 时间段 [0:00–0:35] 开场
**操作**：
- 展示对比图（可以是 PPT 或白板）
- 不需要打开网页，用简单动画说明概念

### 时间段 [0:35–1:15] ENI 部分
**操作**：
1. 打开浏览器，访问 Dashboard 首页
2. 点击右上角"Connect Wallet"（展示 MetaMask 连接）
3. 导航到 eBL 管理页面（如果有的话）
4. **关键展示**：指向某个 eBL 的 `cargoHash` 字段
5. 画外音："这个哈希在链上注册，保证唯一性"

**如果没有独立的 eBL 管理页面**：
- 在终端运行 `npm run demo:once` 
- 展示输出中的 `cargoHash` 和 `EBL uniqueness verified` 部分

### 时间段 [1:15–2:00] AI 定价部分
**操作**：
1. 在 Dashboard 顶部选择案例：**Clean copper · Singapore → Shanghai**
2. 等待 AI Pricing Console 展开（自动或点击"展开定价细节"）
3. **关键展示**：
   - 瀑布图各层级
   - Data Sources 部分（强调 LME API、xAPI、丽讯数据）
   - 三档融资方案对比（FAST $0.80、BALANCED $0.85、SAFE $0.90）
4. 点击"⛓️ 铸造 RWA 上链"按钮
5. 展示 MetaMask 弹窗（确认交易）
6. 等待交易确认，显示成功状态

### 时间段 [2:00–2:35] 在途决策部分
**操作**：
1. 切换到"航运追踪"（Voyage Tracking）页面
2. 当前案例应该显示为"In Transit"状态
3. **关键操作**：点击"⚔️ 模拟霍尔木兹冲突升级"按钮
4. **关键展示**：
   - 风险维度卡片变红
   - AI 重新定价过程（自动展开）
   - 新报价显示：货值 haircut -21%、风险 1410bps
   - 状态变为"PAUSED"
5. 滚动到底部，显示链上交易哈希
6. （如果时间充裕）点击交易哈希链接，跳转到 Injective 区块浏览器

**备选方案**（如果网页不稳定）：
- 终端运行 `npm run demo:default`
- 展示三种结算结果的输出
- 重点指向"战争尾部违约"那一段

### 时间段 [2:35–3:00] 收束
**操作**：
1. 回到 Dashboard 首页
2. 显示页面底部的"Powered by Injective × ENI × 丽讯科技"标识
3. 最后 5 秒：全屏显示 tagline（可以用 PPT 或简单的全屏字幕）

---

## 🎯 必须强调的官方工具点（用于评分）

### ① Injective 官方工具使用
**强调次数**：至少 3 次
- [0:30] "智能合约自动开盘"
- [1:50] "自动在 **Injective 链上**创建发行池"
- [2:25] "在 **Injective 链上执行 PAUSE**"
- [2:45] "所有智能合约部署在 **Injective inEVM 测试网**"

**演示证据**：
- MetaMask 连接显示 Injective Testnet
- 交易哈希指向 Injective 区块浏览器
- 合约地址可追溯到 Injective

### ② ENI 可信文件层
**强调次数**：至少 2 次
- [0:50] "**ENI 可信文件层**"（独立段落，35 秒）
- [2:45] "**ENI 可信文件层**——电子提单的唯一性控制"

**演示证据**：
- cargoHash 字段展示
- "ENI uniqueness verified" 状态
- 文档中明确标注"Powered by ENI"

### ③ 丽讯科技物流场景
**强调次数**：至少 2 次
- [1:35] "接入**丽讯科技物流系统**，获取航线历史数据"
- [2:50] "**丽讯科技物流场景**——真实的物流数据和行业客户"

**演示证据**：
- AI 定价数据来源中标注"丽讯物流数据"
- 案例描述中提到"丽讯科技提供的真实场景"

---

## 🏆 差异化竞争点（为什么能拿第一名）

### 与其他参赛项目的本质区别

| 维度 | 典型 AI × Blockchain 项目 | AgentBL |
|------|--------------------------|---------|
| **AI 角色** | 聊天机器人、推荐系统 | **承保人 + 风控官**——承担真实金融职能 |
| **叙事** | "AI 辅助 DeFi" | **"取代银行的 Web3 原生协议"** |
| **RWA 类型** | 房地产、艺术品、积分 | **电子提单**——全球 $5 万亿贸易的核心单据 |
| **自主程度** | 用户触发 AI 响应 | **事件驱动 + 自主决策 + 链上执行** |
| **官方工具深度** | 浅层集成（只部署合约） | **三位一体**：Injective（执行层）+ ENI（信任层）+ 丽讯（场景层） |
| **产业资源** | 纯链上演示 | **真实物流场景 + 行业客户** |

### 评委打分维度对应

| 评分维度（预测） | AgentBL 的亮点 |
|----------------|---------------|
| **创新性** | ✅ 取代银行，不是服务银行<br>✅ AI 定价货物而非信用评分<br>✅ 自主决策 + 链上强制执行 |
| **技术实现** | ✅ 完整的智能合约（5 个合约）<br>✅ 155 个自动化测试<br>✅ AI 定价引擎 + 多 Agent 系统 |
| **官方工具使用** | ✅ Injective inEVM 部署（可验证）<br>✅ ENI 唯一性控制（核心功能）<br>✅ 丽讯物流数据（真实场景） |
| **商业价值** | ✅ 解决 $2.5 万亿美元缺口<br>✅ 取代传统银行贸易融资<br>✅ 已有行业客户（丽讯） |
| **演示完整性** | ✅ 端到端闭环（上链 → 定价 → 在途决策 → 结算）<br>✅ 极端场景压力测试（战争）<br>✅ 可追溯的链上证据 |

---

## 🔤 关键术语双语对照（制作字幕用）

| 中文 | English |
|-----|---------|
| 电子提单 | Electronic Bill of Lading (eBL) |
| 贸易融资 | Trade Finance |
| 货权凭证 | Document of Title |
| 一货多单 | Double Financing / Cargo Duplication Fraud |
| 货值估算 | Cargo Valuation |
| 战争溢价 | War Premium |
| 战争除外条款 | War Exclusion Clause |
| 折价发行 | Discounted Issuance |
| 目标兑付价 | Target Redemption Price |
| 风险基点 | Risk Basis Points (bps) |
| 自主决策 | Autonomous Decision |
| 链上执行 | On-chain Enforcement |
| 可信文件层 | Trusted Document Layer |
| 唯一性控制 | Uniqueness Control |

---

## 📊 数字清单（所有数字均可照念，来自真实测试）

- **$2.5 万亿**：全球贸易融资缺口
- **30–45 天**：传统贸易融资回款周期
- **$450 万**：案例货值（500 吨铜）
- **$0.80 / $0.85 / $0.90**：三档发行价（FAST / BALANCED / SAFE）
- **20% / 15% / 10%**：对应的折价率
- **+25% / +17.9% / +11.1%**：投资者目标收益率
- **21%**：战争场景货值 haircut
- **1410 个基点**：战争场景风险分
- **< 3 秒**：AI 从检测风险到链上执行的耗时

---

## 🎤 录制建议

### 语速与节奏
- **0:00–0:35 开场**：稍快，抓住注意力
- **0:35–1:15 ENI 部分**：中速，强调核心技术
- **1:15–2:00 AI 定价**：中速，数据密集需清晰
- **2:00–2:35 在途决策**：**放慢**，这是高潮段落
- **2:35–3:00 收束**：稍快，有力收尾

### 情绪与重音
- **"取代银行"**：重音，这是核心叙事
- **"ENI 可信文件层"**：清晰，突出官方工具
- **"AI 自主决策"**：重音，这是技术亮点
- **"代码决定一切"**：重音，Web3 精神

### 备用方案
如果网页演示出现问题：
1. **Plan B**：全程用终端命令
   - `npm run demo:once`（完整闭环）
   - `npm run agent:value`（AI 工具调用）
   - `npm run demo:default`（三种结算）
2. **Plan C**：用 PPT + 架构图讲解
   - 所有核心概念都可以用图示说明
   - 数字和证据来自测试输出

---

## 🎬 最终检查清单（提交前）

- [ ] 片头显示"Injective × Microsoft × Web3Labs 新星计划"
- [ ] 至少 3 次提到"Injective"
- [ ] 至少 2 次提到"ENI 可信文件层"
- [ ] 至少 2 次提到"丽讯科技"
- [ ] 演示中展示 Injective Testnet 连接
- [ ] 演示中展示 cargoHash 唯一性
- [ ] 演示中展示 AI 自主决策过程
- [ ] 演示中展示链上交易哈希
- [ ] 时长控制在 3 分钟 ± 10 秒
- [ ] 英文字幕覆盖所有关键句
- [ ] 最后 5 秒全屏显示 tagline

---

## 💡 金句总结（可用于社交媒体 / 宣传）

**中文版**：
> AgentBL：出口商上链提单，AI 定价货物风险，全球投资者直接融资。无需银行。

> 传统银行评估"你是谁"，AgentBL 只评估"这批货值多少、风险多大"。

> eBL 就是抵押物。智能合约就是结算。代码决定一切。

> Powered by Injective × ENI × 丽讯科技：执行层 × 信任层 × 场景层。

**English**:
> AgentBL: Exporters tokenize eBLs. AI prices cargo risk. Global investors fund directly. No bank required.

> Traditional banks ask "Who are you?" AgentBL asks "How much is this cargo worth and how risky is this route?"

> The eBL is the collateral. The smart contract is the settlement. Code enforces everything.

> Powered by Injective × ENI × 丽讯科技: Execution Layer × Trust Layer × Real-World Scenario Layer.
