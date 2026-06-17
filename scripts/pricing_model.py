"""
TradeShield AI pricing model — reference / sanity-check implementation (Python).

This is the *economic spec* for the profit-grounded RWA discount-issuance pricing
implemented in `src/core/pricingEngine.js`. It is intentionally a standalone,
dependency-free script so the math can be read, run and audited on its own.

Run (uses the team conda env):

    conda activate ETHBJ
    python scripts/pricing_model.py

Core idea
---------
The exporter has a verified trade profit  P = invoice_value - cost_of_goods.
The RWA is issued at a discount to its 1.00 USD target redemption value; the
discount the investor earns IS the exporter's financing cost. We price the
discount as a *share of the exporter's profit*:

    financing_cost = share * P
    issue_price    = cash / (cash + financing_cost)
                   = cash / (cash + share * P)

- payout speed sets the BASE share given up for speed (the "reasonable ratio"):
      FAST 0.50  /  BALANCED 0.33  /  LOW_COST 0.20
- trade risk ADDS share (investors demand more for war / volatility / shipment risk)
- AI-verified collateral CAPS the safe redemption exposure (hard floor on price)
- if the total share would exceed 0.85 of profit, the offering is paused.
"""

BASE_PROFIT_SHARE = {"FAST": 0.50, "BALANCED": 0.33, "LOW_COST": 0.20}
PROFIT_SHARE_WARN = {"FAST": 0.65, "BALANCED": 0.50, "LOW_COST": 0.35}
MAX_PROFIT_SHARE = 0.85
RISK_BPS_PER_PROFIT_SHARE = 3500.0  # 350 bps of risk -> +0.10 of profit shared
MIN_PRICE, MAX_PRICE = 0.50, 0.97


def bps(x):
    return round(x * 10000)


def price_from_share(cash, share, profit):
    return cash / (cash + share * profit)


def quote(speed, cash, profit, collateral, coverage, risk_bps):
    max_safe = round(collateral * coverage, 2)
    risk_share = min(risk_bps / RISK_BPS_PER_PROFIT_SHARE, 0.30)
    base_share = BASE_PROFIT_SHARE[speed]
    total_share = base_share + risk_share
    paused = total_share > MAX_PROFIT_SHARE
    effective_share = min(total_share, MAX_PROFIT_SHARE)

    # additive price decomposition (pre-floor) for the AI Pricing Console
    p_anchor = price_from_share(cash, BASE_PROFIT_SHARE["LOW_COST"], profit)
    p_speed = price_from_share(cash, base_share, profit)
    p_indic = price_from_share(cash, effective_share, profit)

    collateral_floor = cash / max_safe
    final = min(max(p_indic, collateral_floor, MIN_PRICE), MAX_PRICE)
    binding = "COLLATERAL" if collateral_floor > p_indic else "EXPORTER_PROFIT"

    supply = min(cash / final, max_safe)
    redeem = supply  # target redemption value = 1.00
    expected_cash = supply * final
    financing_cost = redeem - expected_cash
    profit_share = financing_cost / profit
    net_profit = profit - financing_cost
    implied_yield = 1 / final - 1

    return {
        "speed": speed,
        "base_issue_price": round(p_anchor, 4),
        "urgency_bps": bps(p_anchor - p_speed),
        "risk_bps": bps(p_speed - p_indic),
        "final": round(final, 4),
        "binding": "PAUSED" if paused else binding,
        "supply": round(supply),
        "redeem": round(redeem),
        "financing_cost": round(financing_cost),
        "profit_share": round(profit_share * 100, 1),
        "yield": round(implied_yield * 100, 1),
        "net_profit": round(net_profit),
        "aggressive": profit_share > PROFIT_SHARE_WARN[speed],
    }


def main():
    print("\nTradeShield profit-grounded RWA pricing - copper SG -> Shanghai")
    print("=" * 78)
    invoice = 6_875_000
    cogs = 5_500_000  # 500 MT x USD 11,000/MT pre-Hormuz cost basis
    profit = invoice - cogs
    cash = 3_300_000
    collateral = 6_531_250  # min(declared, market, insured) less 5% war-premium haircut
    coverage = 0.9
    risk_bps = 200 + 150  # war_risk(warning) + commodity_volatility(warning)

    print(f"invoice USD {invoice:,}  COGS USD {cogs:,}  gross profit P USD {profit:,}")
    print(f"requested cash USD {cash:,}  collateral USD {collateral:,}  "
          f"max safe redemption USD {round(collateral*coverage):,}  risk {risk_bps}bps\n")

    header = f"{'speed':9} {'base':>6} {'urg':>5} {'risk':>5} {'PRICE':>6} {'supply':>10} {'fin_cost':>9} {'share%':>7} {'yield%':>7} {'net':>10}  bind"
    print(header)
    print("-" * len(header))
    for sp in ("FAST", "BALANCED", "LOW_COST"):
        q = quote(sp, cash, profit, collateral, coverage, risk_bps)
        print(f"{q['speed']:9} {q['base_issue_price']:6.3f} {q['urgency_bps']:5} "
              f"{q['risk_bps']:5} {q['final']:6.3f} {q['supply']:10,} "
              f"{q['financing_cost']:9,} {q['profit_share']:7} {q['yield']:7} "
              f"{q['net_profit']:10,}  {q['binding']}{' *AGGR' if q['aggressive'] else ''}")
    print("\nReading: FAST cash now costs the exporter ~60% of trade margin (25% investor"
          "\nupside); LOW_COST preserves ~70% of margin (12.5% upside). Risk and collateral"
          "\ncoverage move the price; target redemption (1.00) is not guaranteed.")


if __name__ == "__main__":
    main()
