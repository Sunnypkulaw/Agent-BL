# AgentBL → Injective 新星计划 开发方向分析 v2

> **目标赛事**：Injective × Microsoft × Web3Labs 联合发起的 Injective 新星计划（AI × 真实应用场景方向）
>
> **项目定位**：Web3-Native Trade Finance Protocol — Exporters Tokenize, AI Prices, Global Investors Fund
>
> **底层能力**：ENI 可信文件层 + 丽讯科技物流/供应链场景
>
> **分析日期**：2026-06-20
>
> **版本说明**：v2 修正叙事方向——从"帮银行做基础设施"扭转为"替代银行的 Web3 原生贸易融资协议"。

---

## 一、核心叙事：取代银行，不是服务银行

### 1.1 传统贸易融资 vs AgentBL

```
传统模式（银行中介）                      AgentBL（Web3 原生）

出口商                                  出口商
  │                                       │
  ├─ 向银行申请融资                         ├─ eBL 上链（ENI 验证唯一性）
  ├─ 银行审核资质（几周）                    ├─ AI 自动定价（秒级）
  ├─ 银行评估风险                           ├─ 智能合约创建发行池
  ├─ 银行放款（层层审批）                    ├─ 全球投资者认购 RWA
  │                                       │
  ▼                                       ▼
银行赚利差                                出口商直接获得资金
银行承担信用风险                          投资者承担货价/航线风险，获折价收益
银行有最终决策权                          代码决定一切，无人可干预
```

### 1.2 一句话定位

> **AgentBL is a Web3-native trade finance protocol.**
>
> Exporters tokenize electronic bills of lading on-chain. AI prices the cargo risk — not the exporter's credit score. Global investors fund the trade directly. No bank. No credit committee. No intermediary.
>
> The eBL *is* the collateral. The smart contract *is* the settlement. ENI guarantees the document is real. Injective enforces every decision.

### 1.3 五个不可动摇的原则

| # | 原则 | 含义 |
|---|------|------|
| 1 | **Exporters tokenize** | 出口商是主动方。打开 AgentBL，上传 eBL，一键 tokenize。不需要银行审批。 |
| 2 | **AI prices risk, not people** | AI 只评估"这批货 + 这条航线 + 当前世界局势"的风险。不查出口商的征信报告。 |
| 3 | **Investors fund directly** | 全球任何人只要有钱包，就可以浏览 eBL 市场、认购 RWA。资金从投资者直达出口商。 |
| 4 | **Smart contracts settle** | 进口商付款 → 合约自动兑付。货物到港 → 合约自动结算。不需要银行的清算部门。 |
| 5 | **eBL is the collateral** | 电子提单本身就是抵押物。它的法律效力 + ENI 的不可篡改性 = 不需要第三方托管。 |

---

## 二、项目当前状态总览

AgentBL 是 ETHBeijing 2026 黑客松获奖项目，已具备核心能力：

| 维度 | 现状 |
|------|------|
| **AI 动态定价引擎** | ✅ 完整：`src/core/pricingEngine.js`，基于"出口商盈利份额"的折价模型 |
| **eBL 上链** | ✅ 基础：mint/pledge/release |
| **eBL 淘宝式市场** | 📐 已设计：[ebl-marketplace-design.md](./ebl-marketplace-design.md) |
| **AI 智能推荐** | 📐 已设计：自然语言描述 → AI 筛选排序推荐 |
| **前端 Dashboard** | ✅ 完整：浏览 eBL + 一键铸造 + 航运追踪 |
| **世界风险情报** | ✅ 完整：xAPI 集成（X/Twitter + 新闻 + 预测市场） |
| **AI 对话助手** | ✅ 完整：popup-assistant.js，9 个 Function Calling 工具 |
| **文档一致性检查** | ✅ 完整：7 维度交叉核验 |
| **区块链部署** | ✅ Injective Testnet (inEVM) |
| **自主 AI Agent** | ❌ 缺失：当前 AI 为"按需调用"，非自主持续决策 |
| **eBL 完整流转** | ❌ 缺失：无 transfer/endorse，无 cargoHash 防双花 |
| **AI 文档解析** | ❌ 缺失：无 OCR/NLP 从扫描件提取字段 |

---

## 三、6 大差距及开发方案

### 方向一：🔴 Injective 链适配（最高优先级）

#### 当前状态

所有合约部署在 Injective Testnet (inEVM/Solidity)，前端支持 MetaMask。

#### 需要开发的内容

##### 1.1 inEVM vs CosmWasm 选型

| 选项 | 优势 | 劣势 | 建议 |
|------|------|------|------|
| **inEVM** | 现有 Solidity 合约可复用 80%+；开发效率高 | Gas 用 INJ；部分 EVM opcode 可能有差异 | **推荐优先** |
| **CosmWasm** | Injective 原生；性能更好 | 需用 Rust 重写全部合约；开发周期长 | 后续迭代考虑 |

**建议**：先用 inEVM 快速落地，后续核心合约可考虑 CosmWasm 重写。

##### 1.2 inEVM 合约部署

将以下合约部署到 inEVM 测试网：

| 合约 | 文件 | 说明 |
|------|------|------|
| `AgentBLRWA` | [hardhat/contracts/AgentBLRWA.sol](../hardhat/contracts/AgentBLRWA.sol) | 主合约：tokenize() + 发行池管理 |
| `RiskPricingOracle` | [hardhat/contracts/RiskPricingOracle.sol](../hardhat/contracts/RiskPricingOracle.sol) | AI 定价锚定上链 |
| `RWAOfferingPool` | [hardhat/contracts/RWAOfferingPool.sol](../hardhat/contracts/RWAOfferingPool.sol) | 发行池：开盘→认购→暂停→结算 |
| `EBLRegistry` | [hardhat/contracts/EBLRegistry.sol](../hardhat/contracts/EBLRegistry.sol) | eBL 注册表（需升级至 V2） |
| `RWAToken` | [hardhat/contracts/RWAToken.sol](../hardhat/contracts/RWAToken.sol) | 投资者份额代币 |

**技术关键点**：

- inEVM RPC 端点配置
- Hardhat 网络配置增加 inEVM 网络
- INJ 作为 gas token
- 前端 `chain-config.json` 改造成多链支持格式

##### 1.3 钱包集成

在 [public/web3.js](../public/web3.js) 中增加：

- 当前：MetaMask only (ethers v6)
- 目标：MetaMask + Keplr + Leap 三钱包支持

##### 1.4 前端多链配置

改造 [public/chain-config.json](../public/chain-config.json) 为多链格式，默认链指向 `injective-testnet`。

**预计工作量**：3-4 天

---

### 方向二：🤖 自主 AI Agent（核心创新，必须强化）

#### 当前状态

AI 能力分散在多个文件中，全部为"用户触发 → AI 响应"模式。**没有任何自主决策能力**。

#### 需要开发的内容

##### 2.1 Agent 编排器 (Orchestrator)

新增文件：`src/agent/orchestrator.js`

```
出口商上传 eBL
      │
      ▼
┌─────────────────────────────────────────────────┐
│           Agent Orchestrator（编排器）             │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ 文档交叉  │  │ 货物估值  │  │ 风险定价      │   │
│  │ 核验     │→│ AI 定价   │→│ 三档速度对比  │   │
│  └──────────┘  └──────────┘  └──────────────┘   │
│       │              │               │            │
│       ▼              ▼               ▼            │
│  ┌──────────────────────────────────────────┐    │
│  │      AI 选定最优方案 → 自动开盘             │    │
│  │      无需任何人审批，eBL 上链即开盘          │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  持续监控循环（每 N 分钟 / 事件驱动）       │    │
│  │  xAPI 检测到风险变化 → 自主改价             │    │
│  │  货物到港 → 自动触发结算                    │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**核心设计原则**：

- eBL 上链的那一刻，AI 自动开始工作。不需要任何人点"开始评估"。
- AI 的决定（定价、改价、暂停、结算）直接上链执行。中间没有人工审批环节。
- 出口商可以设置参数（"最低接受的发行价"、"到账速度偏好"），但 AI 自主执行。

##### 2.2 自主触发器管道

新增文件：`src/agent/autonomousAgent.js`

**Event → Decision → On-chain Action 管道**：

| 事件（Trigger） | AI 决策（Decision） | 链上动作（Action） |
|-----|------|------|
| 出口商 mint eBL + 文档验证通过 | AI 估值 + 定价 + 选择推荐速度 | 自动开盘 `OPEN_OFFERING` |
| xAPI 检测战争/制裁升级 | AI 重新评估航线风险 | `PAUSE_OFFERING` 或 `REPRICE_DOWN` |
| 风险解除（xAPI 信号恢复正常） | AI 确认风险已消除 | `RESUME_OFFERING` |
| 进口商付款确认 | AI 验证付款金额 | 触发 `settle()` → 投资者获兑付 |
| 货物到港（航运追踪确认） | AI 生成结算报告 | 自动赎回流程 |
| 保险即将到期 | AI 检查覆盖缺口 | `OPEN_WITH_WARNING` |

##### 2.3 决策审计日志

新增文件：`src/agent/decisionLogger.js`

每个自主决策记录：

```typescript
type AgentDecision = {
  decision_id: string;           // SHA-256 哈希
  timestamp: string;
  trigger_event: string;         // 触发条件
  agent_pipeline: string[];      // 参与决策的 Agent 列表
  input_snapshot: object;        // 输入数据快照
  reasoning: string;             // AI 推理过程（可解释性）
  decision: string;              // OPEN / PAUSE / REPRICE / SETTLE / ...
  on_chain_tx?: string;          // 上链交易哈希
  evidence_hashes: string[];     // 证据哈希列表
  overridden_by_human?: boolean; // 极少数极端情况下的人工干预
};
```

所有决策在链上可审计。出口商和投资者都可以查看"AI 为什么做了这个定价决策"。

##### 2.4 前端 Agent 活动面板

新增 View ⑤：实时展示 Agent 当前状态、最近决策时间线、推理过程可视化。

**预计工作量**：5-7 天

---

### 方向三：📄 eBL 能力升级（对接 ENI 底座）

#### 当前状态

[EBLRegistry.sol](../hardhat/contracts/EBLRegistry.sol) 仅有 3 个函数：mintEBL、pledge、releasePledge。

#### 需要开发的内容

##### 3.1 eBL 唯一性控制（防一货多单）——核心创新

这是 ENI 底座的核心价值，也是整个协议的信任根基。

```solidity
// eBL 合约新增
function isUnique(bytes32 cargoHash) external view returns (bool);
function registerCargoHash(bytes32 cargoHash, uint256 eblId) internal;

// cargoHash = SHA-256(vessel + voyage + commodity + quantity + portOfLoading)
// 同一批货只能注册一次 eBL。防止"一货多单"骗贷。
```

没有这个机制，协议的所有安全假设都不成立。ENI 的可信文件层 + 链上 cargoHash 注册 = 取代了银行对"贸易真实性"的审核。

##### 3.2 eBL 完整流转

| 函数 | 说明 |
|------|------|
| `mintEBL(metadataHash, holder)` | 已有：登记 |
| `pledge(eblId, pool)` | 已有：质押到发行池 |
| `releasePledge(eblId)` | 已有：释放质押 |
| `transfer(eblId, to)` | **新增**：转移所有权 |
| `endorse(eblId, endorsee)` | **新增**：背书转让 |
| `getTransferHistory(eblId)` | **新增**：完整流转历史 |

##### 3.3 eBL 结构化元数据

```solidity
struct EBLMetadata {
    bytes32 cargoHash;          // 货物唯一哈希（防双花核心）
    string vesselName;
    string voyageNumber;
    string portOfLoading;
    string portOfDischarge;
    uint256 quantityMt;
    string commodity;
    string hsCode;
    uint256 declaredValueUsd;
    string incoterms;
    uint256 issuedAt;
    string complianceStandard;  // MLETR / eUCP / DCSA
}
```

##### 3.4 AI 文档解析器

新增：`src/agent/documentParser.js`。用 LLM 从 eBL/发票/保险单扫描件自动提取结构化字段。

##### 3.5 合规标注引擎

新增：`src/agent/complianceChecker.js`。自动检查 MLETR / eUCP / DCSA / ICC DSI 合规性。

**预计工作量**：4-5 天

---

### 方向四：🌍 Web3 原生贸易融资协议（产品化）

> ⚠️ **v2 重大修正**：这一方向的叙事从"帮银行做供应链金融产品"扭转为"建设取代银行的 Web3 原生协议"。

#### 4.1 参与方

协议只涉及三方。没有银行。

| 角色 | 做什么 | 与银行模式的区别 |
|------|--------|-----------------|
| **出口商 (Exporter)** | 上传 eBL → tokenize → 选择偏好 → 获得资金 | 无需银行授信，秒级到账 |
| **投资者 (Investor)** | 浏览 eBL 市场 → 认购 RWA → 持有至兑付 | 无需银行账户，Metamask/Keplr 直接投 |
| **AI + 智能合约** | 定价风险、开盘、监控、改价、结算 | 替代了银行的风控部 + 放款部 + 清算部 |

#### 4.2 产品逻辑

协议只有一种原语：**一单一池**。

```
出口商 tokenize eBL
       │
       ▼
AI 定价（三档速度：FAST / BALANCED / SAFE）
       │
       ▼
链上创建发行池 → RWA 代币生成
       │
       ▼
投资者认购 → 资金直达出口商
       │
       ▼
进口商付款 / 货物到港 → 合约自动兑付 → 投资者获利
```

不存在"应收账款贴现""订单融资""库存融资"这些银行产品分类。eBL 上链就是 eBL 上链。

#### 4.3 AI 风险定价的本质

AI 不关心出口商是谁。它只回答三个问题：

```
1. 这批货值多少钱？
   → 参考 LME/COMEX 现货价 + AI 文件交叉核验

2. 这条航线的风险有多大？
   → 地缘风险 + 天气风险 + 海盗风险 + 保险覆盖

3. 折多少钱发出去才合理？
   → 风险越高 → 发行价越低 → 投资者潜在收益越高
   → 出口商用折价换取即时资金
```

这正是 **Web3 原生** 的核心：风险评估的不是"人"，是"货 + 航线"。任何出口商，只要能提供真实 eBL，就能获得资金。

#### 4.4 eBL 市场（淘宝式）

详见 [ebl-marketplace-design.md](./ebl-marketplace-design.md)

- 所有已 tokenize 的 eBL 以卡片网格展示
- 自然语言 AI 搜索："收益高一些、风险中等"
- 多维筛选：收益率 / 风险 / 货物 / 航线 / 金额
- 点卡入详情，一键认购

#### 4.5 API 扩展

| Endpoint | 方法 | 用途 |
|----------|------|------|
| `/api/market/listings` | GET | 所有活跃的 eBL 发行池 |
| `/api/market/search` | POST | AI 自然语言搜索 + 筛选 |
| `/api/pool/subscribe` | POST | 投资者认购 RWA |
| `/api/pool/status` | GET | 发行池实时状态 |
| `/api/exporters/dashboard` | GET | 出口商：我的 eBL 状态 |
| `/api/investors/portfolio` | GET | 投资者：我的持仓 |

**预计工作量**：3-4 天

---

### 方向五：🧠 AI 能力扩充

#### 5.1 AI 合规检查

新增：`src/agent/complianceChecker.js`

自动检查维度：
- 制裁名单扫描（出口商/承运人/收货人）
- 出口管制（HS 编码是否需要许可证）
- MLETR 电子提单合规
- eUCP 电子交单合规

注意：合规检查是**信息提示**，不是**准入门槛**。AI 标注风险但不会因为"公司太小"而拒绝服务。

#### 5.2 多 LLM 竞争评估

增强：`src/agent/llm/` 目录

同一个 case → 3 个 LLM 独立评估 → 取中位数/共识。

#### 5.3 AI 投资顾问（与 eBL 市场联动）

新增：`src/agent/investmentAdvisor.js`

```
输入：投资者的自然语言偏好
      "收益高、风险可控、金额在 200 万以内"
      
输出：排序后的 eBL 列表 + 每个的推荐理由
```

这正是 eBL 市场 AI 搜索的后端支撑，在 popup-assistant.js 中通过 `recommendEBL` 工具调用。

#### 5.4 AI 对话界面（已就绪）

[public/popup-assistant.js](../public/popup-assistant.js) 已提供完整的 DeepSeek 流式对话 + 9 个 Function Calling 工具。下一步扩展 `recommendEBL` 工具即可与 eBL 市场打通。

**预计工作量**：4-5 天

---

### 方向六：🖥️ 前端产品化

#### 6.1 页面规划

| View | 文件名 | 用途 | 状态 |
|------|--------|------|------|
| **⓪ eBL 市场** | `public/market.js` | 浏览 eBL + AI 推荐 + 筛选 | 📐 已设计 |
| **① eBL 详情 & 铸造** | `public/app.js`（现有） | eBL 详情 + AI 定价瀑布 + 一键铸造 | ✅ 已有 |
| **② 航运追踪** | `public/voyage.js`（现有） | 在途追踪 + 实时改价 + xAPI 风险 | ✅ 已有 |
| **③ eBL 管理** | `public/ebl.js` | 出口商：上传 eBL、查看状态 | 待开发 |
| **④ 投资组合** | `public/portfolio.js` | 投资者：持仓、收益、兑付记录 | 待开发 |
| **⑤ Agent 活动** | `public/agent-activity.js` | AI 自主决策实时时间线 | 待开发 |

#### 6.2 Injective 品牌适配

- 主题色切换：增加 Injective 紫色主题
- Logo/品牌元素替换
- "Powered by ENI + Injective" 合作方展示

**预计工作量**：5-7 天

---

## 四、优先级排序与时间规划

假设黑客松周期为 **30-45 天**：

### 🔴 P0（必须做，约 15 天）：主链路打通

| # | 任务 | 文件 | 工作量 |
|---|------|------|--------|
| 1 | Injective inEVM 合约部署 | [hardhat/contracts/](../hardhat/contracts/) | 2天 |
| 2 | Keplr + MetaMask 双钱包 | [public/web3.js](../public/web3.js) | 2天 |
| 3 | Agent 编排器（自主决策） | `src/agent/orchestrator.js`（新增） | 3天 |
| 4 | 自主触发器管道 | `src/agent/autonomousAgent.js`（新增） | 3天 |
| 5 | eBL 合约升级（唯一性 + 流转） | [hardhat/contracts/EBLRegistry.sol](../hardhat/contracts/EBLRegistry.sol) | 2天 |
| 6 | AI 文档解析器 | `src/agent/documentParser.js`（新增） | 3天 |

### 🟡 P1（建议做，约 10 天）：核心差异化

| # | 任务 | 文件 | 工作量 |
|---|------|------|--------|
| 7 | eBL 淘宝式市场 (View ⓪) | `public/market.js`（新增） | 2天 |
| 8 | AI 推荐引擎（recommendEBL） | popup-assistant.js 扩展 | 1天 |
| 9 | 决策审计日志 | `src/agent/decisionLogger.js`（新增） | 1天 |
| 10 | AI 合规检查 | `src/agent/complianceChecker.js`（新增） | 2天 |
| 11 | eBL 管理面板 (View ③) | `public/ebl.js`（新增） | 2天 |
| 12 | Agent 活动面板 (View ⑤) | `public/agent-activity.js`（新增） | 2天 |

### 🟢 P2（时间允许，约 5 天）：锦上添花

| # | 任务 | 文件 | 工作量 |
|---|------|------|--------|
| 13 | 投资者组合面板 (View ④) | `public/portfolio.js`（新增） | 1天 |
| 14 | 多 LLM 竞争评估 | `src/agent/llm/` | 1天 |
| 15 | Injective 品牌主题 | `public/styles.css` | 1天 |
| 16 | 出口商参数面板（偏好设置） | `public/` 扩展 | 2天 |

---

## 五、关键差异化卖点

### 5.1 与其他项目的本质区别

| 对比维度 | 典型参赛项目 | AgentBL |
|----------|-------------|----------------|
| 核心理念 | Web3 工具 / DeFi 协议 | **取代银行贸易融资的 Web3 原生协议** |
| AI 角色 | 聊天/客服/推荐 | **货值定价 + 航线风险评估 + 自主决策** |
| 信任基础 | 超额抵押 / 信用评分 | **eBL 的法律效力 + ENI 不可篡改 + 链上透明** |
| RWA 类型 | 代币化房地产/艺术品 | **电子提单——全球每年 $5 万亿贸易的核心单据** |
| 自主程度 | 用户触发 | **事件驱动 + 持续监控 + 链上自动执行** |
| 准入机制 | KYC / 信用审核 | **货物真实性 = 唯一准入门槛。不管你是谁** |
| 产业资源 | 纯链上 | **ENI（可信文件）+ 丽讯（物流场景）** |

### 5.2 一句话

> **AgentBL:** Exporters tokenize eBLs. AI prices the cargo, not the credit score. Global investors fund the trade. Injective enforces every decision on-chain. No bank required.

### 5.3 3 分钟演示脚本

1. **25s** — 出口商上传 eBL → ENI 验证唯一性，cargoHash 上链
2. **35s** — AI 自动解析提单 + 交叉核验发票/保险 → 估值货物
3. **30s** — AI 自动定价（三档速度对比）→ 选定最优方案 → 上链自动开盘
4. **35s** — eBL 市场展示：投资者浏览、AI 推荐"收益高、风险中等"→ 点击认购
5. **35s** — 运输中 xAPI 检测地缘风险升级 → AI 自主改价 → 链上 PAUSE
6. **10s** — 风险解除 → 自主恢复。进口商付款 → 自动兑付。投资者获利。
7. **10s** — ENI + 丽讯 + Injective：取代银行的贸易融资基础设施。

---

## 六、技术架构

```
                         ┌──────────────────────────┐
                         │     丽讯科技              │
                         │   物流场景 · 行业客户      │
                         └────────────┬─────────────┘
                                      │
    ┌─────────────────────────────────┼─────────────────────────────┐
    │                      AgentBL Protocol                    │
    │                                                              │
    │  ┌───────────┐  ┌────────────────┐  ┌──────────────────┐    │
    │  │ 文档解析   │  │  自主 AI Agent  │  │  eBL 市场        │    │
    │  │ 提单/发票  │  │  编排器         │  │  卡片网格        │    │
    │  │ 保险单     │  │  定价→开盘→监控 │  │  AI 搜索+推荐    │    │
    │  └─────┬─────┘  └───────┬────────┘  └────────┬─────────┘    │
    │        │                │                     │              │
    │        └────────────────┼─────────────────────┘              │
    │                         │                                    │
    │              ┌──────────┴──────────┐                         │
    │              │   AI 定价引擎 (Core) │                         │
    │              │   货物估值 + 航线风险 │                         │
    │              │   三档速度定价        │                         │
    │              └──────────┬──────────┘                         │
    │                         │                                    │
    └─────────────────────────┼────────────────────────────────────┘
                              │
    ┌─────────────────────────┼────────────────────────────────────┐
    │                  ENI（可信文件底座）                          │
    │  文件唯一性 · 不可篡改 · 控制权流转 · 可审计                   │
    │  解决核心问题：这批货是真实存在的吗？                           │
    └─────────────────────────┼────────────────────────────────────┘
                              │
    ┌─────────────────────────┼────────────────────────────────────┐
    │               Injective 区块链                               │
    │  EBLRegistry · RWAOfferingPool · RiskPricingOracle           │
    │  每一笔定价、每一个决策、每一次兑付——全部上链，全部可审计       │
    └──────────────────────────────────────────────────────────────┘
```

---

## 七、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| inEVM 测试网不稳定 | 中 | 高 | 保留本地模拟模式作为备用演示方案 |
| LLM API 在比赛期间限流 | 中 | 中 | 确定性 fallback 引擎已就绪（全离线可跑） |
| ENI API 对接不及预期 | 低 | 中 | eBL 功能自包含，可独立演示 ENI 价值 |
| 时间不足 | 高 | 高 | 严格按 P0→P1→P2 优先级执行 |
| 评委不理解"取代银行"叙事 | 中 | 中 | "Uber replaced taxi dispatchers. AgentBL replaces trade finance banks." |

---

## 八、总结

当前 AgentBL 底子扎实（155 测试、完整定价引擎、前后端全链路）。向 Injective + ENI + 丽讯科技方向转型的核心工作：

1. **链迁移**：Ethereum → Injective inEVM
2. **AI 升级**：按需调用 → 事件驱动的自主决策 Agent
3. **eBL 增强**：基础登记 → 唯一性控制 + 完整流转 + ENI 底座
4. **产品化**：实验室开关 → eBL 淘宝式市场 + AI 推荐

核心叙事线：**"Exporters tokenize eBLs. AI prices the cargo risk. Global investors fund directly. No bank."**

建议按 **P0（15天）→ P1（10天）→ P2（5天）** 节奏推进，每阶段结束都有可演示的增量产出。
