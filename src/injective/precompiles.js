import { ethers } from 'ethers';

export const INJECTIVE_TESTNET = Object.freeze({
  chainId: 1439,
  network: 'eip155:1439',
  rpcUrl: 'https://k8s.testnet.json-rpc.injective.network',
  explorerUrl: 'https://testnet.blockscout.injective.network'
});

export const BANK_PRECOMPILE = '0x0000000000000000000000000000000000000064';
export const EXCHANGE_PRECOMPILE = '0x0000000000000000000000000000000000000065';
export const CANONICAL_USDC = '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d';
export const CANONICAL_USDC_DENOM = `erc20:${CANONICAL_USDC}`;
export const TESTNET_USDT_DENOM = 'peggy0x87aB3B4C8661e07D6372361211B96ed4Dc36B1B5';

export const TESTNET_MARKETS = Object.freeze({
  GOLD_USDT_PERP: Object.freeze({
    marketId: '0x8f002b45cb287a4c3ecb89174ee42a7e933178d89c7eea94dbed8dc5dfd35d23',
    ticker: 'GOLD/USDT PERP',
    quoteDenom: TESTNET_USDT_DENOM,
    minQuantity: '0.0001',
    priceTick: '0.1'
  }),
  USDT_USDC_SPOT: Object.freeze({
    marketId: '0x67462ddc4a045e175da8d8310f59a6c33c9994ef98ced0a31ffd977af9da9703',
    ticker: 'USDT/USDC',
    baseDenom: TESTNET_USDT_DENOM,
    quoteDenom: CANONICAL_USDC_DENOM
  })
});

export const BANK_ABI = Object.freeze([
  'function mint(address token,uint256 amount) payable returns (bool)',
  'function balanceOf(address token,address account) view returns (uint256)',
  'function burn(address token,uint256 amount) payable returns (bool)',
  'function transfer(address from,address recipient,uint256 amount) payable returns (bool)',
  'function totalSupply(address token) view returns (uint256)',
  'function metadata(address token) view returns (string name,string symbol,uint8 decimals)',
  'function setMetadata(string name,string symbol,uint8 decimals) payable returns (bool)'
]);

export const EXCHANGE_ABI = Object.freeze([
  'function subaccountDeposit(string subaccountID,string denom) view returns (uint256 availableBalance,uint256 totalBalance)',
  'function deposit(address sender,string subaccountID,string denom,uint256 amount) returns (bool)',
  'function withdraw(address sender,string subaccountID,string denom,uint256 amount) returns (bool)',
  'function createSpotMarketOrder(address sender,(string marketID,string subaccountID,string feeRecipient,uint256 price,uint256 quantity,string cid,string orderType,uint256 triggerPrice) order) returns ((string orderHash,string cid,uint256 quantity,uint256 price,uint256 fee) response)',
  'function createDerivativeLimitOrder(address sender,(string marketID,string subaccountID,string feeRecipient,uint256 price,uint256 quantity,string cid,string orderType,uint256 margin,uint256 triggerPrice) order) returns ((string orderHash,string cid) response)',
  'function derivativeOrdersByHashes((string marketID,string subaccountID,string[] orderHashes) request) returns ((uint256 price,uint256 quantity,uint256 margin,uint256 fillable,bool isBuy,string orderHash,string cid)[] orders)',
  'function cancelDerivativeOrder(address sender,string marketID,string subaccountID,string orderHash,int32 orderMask,string cid) returns (bool)'
]);

export const ERC20_READ_ABI = Object.freeze([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address recipient,uint256 amount) returns (bool)'
]);

export function deriveSubaccountId(address, index = 0) {
  const normalized = ethers.getAddress(address).slice(2).toLowerCase();
  if (!Number.isSafeInteger(index) || index < 0 || index > 255) {
    throw new RangeError('Injective subaccount index must be an integer from 0 to 255');
  }
  const nonce = ethers.zeroPadValue(ethers.toBeHex(index), 12).slice(2);
  return `0x${normalized}${nonce}`;
}

export function createBankPrecompile(runner) {
  return new ethers.Contract(BANK_PRECOMPILE, BANK_ABI, runner);
}

export function createExchangePrecompile(runner) {
  return new ethers.Contract(EXCHANGE_PRECOMPILE, EXCHANGE_ABI, runner);
}

export function createCanonicalUsdc(runner) {
  return new ethers.Contract(CANONICAL_USDC, ERC20_READ_ABI, runner);
}

export async function readCanonicalUsdcParity(runner, account) {
  const bank = createBankPrecompile(runner);
  const token = createCanonicalUsdc(runner);
  const [metadata, bankBalance, erc20Balance, totalSupply, erc20Decimals, erc20Symbol] = await Promise.all([
    bank.metadata(CANONICAL_USDC),
    bank.balanceOf(CANONICAL_USDC, account),
    token.balanceOf(account),
    bank.totalSupply(CANONICAL_USDC),
    token.decimals(),
    token.symbol()
  ]);
  const result = {
    token: CANONICAL_USDC,
    denom: CANONICAL_USDC_DENOM,
    account: ethers.getAddress(account),
    metadata: {
      name: metadata[0],
      symbol: metadata[1],
      decimals: Number(metadata[2])
    },
    erc20: {
      symbol: erc20Symbol,
      decimals: Number(erc20Decimals),
      balance: erc20Balance.toString()
    },
    bank: {
      balance: bankBalance.toString(),
      totalSupply: totalSupply.toString()
    }
  };
  result.parity = result.bank.balance === result.erc20.balance
    && result.metadata.symbol === result.erc20.symbol
    && result.metadata.decimals === result.erc20.decimals;
  return result;
}

export async function readExchangeDeposit(runner, subaccountId, denom) {
  const exchange = createExchangePrecompile(runner);
  const [availableBalance, totalBalance] = await exchange.subaccountDeposit(subaccountId, denom);
  return {
    subaccount_id: subaccountId,
    denom,
    available_balance: availableBalance.toString(),
    total_balance: totalBalance.toString()
  };
}
