<div align="center">

# 🛡️ AgentBL

### When AI Agents Carry Real Financial Weight · 当 AI Agent 承担真实金融职责

**Your cargo is at sea. Your capital is locked for 45 days. An AI Agent watches the risk — and the market pays it to do so.**

**🏆 你的货在海上漂，钱还要等 45 天。谁来替你盯风险？AI Agent 盯——而且市场为它的每一次判断付费。**

[![Injective Nova](https://img.shields.io/badge/Injective_Nova-2026-0B60FF)](https://injectivenova.com)
[![Track](https://img.shields.io/badge/Track-AI_Payments_×_RWA-D6336C)](#)
[![Award](https://img.shields.io/badge/Focus-Killer_AI_App-5A45FF)](#)
[![tests](https://img.shields.io/badge/tests-300_passing-2EA043)](#)
[![contracts](https://img.shields.io/badge/contracts-11_passing-2EA043)](#)
[![Injective](https://img.shields.io/badge/Injective-Testnet-0B60FF)](https://testnet.blockscout.injective.network/address/0x4a03B5707eEBFc88f56f6E6a99b5D98466B31c94)
[![MCP](https://img.shields.io/badge/MCP-Server-1F6FEB)](#)
[![x402](https://img.shields.io/badge/x402-Live_Settlement-D6336C)](#)
[![deps](https://img.shields.io/badge/deps-x402_pinned-1F6FEB)](#)
[![offline](https://img.shields.io/badge/demo-offline_ready-1F6FEB)](#)
[![license](https://img.shields.io/badge/license-MIT-3FB950)](./LICENSE)

**🌐 Language / 语言 — [🇬🇧 English](#english) · [🇨🇳 简体中文](#chinese)**

</div>

---

<a name="english"></a>

## 🇬🇧 English

### 💡 The Big Idea

**An AI Agent doesn't just chat. It prices risk. The market pays it for every judgment. The chain makes it irreversible.**

In global trade, cargo ships but cash is locked for 30–45 days. Traditional trade finance relies on centralized institutions to assess risk and set prices — slow, opaque, and prone to single-point failure.

AgentBL turns this around with three moves:

1. **An AI Pricing & Risk Agent underwrites every deal.** It reads the cargo, route, documents, and live world-risk signals — then issues an explainable, auditable issue price. Not a chatbot. An underwriter.

2. **Every risk assessment is a paid transaction.** Through the **x402 protocol**, market participants pay micro-amounts (as low as $0.001 USDC) to unlock AI risk reports. Each payment is signed by the buyer's wallet, settled on-chain, and permanently recorded. The AI Agent earns its keep — literally.

3. **The pricing gets smarter with every report.** Each paid report anchors risk evidence on-chain. As more independent assessments accumulate, the fair price of any cargo emerges from the market — not from a single institution. The chain is the auditor; the AI is the underwriter; the market is the pricing committee.

> **One-line pitch:** *An AI Agent that prices real-world risk — and the market pays it for every call.*

### ✨ Highlights — why this is more than "another RWA dApp"

| | Highlight | What makes it stand out |
|---|---|---|
| 🤖 | **The AI underwrites — it doesn't chat** | The agent decides the *issue price, financing cap and on-chain action*. It carries a real financial function, not a help-desk bubble. Every call is an economic event. |
| 💰 | **x402 Paid Intel Market — AI reports are bought, not given away** | Market participants pay via **x402** (HTTP 402 + EIP-3009 in Live mode) to unlock risk, valuation, or anti-fraud reports. Each payment: wallet-signed authorization → facilitator settlement → `PaymentOracle` attestation → report delivered. The AI Agent earns revenue; the buyer earns an information edge. |
| 🛡️ | **A genuine Security / Risk Agent** | Before pricing, it runs **anti-fraud document forensics**: cross-checks eBL vs invoice vs insurance for quantity mismatch, mis-invoicing, under-insurance, a policy expiring before arrival — each folded into the price in basis points. |
| 🧠 | **Pricing grounded in verifiable profit** | The discount isn't a hand-waved LTV. It equals the exporter's *financing cost*, taken as a **share of verified trade profit** `P = invoice − cost_of_goods`. Fully explainable. |
| 🔭 | **It sees through deceptive signals** | When war spikes the copper price, a price oracle thinks the collateral is *safer*. The agent knows war premium is a **correlated double-edge** (default ↑, insurance void, recovery ↓) and does the opposite: haircut + **PAUSE**. |
| 🔗 | **Grounded, tool-using, retrieval-backed** | Tool calls for live LME price, regional premium and UN Comtrade historical comparables; a RAG retriever cites macro-risk intel with sources → an auditable **evidence graph**. |
| 🌐 | **Live real-world risk via xAPI** | Pulls X/Twitter, Google News and prediction-market (Polymarket-style) signals through [xAPI](https://xapi.to), maps them to structured risk events, and folds them into the price — *the AI prices live world events on this cargo*. No key? Offline fixtures keep the demo running. |
| ⛓️ | **Live on Injective Testnet, with safety rails** | Every decision is anchored on-chain with `quote_hash` / `evidence_hash`. The LLM **never** sets the final price alone — a deterministic engine + schema guardrail validate it; **300 Node + 24 Solidity tests** guard the invariants. |

### 💰 x402 Paid Intel Market — the AI Agent earns its keep

This is the economic engine of AgentBL. The AI doesn't just analyze risk — it **sells its analysis** through a live x402 payment rail.

**How it works:**

```
Buyer clicks "Get AI Risk Report"
        ↓
Server returns HTTP 402 + challenge   ← "This report costs 0.001 USDC"
        ↓
Buyer signs EIP-3009 authorization    ← wallet signs TransferWithAuthorization
        ↓
Facilitator settles on-chain          ← USDC moves from buyer to protocol
        ↓
PaymentOracle attests the payment     ← immutable on-chain evidence
        ↓
AI report unlocks immediately         ← risk data feeds into RWA pricing engine
```

**Three reports, three prices:**

| Service | Price | What you get |
|---------|-------|-------------|
| 🔍 Premium Risk Intelligence | 0.001 USDC | Live xAPI world-risk signals + RAG deep analysis with full citations |
| 💎 Premium Cargo Valuation | 0.002 USDC | Real-time commodity prices + historical comparables + volatility forecast |
| 🛡️ Anti-Fraud Document Review | 0.0015 USDC | Five-dimension eBL/invoice/insurance consistency check with pricing impact |

**Why participants pay:**

| Motive | Economic logic |
|--------|---------------|
| **Information edge** | Pay $0.001 to know before the market whether this cargo is risky — avoid a bad buy or catch an undervalued deal |
| **Pricing influence** | Every purchased report feeds into the RWA pricing engine. Buy more reports → your judgment carries more weight in the market price |
| **Audit trail protection** | Chain record proves due diligence: "68 out of 100 independent assessments flagged high risk — I priced accordingly" |

> **x402 ≠ RWA subscription.** Paying cents over x402 *buys an AI report*; subscribing to an offering *invests capital*. Two different transactions — see [x402 vs RWA](./docs/x402-integration.md#two-different-businesses-x402-report-payment-vs-rwa-subscription).

### 🧠 The core innovation — discount built on verifiable trade profit

Most RWA protocols price with a hand-waved LTV and a fixed rate. AgentBL's price is **economically grounded and explainable**:

```text
gross_profit  P = invoice_value − cost_of_goods          ← exporter's verifiable margin
financing_cost  = share × P                              ← the discount investors earn = exporter's financing cost
issue_price     = cash / (cash + share × P)              ← the issue price (a discount to the $1.00 target)
```

`share` (how much of the margin is given up) has two drivers, with a collateral floor on top:

| Lever | Effect | Values |
|---|---|---|
| **Payout speed** `payout_speed` | faster → give up more margin → lower price | FAST `0.50` · BALANCED `0.33` · LOW_COST `0.20` |
| **Trade risk** `risk` | war / weather / port / insurance / volatility → add share → lower price | scored in bps by `scoreRisk` |
| **Collateral coverage** | AI-verified cargo value sets a **price floor**; exposure can't exceed safe coverage | can only *raise* the price |

So for the same cargo: **more urgency or more risk → lower issue price → higher investor implied yield.**
`$1.00` is a **target redemption value, not a capital guarantee.**

**Reference case — clean copper, Singapore → Shanghai** (cash $3.3M, P $1.375M, risk 350bps MEDIUM):

| Speed | Margin given up | Issue price | Investor upside | Action |
|---|---:|---:|---:|---|
| FAST | 60% | **$0.80** | 25.0% | OPEN |
| BALANCED | 43% | **$0.85** | 17.9% | OPEN |
| LOW_COST | 30% | **$0.89** | 12.5% | OPEN |

### 🎯 Why AI is non-negotiable here

> The sharpest question a judge can ask: *"Discounted issuance, target redemption $1.00 — isn't the
> investor just buying low and selling high, risk-free? What's the AI even for?"* This is the answer.

```text
① RWA issued at a discount: investor buys at $0.80, target redemption $1.00
② Trap: looks risk-free — so isn't the AI just decoration?
③ Break: $1.00 is a TARGET, not a guarantee — defaults happen, investors can lose
④ So that $0.20 discount isn't free profit — it's THE PRICE OF DEFAULT RISK
⑤ Who sets that price? The AI — before investors subscribe
⑥ Why it must be right up front: cash is wired to the exporter at Funded while the cargo is still at sea;
   repricing afterwards can't protect money already in → the discount is the only pre-paid compensation
⑦ The AI does three jobs: conservative valuation (the cap) · risk → discount (the price) · open/reprice/pause (the gate)
⑧ Ultimate test = war: a price oracle sees copper ↑ and thinks "safer"; the AI knows war premium is a
   correlated double-edge (default ↑ / insurance ↓ / recovery ↓) and goes the other way — haircut + PAUSE
```

**Proof of ③ — same copper, three settlements (`npm run demo:default`):**

| Settlement | What happened | Investor P&L |
|---|---|---:|
| ✅ Repaid | Importer pays, normal redemption | $0.80 → **$1.00**, **+25%** |
| ❌ Tail default | War crashes copper + importer abandons cargo + war-exclusion voids insurance | $0.80 → recovers only **$0.698**, **−12.8%** |
| 🟡 Mild default | Importer bankrupt but cargo intact, sold near market | $0.80 → **$1.00**, made whole by over-collateral |

**Proof of ⑧ — pre-war vs war-crisis (real engine output):**

| | Pre-war (warning) | War crisis (critical) |
|---|---|---|
| Risk score | 350bps · MEDIUM | **1410bps · CRITICAL** |
| AI-verified collateral | $6,531,250 | **$5,141,500 (−21%)** |
| AI action | OPEN @ $0.80 | **PAUSE (refuses to open)** |

### 🏗️ Architecture

```text
        ┌───────────────────────────────────────────────────────────────┐
        │          Frontend Dashboard  (public/ · zero-dep SPA)          │
        │  case picker · exporter quote · AI pricing waterfall ·         │
        │  investor subscribe · voyage tracking · contract timeline      │
        └───────────────▲───────────────────────────────▲───────────────┘
                        │ fetch (one shared PricingQuote) │
        ┌───────────────┴───────────────────────────────┴───────────────┐
        │                    API service  (src/app/server.js)            │
        │   /api/pricing/quote · /api/offering/simulate · /api/oracle/…  │
        └───────────────▲───────────────────────────────▲───────────────┘
                        │                                │
   ┌────────────────────┴───────────┐      ┌─────────────┴──────────────────┐
   │   AI pricing engine (src/core) │      │   MCP / RAG / Skill (src/…)     │
   │  pricingEngine · scoreRisk ·   │      │  7 tools · 3 JSON resources     │
   │  offeringSimulator · oracle    │      │  judge Q&A assistant            │
   └────────────────────┬───────────┘      └─────────────────────────────────┘
                        │ quote_hash / evidence_hash
        ┌───────────────┴───────────────────────────────────────────────┐
        │     Solidity contracts (hardhat/)  ·  LIVE on Injective Testnet   │
        │  AgentBLRWA · RiskPricingOracle · RWAOfferingPool · …       │
        └───────────────────────────────────────────────────────────────┘
```

**Key design:** the AI engine, backend, frontend, contracts and MCP tools all revolve around **one
structured `PricingQuote`** (`src/core/pricingSchema.js`), guarded by invariants (redemption exposure ≤
safe coverage; `base − urgency − risk = indicative`; `final ≥ indicative`).

### ⛓️ Live on Injective Testnet

The permissionless demo contract `AgentBLRWA` is **already deployed and verifiable**:

| | |
|---|---|
| **Network** | Injective Testnet (chainId `1439`) |
| **Contract** | [`0x4a03B5707eEBFc88f56f6E6a99b5D98466B31c94`](https://testnet.blockscout.injective.network/address/0x4a03B5707eEBFc88f56f6E6a99b5D98466B31c94) |
| **Deploy tx** | [`0xf1cb0a86…3ef128`](https://testnet.blockscout.injective.network/tx/0xf1cb0a86074d9a9aa0868216a6c6c3d64295ef2d52289a59cf62ffc67a3ef128) |

Connect MetaMask (Injective Testnet) in **View ①** and click **Mint** to produce a real, signed on-chain
transaction. No wallet / not deployed? The demo falls back to a high-fidelity simulated transaction —
**it never breaks offline.**

### 🚀 Quick Start

```bash
# 1) Install lockfile-pinned runtime dependencies
npm install

# 2) Start the web + API server
npm run dev

# 3) Open the dashboard
#    → http://localhost:3000
```

> Windows PowerShell: if you see `npm.ps1 cannot be loaded`, use `npm.cmd run dev`.

Success looks like:

```text
AgentBL Agent harness running at http://localhost:3000
```

**Requirements:** Node.js ≥ 20 · a modern browser · **no API key in Demo Mode** (a built-in deterministic
fallback runs the full demo offline).

The x402 payment layer pins `@injectivelabs/x402@0.0.1` and `express@5.2.1`. The lockfile overrides
`ws` to patched `8.21.0` because the version selected transitively by `viem` is affected by
GHSA-96hv-2xvq-fx4p. `@x402/core`, `@x402/evm`, and `@x402/fetch` are intentionally not installed:
AgentBL uses one protocol implementation and adds them only if a tested client gap requires it.

### 🛠️ Operation Manual

Two paths: **A. local zero-config demo** (recommended first; simulated minting, no wallet/keys/network) and
**B. deploy to Injective Testnet for real on-chain** transactions.

#### A. Local zero-config demo (5 steps)

1. Install Node ≥ 20 — verify with `node -v`.
2. Enter the project root: `cd AgentBL-AI`.
3. Start the server: `npm run dev` (Windows: `npm.cmd run dev` if PowerShell blocks the script).
4. Open `http://localhost:3000`.
5. Follow the **two-UI walkthrough** below. The top bar shows `○ Contract not deployed · simulated minting`, and the Mint button produces a **high-fidelity simulated transaction** — the demo is complete and network-independent.

#### B. Deploy to Injective Testnet for real on-chain (8 steps)

> Goal: the top bar turns `● Contract deployed`; clicking **Mint** in View ① pops MetaMask and produces a **real Injective transaction**.

1. **Install MetaMask** and add Injective Testnet — chain ID `1439`, RPC `https://k8s.testnet.json-rpc.injective.network`.
2. **Create a throwaway wallet** for deployment — ⚠️ never use a wallet holding real assets.
3. **Get testnet INJ** (~0.1 INJ is plenty) from the [Injective Testnet Faucet](https://testnet.faucet.injective.network/).
4. **Prepare an RPC URL** — public node `https://k8s.testnet.json-rpc.injective.network`, or your own endpoint.
5. **Export the deployer private key** (MetaMask → account details → export). Use it **only** for this test wallet.
6. **Create `.env`** in the project root (other LLM keys can stay empty — the engine has a deterministic fallback):
   ```bash
   INJECTIVE_RPC_URL=https://k8s.testnet.json-rpc.injective.network
   DEPLOYER_PRIVATE_KEY=0xyour_key_from_step_5
   ```
   > `.env` is gitignored. See `.env.example` for all fields.
7. **Install contract deps & deploy:**
   ```bash
   cd hardhat
   npm install                          # first time only (~1 min: hardhat + ethers)
   npm run deploy:injective   # deploys AgentBLRWA to Injective Testnet
   ```
   The script **auto-writes the address + ABI into `public/chain-config.json`** — no manual frontend edit.
8. **Connect the wallet & mint:**
   ```bash
   cd ..          # back to project root
   npm run dev
   ```
   Open `http://localhost:3000` → top bar shows `● Contract deployed` → **View ①** → "🦊 Connect wallet" (it will prompt to switch to Injective Testnet) → enter a financing amount → "⛓ Mint RWA on-chain" → **sign in MetaMask** → the result card shows `tx_hash` (explorer link), `poolId`, and the on-chain RWA balance read back.

#### C. The two UIs

**View ① — "Tokenize eBL · Mint RWA"**
1. Pick a **trade case** from the top bar (start with `Clean copper`).
2. Read **AI cargo valuation & route risk**: AI-verified collateral, a five-dimension route risk score, and each item's **data source**.
3. Read the **AI pricing waterfall**: how the issue price steps down from $1.00.
4. In **Financing & Mint**, choose **payout speed** (FAST/BALANCED/LOW_COST), enter a **financing amount**, see RWA quantity & issue price update live.
5. Click **"⛓ Mint RWA on-chain"** → real transaction (deployed) or simulated (not deployed).

**View ② — "Voyage tracking · live pricing"**
1. Click "② Voyage tracking" in the top nav.
2. Watch the **ship move along the route** on a virtual clock; hover the ship for the current virtual time + leg; play / pause / drag.
3. **Live RWA pricing**: large live issue price (flashes on change), implied yield, risk level/score, subscription progress.
4. Click an **emergency event** (🌪 typhoon / ⚔ Hormuz escalation / 🧭 reroute / 🛡 insurance denied) → the AI **reprices or pauses live**, the price visibly drops, the timeline shows Repriced/Paused.
5. "↺ Reset voyage" returns to the initial pricing.

#### D. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Top bar stuck on `○ Contract not deployed` | Path B not run, or `contracts.AgentBLRWA` empty in `public/chain-config.json`. Re-run step 7. |
| "Connect wallet" does nothing | MetaMask not installed (minting falls back to simulated). Install and refresh. |
| MetaMask "insufficient funds" | Deployer wallet has no INJ — back to step 3. |
| `deploy` errors `Missing DEPLOYER_PRIVATE_KEY` | `.env` not in the project root, or field misnamed — recheck step 6. |
| Mint tx pending forever | Testnet congestion — wait or increase gas in MetaMask. |
| Want a new contract address | Re-run step 7; it overwrites `chain-config.json`. |

### ⌨️ CLI tools

Commands run **offline by default** (deterministic fallback when no API key is
set). Commands explicitly containing `:live` perform testnet network writes.

| Command | What it does |
|---|---|
| `npm run dev` | Start the web + API server (`http://localhost:3000`) |
| `npm run demo` | CLI main flow: prints RWA issue price, investor yield, risk factors, on-chain hashes, AI narrative |
| `npm run demo:default` | "Can investors lose?" — same copper across **repaid / tail-default / mild-default** settlements with P&L |
| `npm run price` | Print a PricingQuote for the demo case |
| `npm run scenarios` | Multi-scenario regression: legacy RiskReport + AI pricing (fast / balanced / reprice / pause) |
| `npm run qa` | Judge Q&A rehearsal (real pricing numbers + RAG citations; `-- "your question"` for one question) |
| `npm run mcp` | Demo the MCP tool chain (get_trade_case → search → price → simulate → push oracle) |
| `npm run mcp:stdio` | Start the standards-compliant MCP SDK stdio server (exactly 7 tools + 3 resources) |
| `npm run agent:value` | Run the AI cargo-valuation tools (live price / historical comparables / valuation; offline fallback) |
| `npm run intel` | **Live world-risk via xAPI**: X/Twitter + news + prediction-market signals → risk events → re-priced quote (offline fixtures with no key) |
| `npm run smoke:x402` | **Demo-safe x402 end-to-end**: HTTP 402 challenge → signed retry → simulated settlement → premium intel unlocked |
| `npm run smoke:x402:live` | **Testnet-only Live proof**: official V2/EIP-3009 → real USDC tx → paid report → `PaymentAttested` (requires funded test wallet) |
| `npm run x402:intel` | CLI paid intel query — pay for and display premium risk/valuation data |
| `npm run verify:wave-b` | Re-verify payment → report → attestation → pricing → quote on Injective Testnet |
| `npm run smoke:mcp:injective` | Official Injective MCP query + controlled allowlisted raw-EVM smoke (funded test wallet required) |
| `npm run check` | Low-cost self-check: files, scripts, seed data, engine integrity |
| `npm run test` | Full unit / integration suite (`node --test`, **300 passing**) |
| `npm run smoke` | Spin up a temp server and smoke-test the key APIs |

The hardened PaymentOracle is deployed on Injective Testnet at
[`0x36d9…4571`](https://testnet.blockscout.injective.network/address/0x36d9Ff1256b3db1EFC1EAcB4c9b5033165D24571).
X402-15 passed on 2026-06-29 using an explicit test-only self-transfer: the official V2 flow settled
[0.001 testnet USDC](https://testnet.blockscout.injective.network/tx/0x6d796d39de0de3becd57f2c8b0ff72e6baf33e570259530cb294ff819d1a0b49),
unlocked report `rpt_3e5f…3334`, and emitted
[`PaymentAttested`](https://testnet.blockscout.injective.network/tx/0xa03ab9622dbc1af7bd448af2a52b5322963abf65853916dc13c75a139adfef6e).
The reproducible evidence is saved in `docs/evidence/x402-live-smoke.json`.

**Wave B is complete:** the same paid-report hash now links the payment and `PaymentAttested` above to
[`PricingUpdated`](https://testnet.blockscout.injective.network/tx/0xee6b6520c040662f3644c2514de628baa2351abe185623e9c22dbbcab76bbac3)
and the final `$0.80` RWA quote. Five protocol contracts are deployed and lifecycle-smoked; the MCP server is
a real SDK stdio server with 7 tools + 3 resources, and the official Injective MCP adapter has a successful
[controlled raw-EVM transaction](https://testnet.blockscout.injective.network/tx/0x1578c10144a6216d8580eabc1497ee02c99a435c20cd315c1492fc0d78d8984f).
See [`docs/wave-b.md`](./docs/wave-b.md) for addresses, commands, evidence, and the upstream compatibility note.

> One-shot pre-demo verification:
> ```bash
> npm run check && npm run test && npm run smoke && npm run scenarios && npm run demo
> ```

### 🔌 API reference

After `npm run dev`, all endpoints are at `http://localhost:3000`. A POST with an empty body defaults to `data/demo-case.json`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/cases` | Structured case catalog (drives the frontend picker) |
| POST | `/api/pricing/quote` | Generate a PricingQuote; `?compare=true` returns all three speeds + a recommendation |
| POST | `/api/offering/simulate` | Simulate the offering lifecycle; `events` can escalate risk in transit |
| POST | `/api/workflow/pricing-simulate` | One call → PricingQuote + RiskReport + offering |
| POST | `/api/oracle/pricing-update` | On-chain oracle update payload (incl. `quote_hash` / `evidence_hash`) |
| GET/POST | `/api/scenarios` · `/api/scenarios/run` | Scenario regression |
| GET/POST | `/api/mcp/tools` · `/api/mcp/call` | MCP tool list / call |
| POST/GET | `/api/rag/search` · `/api/rag/judge-qa` | RAG search / judge Q&A |
| POST | `/api/intel/world-risk` | Live xAPI world-risk sweep → events + signals + before/after re-priced quote |
| GET | `/api/x402/config` | x402 paid-report service catalog + network/facilitator config |
| GET/POST | `/api/x402/intel/premium-risk` · `/valuation/premium` · `/documents/fraud-review` | Paid AI reports — HTTP 402 before payment (see [`docs/x402-integration.md`](./docs/x402-integration.md)) |
| GET | `/api/x402/report/:id` | Re-read an already-paid report within its TTL (no second charge) |

> **x402 ≠ RWA.** Paying cents over x402 *buys an AI report*; subscribing to an
> offering *invests capital in the RWA*. Two different transactions — see the
> [x402 vs RWA section](./docs/x402-integration.md#two-different-businesses-x402-report-payment-vs-rwa-subscription).

**Compare three payout speeds:**
```bash
curl -s -X POST "http://localhost:3000/api/pricing/quote?compare=true"
# → quotes[FAST|BALANCED|LOW_COST] + recommended_payout_speed
```

**Inject war risk in transit and watch the AI pause:**
```bash
curl -s -X POST http://localhost:3000/api/offering/simulate \
  -H "Content-Type: application/json" \
  -d '{"payout_speed":"BALANCED","events":[{"category":"macro","type":"war_risk","severity":"critical","region":"Strait of Hormuz"}]}'
# → final_state: "Paused"
```

### 🤖 Connect a real LLM / live data (optional)

**Fully offline by default:** with no key set, AI valuation and narration use a deterministic fallback
(mock data calibrated to June 2026), so the demo always runs. To use a real LLM / live quotes, copy
`.env.example` → `.env` and fill in:

| Variable | Notes |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek (`deepseek-chat`), OpenAI-compatible |
| `DASHSCOPE_API_KEY` | Qwen (DashScope OpenAI-compatible mode) |
| `Tencent_API_KEY` | Tencent Hunyuan (locked to `hy3-preview`; highest priority when set, auto-fallback) |
| `LLM_BASE_URL` / `LLM_API_KEY` | Any OpenAI-compatible endpoint |
| `ALPHAVANTAGE_API_KEY` / `METALPRICE_API_KEY` | Live copper price (USD/MT) |
| `COMTRADE_PRIMARY_KEY` | UN Comtrade historical comparables (by HS code, free) |
| `XAPI_KEY` | [xAPI](https://xapi.to) — live world-risk signals (X/Twitter · news · prediction markets) for `npm run intel` / `/api/intel/world-risk`. Register: `npx xapi-to register` (invite `xapito`). See [`docs/xapi-integration.md`](./docs/xapi-integration.md). |

> ⚠️ `.env` is gitignored; never commit any `*_API_KEY`.


### ⛓️ Smart contracts (Hardhat)

```bash
cd hardhat
npm install
npx hardhat compile
npx hardhat test          # 24 passing
```

| Contract | Role |
|---|---|
| `AgentBLRWA.sol` | **The deployed, permissionless demo contract.** `tokenize(...)` mints RWA from an AI quote and emits `Tokenized`; `reprice(...)` emits `Repriced`. Carries `quoteHash` / `evidenceHash`. |
| `RiskPricingOracle.sol` | `updatePricing(poolId, issuePrice, riskLevel, action, evidenceHash)` → emits `PricingUpdated`, persists the latest quote/evidence hash |
| `RWAOfferingPool.sol` | Pledged-eBL-gated `createOffering / subscribe / reprice / pause / resume / settle` |
| `EBLRegistry.sol` · `RWAToken.sol` | eBL V2 cargo uniqueness, structured metadata, transfer/endorsement/pledge history; investor RWA share token |

The backend's `/api/oracle/pricing-update` payload maps one-to-one onto the oracle call; the frontend
"Push to oracle" sends exactly that payload.

### 🧩 MCP / RAG / Skill (agentic extras)

- **MCP server** (`src/mcp/`): official SDK stdio lifecycle with exactly 7 tools and 3 read-only JSON resources. It adds `verify_trade_documents` and a real 402 middleware traversal in `purchase_premium_analysis`; chain writes are pinned, allowlisted, capped, approval-gated, and dry-run by default. `generate_pricing_quote` still reuses the same `quoteFromCase`, so MCP, backend and frontend emit an **identical PricingQuote**.
- **RAG** (`src/rag/` + `data/risk-intel/`): a macro-risk intelligence corpus (war / sanctions / port / weather / commodity / FX); the AI cites entries when widening the risk discount.
- **Skill** (`src/skill/`): `pricingAnalyst` (pricing analysis) and `demoOperator` (one-click demo orchestration).
- **Judge Q&A assistant** (`src/agent/judgeAssistant.js`): `npm run qa` — answers with real pricing numbers + intel citations, never contradicts the engine, always keeps the "not capital-guaranteed" framing.
- **Autonomous pipeline** (`src/agent/documentParser.js`, `orchestrator.js`, `autonomousAgent.js`, `decisionLogger.js`): parses trade documents with provenance, produces one deterministic opening decision, maps six event families to protocol actions, and persists idempotent execution/tx audit records across restarts.

### 📁 Project structure

```text
AgentBL-AI/
├── README.md              # this file
├── 基础说明.md            # team onboarding / harness background (original README)
├── package.json           # npm scripts
├── .env.example           # optional LLM / market-data keys
├── data/
│   ├── demo-case.json         # main demo case (copper · SG → Hamburg)
│   ├── cases/                 # structured cases (clean / war-crisis / crude)
│   ├── pricing-scenarios/     # AI pricing regression
│   ├── uploads/               # realistic eBL + commercial invoice
│   └── risk-intel/feed.json   # RAG risk intelligence
├── public/                # frontend (zero-dep ES-module SPA)
├── src/
│   ├── app/server.js          # HTTP + API
│   ├── core/                  # pricingEngine · pricingSchema · offeringSimulator · oracle · pricingWorkflow
│   ├── agent/                 # parser · orchestrator · autonomous execution · audit log · valuation/risk agents
│   ├── mcp/  ·  rag/  ·  skill/
├── hardhat/               # Solidity contracts + tests
├── scripts/               # check / demo / smoke / scenarios / price / qa / mcp / agent-valuation
├── tests/                 # node --test (300 passing)
└── docs/                  # PRD · background · contracts · tasks · acceptance · award-roadmap
```

### ✅ Verification matrix

| Command | Verifies | Status |
|---|---|---|
| `npm run check` | files / scripts / seed / engine integrity | ✅ |
| `npm run test` | unit + integration (pricing invariants, autonomous Agent, schema, MCP, contract mock…) | ✅ 300 passing |
| `npm run smoke` | key APIs end-to-end | ✅ |
| `npm run smoke:x402` | x402 paid-intel flow (HTTP 402 → payment → settlement → intel) | ✅ |
| `npm run scenarios` | fast / balanced / reprice / pause regression | ✅ |
| `cd hardhat && npx hardhat test` | Solidity contract suite | ✅ 24 passing |
| `npm run verify:wave-b` | live payment/report/attestation/pricing/quote trace | ✅ testnet evidence |

### 🔒 Compliance boundary

This is a hackathon prototype. It **deliberately does not** do: real KYC, real cross-border payment,
real mainnet deployment, public fundraising, capital/yield guarantees, or an open secondary market.
`$1.00` is always a **target redemption value**, contingent on importer payment, cargo settlement and
insurance coverage. The demo uses permissioned mock investors only.

### 📚 More docs

- [`基础说明.md`](./基础说明.md) — team workflow, onboarding, harness background
- [`docs/PRD.md`](./docs/PRD.md) — product requirements & pricing model v0.2
- [`docs/background.md`](./docs/background.md) — eBL / RWA / trade-finance primer
- [`docs/contracts.md`](./docs/contracts.md) — frozen contract interfaces
- [`docs/x402-integration.md`](./docs/x402-integration.md) — x402 paid-report market, threat model, FAQ, and x402-vs-RWA distinction
- [`docs/award-roadmap.md`](./docs/award-roadmap.md) — capability & award roadmap
- [`docs/ai-valuation-tooling.md`](./docs/ai-valuation-tooling.md) — AI valuation tool-calling
- [`docs/xapi-integration.md`](./docs/xapi-integration.md) — live world-risk signals via xAPI (X/Twitter · news · prediction markets)

<div align="right"><a href="#english">↑ back to top</a></div>

---

<a name="chinese"></a>

## 🇨🇳 简体中文

### 💡 核心创意

**AI Agent 不只是聊天。它给风险定价。市场为它的每一次判断付费。链上不可篡改。**

国际贸易中，货已装船、钱还锁着 30–45 天。传统贸易金融靠中心化机构评估风险、制定价格——慢、不透明、单点故障。

AgentBL 用三步翻转这个局面：

1. **AI 定价与风控 Agent 承保每笔交易。** 它读懂货物、航线、单据、实时世界风险信号，输出可解释、可审计的发行价。不是客服聊天框，是 AI 承保人。

2. **每次风险评估都是一笔付费交易。** 通过 **x402 协议**，市场参与者支付微小金额（低至 0.001 USDC）解锁 AI 风险报告。每笔支付：钱包签名授权 → Facilitator 链上结算 → PaymentOracle 存证 → 报告即时交付。AI Agent 凭本事挣钱——字面意义上的。

3. **报告越多，定价越准。** 每份付费报告将风险证据锚定在链上。独立评估越多，任何一批货的公允价格就越从市场中浮现——而不是某一家机构说了算。链是审计师，AI 是承保人，市场是定价委员会。

> **一句话 Pitch：** *一个给真实世界风险定价的 AI Agent —— 市场为它的每一次判断付费。*

### ✨ 项目特色 —— 为什么这不是「又一个 RWA dApp」

| | 特色 | 凭什么脱颖而出 |
|---|---|---|
| 🤖 | **AI 在做承保，不是在聊天** | Agent 决定的是*发行价、融资额度、链上动作*——它承担真实金融职责，而不是一个客服气泡。每次调用都是一个经济事件。 |
| 💰 | **x402 付费情报市场 — AI 报告靠卖，不靠送** | 市场参与者通过 **x402**（Live 模式为 HTTP 402 + EIP-3009）付费解锁风险、估值或反欺诈报告。每笔支付：钱包签名授权 → Facilitator 链上结算 → PaymentOracle 存证 → 报告交付。AI Agent 赚取收入，买家赚取信息优势。 |
| 🛡️ | **一个真正的安全 / 风控 Agent** | 定价前先做**反欺诈审单**：交叉核验 eBL / 发票 / 保险——数量是否一致、发票是否高低开、保险是否不足额、保单是否在到港前过期，每项都折成风险基点压进价格。 |
| 🧠 | **定价建立在可验证的利润上** | 折价不是拍脑袋的 LTV。它等于出口商的*融资成本*，并取自其**可验证贸易利润** `P = 发票 − 拿货成本` 的一个份额。完全可解释。 |
| 🔭 | **能看穿欺骗性信号** | 战争推高铜价时，价格预言机以为抵押*更安全*；Agent 知道战争溢价是**相关性双刃剑**（违约↑、保险失效、回收↓），于是反向操作：haircut + **暂停**。 |
| 🔗 | **有据可查：工具调用 + RAG 检索** | 调用实时 LME 铜价、区域升水、UN Comtrade 历史同类成交价；RAG 检索器带来源引用宏观风险情报 → 一张可审计的**证据图**。 |
| 🌐 | **xAPI 实时世界风险** | 通过 [xAPI](https://xapi.to) 拉取 X/Twitter、Google 新闻、预测市场（Polymarket 类）信号，映射成结构化风险事件并入定价——*AI 为这批货实时给真实世界事件定价*。无密钥时走离线兜底，demo 永远能跑。 |
| ⛓️ | **已上链 Injective Testnet，且有安全护栏** | 每个决策带 `quote_hash` / `evidence_hash` 锚定上链。LLM **绝不**单独定最终价——确定性引擎 + schema 护栏校验；**300 个 Node + 24 个 Solidity 测试**守护不变量。 |

### 💰 x402 付费情报市场 — AI Agent 凭本事挣钱

这是 AgentBL 的经济引擎。AI 不只是分析风险——它**出售自己的分析**，通过一条活的 x402 支付链路。

**购买流程：**

```
买家点击"获取 AI 风控报告"
        ↓
服务端返回 HTTP 402 + 支付挑战   ← "本报告售价 0.001 USDC"
        ↓
买家签署 EIP-3009 授权          ← 钱包签署 TransferWithAuthorization
        ↓
Facilitator 链上结算            ← USDC 从买家转入协议
        ↓
PaymentOracle 支付存证          ← 链上不可篡改的支付证据
        ↓
AI 报告即时解锁                 ← 风险数据直接注入 RWA 定价引擎
```

**三类报告，三个价位：**

| 服务 | 价格 | 获得什么 |
|------|------|---------|
| 🔍 高级风险情报 | 0.001 USDC | 实时 xAPI 世界风险信号 + RAG 深度分析 + 完整引用 |
| 💎 高级货值评估 | 0.002 USDC | 实时大宗商品价格 + 历史可比成交价 + 波动率预测 |
| 🛡️ 反欺诈审单 | 0.0015 USDC | 五维 eBL/发票/保险一致性核验 + 定价影响量化 |

**参与者为什么愿意付费：**

| 动机 | 经济逻辑 |
|------|---------|
| **靠信息差赚钱** | 花 0.001 USDC 比别人先知道这批货有风险——避开坏交易，或抢先低价收进被低估的货 |
| **影响市场定价** | 每份购买的报告都汇入 RWA 定价引擎。买得越多，你的判断对最终公允价的影响越大 |
| **免责护身符** | 链上记录就是尽职证明："当时 100 份独立评估中有 68 份标注高风险——我是按公允价卖的" |

> **x402 ≠ RWA 认购。** 用 x402 花几分钱*购买一份 AI 报告*；认购 offering 是*用资金投资 RWA*。这是两笔不同的交易——见 [x402 与 RWA 的区别](./docs/x402-integration.md#two-different-businesses-x402-report-payment-vs-rwa-subscription)。

### 🧠 创新点 —— 把「折价」建立在可验证的贸易利润上

大多数 RWA 协议靠「拍脑袋的 LTV + 固定利率」定价。AgentBL 的定价**有经济学根基、可解释**：

```text
gross_profit  P = invoice_value − cost_of_goods          ← 出口商可验证的毛利
financing_cost  = share × P                              ← 投资者赚到的折价，就是出口商的融资成本
issue_price     = cash / (cash + share × P)              ← 发行价（对 $1.00 目标兑付的折价）
```

`share`（让出多少比例的毛利）由两个杠杆决定，外加一道抵押地板：

| 杠杆 | 作用 | 取值 |
|---|---|---|
| **到账速度** `payout_speed` | 越急 → 让出越多毛利 → 价越低 | FAST `0.50` · BALANCED `0.33` · LOW_COST `0.20` |
| **贸易风险** `risk` | 战争/天气/港口/保险/价格波动 → 加点 → 价更低 | 由 `scoreRisk` 打分（bps） |
| **质押覆盖** | AI 验证货值给价格设**地板**，兑付敞口不超过安全覆盖 | 价格只能被它**抬高** |

所以同一笔货：**要得越急、风险越大 → 发行价越低 → 投资者隐含收益越高**。
`$1.00` 是**目标兑付价，不是保本承诺**。

**参考案例 —— 铜，新加坡 → 上海**（现金 $3.3M，P $1.375M，风险 350bps MEDIUM）：

| 速度 | 让出毛利 | 发行价 | 投资者上行 | 动作 |
|---|---:|---:|---:|---|
| FAST | 60% | **$0.80** | 25.0% | OPEN |
| BALANCED | 43% | **$0.85** | 17.9% | OPEN |
| LOW_COST | 30% | **$0.89** | 12.5% | OPEN |

### 🎯 为什么 RWA 定价非有 AI 不可

> 评委最该问、也最致命的一句：*「折价发行、目标兑付 1 美元，那投资者不就买低卖高、稳赚？要 AI 干嘛？」*
> 这一节就是正面回答。

```text
① RWA 折价发行：投资者按 $0.80 买入，目标兑付 $1.00
② 陷阱：看起来稳赚 —— 那 AI 风控岂不是摆设？
③ 破解：$1.00 是「目标」不是「保本」—— 会违约，投资者会亏
④ 推论：那 $0.20 折价不是白送的利润，而是「违约风险的价格」
⑤ 谁定这个价：AI —— 在投资者认购【之前】
⑥ 为何必须事前定准：钱在 Funded 一刻就打给出口商、货还在海上；
   事后改价保护不了已建仓的钱 → 折价是唯一的、预付的补偿
⑦ AI 做三件事：保守估值(定额度) · 风险打分→折价(定价格) · 开/改价/暂停(定闸门)
⑧ 终极考验 = 战争：价格预言机见铜价↑以为更安全；AI 知道战争溢价是
   「相关性双刃」(违约↑ / 保险↓ / 回收↓)，于是反向 —— haircut + 暂停
```

**第 ③ 步的证据 —— 同一笔铜，三种结算（`npm run demo:default`）：**

| 结算 | 发生了什么 | 投资者损益 |
|---|---|---:|
| ✅ 还款 | 进口商付款，正常赎回 | $0.80 → **$1.00**，**+25%** |
| ❌ 尾部违约 | 战争致铜价崩 + 进口商弃货 + 保险战争除外拒赔 | $0.80 → 只回收 **$0.698**，**−12.8%** |
| 🟡 轻度违约 | 进口商破产但货完好、近市价变现 | $0.80 → **$1.00**，被超额抵押兜回 |

**第 ⑧ 步的证据 —— 战争前 vs 战争危机（定价引擎真实输出）：**

| | 战争前 (warning) | 战争危机 (critical) |
|---|---|---|
| 风险分 | 350bps · MEDIUM | **1410bps · CRITICAL** |
| AI 核验货值 | $6,531,250 | **$5,141,500（−21%）** |
| AI 动作 | OPEN @ $0.80 | **PAUSE（拒绝开盘）** |

### 🏗️ 系统架构

```text
            ┌─────────────────────────────────────────────────────────────┐
            │            前端 Dashboard  (public/ · 零依赖 SPA)             │
            │  场景选择 · 出口商报价 · AI 定价瀑布 · 投资者认购 · 合约时间线  │
            └───────────────▲───────────────────────────────▲─────────────┘
                            │ fetch (同一份 PricingQuote)     │
            ┌───────────────┴───────────────────────────────┴─────────────┐
            │                   API 服务  (src/app/server.js)               │
            │  /api/pricing/quote · /api/offering/simulate · /api/oracle/…  │
            └───────────────▲───────────────────────────────▲─────────────┘
                            │                                │
        ┌───────────────────┴────────┐          ┌────────────┴───────────────┐
        │   AI 定价引擎 (src/core)     │          │  MCP / RAG / Skill (src/…)  │
        │  pricingEngine · scoreRisk  │          │  7 个工具 · 3 个 JSON 资源   │
        │  offeringSimulator · oracle │          │  Q&A 助手               │
        └───────────────────┬─────────┘          └─────────────────────────────┘
                            │ quote_hash / evidence_hash
            ┌───────────────┴───────────────────────────────────────────────┐
            │        Solidity 合约 (hardhat/)  ·  已上链 Injective Testnet     │
            │  AgentBLRWA · RiskPricingOracle · RWAOfferingPool · …       │
            └───────────────────────────────────────────────────────────────┘
```

**关键设计**：AI 引擎、后端、前端、合约、MCP 工具**围绕同一份 `PricingQuote` 结构化输出**
（`src/core/pricingSchema.js`），并由不变量校验（兑付敞口 ≤ 安全覆盖、`base − urgency − risk = indicative`、
`final ≥ indicative`）保证可信。

### ⛓️ 已上链 Injective Testnet

许可型 demo 合约 `AgentBLRWA` **已部署、可在浏览器核实**：

| | |
|---|---|
| **网络** | Injective Testnet（chainId `1439`） |
| **合约地址** | [`0x4a03B5707eEBFc88f56f6E6a99b5D98466B31c94`](https://testnet.blockscout.injective.network/address/0x4a03B5707eEBFc88f56f6E6a99b5D98466B31c94) |
| **部署交易** | [`0xf1cb0a86…3ef128`](https://testnet.blockscout.injective.network/tx/0xf1cb0a86074d9a9aa0868216a6c6c3d64295ef2d52289a59cf62ffc67a3ef128) |

在**界面①**连接 MetaMask（Injective Testnet）点「铸造」即可产生真实、已签名的链上交易。未连钱包 / 未部署时，
demo 走高保真**模拟交易**——**离线永不中断**。

### 🚀 快速开始

```bash
# 1) 安装 lockfile 精确锁定的运行时依赖
npm install

# 2) 启动 Web + API 服务
npm run dev

# 3) 打开 Dashboard
#    → http://localhost:3000
```

> Windows PowerShell 若报 `npm.ps1 禁止运行`，把命令换成 `npm.cmd run dev`。

看到这行就成功了：

```text
AgentBL Agent harness running at http://localhost:3000
```

**环境要求**：Node.js ≥ 20 · 现代浏览器 · **Demo Mode 无需 API Key**（内置确定性 fallback，离线即可完整演示）。

x402 支付层精确锁定 `@injectivelabs/x402@0.0.1` 与 `express@5.2.1`。由于 `viem` 传递选择的
`ws` 版本受 GHSA-96hv-2xvq-fx4p 影响，lockfile 使用 override 固定到修复版 `8.21.0`。
项目暂不安装 `@x402/core` / `@x402/evm` / `@x402/fetch`，避免两套协议实现并存。

### 🛠️ 操作手册

两条路线：**A. 本地零配置演示**（推荐先跑，模拟上链，不需要钱包/密钥/网络）与
**B. 部署到 Injective Testnet 真实上链**。

#### A. 本地零配置演示（5 步）

1. 装 Node ≥ 20：`node -v` 确认。
2. 进入项目根目录：`cd AgentBL-AI`。
3. 启动服务：`npm run dev`（Windows 若报错用 `npm.cmd run dev`）。
4. 打开 `http://localhost:3000`。
5. 照下方**两个界面操作步骤**玩。顶栏显示 `○ 合约未部署 · 当前为模拟上链`，铸造按钮产生**高保真模拟交易**——演示完整、不依赖网络。

#### B. 部署到 Injective Testnet，开启真实上链（8 步）

> 目标：顶栏变 `● 合约已部署`，界面①点「铸造」会弹 MetaMask 签名、产生**真实 Injective 交易**。

1. **安装 MetaMask** 并添加 Injective Testnet——chain ID `1439`，RPC `https://k8s.testnet.json-rpc.injective.network`。
2. **新建一个「只放测试币」的钱包**做部署账户——⚠️ 不要用有真实资产的钱包。
3. **领 Injective 测试币**（约 0.1 INJ 足够），水龙头 [Injective Testnet Faucet](https://testnet.faucet.injective.network/)。
4. **准备 RPC URL**——公共节点 `https://k8s.testnet.json-rpc.injective.network`，或你自己的 endpoint。
5. **导出部署私钥**（MetaMask → 账户详情 → 导出私钥）。**仅用于这个测试钱包**。
6. **在项目根目录创建 `.env`**（其余 LLM key 可留空，引擎有确定性 fallback）：
   ```bash
   INJECTIVE_RPC_URL=https://k8s.testnet.json-rpc.injective.network
   DEPLOYER_PRIVATE_KEY=0x你第5步导出的私钥
   ```
   > `.env` 已被 gitignore。完整字段见 `.env.example`。
7. **安装合约依赖并部署：**
   ```bash
   cd hardhat
   npm install                          # 首次需要（约 1 分钟：hardhat + ethers）
   npm run deploy:injective   # 部署 AgentBLRWA 到 Injective Testnet
   ```
   脚本会**自动把合约地址 + ABI 写进 `public/chain-config.json`**——前端无需手改。
8. **连接钱包并铸造：**
   ```bash
   cd ..          # 回到项目根目录
   npm run dev
   ```
   打开 `http://localhost:3000` → 顶栏显示 `● 合约已部署` → 进入**界面①** → 「🦊 连接钱包」（提示切到 Injective Testnet）→ 输入融资金额 → 「⛓ 铸造 RWA 上链」→ **MetaMask 弹窗签名** → 结果卡显示 `tx_hash`（可点开浏览器）、`poolId`、链上读回的 RWA 余额。

#### C. 两个界面的操作步骤

**界面①「提单上链 · 铸造 RWA」**
1. 顶栏选一个**交易案例**（建议从 `Clean copper` 开始）。
2. 看「AI 货值估算 & 航线风险」：AI 核验货值、五维风险分数、每项**数据来源**。
3. 看「AI 定价台」瀑布图：发行价如何从 $1.00 一步步折下来。
4. 在「融资 & 铸造」里选**到账速度**（FAST/BALANCED/LOW_COST），输入**融资金额**，下方实时显示可得 RWA 数量与发行价。
5. 点「⛓ 铸造 RWA 上链」→ 真实交易（已部署）或模拟交易（未部署）。

**界面②「航运追踪 · 实时定价」**
1. 顶栏点「② 航运追踪」。
2. 看中间的**船**沿航线移动；鼠标移到船上显示**虚拟时间 + 所在航段**；可播放/暂停/拖动。
3. 「实时 RWA 定价」显示当前价（变化时闪动）、收益率、风险等级/分数、认购进度。
4. 点「突发事件」按钮（🌪台风 / ⚔霍尔木兹冲突升级 / 🧭改道 / 🛡保险拒赔）→ AI **实时重定价或暂停**，价格当场下跌，时间线出现 Repriced/Paused。
5. 「↺ 重置航程」回到初始定价。

#### D. 常见问题排查

| 现象 | 原因 / 解决 |
|---|---|
| 顶栏一直显示 `○ 合约未部署` | 没跑 B 路线，或 `public/chain-config.json` 里 `contracts.AgentBLRWA` 为空。重跑第 7 步。 |
| 点连接钱包没反应 | 没装 MetaMask（铸造会走模拟交易），装好后刷新。 |
| MetaMask 报 `insufficient funds` | 部署账户没有 INJ 测试币，回到第 3 步。 |
| `deploy` 报 `Missing DEPLOYER_PRIVATE_KEY` | `.env` 没建在项目根目录或字段名写错，检查第 6 步。 |
| 铸造交易很久不确认 | 测试网偶尔拥堵，等待或在 MetaMask 加速。 |
| 想换合约地址 | 重跑第 7 步，覆盖 `chain-config.json`。 |

### ⌨️ 命令行工具

除显式带 `:live` 的命令外，所有命令都**默认离线可跑**（无 API Key 时走确定性 fallback）。

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动 Web + API 服务（`http://localhost:3000`） |
| `npm run demo` | CLI 主流程：打印 RWA 发行价、investor yield、风险因子、链上哈希、AI 叙述 |
| `npm run demo:default` | 「投资者会不会亏」：同一笔铜跑**还款 / 尾部违约 / 轻度违约**三种结算，逐条打印损益 |
| `npm run price` | 对 demo case 直接打印一份 PricingQuote |
| `npm run scenarios` | 多场景回归：legacy RiskReport + AI 定价（fast / balanced / reprice / pause） |
| `npm run qa` | 评委 Q&A 彩排（真实定价数字 + RAG 引用；`-- "你的问题"` 问单题） |
| `npm run mcp` | 演示 MCP 工具链（get_trade_case → search → price → simulate → push oracle） |
| `npm run mcp:stdio` | 启动标准 MCP SDK stdio server（固定 7 tools + 3 resources） |
| `npm run agent:value` | 跑 AI 货值估值工具（实时价 / 历史成交价 / 估值，离线有 fallback） |
| `npm run intel` | **xAPI 实时世界风险**：X/Twitter + 新闻 + 预测市场信号 → 风险事件 → 重新定价（无密钥走离线兜底） |
| `npm run smoke:x402` | Demo 安全的 402 → 签名 → 模拟结算 → 报告解锁闭环 |
| `npm run smoke:x402:live` | 测试网真实 V2/EIP-3009 → USDC tx → 报告 → `PaymentAttested`（需测试钱包有 USDC） |
| `npm run x402:intel` | 购买并展示风险/估值/反欺诈报告的 CLI |
| `npm run verify:wave-b` | 复验 payment → report → attestation → pricing → quote 测试网闭环 |
| `npm run smoke:mcp:injective` | 官方 Injective MCP 查询 + allowlist 受控 raw-EVM smoke（需测试钱包） |
| `npm run check` | 最低成本自检：文件、脚本、seed 数据、引擎完好 |
| `npm run test` | 全部单元 / 集成测试（`node --test`，**300 passing**） |
| `npm run smoke` | 启动临时 server，冒烟测试关键 API |

硬化 PaymentOracle 已部署在 Injective Testnet：
[`0x36d9…4571`](https://testnet.blockscout.injective.network/address/0x36d9Ff1256b3db1EFC1EAcB4c9b5033165D24571)。
X402-15 已于 2026-06-29 通过（显式测试用 self-transfer）：官方 V2 流程真实结算
[0.001 测试网 USDC](https://testnet.blockscout.injective.network/tx/0x6d796d39de0de3becd57f2c8b0ff72e6baf33e570259530cb294ff819d1a0b49)，
解锁报告 `rpt_3e5f…3334`，并产生
[`PaymentAttested`](https://testnet.blockscout.injective.network/tx/0xa03ab9622dbc1af7bd448af2a52b5322963abf65853916dc13c75a139adfef6e)。
可复验证据保存在 `docs/evidence/x402-live-smoke.json`。

**Wave B 已完成：**同一个付费报告哈希已把上述支付和 `PaymentAttested` 连接到
[`PricingUpdated`](https://testnet.blockscout.injective.network/tx/0xee6b6520c040662f3644c2514de628baa2351abe185623e9c22dbbcab76bbac3)
与最终 `$0.80` RWA 报价。五合约协议已部署并完成全生命周期 smoke；标准 MCP 已达到 7 tools + 3 resources；
官方 Injective MCP adapter 也完成了[受控 raw-EVM 交易](https://testnet.blockscout.injective.network/tx/0x1578c10144a6216d8580eabc1497ee02c99a435c20cd315c1492fc0d78d8984f)。
地址、命令、证据与上游兼容说明见 [`docs/wave-b.md`](./docs/wave-b.md)。

> 演示前一键全验证：
> ```bash
> npm run check && npm run test && npm run smoke && npm run scenarios && npm run demo
> ```

### 🔌 API 参考

启动 `npm run dev` 后，所有端点在 `http://localhost:3000`。POST body 留空时默认用 `data/demo-case.json`。

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/cases` | 结构化案例目录（前端选择器用） |
| POST | `/api/pricing/quote` | 生成 PricingQuote；`?compare=true` 返回三档速度 + 推荐 |
| POST | `/api/offering/simulate` | 模拟发行生命周期；`events` 可在途中升级风险 |
| POST | `/api/workflow/pricing-simulate` | 一次返回 PricingQuote + RiskReport + offering |
| POST | `/api/oracle/pricing-update` | 链上 oracle 更新载荷（含 `quote_hash` / `evidence_hash`） |
| GET/POST | `/api/scenarios` · `/api/scenarios/run` | 场景回归 |
| GET/POST | `/api/mcp/tools` · `/api/mcp/call` | MCP 工具清单 / 调用 |
| POST/GET | `/api/rag/search` · `/api/rag/judge-qa` | RAG 检索 / 评委问答 |
| POST | `/api/intel/world-risk` | xAPI 实时世界风险扫描 → 事件 + 信号 + 并入前后的重新定价 |
| GET | `/api/x402/config` | x402 付费报告服务目录 + 网络/facilitator 配置 |
| GET/POST | `/api/x402/intel/premium-risk` · `/valuation/premium` · `/documents/fraud-review` | 付费 AI 报告——付款前返回 HTTP 402（详见 [`docs/x402-integration.md`](./docs/x402-integration.md)） |
| GET | `/api/x402/report/:id` | 在 TTL 内重读已付费报告（不再次扣费） |

> **x402 ≠ RWA。** 用 x402 花几分钱*购买一份 AI 报告*；认购 offering 是*用资金投资 RWA*。
> 这是两笔不同的交易——见 [x402 与 RWA 的区别](./docs/x402-integration.md#two-different-businesses-x402-report-payment-vs-rwa-subscription)。

**对比三档到账速度：**
```bash
curl -s -X POST "http://localhost:3000/api/pricing/quote?compare=true"
# → quotes[FAST|BALANCED|LOW_COST] + recommended_payout_speed
```

**在途注入战争风险，看 AI 暂停：**
```bash
curl -s -X POST http://localhost:3000/api/offering/simulate \
  -H "Content-Type: application/json" \
  -d '{"payout_speed":"BALANCED","events":[{"category":"macro","type":"war_risk","severity":"critical","region":"Strait of Hormuz"}]}'
# → final_state: "Paused"
```

### 🤖 接入真实 LLM / 实时数据（可选）

**默认全离线**：没有任何 Key 时，AI 估值与叙述走确定性 fallback（按 2026 年 6 月校准的 mock 数据），演示永远能跑。
想用真实 LLM / 实时行情，复制 `.env.example` 为 `.env` 并填入：

| 变量 | 说明 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek（`deepseek-chat`），OpenAI 兼容 |
| `DASHSCOPE_API_KEY` | 通义千问 Qwen（DashScope 兼容模式） |
| `Tencent_API_KEY` | 腾讯混元（锁定 `hy3-preview`，配置后默认优先并自动兜底） |
| `LLM_BASE_URL` / `LLM_API_KEY` | 任意 OpenAI 兼容端点 |
| `ALPHAVANTAGE_API_KEY` / `METALPRICE_API_KEY` | 实时铜价（USD/MT） |
| `COMTRADE_PRIMARY_KEY` | UN Comtrade 历史同类成交价（按 HS code，免费） |
| `XAPI_KEY` | [xAPI](https://xapi.to) — 实时世界风险信号（X/Twitter · 新闻 · 预测市场），供 `npm run intel` / `/api/intel/world-risk`。注册：`npx xapi-to register`（邀请码 `xapito`）。详见 [`docs/xapi-integration.md`](./docs/xapi-integration.md)。 |

> ⚠️ `.env` 已被 gitignore；任何 `*_API_KEY` 都不要提交。

### ⛓️ 智能合约（Hardhat）

```bash
cd hardhat
npm install
npx hardhat compile
npx hardhat test          # 24 passing
```

| 合约 | 职责 |
|---|---|
| `AgentBLRWA.sol` | **已部署的许可型 demo 合约。** `tokenize(...)` 按 AI 定价铸造 RWA 并 emit `Tokenized`；`reprice(...)` emit `Repriced`。携带 `quoteHash` / `evidenceHash`。 |
| `RiskPricingOracle.sol` | `updatePricing(poolId, issuePrice, riskLevel, action, evidenceHash)` → emit `PricingUpdated`，持久化最新 quote/evidence 哈希 |
| `RWAOfferingPool.sol` | 以已质押 eBL 为前置的 `createOffering / subscribe / reprice / pause / resume / settle` |
| `EBLRegistry.sol` · `RWAToken.sol` | eBL V2 货物唯一性、结构化元数据、转让/背书/质押历史；投资者 RWA 份额凭证 |

后端 `/api/oracle/pricing-update` 产出的载荷字段与 oracle 调用一一对应，前端「Push to oracle」即发送这份载荷。

### 🧩 MCP / RAG / Skill（Agent 能力加分项）

- **MCP Server**（`src/mcp/`）：基于官方 SDK 的标准 stdio lifecycle，固定 7 tools + 3 个只读 JSON resources；新增 `verify_trade_documents` 和真实经过 402 middleware 的 `purchase_premium_analysis`。写链固定网络、allowlist、限额、人工批准且默认 dry-run；定价仍复用同一个 `quoteFromCase`。
- **RAG**（`src/rag/` + `data/risk-intel/`）：宏观风险情报知识库（战争 / 制裁 / 港口 / 天气 / 商品波动 / FX），AI 加风险折价时引用其中条目。
- **Skill**（`src/skill/`）：`pricingAnalyst`（定价分析）与 `demoOperator`（一键演示编排）。
- **Judge Q&A 助手**（`src/agent/judgeAssistant.js`）：`npm run qa`，用真实定价数字 + 情报引用作答，永不与引擎自相矛盾，始终保留「非保本」口径。
- **自主 Agent 闭环**（`documentParser.js`、`orchestrator.js`、`autonomousAgent.js`、`decisionLogger.js`）：带来源与置信度地解析贸易单据，生成唯一确定性开盘决策，把六类事件映射为协议动作，并跨重启持久化幂等执行与链上交易审计记录。

### 📁 项目结构

```text
AgentBL-AI/
├── README.md              # 本文件
├── 基础说明.md            # 团队协作 / 新手上手 / Harness 背景（原 README）
├── package.json           # npm scripts
├── .env.example           # 可选的 LLM / 行情 Key
├── data/
│   ├── demo-case.json         # 主 demo 案例（铜 · 新加坡 → 汉堡）
│   ├── cases/                 # 结构化案例（clean / war-crisis / 原油）
│   ├── pricing-scenarios/     # AI 定价场景回归
│   ├── uploads/               # 拟真 eBL + 商业发票
│   └── risk-intel/feed.json   # RAG 风险情报
├── public/                # 前端（零依赖 ES module SPA）
├── src/
│   ├── app/server.js          # HTTP + API
│   ├── core/                  # pricingEngine · pricingSchema · offeringSimulator · oracle · pricingWorkflow
│   ├── agent/                 # 文档解析 · 编排 · 自主执行 · 审计日志 · 估值/风险 Agent
│   ├── mcp/  ·  rag/  ·  skill/
├── hardhat/               # Solidity 合约 + 测试
├── scripts/               # check / demo / smoke / scenarios / price / qa / mcp / agent-valuation
├── tests/                 # node --test（300 passing）
└── docs/                  # PRD · background · contracts · tasks · acceptance · award-roadmap
```

### ✅ 验证矩阵

| 命令 | 验证什么 | 现状 |
|---|---|---|
| `npm run check` | 文件 / 脚本 / seed / 引擎完好 | ✅ |
| `npm run test` | 单元 + 集成（定价不变量、自主 Agent、schema、MCP、合约 mock…） | ✅ 300 passing |
| `npm run smoke` | 关键 API 端到端 | ✅ |
| `npm run scenarios` | fast / balanced / reprice / pause 场景回归 | ✅ |
| `cd hardhat && npx hardhat test` | Solidity 合约测试 | ✅ 24 passing |
| `npm run verify:wave-b` | 真实支付/报告/存证/定价/报价追踪 | ✅ 测试网证据 |

### 🔒 合规边界

本项目是黑客松原型，**刻意不做**：真实 KYC、真实跨境支付、真实主网部署、面向公众募资、保本保收益承诺、开放二级市场。
`$1.00` 始终是**目标兑付价**，取决于进口商付款、货物结算与保险覆盖。Demo 仅使用许可型 mock 投资者。

### 📚 更多文档

- [`基础说明.md`](./基础说明.md) — 团队协作规范、新手上手、Harness 背景
- [`docs/PRD.md`](./docs/PRD.md) — 产品需求与定价模型 v0.2
- [`docs/background.md`](./docs/background.md) — eBL / RWA / 贸易融资领域背景
- [`docs/contracts.md`](./docs/contracts.md) — 合约接口冻结设计
- [`docs/x402-integration.md`](./docs/x402-integration.md) — x402 付费报告市场、威胁模型、FAQ，以及 x402 与 RWA 的区别
- [`docs/award-roadmap.md`](./docs/award-roadmap.md) — 能力与拿奖路线
- [`docs/ai-valuation-tooling.md`](./docs/ai-valuation-tooling.md) — AI 估值 tool calling
- [`docs/xapi-integration.md`](./docs/xapi-integration.md) — xAPI 实时世界风险接入（X/Twitter · 新闻 · 预测市场）

<div align="right"><a href="#chinese">↑ 回到顶部</a></div>

---

<div align="center"><sub>Built for Injective Nova 2026 · The AI prices the risk. The market pays. The chain enforces.</sub></div>
