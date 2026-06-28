# AgentBL x402 Integration

> **AI pays for premium risk intelligence — on-chain audit trail included.**

## What is x402?

x402 is the HTTP 402 Payment Required protocol for Web3 APIs. Instead of subscription keys or API tokens, x402 lets AI agents pay for API access **per-request** using on-chain USDC settlement. The flow:

1. Client requests a protected endpoint → server returns **HTTP 402** with payment instructions
2. Client signs an **EIP-3009 TransferWithAuthorization** (gasless for the signer)
3. The **x402 facilitator** settles the payment on-chain
4. Server returns the unlocked data + a **PAYMENT-RESPONSE** header with the settlement txHash

Every payment is auditable — the chain records who paid, for what, and how much.

## Why x402 for AgentBL?

AgentBL's AI pricing engine needs the best possible risk intelligence to set accurate RWA issue prices. Free intel sources (offline RAG, cached prices) are good enough for a demo, but in production the AI should be able to **buy premium data** when the situation calls for it:

| Intel tier | Source | Cost | When to use |
|---|---|---|---|
| Free | Offline RAG corpus, cached data | $0 | Routine pricing |
| x402 Premium | Live xAPI + deep analysis + volatility forecasts | 0.001–0.002 USDC | Elevated risk, war scenarios, unusual routes |

The x402 integration gives AgentBL:
- **A new differentiator vs projects that only have free intel** — "our AI pays for better data"
- **On-chain payment evidence** — every premium intel purchase is recorded in PaymentOracle
- **Pricing impact tracking** — show how paid intel changed the AI's risk assessment
- **EIP-3009 gasless payments** — the White Agent wallet signs, the facilitator relays

## Architecture

```
                    ┌──────────────────────────────┐
                    │   Frontend (x402 Intel Market) │
                    │   Service catalog · Payment   │
                    │   flow viz · Smoke test       │
                    └──────────────▲───────────────┘
                                   │
            ┌──────────────────────┴──────────────────────────┐
            │              API Server (src/app/server.js)      │
            │                                                  │
            │  GET /api/x402/config           — service catalog│
            │  *   /api/x402/intel/premium-risk   — HTTP 402   │
            │  *   /api/x402/valuation/premium    — HTTP 402   │
            │  POST /api/x402/smoke            — E2E test      │
            └──▲──────────────────────────────────▲───────────┘
               │                                  │
    ┌──────────┴──────────┐          ┌────────────┴──────────────┐
    │  src/x402/server.js │          │  src/x402/client.js       │
    │  createX402Route()  │          │  createPaidFetch()        │
    │  buildPremiumRisk*  │          │  fetchPaidIntel()         │
    └─────────────────────┘          └────────────┬──────────────┘
                                                  │
                                   ┌──────────────┴──────────────┐
                                   │  src/x402/settlement.js     │
                                   │  recordPaymentEvidence()    │
                                   │  generatePaymentReceipt()   │
                                   └──────────────┬──────────────┘
                                                  │
                          ┌───────────────────────┴────────────────┐
                          │         Injective Testnet              │
                          │                                        │
                          │  PaymentOracle.sol                     │
                          │  · PaymentEvidenceLogged               │
                          │  · requestCount · serviceSpend         │
                          └────────────────────────────────────────┘
```

## Available x402 Services

| serviceId | Endpoint | Price | Description |
|---|---|---|---|
| `premium-risk` | `/api/x402/intel/premium-risk` | 0.001 USDC | Live xAPI world-risk signals + RAG deep analysis with full source citations |
| `premium-valuation` | `/api/x402/valuation/premium` | 0.002 USDC | Real-time commodity prices + historical comparables + volatility forecast |

## API Reference

### GET /api/x402/config

Returns the x402 service catalog and runtime configuration.

```json
{
  "ok": true,
  "services": [...],
  "network": "eip155:1439",
  "facilitatorUrl": "https://x402-facilitator.molandak.org",
  "configured": false
}
```

### GET /api/x402/intel/premium-risk

**Without payment:** Returns HTTP 402 with `PAYMENT-REQUIRED` header.

```bash
curl -s -i http://localhost:3000/api/x402/intel/premium-risk
# HTTP/1.1 402 Payment Required
# PAYMENT-REQUIRED: true
# X-Price-USDC: 0.001
# X-Network: eip155:1439
```

**With payment** (via `X402-Payment` header): Returns premium risk intel.

```json
{
  "ok": true,
  "service": "premium-risk",
  "events": [...],
  "deepIntel": [...],
  "before_quote": { "final_issue_price_usd": 0.80, ... },
  "after_quote": { "final_issue_price_usd": 0.76, ... },
  "delta": { "issue_price_delta_usd": -0.04 },
  "payment": { "status": "settled", "txHash": "0x...", ... }
}
```

### GET /api/x402/valuation/premium

Same HTTP 402 flow as premium-risk. Price: 0.002 USDC.

### POST /api/x402/smoke

End-to-end test of the full x402 flow. Returns step-by-step results with payment evidence.

```bash
curl -s -X POST http://localhost:3000/api/x402/smoke \
  -H "Content-Type: application/json" \
  -d '{"locale":"en"}'
```

## CLI Tools

### x402 Smoke Test

```bash
npm run smoke:x402
# → 402 challenge → payment → settlement → intel unlocked → config ✓
```

### Paid Intel Query

```bash
npm run x402:intel
npm run x402:intel -- --service premium-valuation
npm run x402:intel -- --case copper-sg-shanghai
```

## On-Chain: PaymentOracle.sol

Deployed on Injective Testnet alongside `AgentBLRWA` and `RiskPricingOracle`.

**Events:**

- `PaymentEvidenceLogged(uint256 indexed requestId, address indexed payer, string serviceId, uint256 amountMicrousd, string paymentRef, bytes32 responseHash, bytes32 quoteHash, bytes32 evidenceHash, string pricingAction)`
- `BatchPaymentEvidenceLogged(uint256 indexed fromRequestId, uint256 count, uint256 totalMicrousd)`

**Functions:**

- `logPaymentEvidence(...)` — Record a single payment
- `logBatchPaymentEvidence(...)` — Batch-record multiple payments
- `getServiceSpend(serviceId)` — Total spend per service
- `getPayment(requestId)` — Lookup a payment record

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `X402_NETWORK` | No | `eip155:1439` | CAIP-2 network identifier |
| `X402_FACILITATOR_URL` | No | `https://x402-facilitator.molandak.org` | Settlement relay URL |
| `X402_USDC_ADDRESS` | No | Monad DemoUSDC | USDC token for settlement |
| `WHITE_AGENT_PRIVATE_KEY` | No | — | Wallet that signs EIP-3009 payments |
| `X402_PAY_TO_ADDRESS` | No | — | Address receiving payments |

**Without x402 keys,** the endpoints still work — they return data directly (demo mode) without requiring payment. All x402 smoke tests pass using deterministic mock signatures.

## Verification

```bash
# Full x402 end-to-end verification
npm run check && npm run test && npm run smoke:x402

# Individual checks
npm run smoke:x402       # 402 challenge → payment → intel
npm run x402:intel       # CLI paid intel query
npm run dev              # → open http://localhost:3000 → "x402 Intel Market" tab
```

## Comparison: AgentBL vs RugRumble x402

| Feature | AgentBL | RugRumble |
|---|---|---|
| x402 protocol | ✅ HTTP 402 + EIP-3009 | ✅ HTTP 402 + EIP-3009 |
| Protected endpoints | 3 (risk + valuation + smoke) | 3 (reputation + approve + copy) |
| On-chain evidence | PaymentOracle (Injective) | RugRumbleArena (Monad) |
| Payment evidence fields | 8 fields incl. quoteHash, evidenceHash | 5 fields |
| Batch payment logging | ✅ | ❌ |
| Paid intel pricing impact | Before/after quote comparison | Risk delta only |
| Offline demo mode | ✅ Deterministic mock signatures | ❌ Requires config |
| npm script | `smoke:x402` + `x402:intel` | `smoke:x402` |
