# Injective Engineering Runbook (SP-4)

Last verified: 2026-06-30
Scope: Injective EVM development, official agent skills, deployment, precompile spikes, and incident diagnosis.

This is an **engineering runbook**, not an AgentBL product runtime dependency. The official Injective skills help developers produce and diagnose code; the production AgentBL service does not claim that a Markdown skill executes customer trades.

## 1. Pinned environment

| Item | Injective Testnet value |
|---|---|
| Cosmos chain ID | `injective-888` |
| EVM chain ID | `1439` / `0x59F` |
| EVM RPC | `https://k8s.testnet.json-rpc.injective.network` |
| Explorer | `https://testnet.blockscout.injective.network` |
| Bank precompile | `0x0000000000000000000000000000000000000064` |
| Exchange precompile | `0x0000000000000000000000000000000000000065` |
| Canonical USDC | `0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d` |
| Canonical USDC bank denom | `erc20:0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d` |

Sources:

- [Injective CLI Agent Skill](https://docs.injective.network/developers-ai/injective-cli-skill)
- [Injective EVM Developer Agent Skill](https://docs.injective.network/developers-ai/injective-evm-developer-skill)
- [Injective precompiles](https://docs.injective.network/developers-evm/precompiles/)
- [Bank precompile](https://docs.injective.network/developers-evm/bank-precompile)
- [Exchange precompile](https://docs.injective.network/developers-evm/exchange-precompile)
- [Official Solidity interfaces and demos](https://github.com/InjectiveLabs/solidity-contracts)

## 2. Install the official development skills

Project-local installation is preferred so the version used by the team is visible in the workspace:

```powershell
npx skills add https://github.com/InjectiveLabs/agent-skills --skill injective-cli
npx skills add InjectiveLabs/agent-skills --skill injective-evm-developer
```

The alternative installer documented by Injective is:

```powershell
uvx upd-skill InjectiveLabs/injective-cli
```

Use `injective-cli` for `injectived` endpoint, wallet, gas, query, and transaction workflows. Use `injective-evm-developer` for Solidity, RPC, precompile, Hardhat/Foundry, deployment, and EVM diagnosis. Never place a seed phrase or private key in an agent prompt.

Example engineering prompts:

```text
Use injective-cli to query this inj1 testnet account's bank balances on injective-888. Read-only; do not transact.
```

```text
Use injective-evm-developer to diagnose a reverted call to precompile 0x64 on EVM chain 1439. Check ABI, denom mapping, sender balance, gas price, and explorer receipt.
```

## 3. Bootstrap and baseline

```powershell
npm install
npm --prefix hardhat install
npm test
npm --prefix hardhat test
npm run preflight
```

Only names are shown here; values belong in the project-root `.env` and must never be committed:

```dotenv
INJECTIVE_RPC_URL=https://k8s.testnet.json-rpc.injective.network
DEPLOYER_PRIVATE_KEY=0x...
INJECTIVE_MCP_SERVER_PATH=C:\path\to\InjectiveLabs\mcp-server\dist\mcp\server.js
```

Confirm the network before every live command:

```powershell
node --input-type=module -e "const r=await fetch('https://k8s.testnet.json-rpc.injective.network',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})}); console.log(await r.text())"
```

Expected chain ID: `0x59f`. Stop if any other value is returned.

## 4. Reproducible AgentBL workflows

### Deploy and verify the five-contract protocol

```powershell
npm run deploy:protocol
npm run verify:wave-b
```

Evidence is written to `docs/evidence/wave-b-protocol.json` and `docs/evidence/wave-b-gate.json`.

### SP-5 — Bank precompile / MTS USDC

Read-only parity check:

```powershell
npm run spike:bank
```

Live testnet write. This performs an explicitly disclosed **1 atomic USDC self-transfer** through the canonical MTS USDC entrypoint. `BankERC20._update()` then calls `0x64.transfer(from,to,amount)`, so the balance is preserved while a real native-bank state transition is produced:

```powershell
$env:SP5_LIVE_CONFIRM='injective-testnet'
npm run spike:bank:live
```

Acceptance evidence: `docs/evidence/injective-bank-precompile.json`.

### SP-6 — Exchange precompile

Read-only market and subaccount audit:

```powershell
npm run spike:exchange
```

Live testnet order lifecycle:

```powershell
$env:SP6_LIVE_CONFIRM='gold-hedge-testnet'
npm run spike:exchange:live
```

The script is intentionally narrow:

1. reads active markets through the official Injective MCP server;
2. queries isolated subaccount nonce `1` USDC/USDT balances through Exchange precompile `0x65` (nonce `0` is merged with Bank after Injective v1.10);
3. deposits canonical MTS USDC through `0x65`;
4. acquires test USDT on the real `USDT/USDC` spot market;
5. places a tiny post-only short on the real `GOLD/USDT PERP` market;
6. queries the exact order through the official MCP indexer and `0x65`;
7. cancels it and withdraws only the balance added by this run.

Acceptance evidence: `docs/evidence/injective-exchange-precompile.json`.

## 5. Incident diagnosis

| Symptom | Check | Recovery |
|---|---|---|
| `call to non-contract address 0x64/0x65` in a local fork | Generic Foundry/Hardhat forks do not implement Injective native precompiles | Run the live testnet spike, or use Injective's patched Foundry build for local precompile tests |
| Tx rejected with zero/minimum fee | Public RPC can report zero base fee | Scripts pin bounded `500000000` wei gas price; do not use an unbounded retry |
| `eth_estimateGas` stalls | Public testnet RPC estimation instability | Scripts use bounded gas limits and verify the explorer receipt |
| Bank and ERC-20 USDC balances differ | Wrong token address, wrong chain, or non-MTS token | Verify chain `1439`, canonical USDC address, and `erc20:<address>` denom |
| Exchange deposit succeeds but order fails | Wrong subaccount ID, quote denom, API-vs-chain numeric format, tick size, or insufficient margin | Re-run read-only audit; verify 32-byte subaccount, 18-decimal order fields, and native-decimal deposit amount |
| Order cannot be found | Indexer lag or CID mismatch | Poll by wallet + symbol, then match exact CID; do not invent an order hash |
| Commodity has no direct market | Market gap, not a software failure | Return `ineligible`; never substitute BTC/INJ as a cosmetic proxy hedge |
| RPC/indexer disagreement | Different finality/latency paths | Treat explorer receipt as tx truth; retry bounded indexer reads; retain tx hash and CID |

## 6. Safety and rollback

- All scripts pin EVM chain `1439`; mainnet is rejected.
- Live modes require separate explicit confirmation strings.
- Private keys are loaded only from `.env`; evidence contains addresses and hashes, never secrets.
- SP-6 uses a post-only limit order and cancels it after both indexer and precompile queries succeed.
- Cleanup withdraws only the subaccount delta created by the current run; pre-existing funds are preserved.
- If a live run stops after order creation, query `trade_limit_orders` with the official MCP server, match the recorded CID prefix `abl-gold-`, and cancel that exact order before retrying.

## 7. What is product runtime vs. engineering tooling

| Capability | Classification |
|---|---|
| AgentBL pricing engine, x402 service, protocol contracts | Product runtime |
| Bank/Exchange precompile calls in `src/injective` and live scripts | Sponsor-native integration / executable spike |
| Official Injective MCP market and order queries | External runtime adapter with explicit safety policy |
| `injective-cli` and `injective-evm-developer` skills | Developer tooling only |

This distinction is part of the demo claim: every Injective logo points to code, a reproducible command, or a real testnet transaction, without presenting development assistance as autonomous production execution.
