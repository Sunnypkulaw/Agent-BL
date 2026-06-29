/**
 * Deploy PaymentOracle to Injective Testnet.
 *
 * PaymentOracle binds every settled x402 payment to its paid AI report:
 *   PaymentAttested(receiptId, reportHash, caseIdHash, paymentTxHash,
 *     payer, asset, amount, attestor, timestamp)
 *
 * This gives the x402 "AI Risk Report Market" a real on-chain audit trail.
 *
 * After deployment, the address is auto-written into public/chain-config.json
 * alongside the existing AgentBLRWA address, so the frontend can reference it.
 *
 * Required in project-root .env:
 *   DEPLOYER_PRIVATE_KEY=0x...
 *   INJECTIVE_RPC_URL=https://k8s.testnet.json-rpc.injective.network
 *
 * Run:
 *   cd hardhat && npm run deploy:payment-oracle
 */
const fs = require('node:fs');
const path = require('node:path');
const hre = require('hardhat');
const chainConfigLib = require('../../scripts/lib/chain-config.cjs');

const { ethers, network, artifacts } = hre;

const NETWORK_META = {
  injective_testnet: {
    name: 'injective_testnet',
    explorerBase: 'https://testnet.blockscout.injective.network',
    explorerAddressPath: '/address/',
    explorerTxPath: '/tx/',
    gasToken: 'INJ'
  }
};

const SUPPORTED = Object.keys(NETWORK_META);

async function main() {
  if (!SUPPORTED.includes(network.name)) {
    throw new Error(
      `Refusing to deploy on "${network.name}".\n` +
      `  Use: npm run deploy:payment-oracle  (Injective Testnet)`
    );
  }

  const meta = NETWORK_META[network.name];
  const [deployer] = await ethers.getSigners();
  const recoveryAddress = process.env.PAYMENT_ORACLE_RECOVERY_ADDRESS?.trim();
  const recoveryTx = process.env.PAYMENT_ORACLE_RECOVERY_TX?.trim();
  const recovering = Boolean(recoveryAddress || recoveryTx);
  const balance = recovering ? null : await ethers.provider.getBalance(deployer.address);

  console.log(`\n🌐 Network: ${meta.name}`);
  console.log(`⛽ Gas token: ${meta.gasToken}`);
  console.log(`👤 Deployer : ${deployer.address}`);
  if (balance !== null) console.log(`💰 Balance  : ${ethers.formatEther(balance)} ${meta.gasToken}`);

  if (balance === 0n) {
    console.log('💧 Get testnet INJ from: https://testnet.faucet.injective.network/');
    throw new Error(`Deployer balance is 0 ${meta.gasToken}. Fund the wallet first.`);
  }

  // Recover a deployment whose receipt was confirmed after the local RPC
  // disconnected, so metadata can be rebuilt without deploying a duplicate.
  let address;
  let deployTx;
  if (recovering) {
    if (!ethers.isAddress(recoveryAddress) || !/^0x[0-9a-fA-F]{64}$/.test(recoveryTx || '')) {
      throw new Error('Recovery requires valid PAYMENT_ORACLE_RECOVERY_ADDRESS and PAYMENT_ORACLE_RECOVERY_TX');
    }
    if (process.env.PAYMENT_ORACLE_RECOVERY_CONFIRMED !== 'true') {
      throw new Error('Recovery requires PAYMENT_ORACLE_RECOVERY_CONFIRMED=true after explorer verification');
    }
    address = ethers.getAddress(recoveryAddress);
    deployTx = recoveryTx;
    console.log('Recovered explorer-confirmed PaymentOracle deployment:', address);
  } else {
    const Factory = await ethers.getContractFactory('PaymentOracle');
    const feeData = await ethers.provider.getFeeData();
    const overrides = {
      gasLimit: 2_000_000n,
      gasPrice: feeData.gasPrice ? feeData.gasPrice * 2n : 50000000000n
    };
    console.log(`⛏  Deploying with gasLimit=${overrides.gasLimit}, gasPrice=${overrides.gasPrice}wei…`);
    const contract = await Factory.deploy(overrides);
    console.log('⏳ Waiting for confirmation (Injective testnet may take 30-60s)…');
    await contract.waitForDeployment();
    address = await contract.getAddress();
    deployTx = contract.deploymentTransaction()?.hash ?? null;
  }

  const chainId = recovering ? 1439n : (await ethers.provider.getNetwork()).chainId;
  const { abi } = await artifacts.readArtifact('PaymentOracle');
  const deployedAt = new Date().toISOString();

  console.log('\n✅ PaymentOracle deployed');
  console.log('   Address:', address);
  console.log('   Tx:     ', deployTx);

  // ── Merge into existing chain-config.json ──
  const configPath = path.join(__dirname, '..', '..', 'public', 'chain-config.json');
  const current = chainConfigLib.readRegistry(configPath);
  const chainConfig = chainConfigLib.mergeNetworkConfig(current, 'injective-testnet', {
    network: meta.name,
    chainId: '0x' + chainId.toString(16),
    chainIdDecimal: Number(chainId),
    rpcUrls: [process.env.INJECTIVE_RPC_URL || 'https://k8s.testnet.json-rpc.injective.network/'],
    explorerBase: meta.explorerBase,
    contracts: { PaymentOracle: address },
    abis: { PaymentOracle: abi },
    deployments: { PaymentOracle: { address, deployTx, deployedAt } },
    paymentOracle: { address, deployTx, deployedAt, abi }
  });
  chainConfigLib.atomicWriteRegistry(configPath, chainConfig);
  console.log('📄 Frontend config updated ->', configPath);
  console.log('   Contracts:', Object.keys(chainConfig.networks['injective-testnet'].contracts).join(', '));

  // ── Deployment record ──
  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const recordPath = path.join(outDir, `${meta.name}-payment-oracle.json`);
  fs.writeFileSync(recordPath, JSON.stringify({
    network: meta.name,
    chainId: Number(chainId),
    deployer: deployer.address,
    contract: 'PaymentOracle',
    address,
    deployTx,
    explorer: `${meta.explorerBase}${meta.explorerAddressPath}${address}`,
    deployedAt
  }, null, 2));
  console.log('📄 Deployment record ->', recordPath);

  console.log(`\n🎯 PaymentOracle is live on ${meta.name}.`);
  console.log(`   Explorer: ${meta.explorerBase}${meta.explorerAddressPath}${address}`);
  console.log(`   x402 paid reports now emit real PaymentAttested events on-chain.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
