# 贸易融资协议 (Trade Finance Facility Agreement)

> 拟真样例数据，用于 TradeShield demo。

| | |
|---|---|
| **Facility No.** | TF-2026-001 |
| **Agreement Date** | 16 May 2026 |
| **Type** | Import/Export Trade Finance — eBL Pledge |

---

## Parties

| Role | Entity |
|---|---|
| **Borrower** | Beijing Agricultural Trading Co., Ltd. (Exporter) |
| **Lender** | HSBC Hong Kong |
| **Importer / Repayment Source** | Singapore Food Processing Pte. Ltd. |

---

## Collateral Package

```
┌──────────────────────────────────────────────┐
│  1. Electronic Bill of Lading (TradeGo)      │
│     eBL No: TG-EBL-2026-0001                │
│     Consigned: TO ORDER OF HSBC HONG KONG    │
│                                              │
│  2. Marine Cargo Insurance Policy            │
│     Policy No: MCI-2026-001                  │
│     Insured Amount: USD 2,860,000            │
│     Beneficiary assigned to HSBC Hong Kong   │
│                                              │
│  3. Letter of Credit Proceeds                │
│     L/C No: HSBC-LC-2026-08921               │
│     Issued by: HSBC Hong Kong                │
│     Applicant: Singapore Food Processing     │
└──────────────────────────────────────────────┘
```

---

## Financing Terms

| Field | Value |
|---|---|
| Cargo Value (CIF) | USD 2,600,000.00 |
| **Advance Ratio (LTV)** | **80%** |
| **Financing Amount** | **USD 2,080,000.00** |
| Interest Rate | **SOFR + 3%** (per annum) |
| Financing Period | **45 Days** (from drawdown) |
| Drawdown Date | 19 May 2026 (upon eBL pledge) |
| Maturity Date | 3 July 2026 |
| Currency | USD |

---

## Repayment

| Field | Value |
|---|---|
| Primary Source | Importer Payment under L/C at Sight (HSBC-LC-2026-08921) |
| L/C Payment Trigger | Presentation of compliant eBL + documents |
| Expected Repayment | Upon L/C negotiation (~3-5 business days after document presentation) |

---

## Default Events

The Lender may declare an Event of Default upon:

| # | Event |
|---|---|
| 1 | **Cargo Loss** — Total or partial loss of cargo not covered by insurance |
| 2 | **Buyer Default** — Importer fails to honor L/C payment obligations |
| 3 | **Fraudulent Documents** — Any document presented is found to be fraudulent |

---

## Security Enforcement

Upon an Event of Default, HSBC Hong Kong may:

1. **Exercise control over eBL** — Transfer eBL title to itself or a nominated agent
2. **Dispose of cargo** — Sell the cargo at destination or redirect vessel
3. **Claim insurance proceeds** — File claim under MCI-2026-001
4. **Set-off** — Apply any proceeds against the outstanding facility balance

---

## Covenants

Borrower covenants that:
- Cargo is free of encumbrances other than this facility
- All documents are genuine and accurately describe the cargo
- Insurance is maintained at ≥ 110% of CIF value throughout the financing period
- No other financing is secured against the same collateral

---

| | |
|---|---|
| **Signed for HSBC Hong Kong** | **Signed for Beijing Agricultural Trading Co., Ltd.** |
| J. Chan (Trade Finance Director) | Li (Export Director) |
