/**
 * Deploy TradeShieldRWA (the self-contained demo contract that the browser
 * dashboard drives via MetaMask) to Sepolia, then wire the deployed address +
 * ABI straight into the frontend by overwriting public/chain-config.json.
 *
 * After this runs, View ① "Mint RWA on-chain" produces a REAL Sepolia tx
 * (with no further config). Until it runs, public/chain-config.json carries an
 * empty address and the frontend uses its high-fidelity simulated fallback.
 *
 * Required in project-root .env (see .env.example / hardhat.config.cjs):
 *   SEPOLIA_RPC_URL=https://...
 *   DEPLOYER_PRIVATE_KEY=0x...
 *
 * Run:  npm run deploy:tradeshield:sepolia      (from the hardhat/ folder)
 */
const fs = require('node:fs');
const path = require('node:path');
const hre = require('hardhat');

const { ethers, network, artifacts } = hre;

const EXPLORER_BASE = 'https://sepolia.etherscan.io';

async function main() {
  if (network.name !== 'sepolia') {
    throw new Error(`Refusing to deploy on "${network.name}". Use: npm run deploy:tradeshield:sepolia`);
  }

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Balance :', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');

  const Factory = await ethers.getContractFactory('TradeShieldRWA');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deployTx = contract.deploymentTransaction()?.hash ?? null;
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const { abi } = await artifacts.readArtifact('TradeShieldRWA');

  console.log('\nTradeShieldRWA deployed at:', address);
  console.log('Deploy tx:', deployTx);

  // 1) Frontend-readable config (served statically at /chain-config.json).
  const chainConfig = {
    network: 'sepolia',
    chainId: '0x' + chainId.toString(16),
    chainIdDecimal: Number(chainId),
    explorerBase: EXPLORER_BASE,
    contracts: { TradeShieldRWA: address },
    deployedAt: new Date().toISOString(),
    deployTx,
    abi
  };
  const frontendPath = path.join(__dirname, '..', '..', 'public', 'chain-config.json');
  fs.writeFileSync(frontendPath, JSON.stringify(chainConfig, null, 2));
  console.log('Wrote frontend config ->', frontendPath);

  // 2) Deployment record (alongside the existing sepolia.json convention).
  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const recordPath = path.join(outDir, 'sepolia-tradeshield.json');
  fs.writeFileSync(recordPath, JSON.stringify({
    network: 'sepolia',
    chainId: Number(chainId),
    deployer: deployer.address,
    contract: 'TradeShieldRWA',
    address,
    deployTx,
    explorer: `${EXPLORER_BASE}/address/${address}`,
    deployedAt: chainConfig.deployedAt
  }, null, 2));
  console.log('Wrote deployment record ->', recordPath);

  console.log('\n✅ Done. The dashboard will now mint on real Sepolia once a wallet is connected.');
  console.log(`   Explorer: ${EXPLORER_BASE}/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
