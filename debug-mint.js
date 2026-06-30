/**
 * RWA 铸造调试脚本
 * 用于测试合约调用和诊断交易失败原因
 *
 * 使用方法:
 *   node debug-mint.js
 */

const { ethers } = require('hardhat');

const CONTRACT_ADDRESS = '0x3C6774d2D1ac6Bf35d08e5C9c84A233F5bc7f5Ce';

// 测试数据 - 模拟一个典型的铸造参数
const TEST_MINT_ARGS = {
  blId: 'EBL-2026-CU-04417',
  issuePriceE6: 848000n,           // $0.848
  tokenSupply: 2941176n,           // ~2.94M tokens
  financingUsd: 500000n,           // $500,000
  collateralValueUsd: 2500000n,    // $2,500,000
  riskScoreBps: 450,               // 450 bps
  riskLevel: 1,                    // MEDIUM
  quoteHash: '0x' + 'a'.repeat(64),
  evidenceHash: '0x' + 'b'.repeat(64)
};

async function main() {
  console.log('🔍 RWA 铸造调试脚本\n');
  console.log('═'.repeat(60));

  // 1. 检查网络连接
  console.log('\n📡 检查网络连接...');
  const provider = ethers.provider;
  try {
    const network = await provider.getNetwork();
    console.log(`✅ 已连接到网络: ${network.name} (chainId: ${network.chainId})`);

    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ 当前区块高度: ${blockNumber}`);
  } catch (error) {
    console.error('❌ 网络连接失败:', error.message);
    process.exit(1);
  }

  // 2. 获取签名者信息
  console.log('\n👤 检查签名者账户...');
  const [signer] = await ethers.getSigners();
  const address = await signer.getAddress();
  console.log(`✅ 账户地址: ${address}`);

  const balance = await provider.getBalance(address);
  console.log(`💰 账户余额: ${ethers.formatEther(balance)} INJ`);

  if (balance === 0n) {
    console.warn('⚠️  警告: 账户余额为 0，需要从水龙头获取测试币');
    console.log('   水龙头: https://testnet.faucet.injective.network/');
  }

  // 3. 检查合约部署
  console.log('\n📜 检查合约状态...');
  const code = await provider.getCode(CONTRACT_ADDRESS);
  if (code === '0x') {
    console.error(`❌ 合约未部署到地址: ${CONTRACT_ADDRESS}`);
    process.exit(1);
  }
  console.log(`✅ 合约已部署 (字节码长度: ${code.length} bytes)`);

  // 4. 连接合约
  console.log('\n🔗 连接到 AgentBLRWA 合约...');
  const AgentBLRWA = await ethers.getContractAt('AgentBLRWA', CONTRACT_ADDRESS);

  // 检查 nextPoolId
  const nextPoolId = await AgentBLRWA.nextPoolId();
  console.log(`✅ 下一个 Pool ID: ${nextPoolId}`);

  // 5. 验证测试参数
  console.log('\n🧪 验证测试参数...');
  console.log('测试铸造参数:');
  console.log('  - eBL ID:', TEST_MINT_ARGS.blId);
  console.log('  - 发行价格:', ethers.formatUnits(TEST_MINT_ARGS.issuePriceE6, 6), 'USD');
  console.log('  - 代币供应:', TEST_MINT_ARGS.tokenSupply.toString());
  console.log('  - 融资金额:', TEST_MINT_ARGS.financingUsd.toString(), 'USD');
  console.log('  - 抵押品价值:', TEST_MINT_ARGS.collateralValueUsd.toString(), 'USD');
  console.log('  - 风险分数:', TEST_MINT_ARGS.riskScoreBps, 'bps');
  console.log('  - 风险等级:', TEST_MINT_ARGS.riskLevel, '(1=MEDIUM)');

  // 计算预期铸造量
  const expectedMint = TEST_MINT_ARGS.financingUsd * 1_000_000n / TEST_MINT_ARGS.issuePriceE6;
  console.log('  - 预期铸造:', expectedMint.toString(), 'RWA tokens');

  // 参数验证
  if (TEST_MINT_ARGS.issuePriceE6 === 0n) {
    console.error('❌ 错误: issuePriceE6 不能为 0');
    process.exit(1);
  }
  if (TEST_MINT_ARGS.tokenSupply === 0n) {
    console.error('❌ 错误: tokenSupply 不能为 0');
    process.exit(1);
  }
  console.log('✅ 参数验证通过');

  // 6. 估算 Gas
  console.log('\n⛽ 估算 Gas...');
  try {
    const gasEstimate = await AgentBLRWA.tokenize.estimateGas(
      TEST_MINT_ARGS.blId,
      TEST_MINT_ARGS.issuePriceE6,
      TEST_MINT_ARGS.tokenSupply,
      TEST_MINT_ARGS.financingUsd,
      TEST_MINT_ARGS.collateralValueUsd,
      TEST_MINT_ARGS.riskScoreBps,
      TEST_MINT_ARGS.riskLevel,
      TEST_MINT_ARGS.quoteHash,
      TEST_MINT_ARGS.evidenceHash
    );
    console.log(`✅ 预估 Gas: ${gasEstimate.toString()}`);

    const feeData = await provider.getFeeData();
    const estimatedCost = gasEstimate * (feeData.gasPrice || 0n);
    console.log(`💵 预估费用: ${ethers.formatEther(estimatedCost)} INJ`);

    if (balance < estimatedCost) {
      console.error('❌ 错误: 账户余额不足以支付 Gas 费用');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Gas 估算失败:', error.message);
    if (error.data) {
      console.error('   Revert 数据:', error.data);
    }
    if (error.reason) {
      console.error('   失败原因:', error.reason);
    }
    console.log('\n💡 这可能表明交易会失败。常见原因:');
    console.log('   1. 合约 require 检查失败 (如 issuePriceE6=0 或 supply=0)');
    console.log('   2. 参数类型不匹配');
    console.log('   3. 合约逻辑错误');
    process.exit(1);
  }

  // 7. 执行测试铸造（可选）
  console.log('\n🚀 执行测试铸造...');
  console.log('⚠️  这将发送真实的链上交易！');

  // 取消注释以下代码来执行真实交易
  /*
  try {
    console.log('📤 发送交易...');
    const tx = await AgentBLRWA.tokenize(
      TEST_MINT_ARGS.blId,
      TEST_MINT_ARGS.issuePriceE6,
      TEST_MINT_ARGS.tokenSupply,
      TEST_MINT_ARGS.financingUsd,
      TEST_MINT_ARGS.collateralValueUsd,
      TEST_MINT_ARGS.riskScoreBps,
      TEST_MINT_ARGS.riskLevel,
      TEST_MINT_ARGS.quoteHash,
      TEST_MINT_ARGS.evidenceHash
    );

    console.log(`✅ 交易已发送: ${tx.hash}`);
    console.log('⏳ 等待确认...');

    const receipt = await tx.wait();
    console.log(`✅ 交易已确认! 区块: ${receipt.blockNumber}`);

    // 解析事件
    for (const log of receipt.logs) {
      try {
        const parsed = AgentBLRWA.interface.parseLog(log);
        if (parsed.name === 'Tokenized') {
          console.log('\n🎉 铸造成功!');
          console.log('  - Pool ID:', parsed.args.poolId.toString());
          console.log('  - 铸造数量:', parsed.args.mintedAmount.toString());
          console.log('  - 创建者:', parsed.args.creator);
        }
      } catch {}
    }

    console.log(`\n🔗 浏览器查看: https://testnet.blockscout.injective.network/tx/${tx.hash}`);
  } catch (error) {
    console.error('❌ 交易失败:', error.message);
    if (error.data) {
      console.error('   错误数据:', error.data);
    }
    if (error.reason) {
      console.error('   失败原因:', error.reason);
    }
    process.exit(1);
  }
  */

  console.log('\n✅ 调试完成！');
  console.log('\n💡 提示:');
  console.log('   - 如果 Gas 估算成功，说明合约调用参数正确');
  console.log('   - 如果 Gas 估算失败，检查错误信息中的 revert 原因');
  console.log('   - 取消注释上面的代码可以执行真实的测试铸造');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 脚本执行失败:', error);
    process.exit(1);
  });
