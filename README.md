<div align="center">

# 🛡️ AgentBL

### **AI Prices the Risk. Investors Pay for the Intel. The Chain Enforces Settlement.**

**When a $1M cargo ships, capital locks for 45 days. An AI Agent evaluates the risk, prices the discount, and the market pays to unlock that intelligence—all settled on-chain.**

---

[![Injective Nova 2026](https://img.shields.io/badge/Injective_Nova-2026-0B60FF?style=for-the-badge)](https://injectivenova.com)
[![Track](https://img.shields.io/badge/Track-AI_Payments_×_RWA-D6336C?style=for-the-badge)](#)
[![Award Focus](https://img.shields.io/badge/Focus-Killer_AI_App-5A45FF?style=for-the-badge)](#)

[![Tests](https://img.shields.io/badge/tests-341_passing-2EA043?style=flat-square&logo=vitest)](#test-coverage)
[![Contracts](https://img.shields.io/badge/contracts-32_passing-2EA043?style=flat-square&logo=ethereum)](#deployed-contracts)
[![Injective](https://img.shields.io/badge/Injective-Testnet_Live-0B60FF?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDI0QzE4LjYyNzQgMjQgMjQgMTguNjI3NCAyNCAxMkMyNCA1LjM3MjU4IDE4LjYyNzQgMCAxMiAwQzUuMzcyNTggMCAwIDUuMzcyNTggMCAxMkMwIDE4LjYyNzQgNS4zNzI1OCAyNCAxMiAyNFoiIGZpbGw9IiMwQjYwRkYiLz4KPC9zdmc+Cg==)](https://testnet.blockscout.injective.network/address/0x3C6774d2D1ac6Bf35d08e5C9c84A233F5bc7f5Ce)
[![MCP](https://img.shields.io/badge/MCP-Server_Active-1F6FEB?style=flat-square)](#mcp-integration)
[![x402](https://img.shields.io/badge/x402-Live_Settlement-D6336C?style=flat-square)](#x402-paid-intelligence)
[![License](https://img.shields.io/badge/license-MIT-3FB950?style=flat-square)](./LICENSE)

**🌐 [🇬🇧 English](#english) · [🇨🇳 简体中文](#chinese)**

</div>

---

<a name="english"></a>

## 🇬🇧 English

### ⚡ 30-Second Pitch

**The Problem**: Global trade has a **$2.5 trillion** financing gap. When cargo ships, exporters wait **45 days** for payment while their capital is frozen. Banks reject **45%** of SME trade finance requests—not because trades are risky, but because companies are small.

**Our Solution**: AgentBL turns electronic Bills of Lading (eBL) into liquid RWA tokens. An **AI Agent autonomously underwrites** each shipment, calculating a risk-adjusted discount. Investors pay **micro-USDC via x402** to unlock premium risk intelligence, then fund the offering. **Injective EVM enforces** the entire lifecycle on-chain.

**The Key Insight**: Traditional DeFi lets markets *guess* asset prices. AgentBL lets AI *price the risk before investment*—the discount is the investor's only protection against default. That's why the AI must be verifiable, autonomous, and on-chain.

```
Exporter uploads eBL → AI underwrites in 5 min → Investors pay $0.50 for risk report
→ Fund at 0.80 discount → Target redemption: $1.00 → Settlement enforced on Injective
```

---

### 🎯 Why This Wins Championships

| Criteria | Our Evidence | Where to Verify |
|----------|--------------|-----------------|
| **🚀 Innovation** | AI risk intelligence is *sold as a product* via x402, not just a feature. The report itself is tradeable and verifiable on-chain. | [x402 Live Payment](#x402-paid-intelligence) → PaymentOracle binds report hash to USDC settlement |
| **⚙️ Technical Execution** | 341 AI/backend tests + 32 contract tests. 5-contract protocol deployed. MCP server with 7 tools + 3 resources. All transactions verified on Injective testnet. | [`npm test`](#test-coverage) → [Deployed Contracts](#deployed-contracts) → [Live Transactions](#live-evidence) |
| **💎 Real Use Case** | Solves $2.5T trade finance gap. Banks, insurers, investors, and other AI Agents can buy reports without accounts or subscriptions. Clear revenue model. | [Problem Statement](#the-problem) → [Business Model](#business-model) |
| **🎨 Product & UX** | 402 challenge → wallet signature → settlement → unlock intelligence—all in one flow. Evidence expandable. Wallet failure recovery. | [Quick Start](#quick-start-judge-mode) → 5-second comprehension test |
| **🌐 Ecosystem Fit** | Built on official Injective x402 SDK, MCP, inEVM, Explorer. Optional precompiles. Azure Foundry evaluation/tracing. | Every integration links to [code/config/trace/tx](#tech-stack) |

---

### 🌍 The Problem: Closing the $2.5 Trillion Trade Finance Gap

Trade finance is the lifeblood of the global economy, yet it runs on **paperwork, phone calls, and decades-old institutional trust**.

#### 📊 The Numbers

- **$2.5 Trillion Gap** (Asian Development Bank): The amount of viable trade that cannot secure financing globally
- **45% Rejection Rate**: Export SMEs face near-majority rejection from traditional banks due to *company size thresholds*, not trade quality
- **45-Day Capital Lock**: The standard gap between cargo shipment and payment receipt

#### ⏳ The Frozen Cash Timeline

```text
T0: Order Placed → T1: Cargo Shipped (eBL Issued) → [ 45-Day Locked Capital Gap ] 
→ T3: Cargo Arrives → T4: Payment Received
```

**AgentBL targets the T1→T4 liquidity gap**: Exporters tokenize their cargo title (eBL) into trade-finance RWAs that global investors fund instantly.

#### ⚖️ The Legal Catalyst

The adoption of **UNCITRAL MLETR** (Model Law on Electronic Transferable Records), **Singapore ETA 2021**, and **UK ETDA 2023** gives electronic trade documents the **exact same legal possession status as paper**, opening a massive compliance window for on-chain trade finance.

---

### 🏆 Championship Features

#### 🤖 **Feature 1: AI Autonomous Underwriter** — Not a Chatbot, a Financial Decision Engine

The AI doesn't just *advise*—it **executes**. When an eBL is uploaded, the system autonomously:

1. **OCR + Field Extraction**: Parses Bills of Lading, commercial invoices, and insurance certificates
2. **Cross-Document Consistency Check**: Validates quantity, cargo value, unit price vs. market benchmarks, Incoterms, insurance coverage
3. **Risk Scoring**: Evaluates transport risk, geopolitical events, weather, port congestion, FX volatility, commodity price stress
4. **Dynamic Pricing**: Calculates a fair RWA issuance price with explicit urgency/risk/collateral discounts
5. **On-Chain Execution**: Pushes the pricing quote to Injective EVM's `RiskPricingOracle` to autonomously launch the offering

**Evidence**:
- ✅ **341 tests passing** (`npm test`) covering pricing engine, document consistency, risk scoring, LLM fallbacks
- ✅ **Multi-LLM Support**: OpenAI/DeepSeek/Qwen with deterministic fallback when LLM fails
- ✅ **RAG Risk Intelligence**: 10 real-time data sources for macro risk feeds
- ✅ **Structured Output**: Every decision follows the `PricingQuote` JSON schema with evidence graphs

**Why It Matters**: Traditional DeFi lets the market *guess* prices. AgentBL lets AI *price the risk before investment*. The discount is the investor's only compensation for potential default—so it must be calculated **before** capital is deployed.

---

#### 💰 **Feature 2: x402 Paid Intelligence Market** — AI Reports as Tradeable Products

AgentBL implements the **x402 protocol** (HTTP 402 Payment Required + EIP-3009) to **monetize AI intelligence**. Rather than giving away risk insights for free, the server issues a `402 Payment Required` challenge. Clients sign a USDC transfer authorization, settled on-chain.

**The Business Model**:
```
Banks / Insurers / Investors / Other AI Agents
    ↓ Request premium risk report
Server responds: HTTP 402 Payment Required
    ↓ Client signs EIP-3009 USDC authorization
Settlement on Injective EVM via PaymentOracle
    ↓ Payment verified
Unlock: Premium risk intelligence + audit trail hash
```

**What You Can Buy**:
- 🔍 **Premium Risk Reports**: AI due diligence on eBL authenticity, cargo valuation, default probability
- 💎 **Cargo Valuation**: Market-benchmarked pricing with stress scenarios
- 🛡️ **Anti-Fraud Forensics**: Document consistency checks, duplicate eBL detection, compliance alerts

**Revenue Model**:
- $0.50–$2.00 per report (configurable)
- No subscriptions, no accounts—pure pay-per-use
- Scales to institutional API consumption

**Evidence**:
- ✅ **Live x402 Settlement**: Real USDC transfers on Injective testnet with `PaymentAttested` events ([see transactions](#live-evidence))
- ✅ **Official Injective SDK**: Built with `@injectivelabs/x402` npm package
- ✅ **Report Hash Binding**: Every paid report is cryptographically bound to its payment via `PaymentOracle.bindReportToPayment()`
- ✅ **TTL & Replay Protection**: Reports expire; duplicate authorizations are rejected

**Why x402 Deserves a Championship**:
1. **Innovation**: Elevates AI risk analysis from "page feature" to "machine-callable paid service"
2. **Technical Depth**: One demo flow covers HTTP 402 + USDC settlement + AI structured output + Injective on-chain evidence
3. **Real-World Value**: Banks, insurers, logistics platforms, and other Agents can buy reports without human accounts
4. **AI Value Capture**: You're paying for *underwriting work* (due diligence, valuation, stress tests, evidence), not generic LLM chat
5. **Ecosystem Native**: Injective officially provides `@injectivelabs/x402` and x402 EVM integration guides—this is sponsor-native capability

---

#### ⛓️ **Feature 3: Injective 5-Contract Protocol** — Autonomous RWA Lifecycle Enforcement

AgentBL deploys a **5-contract protocol** on Injective inEVM that automates the entire trade finance lifecycle:

| Contract | Role | Key Functions |
|----------|------|---------------|
| **EBLRegistry V2** | eBL NFT ownership + anti-fraud | `registerEBL()`, `transferOwnership()`, `detectDuplicate()`, `verifyENISignature()` |
| **RWAOfferingPool** | Offering lifecycle automation | `createOffering()`, `subscribe()`, `reprice()`, `pause()`, `resume()`, `settle()` |
| **RiskPricingOracle** | AI → On-chain pricing pipeline | `updatePricing()`, `getPricingQuote()`, `bindEvidenceHash()` |
| **RWAToken** | ERC20-compliant RWA shares | `mint()`, `burn()`, `transfer()`, Standard ERC20 interface |
| **AgentBLRWA** | Main coordinator | Cross-contract orchestration, access control, emergency pause |

**State Machine** (enforced on-chain):
```
Created → Priced → Open → Funded → InTransit → [Repriced/Paused] → Arrived → Settled → Redeemed
```

**Evidence**:
- ✅ **32 Solidity tests passing** (`npm run test` in hardhat/)
- ✅ **All contracts deployed on Injective testnet** with verified addresses ([see below](#deployed-contracts))
- ✅ **Full lifecycle smoke test**: Created → Subscribed → Repriced → Paused → Resumed → Settled
- ✅ **Explorer-verified transactions**: Every state transition has a viewable tx hash

---

#### 🔌 **Feature 4: MCP Standard Integration** — Claude & AI Agent Interoperability

AgentBL implements the **Model Context Protocol (MCP)** to make risk intelligence accessible to Claude Desktop, API, VSCode, and other AI systems.

**What's Exposed**:
- **7 Core Tools**: `analyze_ebl`, `price_offering`, `check_risk`, `settle_offering`, `query_injective`, `transfer_usdc`, `get_market_data`
- **3 Resources**: Live offering status, risk intelligence feed, settlement history
- **Security Adapter**: Wraps official Injective MCP server with controlled raw EVM transaction signing

**Evidence**:
- ✅ Official `@modelcontextprotocol/sdk` stdio lifecycle
- ✅ Passes MCP validation tests
- ✅ Compatible with Claude Desktop MCP configuration
- ✅ Integration tested with Injective's official MCP server

**Why It Matters**: Other AI Agents can now *consume* AgentBL's risk intelligence programmatically, creating a composable AI-to-AI marketplace.

---

### 🏗️ System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AGENTBL PROTOCOL ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│  Exporter Upload    │  eBL PDF/Image + Commercial Invoice + Insurance Cert
│  (Document Layer)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     🤖 AI AUTONOMOUS UNDERWRITER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  OCR & Parser  →  Cross-Doc Consistency  →  Risk Intelligence (RAG)         │
│       ↓                    ↓                        ↓                        │
│  Cargo Valuation  →  Multi-Factor Risk Score  →  Dynamic Pricing Engine     │
│       ↓                                                                      │
│  PricingQuote Schema (base/urgency/risk/collateral discounts + evidence)    │
│  • 341 tests passing  • OpenAI/DeepSeek/Qwen fallback  • Deterministic      │
└──────────┬──────────────────────────────────────────────────────────────────┘
           │
           ├─────────────────────────┬──────────────────────────────────────┐
           ▼                         ▼                                      ▼
┌──────────────────────┐  ┌─────────────────────────┐  ┌──────────────────────────┐
│  💰 x402 PAID INTEL  │  │ ⛓️ INJECTIVE PROTOCOL   │  │  🔌 MCP INTEGRATION     │
├──────────────────────┤  ├─────────────────────────┤  ├──────────────────────────┤
│ HTTP 402 Challenge   │  │ EBLRegistry V2          │  │ 7 Core Tools             │
│        ↓             │  │ RWAOfferingPool         │  │ 3 Resources              │
│ EIP-3009 USDC Auth   │  │ RiskPricingOracle       │  │ Claude Desktop/API       │
│        ↓             │  │ RWAToken (ERC20)        │  │ Compatible               │
│ PaymentOracle        │  │ AgentBLRWA              │  │                          │
│ Settlement           │  │                         │  │ AI-to-AI                 │
│        ↓             │  │ State Machine:          │  │ Marketplace              │
│ Unlock Report +      │  │ Created → Priced →      │  │                          │
│ Evidence Hash        │  │ Funded → InTransit →    │  │                          │
│                      │  │ Settled → Redeemed      │  │                          │
│ Revenue: $0.50/call  │  │                         │  │                          │
└──────────────────────┘  └─────────────────────────┘  └──────────────────────────┘
           │                         │
           ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               INJECTIVE TESTNET (Chain ID 1439)                              │
│  • All contracts deployed & verified                                         │
│  • Real USDC settlements                                                     │
│  • Explorer-viewable transactions                                            │
│  • PaymentAttested / PricingUpdated / OfferingCreated events                │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INVESTOR DASHBOARD                                   │
│  View Offerings → Pay x402 for Report → Review Risk → Subscribe → Track ROI │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Color Coding**:
- 🤖 **Purple**: AI/ML Layer (Autonomous decision-making)
- 💰 **Orange**: x402 Paid Intelligence (Revenue layer)
- ⛓️ **Blue**: Web3/Injective (Settlement & enforcement)
- 🔌 **Teal**: MCP (Interoperability)

---

### 📍 Live Evidence

#### Deployed Contracts (Injective Testnet - Chain ID 1439)

All contracts are deployed and verified on Injective testnet. Click any address to view on Blockscout:

| Contract | Address | Purpose |
|----------|---------|---------|
| **AgentBLRWA** | [`0x3C6774d2D1ac6Bf35d08e5C9c84A233F5bc7f5Ce`](https://testnet.blockscout.injective.network/address/0x3C6774d2D1ac6Bf35d08e5C9c84A233F5bc7f5Ce) | Main protocol coordinator |
| **EBLRegistry V2** | [`0x85bfdcd00E0bBb9dDce3dcD2A58A62380703AdA6`](https://testnet.blockscout.injective.network/address/0x85bfdcd00E0bBb9dDce3dcD2A58A62380703AdA6) | eBL NFT + anti-fraud |
| **RWAOfferingPool** | [`0x1F44D336111dE4e2640bd9a5945991D42e876f65`](https://testnet.blockscout.injective.network/address/0x1F44D336111dE4e2640bd9a5945991D42e876f65) | Lifecycle automation |
| **RiskPricingOracle** | [`0x0F9618DDbac86eD51d48ef1361789D7e5eF1FAE1`](https://testnet.blockscout.injective.network/address/0x0F9618DDbac86eD51d48ef1361789D7e5eF1FAE1) | AI → On-chain pricing |
| **RWAToken** | [`0x7eb44f73368d14DBE4c2E30F8490a60513Fe17B0`](https://testnet.blockscout.injective.network/address/0x7eb44f73368d14DBE4c2E30F8490a60513Fe17B0) | ERC20 RWA shares |

#### Test Coverage

```bash
npm test
# Output:
# ✔ tests 341
# ✔ suites 9
# ✔ pass 341
# ✔ fail 0
# ✔ duration_ms 39998
```

**Test Categories**:
- ✅ AI Pricing Engine (50+ tests): Base pricing, urgency discount, risk scoring, collateral guardrails
- ✅ Document Consistency (30+ tests): Cross-validation, fraud detection, field parsing
- ✅ x402 Integration (40+ tests): Payment flow, receipt persistence, replay protection, concurrent settlement
- ✅ Autonomous Agent (25+ tests): Event-driven actions, decision logic, on-chain execution
- ✅ Risk Intelligence (20+ tests): RAG retrieval, evidence evaluation, precision@k metrics
- ✅ Web3 Integration (35+ tests): Wallet connection, transaction signing, network switching, error recovery
- ✅ Contract Tests (32 tests via Hardhat): Full lifecycle smoke, state machine enforcement

#### Real Transaction Examples

**x402 Payment Settlement**:
- Example PaymentAttested event: [View on Explorer](https://testnet.blockscout.injective.network/address/0x0F9618DDbac86eD51d48ef1361789D7e5eF1FAE1)

**RWA Offering Lifecycle**:
- OfferingCreated → Funded → Repriced → Settled
- View transaction history on any contract address above

**Pricing Oracle Updates**:
- AI pushes PricingQuote → `RiskPricingOracle.updatePricing()` → Event emitted with evidence hash
- All pricing decisions are auditable on-chain

---

### 🚀 Quick Start

Choose your path based on your role:

#### 🎯 **Path 1: Judge Mode** (5-minute verification)

Perfect for hackathon judges who need to verify all claims quickly:

```bash
# 1. Clone and install
git clone https://github.com/LuBryant/AgentBL.git
cd AgentBL
npm install

# 2. Run preflight check (validates all 54 gates)
npm run preflight
# Expected: 50 PASS, 4 Live WARN (demo mode), 0 FAIL

# 3. Start demo server
npm run dev
# Opens http://localhost:3000 automatically

# 4. Run test suite
npm test
# Expected: 341 passing tests in ~40 seconds

# 5. View contract deployment evidence
cat docs/evidence/wave-b-protocol.json
```

**What You'll See**:
- ✅ Interactive dashboard with 5 demo scenarios
- ✅ AI pricing waterfall visualization
- ✅ x402 payment flow (demo mode - no real wallet needed)
- ✅ All contract addresses with clickable explorer links
- ✅ Real-time risk simulation (typhoon, war scenarios)

---

#### 👨‍💻 **Path 2: Developer Mode** (Full technical deep-dive)

For developers who want to explore the codebase and run live transactions:

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional - only needed for live mode)
cp .env.example .env
# Edit .env to add:
# - OPENAI_API_KEY (or DEEPSEEK_API_KEY / QWEN_API_KEY)
# - INJECTIVE_PRIVATE_KEY (for live testnet transactions)
# - INJECTIVE_RPC_ENDPOINT (defaults to official testnet)

# 3. Run all test suites
npm test                           # 341 AI/backend tests
npm --prefix hardhat test          # 32 Solidity contract tests

# 4. Run scenario demonstrations
npm run scenarios                  # 4 pricing scenarios
npm run demo                       # Full lifecycle demo
npm run qa                         # Judge Q&A assistant

# 5. Test x402 payment flow
npm run smoke:x402                 # Demo mode x402 flow
npm run smoke:x402:live            # Live testnet settlement (requires wallet)

# 6. Interact with MCP server
npm run mcp:stdio                  # Start MCP server
# Then configure in Claude Desktop settings

# 7. Deploy contracts (optional - already deployed)
npm run deploy:protocol            # Deploys to Injective testnet
```

**Key Scripts**:
- `npm run dev` - Start web server
- `npm run preflight` - Validate all systems
- `npm test` - Run test suite
- `npm run price` - AI pricing demo
- `npm run intel` - Risk intelligence retrieval
- `npm run scenarios` - Scenario runner

---

#### 💼 **Path 3: Business Mode** (Non-technical demo)

For investors, business analysts, or anyone who wants to understand the value proposition without code:

```bash
# 1. One-command demo
npm install && npm run dev
```

**Then explore**:
1. **Dashboard View**: See live RWA offerings with risk scores
2. **Pricing Waterfall**: Understand how AI calculates discounts
3. **Risk Simulation**: Click "Simulate Typhoon" to see AI pause offerings
4. **Investor ROI Calculator**: Input investment amount, see projected returns
5. **Evidence Trail**: Every decision shows on-chain proof

**No wallet needed** - Demo mode shows the full flow with realistic data.

---

### ❓ FAQ - Preempting Judge Questions

#### Q1: Is the AI pricing reliable?

**A**: Yes, with multiple safety layers:
- ✅ **341 tests** covering edge cases, stress scenarios, and failure modes
- ✅ **Deterministic fallback**: If LLM fails, system uses rule-based pricing
- ✅ **On-chain audit trail**: Every pricing decision is logged with evidence hash
- ✅ **Multi-factor validation**: AI considers cargo value, insurance, geopolitical risk, commodity prices, transport risk
- ✅ **Collateral guardrails**: Hard limits prevent over-issuance vs. cargo value

**Test it yourself**: `npm run scenarios` shows AI handling normal trade, war crisis, weather events, and fraud attempts.

---

#### Q2: Does x402 have real adoption?

**A**: x402 is sponsor-native to Injective:
- ✅ **Official Injective SDK**: Built with `@injectivelabs/x402` npm package
- ✅ **Live testnet transactions**: Real USDC settlements with PaymentAttested events ([see explorer](#live-evidence))
- ✅ **Scalable to institutions**: Banks, insurers, logistics platforms, and other AI Agents can consume reports via API
- ✅ **Revenue model validated**: $0.50-$2.00 per report, no subscriptions needed
- ✅ **Foundation support**: x402 Foundation provides SDK, specs, and EVM integration guides

**Why it matters**: This isn't just a feature—it's a new business model for monetizing AI intelligence in a machine-callable, composable way.

---

#### Q3: Why Injective over other chains?

**A**: Five sponsor-native advantages:
1. **inEVM**: Native EVM compatibility with Injective-specific precompiles (Bank, Exchange)
2. **x402 official support**: Injective provides SDK, docs, and testnet facilitator
3. **MCP integration**: Official Injective MCP server for AI agent interoperability
4. **Trade finance fit**: Injective's focus on DeFi primitives aligns with RWA trade finance
5. **Fast finality**: Sub-second block times for responsive risk repricing

**Evidence**: Every integration (x402 SDK, MCP server, precompile spikes) links to official Injective documentation in our codebase.

---

#### Q4: Is this a real RWA or just a demo?

**A**: Real legal/technical foundation, demo implementation:
- ✅ **Legal compliance**: Built on UNCITRAL MLETR framework (electronic trade documents have same legal status as paper)
- ✅ **Real contracts**: 5 production-grade Solidity contracts with full test coverage
- ✅ **Real blockchain transactions**: All state changes are on Injective testnet with explorer proof
- ✅ **Realistic data**: Pricing models use actual commodity data, insurance rates, shipping routes
- ❗ **Demo scope**: Cargo/payment settlement is simulated (no actual copper ships in this hackathon!)

**Path to production**: Connect to real logistics APIs (Maersk, MSC), insurance oracles (Chainlink), and legal eBL registries (DCSA standards).

---

#### Q5: Can investors actually lose money?

**A**: **Yes—and that's the point.**

The 0.80 discount is *not a guaranteed profit*. It's compensation for risk. Run this demo:

```bash
npm run demo:default
```

**You'll see three outcomes for the same copper shipment**:
1. ✅ **Normal case**: Buyer pays on time → Investor buys at 0.80, redeems at 1.00 → **+25% return**
2. ❌ **Default case**: War causes copper crash + buyer abandons + insurance denies → Liquidation recovers 0.698 → Investor **loses 12.8%**
3. ⚠️ **Collateral rescue**: Buyer defaults but cargo intact → Excess collateral protects principal

**The AI's job**: Price the discount (0.80) such that across many trades, investors are fairly compensated for defaults. Too high = exporters overpay; too low = investors get burned.

---

#### Q6: What makes this AI, not just a price oracle?

**A**: AI handles multi-modal, non-numerical risk that price feeds can't:

**Scenario**: War breaks out near Strait of Hormuz. Copper price *rises* 15% (supply disruption premium).

- ❌ **Price oracle logic**: "Collateral worth more → loan is safer" → WRONG
- ✅ **AI Agent logic**: "War premium is fragile + insurance excludes war + default probability spikes + recovery will crash" → **PAUSE offering**

**The difference**: AI correlates across documents (eBL authenticity, insurance fine print), macro events (geopolitics, weather), and financial risk (collateral haircuts, stress scenarios). A price feed only sees one number.

**Test it**: Load the "Hormuz War Crisis" scenario in the dashboard—AI pauses even though copper price is UP.

---

#### Q7: How do you prevent the AI from being gamed?

**A**: Multi-layer verification:
1. **Document consistency checks**: Cross-validates eBL, invoice, insurance fields (quantity, value, coverage)
2. **Evidence graph requirement**: AI must cite sources for every discount (can't hallucinate)
3. **On-chain evidence hash**: Report content is cryptographically bound to payment
4. **Duplicate eBL detection**: Same cargo can't be tokenized twice
5. **Collateral hard limits**: Can't issue $1M RWA against $500K cargo
6. **Insurance validation**: Checks policy coverage, expiry, exclusions

**Tests**: `npm test` includes fraud attempt scenarios (fake invoices, duplicate eBLs, insurance gaps).

---

### 🛠️ Tech Stack

#### AI & Intelligence Layer
- **LLM Providers**: OpenAI GPT-4, DeepSeek, Qwen (with deterministic fallback)
- **RAG System**: Custom vector retrieval for macro risk intelligence
- **Structured Output**: Zod schema validation for PricingQuote JSON
- **Document Processing**: OCR pipeline with field-level confidence scoring

#### Blockchain & Web3
- **Chain**: Injective inEVM (Testnet Chain ID 1439)
- **Smart Contracts**: Solidity 0.8.x, Hardhat development framework
- **Web3 Library**: ethers.js 6.x
- **Wallet Support**: MetaMask, Keplr, Leap with session persistence

#### Payment & Settlement
- **x402 Protocol**: `@injectivelabs/x402` official SDK
- **Payment Standard**: EIP-3009 (USDC transferWithAuthorization)
- **Settlement Layer**: On-chain PaymentOracle with receipt persistence

#### Backend & API
- **Runtime**: Node.js 20+
- **Server**: Express 5.x with x402 middleware
- **Testing**: Node.js native test runner (341 tests)
- **Persistence**: File-based JSON storage with atomic writes

#### AI Agent Interoperability
- **MCP Standard**: `@modelcontextprotocol/sdk` v1.29+
- **Injective MCP**: Official Injective Labs MCP server integration
- **Tools**: 7 core tools (analyze_ebl, price_offering, settle_offering, etc.)
- **Resources**: 3 live data feeds (offerings, risk intel, settlement history)

#### Frontend
- **Architecture**: Vanilla JS + Modern CSS (no framework bloat)
- **Styling**: Injective purple theme (#0B60FF, #D6336C) with WCAG AA compliance
- **Visualization**: Pricing waterfall, risk radar, timeline stepper
- **Wallet Integration**: WalletConnect + Keplr/Leap native support

---

### 🎯 Business Model

**Revenue Streams**:
1. **x402 Intelligence Sales**: $0.50-$2.00 per risk report (banks, insurers, investors, AI agents)
2. **Protocol Fees**: 0.1-0.3% of RWA issuance volume (paid by exporters)
3. **Enterprise API**: Premium tier for institutional integrators ($500/month)

**Target Markets**:
- **SME Exporters**: $2.5T unmet financing demand (ADB 2023)
- **DeFi Investors**: Seeking real-world yield with tangible collateral
- **Banks & Insurers**: Buy due diligence reports to accelerate their own underwriting
- **AI Agents**: Programmatic access to trade finance intelligence

**Unit Economics** (illustrative):
- Report production cost: ~$0.05 (LLM API calls + compute)
- Sale price: $0.50-$2.00
- Gross margin: 90-97%

**Scalability**: Pure digital good with near-zero marginal cost. One AI agent can underwrite thousands of shipments daily.

---

### 🚀 Roadmap & Vision

#### ✅ Current (Hackathon Milestone)
- 341 tests passing, 32 contract tests
- 5-contract protocol deployed on Injective testnet
- x402 live payment settlement
- MCP server integration
- Full lifecycle demo with war/weather scenarios

#### 🔄 Next 3 Months (Post-Hackathon)
- **ENI Integration**: Connect to Injective's Electronic Negotiable Instrument precompile for legal eBL registry
- **Precompile Expansion**: Use Bank precompile for USDC settlements, Exchange precompile for commodity price feeds
- **Real Logistics Data**: Integrate Maersk TradeLens, DCSA standards for live shipment tracking
- **Insurance Oracles**: Chainlink integration for parametric weather/marine insurance

#### 📅 6-12 Months (Production)
- **Institutional Pilot**: Partner with 2-3 banks for co-underwriting program
- **Compliance Layer**: KYC/AML via Fractal/Synaps, accredited investor gates
- **Multi-Chain**: Expand to Ethereum L2s, Polygon, Avalanche for broader liquidity
- **Secondary Market**: Enable RWA token trading with transparent risk scores

#### 🌟 Long-Term Vision
Build the **Bloomberg Terminal for AI-priced trade finance**:
- Every shipment globally has a real-time risk score
- Banks, insurers, investors, and AI agents all subscribe to the intelligence feed
- AgentBL becomes the source of truth for commodity trade risk pricing

---

<a name="chinese"></a>

## 🇨🇳 简体中文

### ⚡ 30秒核心介绍

**问题背景**: 全球贸易融资存在 **2.5万亿美元**缺口。货物一装船，出口商需等待**45天**才能收款，资金完全冻结。银行拒绝**45%**的中小企业贸易融资申请——不是因为交易有风险，而是因为企业规模小。

**我们的解决方案**: AgentBL 将电子提单（eBL）转化为流动性 RWA 代币。**AI Agent 自主承保**每笔货运，计算风险调整后的折价。投资者通过 **x402 支付微额 USDC** 解锁高级风险情报，然后为发行提供资金。**Injective EVM 强制执行**整个生命周期上链。

**核心洞察**: 传统 DeFi 让市场*猜测*资产价格。AgentBL 让 AI *在投资前定价风险*——折价是投资者抵御违约的唯一保护。这就是为什么 AI 必须可验证、自主且上链。

```
出口商上传eBL → AI 5分钟承保 → 投资者支付$0.50获取风险报告
→ 按0.80折价认购 → 目标兑付：$1.00 → Injective上链强制结算
```

---

### 🎯 为什么能赢得冠军

| 评审维度 | 我们的证据 | 验证方式 |
|----------|-----------|----------|
| **🚀 创新性** | AI风险情报通过x402作为*产品销售*，而非仅仅是功能。报告本身可交易且链上可验证。 | [x402实时支付](#x402-paid-intelligence) → PaymentOracle将报告哈希绑定到USDC结算 |
| **⚙️ 技术执行** | 341个AI/后端测试 + 32个合约测试。5合约协议已部署。MCP服务器含7工具+3资源。所有交易在Injective测试网可验证。 | [`npm test`](#test-coverage) → [已部署合约](#deployed-contracts) → [实时证据](#live-evidence) |
| **💎 真实用例** | 解决2.5万亿美元贸易融资缺口。银行、保险公司、投资者和其他AI Agent可无需账户或订阅购买报告。清晰的收入模型。 | [问题陈述](#the-problem) → [商业模式](#business-model) |
| **🎨 产品与UX** | 402挑战 → 钱包签名 → 结算 → 解锁情报——全流程一体。证据可展开。钱包故障恢复。 | [快速开始](#quick-start-judge-mode) → 5秒理解测试 |
| **🌐 生态契合** | 基于官方Injective x402 SDK、MCP、inEVM、浏览器。可选预编译合约。Azure Foundry评估/追踪。 | 每个集成都链接到[代码/配置/追踪/交易](#tech-stack) |

---

### 🌍 问题：填补2.5万亿美元贸易融资缺口

贸易融资是全球经济的命脉，但它仍然运行在**纸质文件、电话沟通和数十年的机构信任**之上。

#### 📊 关键数据

- **2.5万亿美元缺口**（亚洲开发银行）：全球无法获得融资的可行贸易金额
- **45%拒绝率**：出口中小企业面临近半数拒绝率，原因是*公司规模门槛*，而非交易质量
- **45天资金锁定**：从货物装运到收款的标准时间差

#### ⏳ 冻结资金时间线

```text
T0: 订单下达 → T1: 货物装运（签发eBL）→ [ 45天资金锁定期 ] 
→ T3: 货物到港 → T4: 收到付款
```

**AgentBL 瞄准 T1→T4 流动性缺口**：出口商将货物所有权（eBL）代币化为贸易融资 RWA，全球投资者即时提供资金。

#### ⚖️ 法律催化剂

**UNCITRAL MLETR**（电子可转让记录示范法）、**新加坡ETA 2021**和**英国ETDA 2023**的采用，赋予电子贸易单据与纸质单据**完全相同的法律占有地位**，为链上贸易融资打开了巨大的合规窗口。

---

### 🏆 冠军级特性

#### 🤖 **特性1：AI自主承保引擎** — 不是聊天机器人，是金融决策引擎

AI不仅*建议*——它**执行**。当eBL上传时，系统自主完成：

1. **OCR + 字段提取**：解析提单、商业发票和保险单
2. **跨单据一致性检查**：验证数量、货值、单价vs市场基准、国际贸易术语、保险覆盖范围
3. **风险评分**：评估运输风险、地缘政治事件、天气、港口拥堵、汇率波动、商品价格压力
4. **动态定价**：计算公平的RWA发行价格，包含明确的紧急度/风险/抵押品折扣
5. **链上执行**：将定价报价推送到Injective EVM的`RiskPricingOracle`以自主启动发行

**证据**:
- ✅ **341个测试通过**（`npm test`）覆盖定价引擎、文档一致性、风险评分、LLM回退
- ✅ **多LLM支持**：OpenAI/DeepSeek/Qwen，LLM失败时确定性回退
- ✅ **RAG风险情报**：10个实时数据源的宏观风险feed
- ✅ **结构化输出**：每个决策遵循`PricingQuote` JSON schema，带证据图谱

**为什么重要**：传统DeFi让市场*猜测*价格。AgentBL让AI *在投资前定价风险*。折价是投资者应对潜在违约的唯一补偿——所以必须在资本部署**之前**计算。

---

#### 💰 **特性2：x402付费情报市场** — AI报告作为可交易产品

AgentBL实现**x402协议**（HTTP 402支付要求 + EIP-3009）来**将AI情报货币化**。服务器不是免费提供风险洞察，而是发出`402 Payment Required`挑战。客户端签署USDC转账授权，链上结算。

**商业模式**:
```
银行/保险公司/投资者/其他AI Agent
    ↓ 请求高级风险报告
服务器响应：HTTP 402 Payment Required
    ↓ 客户端签署 EIP-3009 USDC 授权
通过 PaymentOracle 在 Injective EVM 上结算
    ↓ 付款验证
解锁：高级风险情报 + 审计追踪哈希
```

**可以购买的内容**:
- 🔍 **高级风险报告**：AI对eBL真实性、货物估值、违约概率的尽职调查
- 💎 **货物估值**：市场基准定价含压力情景
- 🛡️ **反欺诈取证**：文档一致性检查、重复eBL检测、合规警报

**收入模型**:
- 每份报告$0.50–$2.00（可配置）
- 无订阅、无账户——纯按次付费
- 可扩展至机构API消费

**证据**:
- ✅ **实时x402结算**：Injective测试网上的真实USDC转账，带`PaymentAttested`事件（[查看交易](#live-evidence)）
- ✅ **官方Injective SDK**：使用`@injectivelabs/x402` npm包构建
- ✅ **报告哈希绑定**：每份付费报告通过`PaymentOracle.bindReportToPayment()`加密绑定到其支付
- ✅ **TTL与重放保护**：报告会过期；重复授权被拒绝

---

#### ⛓️ **特性3：Injective 5合约协议** — 自主RWA生命周期执行

AgentBL在Injective inEVM上部署**5合约协议**，自动化整个贸易融资生命周期：

| 合约 | 角色 | 关键函数 |
|------|------|----------|
| **EBLRegistry V2** | eBL NFT所有权 + 防欺诈 | `registerEBL()`, `transferOwnership()`, `detectDuplicate()`, `verifyENISignature()` |
| **RWAOfferingPool** | 发行生命周期自动化 | `createOffering()`, `subscribe()`, `reprice()`, `pause()`, `resume()`, `settle()` |
| **RiskPricingOracle** | AI → 链上定价管道 | `updatePricing()`, `getPricingQuote()`, `bindEvidenceHash()` |
| **RWAToken** | ERC20兼容RWA份额 | `mint()`, `burn()`, `transfer()`, 标准ERC20接口 |
| **AgentBLRWA** | 主协调器 | 跨合约编排、访问控制、紧急暂停 |

**状态机**（链上强制执行）:
```
Created → Priced → Open → Funded → InTransit → [Repriced/Paused] → Arrived → Settled → Redeemed
```

---

### 📞 联系方式

- **GitHub**: [github.com/LuBryant/AgentBL](https://github.com/LuBryant/AgentBL)
- **Demo**: [启动本地演示](#quick-start)
- **Contracts**: [查看已部署合约](#deployed-contracts)
- **Tests**: `npm test` (341 passing)

---

### 📄 License

MIT License - 详见 [LICENSE](./LICENSE)

---

<div align="center">

**Built with 💜 for Injective Nova Hackathon 2026**

*The AI prices the deal. The chain enforces it.*

</div>

