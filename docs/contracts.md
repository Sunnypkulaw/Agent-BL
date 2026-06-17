# TradeShield Web3 Contract Interface

状态：WEB3-1 ~ WEB3-4 设计冻结  
命名来源：以 `docs/PRD.md` v0.2 和 `docs/tasks.md` 为准  
范围：先定义可被 JS contract mock、Hardhat 合约和前端共同复用的最小接口，不做公开募资、不做 AMM、不承诺保本收益。

## 1. 设计目标

Web3 / Contract 层只解决一件事：

```text
AI Pricing & Risk Agent 输出 PricingQuote / RiskReport
→ RiskPricingOracle 记录价格、风险动作和证据哈希
→ RWAOfferingPool 根据动作开放认购、改价、暂停、冻结或清算
→ 前端和测试能验证链上事件与状态变化
```

MVP 不追求复杂金融合约，优先保证：

1. eBL 质押关系可记录；
2. RWA 份额凭证可 mint；
3. RWA offering 状态机可跑通；
4. AI 定价与风险证据可通过 event 审计；
5. 所有接口能被现有 Harness 和后续 Hardhat 测试验证。

## 2. 共同约定

### 2.1 金额与价格单位

Solidity 实现中避免浮点数：

| 字段 | 建议单位 |
|---|---|
| `issuePrice` | 6 decimals，例如 `0.80 USD` 记为 `800000` |
| `targetRedemptionValue` | 6 decimals，例如 `1.00 USD` 记为 `1000000` |
| `tokenSupply` / `amount` | RWA token 最小单位，MVP 可按 whole token 处理 |

JS mock 可以保留人类可读的 `0.8` / `1`，但 Hardhat 合约测试应使用整数单位。

### 2.2 风险等级枚举

链上用 `uint8 riskLevel`，JS 层负责把字符串映射为数字。

| uint8 | Risk level |
|---:|---|
| 0 | LOW |
| 1 | MEDIUM |
| 2 | WARNING |
| 3 | CRITICAL |

### 2.3 定价动作枚举

链上用 `uint8 action`，JS 层维护 `contract_action` / `pricing_action` 映射。

| uint8 | PRD `pricing_action` | Harness `contract_action` | 链上语义 |
|---:|---|---|---|
| 0 | OPEN_OFFERING | APPROVE_FINANCING | 开放认购 |
| 1 | OPEN_WITH_WARNING | CONTINUE_WITH_WARNING | 带警告继续 |
| 2 | REPRICE_DOWN | TRIGGER_MARGIN_CALL | 降价 / 追加保证金 |
| 3 | PAUSE_OFFERING | FREEZE_POOL | 暂停发行 |
| 4 | FREEZE_POOL | FREEZE_POOL | 冻结池子 |
| 5 | TRIGGER_LIQUIDATION | TRIGGER_LIQUIDATION | 进入清算 |

### 2.4 哈希字段

| 字段 | 类型 | 含义 |
|---|---|---|
| `evidenceHash` | `bytes32` | AI 定价 / 风险证据包哈希 |
| `quoteHash` | `bytes32` | `PricingQuote` 结构化输出哈希 |
| `metadataHash` | `bytes32` | eBL 元数据 / 文件摘要 |

所有哈希在 JS 中应表现为 `0x` + 64 位 hex。

## 3. WEB3-1：EBLRegistry

### 3.1 目的

`EBLRegistry` 记录电子提单凭证和质押关系。它不是 NFT 市场，也不处理真实 eBL 平台法律转让；MVP 只做可验证的登记、质押和解除质押状态。

### 3.2 Interface

```solidity
interface IEBLRegistry {
    event EBLMinted(
        uint256 indexed eblId,
        bytes32 indexed metadataHash,
        address indexed holder
    );

    event EBLPledged(
        uint256 indexed eblId,
        address indexed pool,
        address indexed holder
    );

    event EBLPledgeReleased(
        uint256 indexed eblId,
        address indexed pool,
        address indexed holder
    );

    function mintEBL(bytes32 metadataHash, address holder)
        external
        returns (uint256 eblId);

    function pledge(uint256 eblId, address pool) external;

    function releasePledge(uint256 eblId) external;

    function holderOf(uint256 eblId) external view returns (address);

    function pledgedTo(uint256 eblId) external view returns (address);

    function metadataHashOf(uint256 eblId) external view returns (bytes32);
}
```

### 3.3 权限和约束

| 操作 | 权限 | 约束 |
|---|---|---|
| `mintEBL` | registry owner / authorized issuer | `metadataHash != 0`, `holder != address(0)` |
| `pledge` | eBL holder 或授权 pool factory | eBL 必须存在，不能重复质押 |
| `releasePledge` | 当前 pledgee pool 或 registry owner | eBL 必须已质押 |

## 4. WEB3-2：RWAToken

### 4.1 目的

`RWAToken` 表示投资者认购某个 RWA offering 后获得的份额凭证。它不是公开交易代币；MVP 中只允许 `RWAOfferingPool` mint，并保留 permissioned transfer 的扩展口。

### 4.2 Interface

```solidity
interface IRWAToken {
    event RWAMinted(
        uint256 indexed poolId,
        address indexed investor,
        uint256 amount
    );

    event TransferPermissionSet(
        address indexed account,
        bool allowed
    );

    function mint(uint256 poolId, address investor, uint256 amount) external;

    function balanceOf(uint256 poolId, address investor)
        external
        view
        returns (uint256);

    function totalSupply(uint256 poolId) external view returns (uint256);

    function setTransferPermission(address account, bool allowed) external;

    function isTransferAllowed(address account) external view returns (bool);
}
```

### 4.3 权限和约束

| 操作 | 权限 | 约束 |
|---|---|---|
| `mint` | only `RWAOfferingPool` | investor 必须是 permissioned，amount > 0 |
| `setTransferPermission` | owner / compliance operator | MVP 可只记录，不开放二级市场 |

## 5. WEB3-3：RWAOfferingPool

### 5.1 目的

`RWAOfferingPool` 管理 eBL-backed RWA 的发行、认购、改价、暂停和结算状态。它消费 AI 定价结果，但不自己计算风险。

### 5.2 状态机

```text
Created
→ Priced
→ Open
→ Subscribed
→ Funded
→ InTransit
→ Repriced / Paused / Frozen
→ Repaid / Redeemed / Liquidation / Cancelled
```

### 5.3 Interface

```solidity
interface IRWAOfferingPool {
    enum OfferingState {
        Created,
        Priced,
        Open,
        Subscribed,
        Funded,
        InTransit,
        Repriced,
        Paused,
        Frozen,
        Repaid,
        Redeemed,
        Liquidation,
        Cancelled
    }

    event OfferingCreated(
        uint256 indexed poolId,
        uint256 indexed eblId,
        uint256 tokenSupply,
        uint256 issuePrice,
        uint256 targetRedemptionValue
    );

    event Subscribed(
        uint256 indexed poolId,
        address indexed investor,
        uint256 amount,
        uint256 paidAmount
    );

    event OfferingRepriced(
        uint256 indexed poolId,
        uint256 oldIssuePrice,
        uint256 newIssuePrice,
        bytes32 evidenceHash,
        bytes32 quoteHash
    );

    event OfferingPaused(uint256 indexed poolId, bytes32 evidenceHash);

    event OfferingStateChanged(
        uint256 indexed poolId,
        OfferingState oldState,
        OfferingState newState,
        uint8 action
    );

    event OfferingSettled(uint256 indexed poolId, uint256 repaymentAmount);

    function createOffering(
        uint256 eblId,
        uint256 tokenSupply,
        uint256 issuePrice,
        uint256 targetRedemptionValue
    ) external returns (uint256 poolId);

    function subscribe(uint256 poolId, uint256 amount) external;

    function pauseOffering(uint256 poolId) external;

    function applyPricingAction(
        uint256 poolId,
        uint256 newIssuePrice,
        uint8 action,
        bytes32 evidenceHash,
        bytes32 quoteHash
    ) external;

    function settle(uint256 poolId, uint256 repaymentAmount) external;

    function stateOf(uint256 poolId) external view returns (OfferingState);
}
```

### 5.4 权限和约束

| 操作 | 权限 | 约束 |
|---|---|---|
| `createOffering` | pool factory / exporter operator | eBL 必须已登记，issuePrice > 0 |
| `subscribe` | permissioned investor | pool 必须 Open / Repriced，amount > 0 |
| `pauseOffering` | owner / oracle / risk operator | pool 不能已结算 |
| `applyPricingAction` | only `RiskPricingOracle` 或 risk operator | action 必须合法，hash 必须非空 |
| `settle` | pool operator | pool 必须 Funded / InTransit / Repaid path |

### 5.5 Action 到状态转换

| action | 目标状态 |
|---|---|
| OPEN_OFFERING | Open |
| OPEN_WITH_WARNING | Open 或 Repriced |
| REPRICE_DOWN | Repriced |
| PAUSE_OFFERING | Paused |
| FREEZE_POOL | Frozen |
| TRIGGER_LIQUIDATION | Liquidation |

## 6. WEB3-4：RiskPricingOracle

### 6.1 目的

`RiskPricingOracle` 把 AI 的 `PricingQuote` 和风险动作写成链上事件，并把动作转发给 `RWAOfferingPool`。它不负责生成 AI 结果，只负责记录、鉴权和触发状态变化。

### 6.2 Interface

```solidity
interface IRiskPricingOracle {
    event PricingUpdated(
        uint256 indexed poolId,
        uint256 issuePrice,
        uint8 riskLevel,
        uint8 action,
        bytes32 evidenceHash,
        bytes32 quoteHash,
        address indexed updater
    );

    event UpdaterSet(address indexed updater, bool allowed);

    function updatePricing(
        uint256 poolId,
        uint256 issuePrice,
        uint8 riskLevel,
        uint8 action,
        bytes32 evidenceHash,
        bytes32 quoteHash
    ) external;

    function setUpdater(address updater, bool allowed) external;

    function isUpdater(address updater) external view returns (bool);

    function latestQuoteHash(uint256 poolId) external view returns (bytes32);

    function latestEvidenceHash(uint256 poolId) external view returns (bytes32);
}
```

### 6.3 权限和约束

| 操作 | 权限 | 约束 |
|---|---|---|
| `updatePricing` | authorized AI pricing updater | poolId 必须存在，issuePrice > 0，hash 非空 |
| `setUpdater` | owner / governance | updater != address(0) |

### 6.4 与 RWAOfferingPool 的关系

`updatePricing` 应做两件事：

1. emit `PricingUpdated`，把 `issuePrice`、`riskLevel`、`action`、`evidenceHash`、`quoteHash` 留痕；
2. 调用或允许后续调用 `RWAOfferingPool.applyPricingAction(...)`，让 offering 状态变化。

MVP 可以先把第 2 步放在 JS mock 或测试脚本中完成；Solidity 最小版本优先保证 event 可测。

## 7. WEB3-1 ~ WEB3-4 完成定义

| ID | 完成定义 | Evidence |
|---|---|---|
| WEB3-1 | `EBLRegistry` interface、事件、权限、约束明确 | `docs/contracts.md` §3 |
| WEB3-2 | `RWAToken` interface、mint 权限、permissioned 约束明确 | `docs/contracts.md` §4 |
| WEB3-3 | `RWAOfferingPool` interface、状态机、action 转换明确 | `docs/contracts.md` §5 |
| WEB3-4 | `RiskPricingOracle` interface、`PricingUpdated` event、updater 权限明确 | `docs/contracts.md` §6 |

后续 WEB3-5 的 JS contract mock 和 WEB3-6 ~ WEB3-9 的 Hardhat 合约必须对齐本文件。
