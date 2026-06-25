# 商业发票 (Commercial Invoice)

> 拟真样例数据，用于 TradeShield demo。

**Beijing Agricultural Trading Co., Ltd.**
北京市朝阳区建国路88号，中国北京
Tel: +86 10 8888-XXXX | export@batc-agri.example

---

| | | | |
|---|---|---|---|
| **Invoice No.** | INV-2026-001 | **Invoice Date** | 15 May 2026 |
| **Sales Contract** | SC-2026-001 (dated 10 April 2026) | **Incoterms 2020** | **CIF Singapore** |
| **L/C No.** | HSBC-LC-2026-08921 | **Payment Terms** | Irrevocable Documentary Credit at Sight |
| **eBL No.** | TG-EBL-2026-0001 | **Vessel / Voyage** | MV PACIFIC HORIZON / PH2605 |
| **Port of Loading** | Shanghai, China | **Port of Discharge** | Singapore |
| **Country of Origin** | China (PRC — Heilongjiang Province) | **Country of Destination** | Singapore |

**Seller (Beneficiary):** Beijing Agricultural Trading Co., Ltd., Beijing, China
**Buyer (Applicant):** Singapore Food Processing Pte. Ltd., 80 Robinson Road, Singapore

---

## Goods

| # | Description | HS Code | Quantity | Unit Price (CIF Singapore) | Amount (USD) |
|---|---|---|---:|---:|---:|
| 1 | Non-GMO Soybeans, Grade No.1, Protein ≥ 38%, Moisture ≤ 13.5%, Splits ≤ 5%. Origin: Heilongjiang Province, China. Bulk cargo. | 1201.90 | 5,000.000 MT | 520.00 / MT | 2,600,000.00 |
| | | | **5,000.000 MT** | | **USD 2,600,000.00** |

**Total Invoice Value: USD 2,600,000.00 (US Dollars Two Million Six Hundred Thousand Only) — CIF Singapore.**

---

## Pricing Basis

```
Unit Price = CBOT Soybean Futures (July 2026) + CIF Singapore non-GMO premium

  • CBOT Soybean July 2026 futures (as of contract date):   USD 480.00 / MT
  • CIF Singapore non-GMO premium (ocean freight + quality): USD  40.00 / MT
  • Contract unit price:                                     USD 520.00 / MT
```

> **Fixed-price contract.** Price locked at contract signing on 10 April 2026.
> Non-GMO premium (~USD 35-40/MT) reflects traceability, identity preservation, and
> growing ASEAN demand for non-GM soy products.

Freight & insurance: **included (CIF)**. Ocean freight prepaid at USD 95,000. Marine cargo insurance ICC(A) at 110% of CIF value placed by Seller with Ping An Insurance.

---

## Bank / Payment Instructions

| | |
|---|---|
| Beneficiary | Beijing Agricultural Trading Co., Ltd. |
| Bank | HSBC Hong Kong |
| SWIFT | HSBCHKHH |
| Account (USD) | 004-XXXXXX-001 |

We hereby certify that this invoice is true and correct.

For and on behalf of **Beijing Agricultural Trading Co., Ltd.**
Authorized Signatory: Li (Export Director)

---

> Invoice value = **USD 2,600,000.00 CIF Singapore** (5,000 MT × USD 520/MT).
> This is the declared transaction value used for AI valuation cross-checks against
> quantity × real-time market price, insurance amount, and historical trade comparables.
