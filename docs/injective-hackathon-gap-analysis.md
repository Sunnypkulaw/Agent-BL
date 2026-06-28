# AgentBL-AI → Injective 新星计划 开发方向分析

> **目标赛事**：Injective × Microsoft × Web3Labs 联合发起的 Injective 新星计划（AI × 真实应用场景方向）
>
> **项目定位**：AI-Powered Autonomous eBL & Supply Chain Finance Agent on Injective
>
> **底层能力**：ENI 可信文件层 + 丽讯科技物流/供应链场景
>
> **分析日期**：2026-06-20

---

## 一、项目当前状态总览

AgentBL-AI 是一个已完成的 ETHBeijing 2026 黑客松项目，核心能力如下：

| 维度 | 现状 |
|------|------|
| **AI 动态定价引擎** | ✅ 完整：`src/core/pricingEngine.js`，基于"出口商盈利份额"的折价模型 |
| **eBL Registry 合约** | ⚠️ 基础：仅 mint/pledge/release，无 transfer/endorse |
| **单据一致性检查** | ✅ 完整：`src/agent/documentConsistency.js`，7 维度交叉核验 |
| **RWA 生命周期模拟** | ✅ 完整：12 个状态的状态机 |
| **世界风险情报** | ✅ 完整：xAPI 集成（X/Twitter + 新闻 + 预测市场） |
| **前端 Dashboard** | ✅ 完整：两视图（铸造 RWA + 航运追踪） |
| **区块链部署** | ⚠️ Ethereum Sepolia，非 Injective |
| **自主 AI Agent** | ❌ 缺失：当前 AI 为"按需调用"，非自主决策 |
| **供应链金融产品** | ⚠️ 仅有 RWA 折价发行，缺少应收账款、信用评分等 |
| **多角色系统** | ❌ 缺失：无出口商/银行/投资者角色区分 |
| **AI 文档解析** | ❌ 缺失：无 OCR/NLP 从文档扫描件提取字段 |

---

## 二、与目标方向的 6 大差距及开发方案

### 方向一：🔴 Injective 链适配（最高优先级）

#### 当前状态

所有合约部署在 Ethereum Sepolia（Solidity），前端仅支持 MetaMask。

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
| `AgentBLRWA` | [hardhat/contracts/AgentBLRWA.sol](../hardhat/contracts/AgentBLRWA.sol) | 主合约，许可型 demo |
| `RiskPricingOracle` | [hardhat/contracts/RiskPricingOracle.sol](../hardhat/contracts/RiskPricingOracle.sol) | AI 定价上链 |
| `RWAOfferingPool` | [hardhat/contracts/RWAOfferingPool.sol](../hardhat/contracts/RWAOfferingPool.sol) | 发行池生命周期 |
| `EBLRegistry` | [hardhat/contracts/EBLRegistry.sol](../hardhat/contracts/EBLRegistry.sol) | 升级版 eBL 注册表 |
| `RWAToken` | [hardhat/contracts/RWAToken.sol](../hardhat/contracts/RWAToken.sol) | 投资者份额凭证 |

**技术关键点**：

- inEVM RPC 端点配置
- Hardhat 网络配置增加 inEVM 网络
- INJ 作为 gas token
- 前端 `chain-config.json` 改造成多链支持格式

##### 1.3 钱包集成

在 [public/web3.js](../public/web3.js) 中增加：

```
当前：MetaMask only (ethers v6)
目标：MetaMask + Keplr + Leap 三钱包支持
```

- `@keplr-wallet/types` 类型定义
- Injective 的 `injective-lists` 或 `@injectivelabs/sdk-ts` 用于链交互
- 钱包自动检测：EVM 钱包走 inEVM，Cosmos 原生钱包走 CosmWasm（后续）

##### 1.4 前端多链配置

改造 [public/chain-config.json](../public/chain-config.json)：

```json
{
  "chains": {
    "injective-testnet": {
      "chainId": "injective-888",
      "rpcUrl": "https://testnet.sentry.tm.injective.network:443",
      "contracts": {
        "AgentBLRWA": { "address": "0x...", "abi": [...] },
        "RiskPricingOracle": { "address": "0x...", "abi": [...] }
      }
    },
    "sepolia": {
      "chainId": "11155111",
      "rpcUrl": "https://ethereum-sepolia-rpc.publicnode.com",
      "contracts": {
        "AgentBLRWA": { "address": "0xfCA6F1C4...", "abi": [...] }
      }
    }
  },
  "defaultChain": "injective-testnet"
}
```

**预计工作量**：3-4 天

---

### 方向二：🤖 自主 AI Agent（核心创新，必须强化）

#### 当前状态

AI 能力分散在多个文件中，全部为"用户触发 → AI 响应"模式：

- `src/agent/valuationAgent.js` — 手动调用
- `src/agent/documentConsistency.js` — 手动调用
- `src/agent/worldRiskAgent.js` — 手动调用
- `src/agent/pricingNarrator.js` — 手动调用

**没有任何自主决策能力**。

#### 需要开发的内容

##### 2.1 Agent 编排器 (Orchestrator)

新增文件：`src/agent/orchestrator.js`

```
┌─────────────────────────────────────────────────┐
│           Agent Orchestrator（编排器）             │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ eBL 验证  │  │ 货物估值  │  │ 风险定价      │   │
│  │ Agent    │→│ Agent    │→│ Agent         │   │
│  └──────────┘  └──────────┘  └──────────────┘   │
│       │              │               │            │
│       ▼              ▼               ▼            │
│  ┌──────────────────────────────────────────┐    │
│  │        定价决策 → 链上动作                  │    │
│  │  OPEN / PAUSE / REPRICE / LIQUIDATE       │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  持续监控循环（每 N 分钟 / 事件驱动）       │    │
│  │  xAPI 信号 → 风险变化 → 自主改价            │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**核心设计**：

```javascript
// orchestrator.js 伪代码
class AgentOrchestrator {
  // eBL 上链事件 → 自动触发完整工作流
  async onEBLMinted(eblId, metadataHash) {
    // Step 1: 文档解析 + 验证
    const docReport = await documentConsistencyAgent.verify(eblId);
    if (docReport.has_critical) return this.reject("文档验证失败");

    // Step 2: 货物估值
    const valuation = await valuationAgent.run(caseData);

    // Step 3: 风险定价（三档速度）
    const quotes = await pricingEngine.compareSpeeds(caseData);

    // Step 4: 自动选择推荐方案并开盘
    const recommended = quotes.recommended_payout_speed;
    await this.openOffering(quotes[recommended]);
  }

  // 持续风险监控循环
  async startMonitoring(poolId) {
    // 每 5 分钟 / 事件驱动
    this.interval = setInterval(async () => {
      const worldRisk = await worldRiskAgent.sweep(poolId);
      if (worldRisk.levelChanged) {
        const newQuote = await pricingEngine.reprice(poolId, worldRisk);
        await this.pushOnChainAction(newQuote);
      }
    }, 5 * 60 * 1000);
  }
}
```

##### 2.2 自主融资触发管道

新增文件：`src/agent/autonomousAgent.js`

**Trigger → Action 管道**：

| Trigger（触发条件） | Action（自主动作） | 链上效果 |
|-----|------|------|
| eBL 登记 + 文档验证通过 | AI 自动估值 + 定价 | 自动创建 RWA 发行池 |
| 风险评分 ≤ MEDIUM | 自动开盘 | `OPEN_OFFERING` |
| xAPI 检测到战争/制裁升级 | AI 重新评估 | `PAUSE_OFFERING` 或 `REPRICE_DOWN` |
| 保险即将到期 | AI 检查覆盖缺口 | `OPEN_WITH_WARNING` |
| 进口商付款确认 | 自动结算 | `settle(poolId)` |
| 货物到港确认 | 自动赎回 | 触发赎回流程 |

##### 2.3 决策审计日志

新增文件：`src/agent/decisionLogger.js`

每个自主决策记录：

```typescript
type AgentDecision = {
  decision_id: string;           // SHA-256 哈希
  timestamp: string;
  trigger: string;               // 触发条件
  agent_pipeline: string[];      // 参与决策的 Agent 列表
  inputs: object;                // 输入数据快照
  reasoning: string;             // AI 推理过程
  decision: string;              // OPEN / PAUSE / REPRICE / etc.
  on_chain_tx?: string;          // 上链交易哈希
  evidence_hashes: string[];     // 证据哈希列表
  human_override?: boolean;      // 是否有人工干预
};
```

##### 2.4 前端 Agent 活动面板

在 Dashboard 中新增实时展示：
- Agent 当前状态（空闲/监控中/决策中）
- 最近决策列表（时间线）
- 推理过程可视化（为什么做了这个决定）
- 手动干预按钮（紧急情况下的人工 override）

**预计工作量**：5-7 天

---

### 方向三：📄 eBL 能力升级（对接 ENI 底座）

#### 当前状态

[EBLRegistry.sol](../hardhat/contracts/EBLRegistry.sol) 仅有 3 个函数：
- `mintEBL(bytes32 metadataHash, address holder)` — 登记
- `pledge(uint256 eblId, address pool)` — 质押
- `releasePledge(uint256 eblId)` — 释放

#### 需要开发的内容

##### 3.1 eBL 合约升级

```solidity
// 新增功能
contract EBLRegistryV2 {
    // === 现有功能 ===
    function mintEBL(bytes32 metadataHash, address holder) external returns (uint256);
    function pledge(uint256 eblId, address pool) external;
    function releasePledge(uint256 eblId) external;

    // === 新增：转移与背书 ===
    function transfer(uint256 eblId, address to) external;
    function endorse(uint256 eblId, address endorsee) external;

    // === 新增：唯一性控制 ===
    function isUnique(bytes32 cargoHash) external view returns (bool);
    function registerCargoHash(bytes32 cargoHash, uint256 eblId) internal;

    // === 新增：结构化元数据 ===
    struct EBLMetadata {
        bytes32 cargoHash;          // 货物唯一哈希（防双花）
        string vesselName;          // 船名
        string voyageNumber;        // 航次号
        string portOfLoading;       // 装货港
        string portOfDischarge;     // 卸货港
        uint256 quantityMt;         // 货物数量（公吨）
        string commodity;           // 货物类型
        string hsCode;              // HS 编码
        uint256 declaredValueUsd;   // 申报货值
        string incoterms;           // 贸易术语
        uint256 issuedAt;           // 签发时间戳
        string complianceStandard;  // MLETR / eUCP / DCSA
    }

    function setMetadata(uint256 eblId, EBLMetadata calldata meta) external;
    function getMetadata(uint256 eblId) external view returns (EBLMetadata memory);

    // === 新增：流转历史 ===
    struct TransferEvent {
        address from;
        address to;
        uint256 timestamp;
        string transferType;  // "TRANSFER" | "ENDORSE" | "PLEDGE" | "RELEASE"
    }

    function getTransferHistory(uint256 eblId)
        external view returns (TransferEvent[] memory);

    // === 事件 ===
    event EBLTransferred(uint256 indexed eblId, address indexed from, address indexed to);
    event EBLEndorsed(uint256 indexed eblId, address indexed endorsee);
    event CargoHashRegistered(bytes32 indexed cargoHash, uint256 indexed eblId);
    event MetadataUpdated(uint256 indexed eblId, bytes32 indexed cargoHash);
}
```

##### 3.2 AI 文档解析器

新增文件：`src/agent/documentParser.js`

用 LLM 从 eBL/发票/保险单的扫描件中提取结构化字段：

```
输入：eBL PDF/图片（或 Markdown 文本）
输出：结构化字段
  - 提单号
  - 船名/航次
  - 装货港/卸货港
  - 货物描述/HS 编码
  - 数量/重量
  - 托运人/收货人
  - 签发日期
  - 贸易术语 (Incoterms)
```

**LLM Prompt 设计**：

```
你是一个国际贸易单据解析专家。请从以下电子提单文本中提取结构化信息。

要求：
1. 如果某个字段在文档中未找到，标注为 null
2. 金额字段以美元为单位
3. 日期格式为 ISO 8601 (YYYY-MM-DD)

输出 JSON 格式...
```

##### 3.3 eBL 唯一性验证

新增文件：`src/agent/eblUniqueness.js`

- 对同一批货物生成 `cargoHash = SHA-256(vessel + voyage + commodity + quantity + portOfLoading)`
- 在 eBL 合约中注册 `cargoHash → eblId` 映射
- 新 eBL 注册时检查 `cargoHash` 是否已存在 → 防止一货多单
- 这是 ENI 的核心技术价值点

##### 3.4 合规标注引擎

新增文件：`src/agent/complianceChecker.js`

自动检查交易是否符合：
- **MLETR**（电子可转让记录示范法）
- **eUCP**（电子信用证统一惯例）
- **DCSA**（数字集装箱航运协会标准）
- **ICC DSI**（国际商会数字标准倡议）

**预计工作量**：4-5 天

---

### 方向四：🏦 供应链金融产品化

#### 当前状态

仅有 RWA 折价发行一种产品形态。

#### 需要开发的内容

##### 4.1 多参与方角色系统

| 角色 | 权限 | 视图 |
|------|------|------|
| **出口商 (Exporter)** | 创建 eBL、申请融资、选择到账速度 | 融资管理面板 |
| **进口商 (Importer)** | 确认收货、发起付款 | 交易状态面板 |
| **银行/金融机构** | 审核 eBL、放款、查看风控报告 | 风控审核面板 |
| **投资者 (Investor)** | 查看 RWA 产品、认购、查看持仓 | 投资仪表盘（已有） |
| **物流公司** | 更新货物状态、上传单据 | 物流更新面板 |
| **ENI 节点** | 提供文件可信验证服务 | 技术对接 |

##### 4.2 融资产品矩阵

| 产品 | 基于什么 | 适用场景 |
|------|----------|----------|
| **eBL 质押融资** | 已装船提单 | 货物在途，出口商需现金（现有） |
| **应收账款贴现** | 商业发票 + eBL | 货物已到港，等待进口商付款 |
| **订单融资** | 采购订单 | 出口商备货阶段，需要资金采购原材料 |
| **库存融资** | 仓单 | 货物在仓，等待出运 |

##### 4.3 信用评分引擎

新增文件：`src/agent/creditScoring.js`

```
评分维度：
├── 交易历史（还款记录、违约次数）
├── 公司基本面（成立年限、注册资本）
├── 贸易真实性（eBL/发票/保险一致性）
├── 进口商所在国风险
├── 行业风险（大宗商品波动性）
└── 银行/金融机构背书
```

##### 4.4 API 扩展

| Endpoint | 方法 | 用途 |
|----------|------|------|
| `/api/finance/products` | GET | 融资产品列表 |
| `/api/finance/apply` | POST | 出口商申请融资 |
| `/api/finance/approve` | POST | 银行审核通过 |
| `/api/finance/credit-score` | GET | 查询信用评分 |
| `/api/finance/receivables` | GET | 应收账款列表 |
| `/api/finance/settle` | POST | 结算 |

**预计工作量**：3-4 天

---

### 方向五：🧠 AI 能力扩充

#### 5.1 AI 合规检查

新增文件：`src/agent/complianceChecker.js`

自动检查维度：
- 制裁名单扫描（出口商/进口商/承运人/银行是否在制裁名单）
- 出口管制（货物 HS 编码是否需要出口许可证）
- 反洗钱（AML）红旗指标
- MLETR 电子提单合规
- eUCP 电子交单合规

##### 5.2 多 LLM 竞争评估

增强：`src/agent/llm/` 目录

```
同一个 case → 3 个 LLM 独立评估
  ├── DeepSeek (成本优势)
  ├── Qwen (中文场景优势)
  └── 腾讯混元 (国内合规优势)
       ↓
  取中位数 / 共识/ 加权平均
       ↓
  差异过大时 → 标记人工审核
```

##### 5.3 AI 融资顾问

新增文件：`src/agent/financingAdvisor.js`

```
输入：
  - 出口商偏好（速度优先 / 成本优先）
  - 货物估值
  - 当前风险水平
  - 市场利率

输出：
  - 推荐融资产品类型
  - 推荐到账速度
  - 预计融资成本
  - 风险提示
  - 替代方案
```

##### 5.4 AI 对话界面

新增前端组件：`public/chat.js`

- 用户直接与 AI Agent 对话
- 查询：eBL 状态、融资进度、风险等级
- 操作：申请融资、调整参数、确认交易
- 支持中文/英文

**预计工作量**：4-5 天

---

### 方向六：🖥️ 前端产品化

#### 6.1 新增页面

| 页面 | 文件名 | 用途 |
|------|--------|------|
| **View ③ eBL 管理** | `public/ebl.js` | eBL 列表、创建、转让、质押、查看流转历史 |
| **View ④ 融资管理** | `public/finance.js` | 融资申请、产品对比、审批状态、还款 |
| **View ⑤ Agent 活动** | `public/agent-activity.js` | 自主 Agent 的实时状态与决策记录 |
| **View ⑥ 供应链全景** | `public/supply-chain.js` | 端到端可视化：订单→eBL→融资→运输→到港→付款 |

#### 6.2 Injective 品牌适配

- 主题色切换：当前暗色主题 → 增加 Injective 紫色主题
- Logo/品牌元素替换
- "Powered by ENI + Injective" 合作方展示
- 区块链浏览器链接替换为 Injective Explorer

#### 6.3 响应式优化

- 移动端适配（评委可能在手机上查看）
- 关键操作按钮移动端优先

**预计工作量**：5-7 天

---

## 三、优先级排序与时间规划

假设黑客松周期为 **30-45 天**：

### 🔴 P0（必须做，约 15 天）：主链路打通

| # | 任务 | 文件 | 工作量 |
|---|------|------|--------|
| 1 | Injective inEVM 合约部署 | [hardhat/contracts/](../hardhat/contracts/) | 2天 |
| 2 | Keplr 钱包集成 | [public/web3.js](../public/web3.js) | 2天 |
| 3 | Agent 编排器 | `src/agent/orchestrator.js`（新增） | 3天 |
| 4 | 自主融资触发管道 | `src/agent/autonomousAgent.js`（新增） | 3天 |
| 5 | eBL 合约升级（transfer + 唯一性） | [hardhat/contracts/EBLRegistry.sol](../hardhat/contracts/EBLRegistry.sol) | 2天 |
| 6 | AI 文档解析器 | `src/agent/documentParser.js`（新增） | 3天 |

### 🟡 P1（建议做，约 10 天）：核心差异化

| # | 任务 | 文件 | 工作量 |
|---|------|------|--------|
| 7 | 多参与方角色系统 | `public/` + API | 3天 |
| 8 | 决策审计日志 | `src/agent/decisionLogger.js`（新增） | 1天 |
| 9 | AI 合规检查 | `src/agent/complianceChecker.js`（新增） | 2天 |
| 10 | eBL 管理面板 (View ③) | `public/ebl.js`（新增） | 2天 |
| 11 | Agent 活动面板 (View ⑤) | `public/agent-activity.js`（新增） | 2天 |

### 🟢 P2（时间允许，约 5 天）：锦上添花

| # | 任务 | 文件 | 工作量 |
|---|------|------|--------|
| 12 | AI 对话界面 | `public/chat.js`（新增） | 2天 |
| 13 | 信用评分引擎 | `src/agent/creditScoring.js`（新增） | 1天 |
| 14 | 多 LLM 竞争评估 | `src/agent/llm/` | 1天 |
| 15 | Injective 品牌主题 | `public/styles.css` | 1天 |

---

## 四、关键差异化卖点

针对 Injective 新星计划，项目最独特的竞争优势：

### 4.1 与其他项目的本质区别

| 对比维度 | 典型参赛项目 | AgentBL-AI |
|----------|-------------|----------------|
| AI 角色 | 聊天/客服/推荐 | **金融承保+定价**（承担真实金融职能） |
| RWA | 代币化房地产/艺术品 | **eBL 提单**（全球贸易核心单据） |
| 自主程度 | 用户触发 | **事件驱动+持续监控**（真正自主） |
| 风险控制 | 链上清算 | **预付费补偿**（折价=违约风险的价格） |
| 产业资源 | 纯链上 | **ENI（可信文件）+ 丽讯（物流场景）** |

### 4.2 一句话描述

> **AI-Powered Autonomous eBL & Supply Chain Finance Agent on Injective**
>
> ENI's trusted document layer powers eBL uniqueness + AI autonomously prices trade risk into RWA discount + Injective enforces every decision on-chain.

### 4.3 3 分钟演示脚本

1. **30s** — 出口商上传 eBL → ENI 可信文件层验证唯一性
2. **40s** — AI Agent 自动解析 eBL + 估值 + 风险定价 → 生成三档融资方案
3. **30s** — Agent 自动选择推荐方案 → 在 Injective 上创建 RWA 发行池 → 自动开盘
4. **40s** — 运输途中 xAPI 检测到地缘风险升级 → Agent 自主决策改价 → 链上 PAUSE
5. **30s** — 风险解除 → Agent 自动恢复 → 进口商付款 → 自动结算 → 投资者获利
6. **10s** — ENI + 丽讯 + Injective 三位一体，打造下一代供应链金融基础设施

---

## 五、技术架构目标

```
                     ┌──────────────────────────────────┐
                     │      丽讯科技（物流场景层）         │
                     │   客户 · 行业场景 · 系统集成       │
                     └──────────────┬───────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    │                    AgentBL-AI                            │
    │                                                              │
    │  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
    │  │ AI 文档解析  │  │  自主 Agent      │  │  AI 合规检查     │  │
    │  │ 提单/发票/   │  │  编排器          │  │  MLETR/eUCP/    │  │
    │  │ 保险单       │  │  估值→定价→执行  │  │  制裁名单        │  │
    │  └──────┬───────┘  └────────┬────────┘  └────────┬─────────┘  │
    │         │                   │                     │            │
    │         └───────────────────┼─────────────────────┘            │
    │                             │                                  │
    │               ┌─────────────┴─────────────┐                   │
    │               │    AI 定价引擎 (Core)      │                   │
    │               │  pricingEngine · scoreRisk │                   │
    │               │  offeringSimulator · oracle│                   │
    │               └─────────────┬─────────────┘                   │
    │                             │                                  │
    └─────────────────────────────┼──────────────────────────────────┘
                                  │
    ┌─────────────────────────────┼──────────────────────────────────┐
    │                     ENI（可信文件底座）                         │
    │  文件唯一性 · 不可篡改 · 控制权 · 可审计 · 跨企业流转          │
    └─────────────────────────────┼──────────────────────────────────┘
                                  │
    ┌─────────────────────────────┼──────────────────────────────────┐
    │                 Injective 区块链                               │
    │  EBLRegistry · RWAOfferingPool · RiskPricingOracle             │
    │  INJ gas · Keplr wallet · on-chain audit trail                │
    └────────────────────────────────────────────────────────────────┘
```

---

## 六、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| inEVM 测试网不稳定 | 中 | 高 | 保留 Ethereum Sepolia 作为备用演示链 |
| LLM API 在比赛期间限流 | 中 | 中 | 确定性 fallback 引擎已就绪（全离线可跑） |
| ENI API 对接不及预期 | 低 | 中 | eBL 功能自包含，可独立演示 ENI 的价值 |
| 时间不足 | 高 | 高 | 严格按 P0→P1→P2 优先级执行，每阶段有可演示产出 |
| 评委不理解供应链金融 | 中 | 中 | 准备简化的类比解释（"海运版蚂蚁借呗"） |

---

## 七、总结

当前 AgentBL-AI 底子扎实（154 测试、完整定价引擎、前后端全链路），向 Injective + ENI + 丽讯科技方向转型的核心工作在于：

1. **链迁移**：Ethereum → Injective inEVM
2. **AI 升级**：按需调用 → 自主决策 Agent
3. **eBL 增强**：基础登记 → 完整流转 + 唯一性 + ENI 底座
4. **产品化**：单一 RWA 发行 → 多产品供应链金融平台

建议按 **P0（15天）→ P1（10天）→ P2（5天）** 的节奏推进，每阶段结束都有可演示的增量产出。核心故事线始终围绕 **"ENI 可信文件 + AI 自主定价 + Injective 链上执行"** 三位一体。
