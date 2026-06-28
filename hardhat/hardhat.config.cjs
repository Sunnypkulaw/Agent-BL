const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('@nomicfoundation/hardhat-ethers');

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing ${name} in project-root .env`);
  }
  return value.trim();
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  networks: {
    // Injective Testnet (inEVM)
    injective_testnet: {
      url: process.env.INJECTIVE_RPC_URL || 'https://k8s.testnet.json-rpc.injective.network',
      chainId: 1439,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY.trim()] : []
    }
  }
};

// Validate when user explicitly targets a network via CLI flag.
const targetNetwork = process.argv.includes('--network') ? process.argv[process.argv.indexOf('--network') + 1] : null;
if (targetNetwork === 'injective_testnet') {
  requireEnv('DEPLOYER_PRIVATE_KEY');
}
