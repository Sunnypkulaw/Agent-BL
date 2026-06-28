/**
 * x402 Configuration — AgentBL
 *
 * x402 is the HTTP 402 Payment Required protocol for Web3 APIs.
 * When the AI Agent needs premium risk intel (live xAPI data, deep valuation,
 * volatility forecasts), it pays through x402 — the chain records every
 * payment and the paid intel flows into the pricing engine.
 *
 * This module reads from process.env so that a single .env file works for
 * both the server and CLI scripts.
 */

/**
 * CAIP-2 network identifier for x402 payments.
 * Defaults to Injective Testnet (EIP-155 chainId 1439), matching the
 * existing AgentBL deployment.
 */
export function x402Network() {
  return process.env.X402_NETWORK || process.env.MONAD_NETWORK || 'eip155:1439';
}

/** x402 facilitator URL — the settlement relay. */
export function x402FacilitatorUrl() {
  return process.env.X402_FACILITATOR_URL || 'https://x402-facilitator.molandak.org';
}

/**
 * USDC token address for x402 settlement.
 * On Injective Testnet this would be a test USDC / mock ERC-20.
 * Falls back to the known Monad testnet DemoUSDC for cross-chain demo.
 */
export function x402Usdc() {
  return process.env.X402_USDC_ADDRESS
    || process.env.MONAD_USDC_TESTNET
    || '0x534b2f3A21130d7a60830c2Df862319e593943A3';
}

/** Address that receives x402 payments. */
export function x402PayTo() {
  return process.env.X402_PAY_TO_ADDRESS || process.env.PAY_TO_ADDRESS || null;
}

/** RPC URL for the x402 settlement chain. Falls back to Injective Testnet RPC. */
export function x402RpcUrl() {
  return process.env.X402_RPC_URL
    || process.env.INJECTIVE_RPC_URL
    || 'https://k8s.testnet.json-rpc.injective.network';
}

/** Is a White Agent private key configured for signing x402 payments? */
export function isX402Configured() {
  return Boolean(
    process.env.WHITE_AGENT_PRIVATE_KEY
    && x402PayTo()
    && x402RpcUrl()
  );
}

/** Default x402 payment budget per pricing request (USDC). */
export const DEFAULT_X402_BUDGET_USDC = 0.005;

/** Available x402-protected premium services. */
export const X402_SERVICES = [
  {
    serviceId: 'premium-risk',
    endpoint: '/api/x402/intel/premium-risk',
    priceUSDC: 0.001,
    title: 'Premium Risk Intelligence',
    description: 'Live xAPI world-risk signals + RAG deep analysis with full source citations',
    status: 'live'
  },
  {
    serviceId: 'premium-valuation',
    endpoint: '/api/x402/valuation/premium',
    priceUSDC: 0.002,
    title: 'Premium Cargo Valuation',
    description: 'Real-time commodity prices + historical comparables + volatility forecast',
    status: 'live'
  }
];
