# RWA 铸造失败问题诊断报告

## 问题概述
- **交易 ID**: `0xc789d475531547b4eed558aa1851e7a1910e16c2177e251261a32bab5e3ca26b`
- **症状**: MetaMask 连接成功，但点击"铸造 rwa 上链"后显示"交互失败"
- **合约地址**: `0x3C6774d2D1ac6Bf35d08e5C9c84A233F5bc7f5Ce`
- **网络**: Injective Testnet (chainId: 1439)

## 已识别的潜在问题点

### 1. **Node.js 版本不兼容** ⚠️ 高优先级
```
当前版本: Node.js 22.9.0
要求版本: Node.js 22.13.0 或更高
```

**影响**: 
- 无法使用 Hardhat 进行链上交互测试
- 可能影响后端服务的稳定性

**修复方案**:
```bash
# 升级 Node.js 到 22.13.0 或更高版本
# 使用 nvm (推荐)
nvm install 22.13.0
nvm use 22.13.0

# 或直接下载安装
# https://nodejs.org/
```

### 2. **交易参数验证问题** 🔍

根据智能合约代码 (`hardhat/contracts/AgentBLRWA.sol`):

```solidity
function tokenize(
    string calldata blId,
    uint256 issuePriceE6,      // 价格必须 > 0
    uint256 tokenSupply,       // 供应量必须 > 0
    uint256 financingUsd,      // 融资金额
    uint256 collateralValueUsd,
    uint32  riskScoreBps,
    uint8   riskLevel,
    bytes32 quoteHash,
    bytes32 evidenceHash
) external returns (uint256 poolId, uint256 mintedAmount) {
    require(issuePriceE6 > 0, "issuePrice=0");  // ← 检查点 1
    require(tokenSupply > 0, "supply=0");       // ← 检查点 2
    // ...
}
```

**可能的失败原因**:
1. `issuePriceE6 = 0` - 价格转换错误
2. `tokenSupply = 0` - 供应量为 0
3. `quoteHash` 或 `evidenceHash` 为空
4. Gas 不足

### 3. **价格转换逻辑检查** 📊

查看 `public/web3.js` 第 421-432 行：

```javascript
export function mintArgsFromQuote(quote, financingUsd) {
  return {
    blId: quote.bl_id ?? quote.case_id ?? 'EBL-DEMO',
    issuePriceE6: BigInt(priceToE6(quote.final_issue_price_usd)),  // ← 关键转换
    tokenSupply: BigInt(Math.max(1, Math.round(quote.recommended_token_supply || 0))),
    financingUsd: BigInt(Math.max(0, Math.round(financingUsd || 0))),
    // ...
  };
}
```

**需要验证**:
- `quote.final_issue_price_usd` 是否有效
- `priceToE6()` 函数是否正确（应该将 0.848 转换为 848000）
- `quote.recommended_token_supply` 是否 > 0

### 4. **RPC 连接问题** 🌐

配置的 RPC:
```
https://testnet.sentry.chain.json-rpc.injective.network
```

**可能的问题**:
- RPC 节点不稳定
- 网络延迟
- 请求被限流

## 推荐的诊断步骤

### 步骤 1: 升级 Node.js
```bash
nvm install 22.13.0
nvm use 22.13.0
node --version  # 验证版本
```

### 步骤 2: 添加前端调试日志

在 `public/web3.js` 的 `mintOnChain` 函数中添加详细日志（第 451 行附近）:

```javascript
export async function mintOnChain(quote, financingUsd, onConfirmed) {
  const cfg = await loadChainConfig();
  const contract = await getContract(true);
  const a = mintArgsFromQuote(quote, financingUsd);
  
  // ✅ 添加调试日志
  console.log('[DEBUG] Mint arguments:', {
    blId: a.blId,
    issuePriceE6: a.issuePriceE6.toString(),
    tokenSupply: a.tokenSupply.toString(),
    financingUsd: a.financingUsd.toString(),
    collateralValueUsd: a.collateralValueUsd.toString(),
    riskScoreBps: a.riskScoreBps,
    riskLevel: a.riskLevel,
    quoteHash: a.quoteHash,
    evidenceHash: a.evidenceHash
  });
  
  // ✅ 验证参数
  if (a.issuePriceE6 === 0n) {
    throw new Error('Issue price is 0 - check quote.final_issue_price_usd');
  }
  if (a.tokenSupply === 0n) {
    throw new Error('Token supply is 0 - check quote.recommended_token_supply');
  }
  
  let tx;
  try {
    tx = await contract.tokenize(
      a.blId, a.issuePriceE6, a.tokenSupply, a.financingUsd,
      a.collateralValueUsd, a.riskScoreBps, a.riskLevel, a.quoteHash, a.evidenceHash
    );
  } catch (e) {
    console.error('[mint] tokenize FAILED:', e);
    console.error('[mint] Failed args:', a);  // ✅ 打印失败时的参数
    if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) {
      throw err('REJECTED', '用户在钱包中拒绝了交易');
    }
    throw e;
  }
  // ...
}
```

### 步骤 3: 检查 priceToE6 函数

找到 `public/format.js` 中的 `priceToE6` 函数并验证：

```javascript
// 应该类似这样
export function priceToE6(price) {
  return Math.round(Number(price) * 1e6);
}
```

### 步骤 4: 验证合约部署状态

```bash
cd hardhat

# 升级 Node.js 后执行
npx hardhat verify --network injective_testnet 0x3C6774d2D1ac6Bf35d08e5C9c84A233F5bc7f5Ce

# 或测试合约调用
npx hardhat console --network injective_testnet
```

在 Hardhat console 中：
```javascript
const AgentBLRWA = await ethers.getContractAt(
  "AgentBLRWA",
  "0x3C6774d2D1ac6Bf35d08e5C9c84A233F5bc7f5Ce"
);

// 检查 nextPoolId
const nextPoolId = await AgentBLRWA.nextPoolId();
console.log("Next Pool ID:", nextPoolId.toString());

// 尝试一个测试铸造
const tx = await AgentBLRWA.tokenize(
  "TEST-BL-001",
  848000n,      // $0.848
  1000n,        // 1000 tokens
  500n,         // $500 financing
  2500000n,     // $2,500,000 collateral
  450,          // 450 bps risk
  1,            // MEDIUM risk level
  "0x" + "a".repeat(64),  // dummy quote hash
  "0x" + "b".repeat(64)   // dummy evidence hash
);
console.log("Test TX:", tx.hash);
await tx.wait();
```

### 步骤 5: 浏览器控制台检查

打开浏览器 DevTools (F12)，在点击"铸造 rwa 上链"之前：

1. 切换到 Console 标签
2. 点击按钮
3. 查看所有错误信息，特别是：
   - `[mint]` 开头的日志
   - MetaMask 错误
   - 网络请求失败

### 步骤 6: 检查 MetaMask 设置

1. **网络配置**:
   - 网络名称: Injective Testnet
   - RPC URL: `https://testnet.sentry.chain.json-rpc.injective.network`
   - Chain ID: `1439` (十进制) 或 `0x59f` (十六进制)
   - 货币符号: INJ

2. **Gas 设置**: 确保有足够的 INJ 测试币
   - 水龙头: https://testnet.faucet.injective.network/

3. **账户权限**: 检查账户是否正确连接到网站

## 快速修复清单 ✅

- [ ] 升级 Node.js 到 22.13.0+
- [ ] 在浏览器控制台查看完整错误信息
- [ ] 验证 MetaMask 网络配置 (Chain ID: 1439)
- [ ] 确认钱包有足够的 INJ 测试币
- [ ] 添加前端调试日志到 `public/web3.js`
- [ ] 检查 `priceToE6` 函数实现
- [ ] 使用 Hardhat console 测试合约直接调用
- [ ] 检查交易失败的具体 revert 原因

## 最可能的问题 🎯

根据代码分析，最可能的问题是：

1. **价格转换错误**: `issuePriceE6` 为 0
2. **供应量为 0**: `recommended_token_supply` 未正确传递
3. **Gas 不足**: MetaMask 估算的 gas 不够
4. **RPC 连接失败**: 网络不稳定导致交易提交失败

## 下一步行动

1. **立即**: 在浏览器控制台复现问题，截图完整错误信息
2. **短期**: 添加调试日志，定位具体失败参数
3. **长期**: 添加前端参数验证和更友好的错误提示

---

## 需要你提供的信息

为了进一步诊断，请提供：

1. **浏览器控制台的完整错误日志**（点击铸造按钮后）
2. **MetaMask 弹窗显示的错误信息**（如果有）
3. **当前选择的交易案例详情**（quote 对象的内容）
4. **融资金额**（你输入的数字）

可以在浏览器控制台运行：
```javascript
// 导出当前状态
console.log('Current Quote:', JSON.stringify(state.comparison?.quotes, null, 2));
console.log('Selected Speed:', state.speed);
console.log('Financing USD:', state.financingUsd);
```
