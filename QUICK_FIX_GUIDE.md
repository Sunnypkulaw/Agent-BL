# RWA 铸造问题快速修复指南

## 🚀 立即执行的步骤

### 步骤 1: 升级 Node.js (必需)
```bash
# 当前版本 22.9.0 不兼容，需要升级到 22.13.0+
nvm install 22.13.0
nvm use 22.13.0

# 验证
node --version  # 应该显示 v22.13.0 或更高
```

### 步骤 2: 在浏览器中运行诊断

1. 打开项目: `http://localhost:3000` (或你的开发服务器地址)
2. 打开浏览器开发者工具 (F12)
3. 切换到 **Console** 标签
4. 粘贴并运行调试脚本:

```javascript
// 直接在浏览器控制台运行这个诊断函数
(async function diagnose() {
  console.log('🔍 开始诊断 RWA 铸造问题...\n');
  
  // 1. 检查 state
  if (typeof state === 'undefined') {
    console.error('❌ state 对象不存在');
    return;
  }
  
  console.log('✅ 当前 Case ID:', state.caseId);
  console.log('✅ 融资金额:', state.financingUsd);
  console.log('✅ 选择速度:', state.speed);
  
  // 2. 检查 quote
  const quote = state.comparison?.quotes?.find(q => q.payout_speed === state.speed);
  if (!quote) {
    console.error('❌ 未找到当前速度的 quote');
    console.log('可用的 quotes:', state.comparison?.quotes);
    return;
  }
  
  console.log('\n📊 Quote 数据:');
  console.log('  final_issue_price_usd:', quote.final_issue_price_usd);
  console.log('  recommended_token_supply:', quote.recommended_token_supply);
  console.log('  bl_id:', quote.bl_id);
  console.log('  quote_hash:', quote.quote_hash?.slice(0, 20) + '...');
  console.log('  evidence_hash:', quote.evidence_hash?.slice(0, 20) + '...');
  
  // 3. 模拟参数转换
  console.log('\n🔧 转换后的链上参数:');
  const issuePriceE6 = Math.round((quote.final_issue_price_usd || 0) * 1e6);
  const tokenSupply = Math.max(1, Math.round(quote.recommended_token_supply || 0));
  const financingUsd = Math.max(0, Math.round(state.financingUsd || 0));
  
  console.log('  issuePriceE6:', issuePriceE6);
  console.log('  tokenSupply:', tokenSupply);
  console.log('  financingUsd:', financingUsd);
  
  // 4. 检查问题
  console.log('\n⚠️  问题检查:');
  const problems = [];
  
  if (issuePriceE6 === 0) {
    problems.push('❌ 致命: issuePriceE6 = 0 (合约会拒绝)');
    console.error('  → final_issue_price_usd 是:', quote.final_issue_price_usd);
  }
  
  if (tokenSupply === 0) {
    problems.push('❌ 致命: tokenSupply = 0 (合约会拒绝)');
    console.error('  → recommended_token_supply 是:', quote.recommended_token_supply);
  }
  
  if (financingUsd === 0) {
    problems.push('⚠️  警告: 融资金额为 0');
  }
  
  if (!quote.quote_hash || !quote.quote_hash.startsWith('0x')) {
    problems.push('⚠️  警告: quote_hash 格式错误');
  }
  
  if (problems.length === 0) {
    console.log('  ✅ 参数看起来正常!');
    
    // 5. 检查钱包
    console.log('\n👛 钱包检查:');
    if (window.ethereum) {
      console.log('  MetaMask:', window.ethereum.selectedAddress || '未连接');
      console.log('  Chain ID:', window.ethereum.chainId, window.ethereum.chainId === '0x59f' ? '✅' : '❌ 应该是 0x59f');
      
      if (window.ethereum.selectedAddress) {
        const balance = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [window.ethereum.selectedAddress, 'latest']
        });
        const balanceInj = parseInt(balance, 16) / 1e18;
        console.log('  余额:', balanceInj.toFixed(4), 'INJ', balanceInj === 0 ? '❌ 需要测试币' : '✅');
        
        if (balanceInj === 0) {
          console.log('\n💡 从水龙头获取测试币:');
          console.log('   https://testnet.faucet.injective.network/');
        }
      }
    } else {
      console.error('  ❌ MetaMask 未安装');
    }
  } else {
    console.error('\n发现以下问题:');
    problems.forEach(p => console.error(p));
  }
  
  console.log('\n✅ 诊断完成!');
})();
```

### 步骤 3: 根据诊断结果采取行动

#### 如果显示 "issuePriceE6 = 0"

**原因**: `quote.final_issue_price_usd` 为空或无效

**修复**:
1. 检查后端 API 是否正常返回定价数据
2. 刷新页面重新加载 case 数据
3. 查看网络请求 (Network 标签) 中的 `/api/compare-speeds` 响应

#### 如果显示 "tokenSupply = 0"

**原因**: `quote.recommended_token_supply` 为空或无效

**修复**:
1. 同样检查后端 API 响应
2. 可能是 AI 定价引擎返回的数据不完整

#### 如果显示 "Chain ID 不正确"

**原因**: MetaMask 未连接到 Injective Testnet

**修复**:
```javascript
// 在控制台运行此代码，让 MetaMask 切换网络
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x59f',  // 1439 的十六进制
    chainName: 'Injective Testnet',
    nativeCurrency: { name: 'INJ', symbol: 'INJ', decimals: 18 },
    rpcUrls: ['https://testnet.sentry.chain.json-rpc.injective.network'],
    blockExplorerUrls: ['https://testnet.blockscout.injective.network']
  }]
});
```

#### 如果显示 "余额为 0"

**修复**:
1. 访问水龙头: https://testnet.faucet.injective.network/
2. 输入你的钱包地址
3. 领取测试币
4. 等待 1-2 分钟后刷新

### 步骤 4: 使用 Hardhat 测试合约

升级 Node.js 后，运行诊断脚本:

```bash
cd "d:\0-Document\University\PKU\Phd\Society\Blockchain\Competition\202606_Injective\AgentBL"

# 运行诊断脚本
node debug-mint.js
```

这将:
- ✅ 验证网络连接
- ✅ 检查合约部署状态
- ✅ 验证测试参数
- ✅ 估算 Gas（如果失败会显示 revert 原因）

### 步骤 5: 启用详细日志

临时修改 `public/web3.js` 中的 `mintOnChain` 函数 (第 451 行):

```javascript
export async function mintOnChain(quote, financingUsd, onConfirmed) {
  const cfg = await loadChainConfig();
  const contract = await getContract(true);
  const a = mintArgsFromQuote(quote, financingUsd);
  
  // ✅ 添加这些调试日志
  console.log('========== MINT DEBUG START ==========');
  console.log('Quote object:', quote);
  console.log('Financing USD:', financingUsd);
  console.log('Mint args:', {
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
  console.log('========== MINT DEBUG END ==========');
  
  let tx;
  try {
    tx = await contract.tokenize(
      a.blId, a.issuePriceE6, a.tokenSupply, a.financingUsd,
      a.collateralValueUsd, a.riskScoreBps, a.riskLevel, a.quoteHash, a.evidenceHash
    );
  } catch (e) {
    console.error('[mint] tokenize FAILED:', e);
    console.error('[mint] Error code:', e.code);
    console.error('[mint] Error message:', e.message);
    console.error('[mint] Error data:', e.data);  // ✅ 这个很重要
    if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) {
      throw err('REJECTED', '用户在钱包中拒绝了交易');
    }
    throw e;
  }
  // ... 其余代码
}
```

## 🎯 最可能的根本原因

根据代码分析，按概率排序:

### 1. **后端 API 返回的 quote 数据不完整** (60% 可能性)
- `final_issue_price_usd` 为 0 或 null
- `recommended_token_supply` 为 0 或 null

**验证方法**:
```javascript
// 在浏览器控制台运行
fetch('/api/compare-speeds', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ case: state.caseData })
})
  .then(r => r.json())
  .then(data => console.log('API Response:', data));
```

### 2. **MetaMask 网络配置错误** (25% 可能性)
- Chain ID 不是 1439
- RPC URL 不正确
- 网络拥堵或 RPC 节点故障

### 3. **Gas 不足** (10% 可能性)
- 钱包余额为 0
- Gas 估算失败

### 4. **合约 bug** (5% 可能性)
- 不太可能，因为合约已经部署且代码看起来正确

## 📝 需要收集的信息

为了进一步帮助你，请运行上面的诊断脚本并提供:

1. **诊断脚本的完整输出**
2. **Network 标签中 `/api/compare-speeds` 的响应**
3. **点击铸造按钮后 Console 中的所有错误**
4. **MetaMask 弹窗显示的内容**（截图）

## 🔗 有用的链接

- **区块浏览器**: https://testnet.blockscout.injective.network/address/0x3C6774d2D1ac6Bf35d08e5C9c84A233F5bc7f5Ce
- **你的交易**: https://testnet.blockscout.injective.network/tx/0xc789d475531547b4eed558aa1851e7a1910e16c2177e251261a32bab5e3ca26b
- **水龙头**: https://testnet.faucet.injective.network/
- **RPC 状态**: https://status.injective.network/

## ⚡ 快速测试清单

- [ ] Node.js 版本 ≥ 22.13.0
- [ ] 浏览器控制台运行诊断脚本
- [ ] MetaMask 已连接且 Chain ID = 0x59f
- [ ] 钱包有 INJ 测试币余额
- [ ] 后端 API 返回完整的 quote 数据
- [ ] `issuePriceE6 > 0`
- [ ] `tokenSupply > 0`
- [ ] 运行 `node debug-mint.js` 无错误

完成这些步骤后，问题应该会清晰显现！
