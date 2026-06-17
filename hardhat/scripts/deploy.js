/**
 * WEB3-10: Deploy TradeShield contracts to Sepolia.
 *
 * Required in project-root .env:
 *   SEPOLIA_RPC_URL=https://...
 *   DEPLOYER_PRIVATE_KEY=0x...
 *
 * Optional:
 *   PERMISSIONED_INVESTOR=0x...   (defaults to deployer)
 *   ORACLE_UPDATER=0x...          (defaults to deployer)
 *   DEMO_SEED=true                (mint eBL, create offering, emit PricingUpdated)
 */
const fs = require('node:fs');
const path = require('node:path');
const { ethers, network } = require('hardhat');

const ACTION = {
  REPRICE_DOWN: 2
};

async function main() {
  if (network.name !== 'sepolia') {
    throw new Error(`Refusing to deploy on "${network.name}". Use: npm run deploy:sepolia`);
  }

  const [deployer] = await ethers.getSigners();
  const investor = process.env.PERMISSIONED_INVESTOR || deployer.address;
  const oracleUpdater = process.env.ORACLE_UPDATER || deployer.address;
  const demoSeed = String(process.env.DEMO_SEED ?? 'true').toLowerCase() !== 'false';

  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');

  const Registry = await ethers.getContractFactory('EBLRegistry');
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryTx = registry.deploymentTransaction()?.hash;

  const Token = await ethers.getContractFactory('RWAToken');
  const token = await Token.deploy();
  await token.waitForDeployment();

  const Pool = await ethers.getContractFactory('RWAOfferingPool');
  const pool = await Pool.deploy(await registry.getAddress(), await token.getAddress());
  await pool.waitForDeployment();

  const Oracle = await ethers.getContractFactory('RiskPricingOracle');
  const oracle = await Oracle.deploy(await pool.getAddress());
  await oracle.waitForDeployment();

  await (await token.setPool(await pool.getAddress())).wait();
  await (await pool.setOracle(await oracle.getAddress())).wait();
  await (await pool.setPermissionedInvestor(investor, true)).wait();
  if (oracleUpdater.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await oracle.setUpdater(oracleUpdater, true)).wait();
  }

  const addresses = {
    network: 'sepolia',
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    permissionedInvestor: investor,
    oracleUpdater,
    contracts: {
      EBLRegistry: await registry.getAddress(),
      RWAToken: await token.getAddress(),
      RWAOfferingPool: await pool.getAddress(),
      RiskPricingOracle: await oracle.getAddress()
    },
    transactions: {
      EBLRegistry_deploy: registryTx
    },
    demo: null
  };

  if (demoSeed) {
    const metadataHash = ethers.id('EBL-2026-0001');
    const evidenceHash = ethers.id('tradeshield-sepolia-evidence');
    const quoteHash = ethers.id('tradeshield-sepolia-quote');

    const mintTx = await registry.mintEBL(metadataHash, deployer.address);
    await mintTx.wait();
    const pledgeTx = await registry.pledge(1, await pool.getAddress());
    await pledgeTx.wait();
    const createTx = await pool.createOffering(1, 1_000_000n, 900_000n, 1_000_000n);
    await createTx.wait();
    const pricingTx = await oracle.updatePricing(1, 800_000n, 2, ACTION.REPRICE_DOWN, evidenceHash, quoteHash);
    const pricingReceipt = await pricingTx.wait();

    addresses.demo = {
      poolId: 1,
      eblId: 1,
      issuePriceE6: '800000',
      evidenceHash,
      quoteHash,
      transactions: {
        EBLMinted: mintTx.hash,
        EBLPledged: pledgeTx.hash,
        OfferingCreated: createTx.hash,
        PricingUpdated: pricingReceipt.hash
      }
    };
  }

  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'sepolia.json');
  fs.writeFileSync(outFile, JSON.stringify(addresses, null, 2));

  console.log('\nDeployment complete. Addresses written to:', outFile);
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
