/**
 * Deploy PaymentOracle to Injective Testnet.
 *
 * PaymentOracle records every x402 payment as an on-chain event:
 *   PaymentEvidenceLogged(requestId, payer, serviceId, amountMicrousd,
 *     paymentRef, responseHash, quoteHash, evidenceHash, pricingAction)
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
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`\n🌐 Network: ${meta.name}`);
  console.log(`⛽ Gas token: ${meta.gasToken}`);
  console.log(`👤 Deployer : ${deployer.address}`);
  console.log(`💰 Balance  : ${ethers.formatEther(balance)} ${meta.gasToken}`);

  if (balance === 0n) {
    console.log('💧 Get testnet INJ from: https://testnet.faucet.injective.network/');
    throw new Error(`Deployer balance is 0 ${meta.gasToken}. Fund the wallet first.`);
  }

  // ── Deploy PaymentOracle ──
  const Factory = await ethers.getContractFactory('PaymentOracle');

  // Injective testnet sometimes needs explicit gas to avoid hanging
  const feeData = await ethers.provider.getFeeData();
  const overrides = {
    gasLimit: 2_000_000n,
    gasPrice: feeData.gasPrice ? feeData.gasPrice * 2n : 50000000000n // 50 gwei fallback
  };

  console.log(`⛏  Deploying with gasLimit=${overrides.gasLimit}, gasPrice=${overrides.gasPrice}wei…`);
  const contract = await Factory.deploy(overrides);
  console.log('⏳ Waiting for confirmation (Injective testnet may take 30-60s)…');
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deployTx = contract.deploymentTransaction()?.hash ?? null;
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const { abi } = await artifacts.readArtifact('PaymentOracle');

  console.log('\n✅ PaymentOracle deployed');
  console.log('   Address:', address);
  console.log('   Tx:     ', deployTx);

  // ── Merge into existing chain-config.json ──
  const configPath = path.join(__dirname, '..', '..', 'public', 'chain-config.json');
  let chainConfig = {};
  try {
    chainConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    // No existing config — create from scratch
    chainConfig = {
      network: meta.name,
      chainId: '0x' + chainId.toString(16),
      chainIdDecimal: Number(chainId),
      explorerBase: meta.explorerBase,
      deployedAt: new Date().toISOString()
    };
  }

  // Preserve existing contracts, add PaymentOracle
  chainConfig.contracts = { ...(chainConfig.contracts || {}), PaymentOracle: address };
  chainConfig.paymentOracle = {
    address,
    deployTx,
    deployedAt: new Date().toISOString(),
    abi
  };

  fs.writeFileSync(configPath, JSON.stringify(chainConfig, null, 2));
  console.log('📄 Frontend config updated ->', configPath);
  console.log('   Contracts:', Object.keys(chainConfig.contracts).join(', '));

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
    deployedAt: chainConfig.deployedAt
  }, null, 2));
  console.log('📄 Deployment record ->', recordPath);

  console.log(`\n🎯 PaymentOracle is live on ${meta.name}.`);
  console.log(`   Explorer: ${meta.explorerBase}${meta.explorerAddressPath}${address}`);
  console.log(`   x402 payments now emit real PaymentEvidenceLogged events on-chain.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
