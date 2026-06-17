const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('@nomicfoundation/hardhat-ethers');

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing ${name} in project-root .env (required for Sepolia deploy)`);
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
      }
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY.trim()] : []
    }
  }
};

// Validate only when user explicitly targets Sepolia via CLI flag.
if (process.argv.includes('--network') && process.argv.includes('sepolia')) {
  requireEnv('SEPOLIA_RPC_URL');
  requireEnv('DEPLOYER_PRIVATE_KEY');
}
