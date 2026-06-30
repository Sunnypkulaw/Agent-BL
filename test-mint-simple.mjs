/**
 * 直接使用 ethers.js 测试铸造
 * 不依赖 hardhat，直接连接 RPC
 */

import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTRACT_ADDRESS = '0x3C6774d2D1ac6Bf35d08e5C9c84A233F5bc7f5Ce';
const RPC_URLS = [
  'https://k8s.testnet.json-rpc.injective.network',
  'https://testnet.sentry.chain.json-rpc.injective.network'
];
const SUBMIT_RPC_URL = RPC_URLS[0];
const RECEIPT_TIMEOUT_MS = 120_000;
const RECEIPT_POLL_MS = 2_000;
const RPC_CALL_TIMEOUT_MS = 5_000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Injective testnet RPC nodes can share the same canonical block while one
 * node's transaction/receipt index temporarily returns null. Poll every
 * configured endpoint and use the first confirmed receipt.
 */
async function waitForReceiptWithFallback(txHash, providers) {
  const deadline = Date.now() + RECEIPT_TIMEOUT_MS;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    const results = await Promise.allSettled(providers.map((provider) => Promise.race([
      provider.getTransactionReceipt(txHash),
      delay(RPC_CALL_TIMEOUT_MS).then(() => { throw new Error('RPC call timed out'); })
    ])));

    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status === 'fulfilled' && result.value) {
        return { receipt: result.value, rpcUrl: RPC_URLS[index], attempts };
      }
      if (result.status === 'rejected') {
        console.warn(`⚠️  Receipt RPC ${index + 1} 暂时不可用: ${result.reason?.message ?? result.reason}`);
      }
    }
    await delay(RECEIPT_POLL_MS);
  }

  throw new Error(
    `交易已广播，但 ${RECEIPT_TIMEOUT_MS / 1000} 秒内所有 RPC 均未返回 receipt；请通过区块浏览器按交易哈希确认`
  );
}

function createReceiptProviders() {
  return RPC_URLS.map((url) => new ethers.JsonRpcProvider(url, 1439, { staticNetwork: true }));
}

function printReceiptDetails(receipt, abi, confirmation) {
  console.log('\n🎉 交易已确认!');
  console.log('═'.repeat(70));
  console.log('📊 交易详情:');
  console.log('  - 确认 RPC:', confirmation.rpcUrl);
  console.log('  - 轮询次数:', confirmation.attempts);
  console.log('  - 区块号:', receipt.blockNumber);
  console.log('  - Gas 使用:', receipt.gasUsed.toString());
  console.log('  - 状态:', receipt.status === 1 ? '✅ 成功' : '❌ 失败');

  const contractInterface = new ethers.Interface(abi);
  console.log('\n📋 事件:');
  for (const log of receipt.logs) {
    try {
      const parsed = contractInterface.parseLog(log);
      if (parsed && parsed.name === 'Tokenized') {
        console.log('  ✅ Tokenized 事件:');
        console.log('     - Pool ID:', parsed.args.poolId.toString());
        console.log('     - 铸造数量:', parsed.args.mintedAmount.toString());
        console.log('     - 创建者:', parsed.args.creator);
        console.log('     - eBL ID:', parsed.args.blId);
      }
    } catch {
      // 忽略其他合约或无法解析的日志
    }
  }
}

// 从 .env 读取私钥
function loadPrivateKey() {
  try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/DEPLOYER_PRIVATE_KEY\s*=\s*(.+)/);
    if (match) {
      return match[1].trim().replace(/['"]/g, '');
    }
  } catch (e) {
    console.error('❌ 无法读取 .env 文件:', e.message);
  }
  return null;
}

// 从 chain-config.json 读取 ABI
function loadContractABI() {
  try {
    const configPath = join(__dirname, 'public', 'chain-config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    return config.networks['injective-testnet'].abis.AgentBLRWA;
  } catch (e) {
    console.error('❌ 无法读取 ABI:', e.message);
    return null;
  }
}

// 使用截图中的真实参数（修正 evidenceHash 长度）
const MINT_ARGS = {
  blId: 'EBL-2026-CU-04417',
  issuePriceE6: 849100n,
  tokenSupply: 3891050n,
  financingUsd: 3300000n,
  collateralValueUsd: 6531250n,
  riskScoreBps: 350,
  riskLevel: 1,
  quoteHash: '0x7f887fe64c302f63d584cfc0095c5a0809d7faf8cc0a92618588ca0073af207a',
  evidenceHash: '0x2787720faa7d963652df19e9068ae65db93b0a1e523d462d9aaa44b24d821ce8'  // 修正：去掉最后的 7
};

async function main() {
  console.log('🚀 RWA 直接铸造测试\n');
  console.log('═'.repeat(70));

  // 只查询既有交易，不读取私钥，也不会再次铸造。
  if (process.argv[2] === '--receipt') {
    const txHash = process.argv[3];
    if (!ethers.isHexString(txHash, 32)) {
      throw new Error('用法: node test-mint-simple.mjs --receipt 0x<64位交易哈希>');
    }
    const abi = loadContractABI();
    if (!abi) throw new Error('无法读取 ABI');
    console.log('🔎 仅确认已有交易，不会发送新交易');
    console.log('📝 Tx Hash:', txHash);
    const confirmation = await waitForReceiptWithFallback(txHash, createReceiptProviders());
    if (confirmation.receipt.status !== 1) {
      throw new Error(`交易已上链但执行失败（status=${confirmation.receipt.status}）`);
    }
    printReceiptDetails(confirmation.receipt, abi, confirmation);
    return;
  }

  // 1. 加载私钥
  console.log('🔑 加载私钥...');
  const privateKey = loadPrivateKey();
  if (!privateKey) {
    console.error('❌ 未找到 DEPLOYER_PRIVATE_KEY');
    console.log('💡 请确保根目录下的 .env 文件包含 DEPLOYER_PRIVATE_KEY');
    process.exit(1);
  }
  console.log('✅ 私钥已加载\n');

  // 2. 连接 RPC
  console.log('📡 连接到 Injective Testnet...');
  console.log('   发送 RPC:', SUBMIT_RPC_URL);
  console.log('   确认 RPC:', RPC_URLS.join(', '));
  const receiptProviders = createReceiptProviders();
  const provider = receiptProviders[0];

  try {
    const network = await provider.getNetwork();
    console.log(`✅ Chain ID: ${network.chainId}`);

    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ 当前区块: ${blockNumber}\n`);
  } catch (e) {
    console.error('❌ RPC 连接失败:', e.message);
    process.exit(1);
  }

  // 3. 创建钱包
  console.log('👤 创建签名者...');
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = wallet.address;
  console.log(`✅ 地址: ${address}`);

  const balance = await provider.getBalance(address);
  console.log(`💰 余额: ${ethers.formatEther(balance)} INJ\n`);

  if (balance === 0n) {
    console.error('❌ 余额为 0，需要测试币');
    console.log('🔗 水龙头: https://testnet.faucet.injective.network/');
    process.exit(1);
  }

  // 4. 加载合约 ABI
  console.log('📜 加载合约 ABI...');
  const abi = loadContractABI();
  if (!abi) {
    console.error('❌ 无法加载合约 ABI');
    process.exit(1);
  }
  console.log(`✅ ABI 已加载 (${abi.length} 个方法/事件)\n`);

  // 5. 连接合约
  console.log('🔗 连接到 AgentBLRWA 合约...');
  console.log('   地址:', CONTRACT_ADDRESS);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);
  console.log('✅ 合约已连接\n');

  // 6. 显示铸造参数
  console.log('🔧 铸造参数:');
  console.log('  - blId:', MINT_ARGS.blId);
  console.log('  - issuePriceE6:', MINT_ARGS.issuePriceE6.toString(), `($${(Number(MINT_ARGS.issuePriceE6) / 1e6).toFixed(4)})`);
  console.log('  - tokenSupply:', MINT_ARGS.tokenSupply.toString());
  console.log('  - financingUsd:', MINT_ARGS.financingUsd.toString());
  console.log('  - collateralValueUsd:', MINT_ARGS.collateralValueUsd.toString());
  console.log('  - riskScoreBps:', MINT_ARGS.riskScoreBps);
  console.log('  - riskLevel:', MINT_ARGS.riskLevel);

  const expectedMint = MINT_ARGS.financingUsd * 1_000_000n / MINT_ARGS.issuePriceE6;
  console.log('  - 预期铸造:', expectedMint.toString(), 'RWA\n');

  // 7. Gas 估算
  console.log('⛽ 估算 Gas...');
  try {
    const gasEstimate = await contract.tokenize.estimateGas(
      MINT_ARGS.blId,
      MINT_ARGS.issuePriceE6,
      MINT_ARGS.tokenSupply,
      MINT_ARGS.financingUsd,
      MINT_ARGS.collateralValueUsd,
      MINT_ARGS.riskScoreBps,
      MINT_ARGS.riskLevel,
      MINT_ARGS.quoteHash,
      MINT_ARGS.evidenceHash
    );
    console.log(`✅ 预估 Gas: ${gasEstimate.toString()}\n`);
  } catch (error) {
    console.error('❌ Gas 估算失败!');
    console.error('═'.repeat(70));
    console.error('错误信息:', error.message);
    if (error.data) {
      console.error('错误数据:', error.data);
    }
    if (error.reason) {
      console.error('失败原因:', error.reason);
    }
    console.error('═'.repeat(70));
    console.log('\n💡 Gas 估算失败通常意味着交易会被合约拒绝');
    console.log('常见原因:');
    console.log('  1. issuePriceE6 = 0 → 触发 require(issuePriceE6 > 0)');
    console.log('  2. tokenSupply = 0 → 触发 require(tokenSupply > 0)');
    console.log('  3. 合约有其他限制条件');
    process.exit(1);
  }

  // 8. 发送交易
  console.log('🚀 发送铸造交易...');
  console.log('⏳ 等待确认（可能需要 10-30 秒）...\n');

  try {
    const tx = await contract.tokenize(
      MINT_ARGS.blId,
      MINT_ARGS.issuePriceE6,
      MINT_ARGS.tokenSupply,
      MINT_ARGS.financingUsd,
      MINT_ARGS.collateralValueUsd,
      MINT_ARGS.riskScoreBps,
      MINT_ARGS.riskLevel,
      MINT_ARGS.quoteHash,
      MINT_ARGS.evidenceHash,
      { gasLimit: 500000n }
    );

    console.log('✅ 交易已发送!');
    console.log('📝 Tx Hash:', tx.hash);
    console.log('🔗 浏览器:', `https://testnet.blockscout.injective.network/tx/${tx.hash}`);
    console.log('\n⏳ 等待区块确认...');

    const confirmation = await waitForReceiptWithFallback(tx.hash, receiptProviders);
    const { receipt } = confirmation;

    if (receipt.status !== 1) {
      throw new Error(`交易已上链但执行失败（status=${receipt.status}）`);
    }

    printReceiptDetails(receipt, abi, confirmation);

    console.log('\n🎊 铸造成功!');
    console.log('═'.repeat(70));

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
