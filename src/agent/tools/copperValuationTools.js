// TradeShield AI valuation tools (copper cathodes).
//
// Each tool is exposed to the LLM as an OpenAI-compatible "function" spec and
// has a matching executor. External-data tools (live price, historical trades)
// call real APIs when their key is set, and fall back to deterministic mock
// data (calibrated to June 2026 levels) when it is not — so the whole agent
// runs offline for the demo. The valuation tool is pure/local.
//
// Required env (all optional; missing -> mock):
//   COMMODITY_PRICE_PROVIDER   "metalprice" | "alphavantage" | "mock" (auto if unset)
//   METALPRICE_API_KEY         metalpriceapi.com (LME copper, USD/MT)
//   ALPHAVANTAGE_API_KEY       alphavantage.co  (COPPER global price, USD/MT)
//   COMTRADE_PRIMARY_KEY       comtradeapi.un.org (historical trade unit values)
//   REGION_PREMIUM_USD_PER_MT  override regional physical premium (e.g. Yangshan)

const MOCK = 'mock-fallback';

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

async function fetchJson(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Tool 1: live commodity price (LME-linked copper, USD/MT)
// ---------------------------------------------------------------------------
export async function getLiveCommodityPrice(args = {}, env = process.env) {
  const commodity = args.commodity ?? 'copper';
  const provider = env.COMMODITY_PRICE_PROVIDER
    ?? (env.METALPRICE_API_KEY ? 'metalprice' : env.ALPHAVANTAGE_API_KEY ? 'alphavantage' : 'mock');

  try {
    if (provider === 'metalprice' && env.METALPRICE_API_KEY) {
      // metalpriceapi.com — LME copper symbol "LME-XCU", USD base.
      // NOTE: verify symbol + whether rate is inverted (per-USD) against provider docs.
      const url = `https://api.metalpriceapi.com/v1/latest?api_key=${env.METALPRICE_API_KEY}&base=USD&currencies=LME-XCU`;
      const json = await fetchJson(url);
      const rate = json.rates?.['LME-XCU'] ?? json.rates?.LMEXCU ?? json.rates?.XCU;
      if (rate) {
        const pricePerMt = rate > 1 ? rate : round(1 / rate, 2); // defensive inversion
        return { commodity, price_usd_per_mt: round(pricePerMt, 2), currency: 'USD', as_of: json.date ?? null, source: 'metalpriceapi.com (LME-XCU)' };
      }
    }

    if (provider === 'alphavantage' && env.ALPHAVANTAGE_API_KEY) {
      // Alpha Vantage COPPER — monthly global price of copper, USD per metric ton.
      const url = `https://www.alphavantage.co/query?function=COPPER&interval=monthly&apikey=${env.ALPHAVANTAGE_API_KEY}`;
      const json = await fetchJson(url);
      const latest = (json.data ?? []).find((d) => d.value && d.value !== '.');
      if (latest) {
        return { commodity, price_usd_per_mt: round(Number(latest.value), 2), currency: 'USD', as_of: latest.date, source: 'alphavantage.co COPPER (global monthly)' };
      }
    }
  } catch (error) {
    // fall through to mock with a note
    return mockLivePrice(commodity, `mock-fallback (live API error: ${error.message})`);
  }

  return mockLivePrice(commodity);
}

function mockLivePrice(commodity, sourceOverride) {
  const isOil = /crude|oil|petroleum/i.test(commodity ?? '');
  if (isOil) {
    // Brent ~USD 95/bbl x ~7.67 bbl/MT -> ~USD 740/MT-equivalent (June 2026 calibrated).
    return { commodity, price_usd_per_mt: 740, currency: 'USD', as_of: '2026-06-05', source: sourceOverride ?? `${MOCK} (Brent June 2026, USD/MT-equiv)` };
  }
  return { commodity, price_usd_per_mt: 13680, currency: 'USD', as_of: '2026-06-04', source: sourceOverride ?? `${MOCK} (LME copper June 2026 calibrated)` };
}

// ---------------------------------------------------------------------------
// Tool 2: regional physical premium (e.g. CIF Shanghai / Yangshan basis)
// ---------------------------------------------------------------------------
export async function getRegionalPhysicalPremium(args = {}, env = process.env) {
  const destination = args.destination ?? 'Shanghai';
  const commodity = args.commodity ?? 'copper';
  const isOil = /crude|oil|petroleum/i.test(commodity);
  // No clean free API for physical premiums (SMM / Fastmarkets are paid),
  // so this is a configured value; override via REGION_PREMIUM_USD_PER_MT.
  const configured = env.REGION_PREMIUM_USD_PER_MT ? Number(env.REGION_PREMIUM_USD_PER_MT) : null;
  const fallback = isOil ? 10 : 70;
  return {
    destination,
    premium_usd_per_mt: configured ?? fallback,
    basis: isOil ? 'crude grade differential (USD/MT-equiv)' : 'CIF Shanghai (Yangshan) copper premium',
    source: configured != null ? 'env:REGION_PREMIUM_USD_PER_MT' : `${MOCK} (${isOil ? 'crude differential' : 'typical Yangshan premium'})`
  };
}

// ---------------------------------------------------------------------------
// Tool 3: historical comparable trade prices (UN Comtrade unit values)
// ---------------------------------------------------------------------------
export async function getHistoricalComparableTrades(args = {}, env = process.env) {
  const hsCode = String(args.hs_code ?? '740311');
  const reporter = String(args.reporter_code ?? '156'); // 156 = China
  const partner = String(args.partner_code ?? '0'); // 0 = World
  const periods = args.periods ?? ['2025', '2024', '2023'];

  if (env.COMTRADE_PRIMARY_KEY) {
    try {
      // UN Comtrade v1: annual (A) imports (M) of HS 740311 by reporter.
      const url = `https://comtradeapi.un.org/data/v1/get/C/A/HS`
        + `?reporterCode=${reporter}&cmdCode=${hsCode}&flowCode=M`
        + `&partnerCode=${partner}&partner2Code=0&period=${periods.join(',')}&includeDesc=true`;
      const json = await fetchJson(url, { headers: { 'Ocp-Apim-Subscription-Key': env.COMTRADE_PRIMARY_KEY } });
      const rows = json.data ?? [];
      const comparables = rows
        .filter((r) => r.primaryValue && r.netWgt)
        .map((r) => ({
          period: String(r.period),
          partner: r.partnerDesc ?? partner,
          unit_value_usd_per_mt: round((r.primaryValue / r.netWgt) * 1000, 2), // netWgt is kg
          trade_value_usd: Math.round(r.primaryValue),
          source: 'UN Comtrade'
        }));
      if (comparables.length) {
        return { hs_code: hsCode, reporter_code: reporter, comparables, source: 'comtradeapi.un.org' };
      }
    } catch (error) {
      return mockComparables(hsCode, reporter, `mock-fallback (Comtrade error: ${error.message})`);
    }
  }

  return mockComparables(hsCode, reporter);
}

function mockComparables(hsCode, reporter, sourceOverride) {
  const isOil = String(hsCode).startsWith('2709');
  if (isOil) {
    // China crude import unit values (HS 2709), USD/MT-equiv, run-up into 2026.
    const comparables = [
      { period: '2025-Q3', partner: 'World', unit_value_usd_per_mt: 540, trade_value_usd: 78_000_000_000, source: MOCK },
      { period: '2025-Q4', partner: 'World', unit_value_usd_per_mt: 575, trade_value_usd: 82_000_000_000, source: MOCK },
      { period: '2026-Q1', partner: 'World', unit_value_usd_per_mt: 650, trade_value_usd: 90_000_000_000, source: MOCK },
      { period: '2026-04', partner: 'World', unit_value_usd_per_mt: 705, trade_value_usd: 31_000_000_000, source: MOCK },
      { period: '2026-05', partner: 'World', unit_value_usd_per_mt: 730, trade_value_usd: 33_000_000_000, source: MOCK }
    ];
    return { hs_code: hsCode, reporter_code: reporter, comparables, source: sourceOverride ?? `${MOCK} (China crude import unit values, calibrated)` };
  }
  // Recent China import unit values for refined copper cathodes (HS 740311),
  // showing the 2025->2026 run-up into the war-premium environment.
  const comparables = [
    { period: '2025-Q3', partner: 'World', unit_value_usd_per_mt: 9850, trade_value_usd: 4_120_000_000, source: MOCK },
    { period: '2025-Q4', partner: 'World', unit_value_usd_per_mt: 10400, trade_value_usd: 4_380_000_000, source: MOCK },
    { period: '2026-Q1', partner: 'World', unit_value_usd_per_mt: 11900, trade_value_usd: 4_910_000_000, source: MOCK },
    { period: '2026-04', partner: 'World', unit_value_usd_per_mt: 12800, trade_value_usd: 1_690_000_000, source: MOCK },
    { period: '2026-05', partner: 'World', unit_value_usd_per_mt: 13250, trade_value_usd: 1_770_000_000, source: MOCK }
  ];
  return { hs_code: hsCode, reporter_code: reporter, comparables, source: sourceOverride ?? `${MOCK} (China copper-cathode import unit values, calibrated)` };
}

// ---------------------------------------------------------------------------
// Tool 4: compute cargo valuation (pure / local deterministic policy)
// ---------------------------------------------------------------------------
export function computeCargoValuation(args = {}) {
  const quantityMt = Number(args.quantity_mt);
  const marketPrice = Number(args.market_price_usd_per_mt);
  const premium = Number(args.premium_usd_per_mt ?? 0);
  const declared = Number(args.declared_invoice_value_usd);
  const insured = Number(args.insured_value_usd);
  const haircutPct = Number(args.volatility_haircut_pct ?? 0); // e.g. 0.04 for war premium
  const coverageLimit = Number(args.redemption_coverage_limit ?? 0.9);

  const landedPrice = round(marketPrice + premium, 2);
  const marketValue = round(quantityMt * landedPrice, 2);
  const rawVerified = Math.min(declared, marketValue, insured);
  const aiVerified = round(rawVerified * (1 - haircutPct), 2);
  const maxSafeRedemption = round(aiVerified * coverageLimit, 2);

  const basisParts = [];
  if (rawVerified === marketValue) basisParts.push('quantity x landed market price (lowest)');
  if (rawVerified === declared) basisParts.push('declared invoice value (lowest)');
  if (rawVerified === insured) basisParts.push('insured value (lowest)');

  return {
    landed_price_usd_per_mt: landedPrice,
    market_value_usd: marketValue,
    declared_invoice_value_usd: round(declared, 2),
    insured_value_usd: round(insured, 2),
    raw_verified_value_usd: round(rawVerified, 2),
    volatility_haircut_pct: haircutPct,
    ai_verified_collateral_value_usd: aiVerified,
    redemption_coverage_limit: coverageLimit,
    max_safe_redemption_exposure_usd: maxSafeRedemption,
    valuation_basis: `min(${basisParts.join(', ') || 'declared, market, insured'}) - ${round(haircutPct * 100, 1)}% volatility haircut`
  };
}

// ---------------------------------------------------------------------------
// OpenAI-compatible tool specs + executor registry
// ---------------------------------------------------------------------------
export const TOOL_SPECS = [
  {
    type: 'function',
    function: {
      name: 'get_live_commodity_price',
      description: 'Get the latest LME-linked market price for a commodity (e.g. copper) in USD per metric tonne.',
      parameters: {
        type: 'object',
        properties: {
          commodity: { type: 'string', description: 'Commodity name, e.g. "copper".' }
        },
        required: ['commodity']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_regional_physical_premium',
      description: 'Get the regional physical delivery premium (USD/MT) for a destination, e.g. CIF Shanghai (Yangshan) copper premium.',
      parameters: {
        type: 'object',
        properties: {
          commodity: { type: 'string' },
          destination: { type: 'string', description: 'Discharge market, e.g. "Shanghai".' }
        },
        required: ['destination']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_historical_comparable_trades',
      description: 'Get historical comparable transaction prices (unit values, USD/MT) for an HS code from international trade statistics (UN Comtrade).',
      parameters: {
        type: 'object',
        properties: {
          hs_code: { type: 'string', description: 'HS code, e.g. "740311" for refined copper cathodes.' },
          reporter_code: { type: 'string', description: 'UN M49 reporter country code, e.g. "156" for China.' },
          partner_code: { type: 'string', description: 'Partner country code, "0" for World.' },
          periods: { type: 'array', items: { type: 'string' }, description: 'Periods, e.g. ["2025","2024"].' }
        },
        required: ['hs_code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'compute_cargo_valuation',
      description: 'Deterministically compute the AI-verified collateral value: min(invoice, quantity x landed price, insured) minus a volatility haircut, and the max safe redemption exposure. Call this LAST, after gathering price and premium.',
      parameters: {
        type: 'object',
        properties: {
          quantity_mt: { type: 'number' },
          market_price_usd_per_mt: { type: 'number' },
          premium_usd_per_mt: { type: 'number' },
          declared_invoice_value_usd: { type: 'number' },
          insured_value_usd: { type: 'number' },
          volatility_haircut_pct: { type: 'number', description: 'Fraction 0-1, e.g. 0.04 when prices are at war-premium highs.' },
          redemption_coverage_limit: { type: 'number', description: 'Fraction 0-1, default 0.9.' }
        },
        required: ['quantity_mt', 'market_price_usd_per_mt', 'declared_invoice_value_usd', 'insured_value_usd']
      }
    }
  }
];

export const TOOL_EXECUTORS = {
  get_live_commodity_price: (args, env) => getLiveCommodityPrice(args, env),
  get_regional_physical_premium: (args, env) => getRegionalPhysicalPremium(args, env),
  get_historical_comparable_trades: (args, env) => getHistoricalComparableTrades(args, env),
  compute_cargo_valuation: (args) => computeCargoValuation(args)
};
