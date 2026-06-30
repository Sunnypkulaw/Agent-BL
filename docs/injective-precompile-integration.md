# Injective Precompile Integration Decision (SP-5 / SP-6)

Last verified: 2026-06-30

## Outcome

AgentBL now has executable adapters, safety policy, tests, live scripts, and explorer-ready evidence for Injective's Bank and Exchange precompiles.

| Task | Decision | Why |
|---|---|---|
| SP-5 Bank / ERC20 | Promote canonical MTS USDC to P0 | ERC-20 and `x/bank` expose one canonical balance; no custom bridge or duplicated ledger is needed |
| SP-5 current `RWAToken` mapping | Defer to per-pool token V2 | The current contract stores `poolId => investor => balance`; it is a multi-pool receipt, not a standard single-asset ERC-20 |
| SP-6 copper/aluminum/soy/oil hedge | Block | Injective Testnet currently has no direct market; BTC/INJ proxy hedges are forbidden |
| SP-6 gold-cargo hedge | Enable as bounded spike | A live `GOLD/USDT PERP` market exists and a short directly offsets falling gold-cargo collateral recovery value |

## SP-5: one USDC balance across EVM and native modules

Injective's MultiVM Token Standard makes the Bank module the canonical balance store. For native testnet USDC:

```text
ERC-20 view:  0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d
Native denom: erc20:0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d
Bank call:    0x64.balanceOf(token, account)
ERC-20 call:  token.balanceOf(account)
Invariant:    both balances and metadata must match
```

The live write uses the canonical USDC contract's `transfer(recipient, amount)` with a 1-atomic self-transfer. The official `BankERC20._update()` implementation calls `0x64.transfer(from, to, amount)`; the token identity is the calling MTS contract. Calling `0x64` directly from an EOA would incorrectly identify the EOA itself as the token denom. The transaction, calldata selector, status, and before/after parity are stored in `docs/evidence/injective-bank-precompile.json`.

Why not map the existing RWA receipt immediately? `RWAToken.sol` represents many pools inside one address and requires both `poolId` and `investor` for `balanceOf`. A bank denom maps to one fungible token contract. Pretending these models are equivalent would create ambiguous native balances. The V2 path is one MTS-compatible ERC-20 per pool (or a factory), followed by ERC20-module token-pair creation and its documented 1 INJ anti-spam deployment fee.

## SP-6: economic gate before technical execution

The gate is implemented in `src/injective/hedgingPolicy.js`:

```text
commodity exposure
  -> exact underlying market exists?
  -> exact expected market ID/ticker/quote denom active?
  -> direct economic basis documented?
  -> bounded testnet order allowed
otherwise: ineligible
```

On the verified testnet market snapshot, the official MCP server returned active perpetuals including GOLD, BTC, ETH, INJ, LINK, and test markets. There was no direct copper, aluminum, soybean, crude-oil, or freight market. Therefore the flagship copper demo remains unhedged on Injective Exchange and the UI must not claim otherwise.

### Gold-cargo hedge economics

For a gold-backed trade-finance pool, investors redeem in stable value while recovery depends on the collateral value of the gold cargo. During the financing window, a gold-price fall reduces collateral coverage. A short GOLD perpetual has the correct first-order sign:

```text
gold price falls -> cargo collateral value falls
gold price falls -> short perpetual gains
net recovery value becomes less sensitive to gold price
```

The live spike uses a tiny notional, one-times economic exposure, a post-only limit order, no correlated proxy asset, and immediate cancellation after proof. It demonstrates the execution rail without presenting a test order as a production hedge program.

### Real order/query lifecycle

```text
MTS USDC bank balance
  -> Exchange precompile deposit to isolated subaccount nonce 1
  -> real USDT/USDC spot conversion
  -> real GOLD/USDT post-only short order
  -> official MCP indexer query by wallet/CID
  -> Exchange precompile query by exact order hash
  -> Exchange precompile cancel
  -> withdraw only run-created subaccount deltas
```

The order hash is never guessed or fabricated. It is discovered from the official Injective indexer and then independently queried through precompile `0x65`. Evidence is stored in `docs/evidence/injective-exchange-precompile.json`.

## Judge-facing claim

> AgentBL uses Injective's MultiVM token standard for one canonical USDC balance and only activates native Exchange hedging when the chain has a direct market for the financed commodity. Today gold qualifies; copper does not. The protocol fails closed instead of manufacturing correlation.

That claim is narrower than “every RWA is automatically hedged,” and far stronger under technical questioning.
