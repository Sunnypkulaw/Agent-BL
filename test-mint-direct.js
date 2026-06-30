/**
 * 直接通过 Hardhat 测试铸造功能
 * 绕过浏览器和 MetaMask，直接与合约交互
 *
 * 使用方法:
 *   cd d:\0-Document\University\PKU\Phd\Society\Blockchain\Competition\202606_Injective\AgentBL
 *   node test-mint-direct.js
 */

const { ethers } = require('hardhat');

const CONTRACT_ADDRESS = '0x3C6774d2D1ac6Bf35d08e5C9c84A233F5bc7f5Ce';

// 使用你截图中的真实数据
const REAL_MINT_ARGS = {
  blId: 'EBL-2026-CU-04417',
  issuePriceE6: 849100n,           // 0.8491 USD
  tokenSupply: 3891050n,           // 3,891,050 tokens
  financingUsd: 3300000n,          // $3,300,000
  collateralValueUsd: 6531250n,    // $6,531,250
  riskScoreBps: 350,               // 350 bps
  riskLevel: 1,                    // MEDIUM
  quoteHash: '0x7f887fe64c302f63d584cfc0095c5a0809d7faf8cc0a92618588ca0073af207a',
  evidenceHash: '0x2787720faa7d963652df19e9068ae65db93b0a1e523d462d9aaa44b24d821ce87'
};

async function main() {
  console.log('🚀 直接铸造测试（绕过 MetaMask）\n');
  console.log('═'.repeat(70));

  try {
    // 1. 连接网络
    console.log('📡 连接到 Injective Testnet...');
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    console.log(`✅ 网络: ${network.name} (chainId: ${network.chainId})`);

    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ 当前区块: ${blockNumber}\n`);

    // 2. 获取签名者
    console.log('👤 获取签名者账户...');
    const [signer] = await ethers.getSigners();
    const address = await signer.getAddress();
    console.log(`✅ 地址: ${address}`);

    const balance = await provider.getBalance(address);
    console.log(`💰 余额: ${ethers.formatEther(balance)} INJ\n`);

    if (balance === 0n) {
      console.error('❌ 余额为 0，请从水龙头获取测试币');
      console.log('🔗 https://testnet.faucet.injective.network/');
      process.exit(1);
    }

    // 3. 连接合约
    console.log('📜 连接到 AgentBLRWA 合约...');
    const AgentBLRWA = await ethers.getContractAt('AgentBLRWA', CONTRACT_ADDRESS);
    console.log(`✅ 合约地址: ${CONTRACT_ADDRESS}\n`);

    // 4. 显示铸造参数
    console.log('🔧 铸造参数:');
    console.log('  - blId:', REAL_MINT_ARGS.blId);
    console.log('  - issuePriceE6:', REAL_MINT_ARGS.issuePriceE6.toString(), '($' + (Number(REAL_MINT_ARGS.issuePriceE6) / 1e6).toFixed(4) + ')');
    console.log('  - tokenSupply:', REAL_MINT_ARGS.tokenSupply.toString());
    console.log('  - financingUsd:', REAL_MINT_ARGS.financingUsd.toString());
    console.log('  - collateralValueUsd:', REAL_MINT_ARGS.collateralValueUsd.toString());
    console.log('  - riskScoreBps:', REAL_MINT_ARGS.riskScoreBps);
    console.log('  - riskLevel:', REAL_MINT_ARGS.riskLevel);
    console.log('  - quoteHash:', REAL_MINT_ARGS.quoteHash);
    console.log('  - evidenceHash:', REAL_MINT_ARGS.evidenceHash);

    const expectedMint = REAL_MINT_ARGS.financingUsd * 1_000_000n / REAL_MINT_ARGS.issuePriceE6;
    console.log('  - 预期铸造:', expectedMint.toString(), 'RWA tokens\n');

    // 5. 估算 Gas
    console.log('⛽ 估算 Gas...');
    try {
      const gasEstimate = await AgentBLRWA.tokenize.estimateGas(
        REAL_MINT_ARGS.blId,
        REAL_MINT_ARGS.issuePriceE6,
        REAL_MINT_ARGS.tokenSupply,
        REAL_MINT_ARGS.financingUsd,
        REAL_MINT_ARGS.collateralValueUsd,
        REAL_MINT_ARGS.riskScoreBps,
        REAL_MINT_ARGS.riskLevel,
        REAL_MINT_ARGS.quoteHash,
        REAL_MINT_ARGS.evidenceHash
      );
      console.log(`✅ 预估 Gas: ${gasEstimate.toString()}`);

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;
      console.log(`💵 Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);

      const estimatedCost = gasEstimate * gasPrice;
      console.log(`💵 预估费用: ${ethers.formatEther(estimatedCost)} INJ\n`);
    } catch (error) {
      console.error('❌ Gas 估算失败:', error.message);
      if (error.data) {
        console.error('   Revert 数据:', error.data);
      }
      if (error.reason) {
        console.error('   失败原因:', error.reason);
      }
      console.log('\n💡 这表明合约会拒绝此交易。常见原因:');
      console.log('   1. issuePriceE6 = 0');
      console.log('   2. tokenSupply = 0');
      console.log('   3. 合约逻辑错误');
      process.exit(1);
    }

    // 6. 执行铸造
    console.log('🚀 发送铸造交易...');
    console.log('⏳ 这可能需要 10-30 秒...\n');

    const tx = await AgentBLRWA.tokenize(
      REAL_MINT_ARGS.blId,
      REAL_MINT_ARGS.issuePriceE6,
      REAL_MINT_ARGS.tokenSupply,
      REAL_MINT_ARGS.financingUsd,
      REAL_MINT_ARGS.collateralValueUsd,
      REAL_MINT_ARGS.riskScoreBps,
      REAL_MINT_ARGS.riskLevel,
      REAL_MINT_ARGS.quoteHash,
      REAL_MINT_ARGS.evidenceHash,
      {
        gasLimit: 500000n // 使用固定 gas limit
      }
    );

    console.log('✅ 交易已发送!');
    console.log('📝 交易哈希:', tx.hash);
    console.log('🔗 区块浏览器:', `https://testnet.blockscout.injective.network/tx/${tx.hash}`);
    console.log('\n⏳ 等待确认...');

    const receipt = await tx.wait();

    console.log('\n🎉 交易已确认!');
    console.log('═'.repeat(70));
    console.log('📊 交易详情:');
    console.log('  - 区块号:', receipt.blockNumber);
    console.log('  - Gas 使用:', receipt.gasUsed.toString());
    console.log('  - 状态:', receipt.status === 1 ? '✅ 成功' : '❌ 失败');

    // 7. 解析事件
    console.log('\n📋 事件日志:');
    let poolId = null;
    let mintedAmount = null;

    for (const log of receipt.logs) {
      try {
        const parsed = AgentBLRWA.interface.parseLog(log);
        if (parsed.name === 'Tokenized') {
          poolId = parsed.args.poolId;
          mintedAmount = parsed.args.mintedAmount;

          console.log('  ✅ Tokenized 事件:');
          console.log('     - Pool ID:', poolId.toString());
          console.log('     - 铸造数量:', mintedAmount.toString());
          console.log('     - 创建者:', parsed.args.creator);
          console.log('     - eBL ID:', parsed.args.blId);
          console.log('     - 发行价格:', (Number(parsed.args.issuePriceE6) / 1e6).toFixed(4), 'USD');
        }
      } catch (e) {
        // 跳过无法解析的日志
      }
    }

    if (poolId !== null) {
      console.log('\n🎊 铸造成功!');
      console.log('═'.repeat(70));
      console.log('🆔 Pool ID:', poolId.toString());
      console.log('💎 铸造数量:', mintedAmount.toString(), 'RWA');
      console.log('🔗 查看交易:', `https://testnet.blockscout.injective.network/tx/${tx.hash}`);
      console.log('═'.repeat(70));
    } else {
      console.log('\n⚠️  交易已确认，但未找到 Tokenized 事件');
    }

  } catch (error) {
    console.error('\n💥 交易失败!');
    console.error('═'.repeat(70));
    console.error('错误类型:', error.constructor.name);
    console.error('错误信息:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    if (error.data) {
      console.error('错误数据:', error.data);
    }
    if (error.reason) {
      console.error('失败原因:', error.reason);
    }
    if (error.transaction) {
      console.error('交易:', error.transaction);
    }
    console.error('═'.repeat(70));
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('\n✅ 测试完成!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 脚本执行失败:', error);
    process.exit(1);
  });
