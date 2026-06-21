/**
 * Deploy TradeShieldRWA (the self-contained demo contract that the browser
 * dashboard drives via MetaMask) to the target network, then wire the deployed
 * address + ABI straight into the frontend by overwriting public/chain-config.json.
 *
 * After this runs, View ① "Mint RWA on-chain" produces a REAL on-chain tx.
 * Until it runs, public/chain-config.json carries an empty address and the
 * frontend uses its high-fidelity simulated fallback.
 *
 * Supported networks:
 *   injective_testnet — Injective Testnet (inEVM, chainId 1439)
 *   sepolia           — Ethereum Sepolia (legacy fallback, chainId 11155111)
 *
 * Required in project-root .env:
 *   DEPLOYER_PRIVATE_KEY=0x...
 *   INJECTIVE_RPC_URL=https://k8s.testnet.json-rpc.injective.network  (for Injective)
 *   SEPOLIA_RPC_URL=https://...                                       (for Sepolia)
 *
 * Run:
 *   npm run deploy:tradeshield:injective      (Injective Testnet)
 *   npm run deploy:tradeshield:sepolia        (Ethereum Sepolia)
 */
const fs = require('node:fs');
const path = require('node:path');
const hre = require('hardhat');

const { ethers, network, artifacts } = hre;

const NETWORK_META = {
  injective_testnet: {
    name: 'injective_testnet',
    explorerBase: 'https://testnet.explorer.injective.network',
    explorerAddressPath: '/address/',
    explorerTxPath: '/tx/',
    gasToken: 'INJ'
  },
  sepolia: {
    name: 'sepolia',
    explorerBase: 'https://sepolia.etherscan.io',
    explorerAddressPath: '/address/',
    explorerTxPath: '/tx/',
    gasToken: 'ETH'
  }
};

const SUPPORTED = Object.keys(NETWORK_META);

async function main() {
  if (!SUPPORTED.includes(network.name)) {
    throw new Error(
      `Refusing to deploy on "${network.name}".\n` +
      `  Use: npm run deploy:tradeshield:injective  (Injective Testnet)\n` +
      `   or: npm run deploy:tradeshield:sepolia    (Ethereum Sepolia)`
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
    if (network.name === 'injective_testnet') {
      console.log('💧 Get testnet INJ from: https://testnet.faucet.injective.network/');
    }
    throw new Error(`Deployer balance is 0 ${meta.gasToken}. Fund the wallet first.`);
  }

  const Factory = await ethers.getContractFactory('TradeShieldRWA');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deployTx = contract.deploymentTransaction()?.hash ?? null;
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const { abi } = await artifacts.readArtifact('TradeShieldRWA');

  console.log('\n✅ TradeShieldRWA deployed');
  console.log('   Address:', address);
  console.log('   Tx:     ', deployTx);

  // 1) Frontend-readable config (served statically at /chain-config.json).
  const chainConfig = {
    network: meta.name,
    chainId: '0x' + chainId.toString(16),
    chainIdDecimal: Number(chainId),
    explorerBase: meta.explorerBase,
    contracts: { TradeShieldRWA: address },
    deployedAt: new Date().toISOString(),
    deployTx,
    abi
  };
  const frontendPath = path.join(__dirname, '..', '..', 'public', 'chain-config.json');
  fs.writeFileSync(frontendPath, JSON.stringify(chainConfig, null, 2));
  console.log('📄 Frontend config ->', frontendPath);

  // 2) Deployment record.
  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const recordFilename = `${meta.name}-tradeshield.json`;
  const recordPath = path.join(outDir, recordFilename);
  fs.writeFileSync(recordPath, JSON.stringify({
    network: meta.name,
    chainId: Number(chainId),
    deployer: deployer.address,
    contract: 'TradeShieldRWA',
    address,
    deployTx,
    explorer: `${meta.explorerBase}${meta.explorerAddressPath}${address}`,
    deployedAt: chainConfig.deployedAt
  }, null, 2));
  console.log('📄 Deployment record ->', recordPath);

  console.log(`\n🎯 Done. The dashboard will now mint real ${meta.gasToken} txs on ${meta.name}.`);
  console.log(`   Explorer: ${meta.explorerBase}${meta.explorerAddressPath}${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
