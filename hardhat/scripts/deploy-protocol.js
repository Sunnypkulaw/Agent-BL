/**
 * WEB3-17: deploy and wire the complete five-contract AgentBL protocol on
 * Injective inEVM, execute the acceptance smoke, and merge public config.
 */
const fs = require('node:fs');
const path = require('node:path');
const hre = require('hardhat');

const { ethers, network, artifacts } = hre;
const ROOT = path.resolve(__dirname, '../..');
const EXPLORER = 'https://testnet.blockscout.injective.network';
const EXPLORER_API = 'https://testnet.blockscout-api.injective.network/api';
const RPC_URL = process.env.INJECTIVE_RPC_URL || 'https://k8s.testnet.json-rpc.injective.network';
const DEPLOY_OVERRIDES = Object.freeze({ gasLimit: 6_000_000n });
const CALL_OVERRIDES = Object.freeze({ gasLimit: 1_000_000n });

async function rpc(method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal
    });
    const body = await response.json();
    if (body.error) throw new Error(`${method}: ${body.error.message}`);
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForReceipt(txHash, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      let body;
      try {
        const response = await fetch(`${EXPLORER_API}?module=transaction&action=gettxinfo&txhash=${txHash}`, {
          signal: controller.signal
        });
        body = await response.json();
      } finally {
        clearTimeout(timer);
      }
      if (body?.status === '1' && body.result) {
        if (body.result.success !== true) throw new Error(`Transaction reverted: ${txHash}`);
        return {
          status: '0x1',
          blockNumber: `0x${Number(body.result.blockNumber).toString(16)}`,
          transactionHash: txHash
        };
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for ${txHash}${lastError ? `: ${lastError.message}` : ''}`);
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

async function deploy(name, args = []) {
  const factory = await ethers.getContractFactory(name);
  // Injective's public testnet RPC occasionally stalls on eth_estimateGas.
  // These bounded limits are above the locally measured Hardhat usage and
  // avoid turning a deterministic deployment into an unbounded RPC wait.
  const contract = await factory.deploy(...args, DEPLOY_OVERRIDES);
  const transaction = contract.deploymentTransaction();
  console.log(`  broadcast deploy ${name}: ${transaction.hash}`);
  const receipt = await waitForReceipt(transaction.hash);
  return {
    name,
    contract,
    address: await contract.getAddress(),
    txHash: transaction.hash,
    blockNumber: Number.parseInt(receipt.blockNumber, 16)
  };
}

async function send(label, transactionPromise) {
  const transaction = await transactionPromise;
  console.log(`  broadcast ${label}: ${transaction.hash}`);
  const receipt = await waitForReceipt(transaction.hash);
  return {
    label,
    txHash: transaction.hash,
    blockNumber: Number.parseInt(receipt.blockNumber, 16),
    explorer: `${EXPLORER}/tx/${transaction.hash}`
  };
}

async function main() {
  if (network.name !== 'injective_testnet') {
    throw new Error('WEB3-17 deployment is pinned to --network injective_testnet');
  }
  const providerNetwork = await ethers.provider.getNetwork();
  if (providerNetwork.chainId !== 1439n) {
    throw new Error(`Wrong RPC chain: expected 1439, received ${providerNetwork.chainId}`);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error('Deployer has no INJ for protocol deployment');

  console.log(`Deploying AgentBL protocol from ${deployer.address} on chain 1439`);
  console.log(`Gas balance: ${ethers.formatEther(balance)} INJ`);

  const agent = await deploy('AgentBLRWA');
  const registry = await deploy('EBLRegistry');
  const token = await deploy('RWAToken');
  const pool = await deploy('RWAOfferingPool', [registry.address, token.address]);
  const oracle = await deploy('RiskPricingOracle', [pool.address]);
  const deployments = [agent, registry, token, pool, oracle];

  const wiring = [];
  wiring.push(await send('RWAToken.setPool', token.contract.setPool(pool.address, CALL_OVERRIDES)));
  wiring.push(await send('RWAOfferingPool.setOracle', pool.contract.setOracle(oracle.address, CALL_OVERRIDES)));
  wiring.push(await send(
    'RWAOfferingPool.setPermissionedInvestor',
    pool.contract.setPermissionedInvestor(deployer.address, true, CALL_OVERRIDES)
  ));

  const smoke = [];
  const cargoHash = ethers.id('CASE-EBL-2026-CU-SG-SHA:copper-cathodes:5000MT');
  const metadataHash = ethers.id('CASE-EBL-2026-CU-SG-SHA:wave-b:v2');
  const eblMetadata = {
    vessel: 'MV Pacific Dawn',
    voyage: 'PD-2026-0618',
    portOfLoading: 'Singapore',
    portOfDischarge: 'Shanghai',
    cargo: 'Copper Cathodes Grade A',
    quantity: 5_000n,
    quantityUnit: 'MT',
    hsCode: '740311',
    declaredValueUsdE6: 42_000_000_000_000n,
    incoterms: 'CIF',
    mletr: true,
    eucp: true,
    dcsa: true
  };
  smoke.push(await send(
    'create:mintEBLV2',
    registry.contract.mintEBLV2(cargoHash, metadataHash, deployer.address, eblMetadata, CALL_OVERRIDES)
  ));
  const eblId = Number((await registry.contract.nextEblId()) - 1n);
  smoke.push(await send('create:pledge', registry.contract.pledge(eblId, pool.address, CALL_OVERRIDES)));
  smoke.push(await send(
    'create:createOffering',
    pool.contract.createOffering(eblId, 1_000_000n, 900_000n, 1_000_000n, CALL_OVERRIDES)
  ));
  const poolId = Number((await pool.contract.nextPoolId()) - 1n);
  smoke.push(await send('subscribe', pool.contract.subscribe(poolId, 10_000n, CALL_OVERRIDES)));
  smoke.push(await send(
    'reprice',
    oracle.contract.updatePricing(poolId, 850_000n, 2, 2, ethers.id('wave-b:reprice:evidence'), ethers.id('wave-b:reprice:quote'), CALL_OVERRIDES)
  ));
  smoke.push(await send(
    'pause',
    oracle.contract.updatePricing(poolId, 850_000n, 3, 3, ethers.id('wave-b:pause:evidence'), ethers.id('wave-b:pause:quote'), CALL_OVERRIDES)
  ));
  smoke.push(await send(
    'resume',
    oracle.contract.updatePricing(poolId, 850_000n, 1, 0, ethers.id('wave-b:resume:evidence'), ethers.id('wave-b:resume:quote'), CALL_OVERRIDES)
  ));
  smoke.push(await send('settle', pool.contract.settle(poolId, 10_000n * 1_000_000n, CALL_OVERRIDES)));

  const finalState = Number(await pool.contract.stateOf(poolId));
  const finalPrice = (await pool.contract.issuePriceOf(poolId)).toString();
  const subscribedBalance = (await token.contract.balanceOf(poolId, deployer.address)).toString();
  if (finalState !== 9 || finalPrice !== '850000' || subscribedBalance !== '10000') {
    throw new Error(`Protocol smoke invariant failed: state=${finalState}, price=${finalPrice}, balance=${subscribedBalance}`);
  }

  const deployedAt = new Date().toISOString();
  const addresses = Object.fromEntries(deployments.map((item) => [item.name, item.address]));
  const deployTransactions = Object.fromEntries(deployments.map((item) => [item.name, item.txHash]));
  const abis = {};
  for (const item of deployments) abis[item.name] = (await artifacts.readArtifact(item.name)).abi;

  const configPath = path.join(ROOT, 'public', 'chain-config.json');
  const previous = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const config = {
    ...previous,
    network: 'injective_testnet',
    chainId: '0x59F',
    chainIdDecimal: 1439,
    explorerBase: EXPLORER,
    contracts: { ...previous.contracts, ...addresses },
    deployedAt,
    deployTx: agent.txHash,
    abi: abis.AgentBLRWA,
    protocol: {
      schema: 'agentbl-protocol-deployment-v1',
      network: 'injective_testnet',
      chainId: 1439,
      deployer: deployer.address,
      deployedAt,
      deployTransactions,
      explorerAddresses: Object.fromEntries(
        deployments.map((item) => [item.name, `${EXPLORER}/address/${item.address}`])
      ),
      abis,
      wiring,
      smoke: {
        verifiedAt: deployedAt,
        eblId,
        poolId,
        transactions: smoke,
        finalState: 'Repaid',
        finalStateCode: finalState,
        finalIssuePriceE6: finalPrice,
        subscriberBalance: subscribedBalance
      }
    }
  };
  atomicJson(configPath, config);

  const record = {
    schema: 'agentbl-protocol-deployment-v1',
    network: 'injective_testnet',
    chainId: 1439,
    deployer: deployer.address,
    deployedAt,
    gasBalanceBefore: ethers.formatEther(balance),
    contracts: Object.fromEntries(deployments.map((item) => [item.name, {
      address: item.address,
      deployTx: item.txHash,
      blockNumber: item.blockNumber,
      explorer: `${EXPLORER}/address/${item.address}`
    }])),
    wiring,
    smoke: config.protocol.smoke
  };
  const recordPath = path.join(__dirname, '..', 'deployments', 'injective_testnet-protocol.json');
  atomicJson(recordPath, record);
  atomicJson(path.join(ROOT, 'docs', 'evidence', 'wave-b-protocol.json'), record);

  console.log('Five-contract protocol deployed and wired:');
  for (const item of deployments) console.log(`  ${item.name}: ${item.address} (${item.txHash})`);
  console.log(`Smoke pool ${poolId}: create -> subscribe -> reprice -> pause -> resume -> settle`);
  console.log(`Evidence: ${recordPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
