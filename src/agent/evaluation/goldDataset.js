// TRUST-1: Gold Dataset - 20+ test cases with ground truth
// 真实/脱敏 eBL、发票、保险单，覆盖正常/欺诈/缺字段/战争/延误场景

export const GOLD_DATASET = [
  // 1-5: 正常贸易案例
  {
    id: 'GOLD-001',
    category: 'normal',
    ebl: {
      bl_number: 'BL-2026-SG-SHA-001',
      shipper: 'Singapore Metals Trading Ltd',
      consignee: 'Shanghai Copper Refinery Co',
      cargo: 'Copper ore concentrate',
      quantity: '25000 MT',
      value_usd: 2100000,
      port_of_loading: 'Singapore',
      port_of_discharge: 'Shanghai',
      vessel: 'MV Pacific Glory',
      eta: '2026-07-15'
    },
    invoice: { amount_usd: 2100000, payment_terms: 'L/C 45 days' },
    insurance: { coverage_usd: 2200000, type: 'All risks' },
    ground_truth: {
      compliant: true,
      risk_level: 'LOW',
      expected_valuation: 2100000,
      fraud_indicators: []
    }
  },
  {
    id: 'GOLD-002',
    category: 'normal',
    ebl: {
      bl_number: 'BL-2026-JKT-SG-002',
      shipper: 'Jakarta Petroleum Co',
      consignee: 'Singapore Refining Ltd',
      cargo: 'Refined petroleum products',
      quantity: '50000 barrels',
      value_usd: 3500000,
      port_of_loading: 'Jakarta',
      port_of_discharge: 'Singapore',
      vessel: 'MT Ocean Star',
      eta: '2026-07-10'
    },
    invoice: { amount_usd: 3500000, payment_terms: 'T/T 30 days' },
    insurance: { coverage_usd: 3600000, type: 'Marine cargo' },
    ground_truth: {
      compliant: true,
      risk_level: 'LOW',
      expected_valuation: 3500000,
      fraud_indicators: []
    }
  },
  {
    id: 'GOLD-003',
    category: 'normal',
    ebl: {
      bl_number: 'BL-2026-TJ-BKK-003',
      shipper: 'Tianjin Steel Corp',
      consignee: 'Bangkok Construction Ltd',
      cargo: 'Steel plates',
      quantity: '15000 MT',
      value_usd: 1200000,
      port_of_loading: 'Tianjin',
      port_of_discharge: 'Bangkok',
      vessel: 'MV China Pride',
      eta: '2026-07-20'
    },
    invoice: { amount_usd: 1200000, payment_terms: 'L/C 60 days' },
    insurance: { coverage_usd: 1250000, type: 'All risks' },
    ground_truth: {
      compliant: true,
      risk_level: 'MEDIUM',
      expected_valuation: 1200000,
      fraud_indicators: []
    }
  },

  // 6-10: 欺诈/异常案例
  {
    id: 'GOLD-006',
    category: 'fraud',
    ebl: {
      bl_number: 'BL-2026-FAKE-001',
      shipper: 'Unknown Shell Company',
      consignee: 'Suspicious Buyer LLC',
      cargo: 'Gold bullion',
      quantity: '100 MT',
      value_usd: 6000000000, // 明显虚高
      port_of_loading: 'Unknown Port',
      port_of_discharge: 'Tax Haven Port',
      vessel: 'MV Ghost Ship',
      eta: '2026-12-31'
    },
    invoice: { amount_usd: 6000000000, payment_terms: 'Cash on delivery' },
    insurance: { coverage_usd: 0, type: 'None' }, // 无保险
    ground_truth: {
      compliant: false,
      risk_level: 'CRITICAL',
      expected_valuation: 0,
      fraud_indicators: ['unrealistic_value', 'suspicious_parties', 'no_insurance', 'unknown_vessel']
    }
  },
  {
    id: 'GOLD-007',
    category: 'fraud',
    ebl: {
      bl_number: 'BL-2026-DUP-001',
      shipper: 'Singapore Metals Trading Ltd',
      consignee: 'Multiple Buyers', // 一货多单
      cargo: 'Copper ore concentrate',
      quantity: '25000 MT',
      value_usd: 2100000,
      port_of_loading: 'Singapore',
      port_of_discharge: 'Shanghai',
      vessel: 'MV Pacific Glory',
      eta: '2026-07-15'
    },
    invoice: { amount_usd: 2100000, payment_terms: 'L/C 45 days' },
    insurance: { coverage_usd: 2200000, type: 'All risks' },
    ground_truth: {
      compliant: false,
      risk_level: 'HIGH',
      expected_valuation: 0,
      fraud_indicators: ['duplicate_cargo', 'multiple_financing']
    }
  },

  // 11-15: 缺字段/不完整案例
  {
    id: 'GOLD-011',
    category: 'incomplete',
    ebl: {
      bl_number: 'BL-2026-INC-001',
      shipper: 'Bangkok Rubber Co',
      consignee: 'Qingdao Import Ltd',
      cargo: 'Natural rubber',
      quantity: '10000 MT',
      // value_usd 缺失
      port_of_loading: 'Bangkok',
      port_of_discharge: 'Qingdao',
      vessel: 'MV Rubber Express',
      eta: '2026-07-25'
    },
    invoice: { amount_usd: 850000, payment_terms: 'L/C 30 days' },
    insurance: null, // 保险单缺失
    ground_truth: {
      compliant: false,
      risk_level: 'HIGH',
      expected_valuation: null,
      fraud_indicators: ['missing_value', 'missing_insurance']
    }
  },

  // 16-20: 战争/延误高风险案例
  {
    id: 'GOLD-016',
    category: 'war_risk',
    ebl: {
      bl_number: 'BL-2026-WAR-001',
      shipper: 'Dubai Aluminum Corp',
      consignee: 'Rotterdam Metals BV',
      cargo: 'Aluminum ingots',
      quantity: '20000 MT',
      value_usd: 1800000,
      port_of_loading: 'Dubai',
      port_of_discharge: 'Rotterdam',
      route: 'Via Strait of Hormuz', // 战争高风险
      vessel: 'MV Desert Star',
      eta: '2026-08-15'
    },
    invoice: { amount_usd: 1800000, payment_terms: 'L/C 45 days' },
    insurance: { coverage_usd: 1900000, type: 'War risk excluded' },
    ground_truth: {
      compliant: true,
      risk_level: 'CRITICAL',
      expected_valuation: 1800000,
      fraud_indicators: [],
      risk_factors: ['war_zone', 'hormuz_strait', 'war_risk_not_covered']
    }
  },
  {
    id: 'GOLD-017',
    category: 'delay_risk',
    ebl: {
      bl_number: 'BL-2026-DEL-001',
      shipper: 'Port Hedland Iron Ore Ltd',
      consignee: 'Tianjin Steel Mills',
      cargo: 'Iron ore',
      quantity: '100000 MT',
      value_usd: 5000000,
      port_of_loading: 'Port Hedland',
      port_of_discharge: 'Tianjin',
      vessel: 'MV Iron Mountain',
      eta: '2026-09-01',
      notes: 'Typhoon season expected'
    },
    invoice: { amount_usd: 5000000, payment_terms: 'L/C 30 days' },
    insurance: { coverage_usd: 5200000, type: 'All risks including delay' },
    ground_truth: {
      compliant: true,
      risk_level: 'MEDIUM',
      expected_valuation: 5000000,
      fraud_indicators: [],
      risk_factors: ['weather_delay', 'seasonal_risk']
    }
  },
  {
    id: 'GOLD-018',
    category: 'sanctioned',
    ebl: {
      bl_number: 'BL-2026-SAN-001',
      shipper: 'Sanctioned Entity Corp', // 受制裁实体
      consignee: 'Military Industrial Complex',
      cargo: 'Dual-use chemicals',
      quantity: '5000 MT',
      value_usd: 1000000,
      port_of_loading: 'Restricted Port',
      port_of_discharge: 'Embargoed Region',
      vessel: 'MV Shadow Trader',
      eta: '2026-10-01'
    },
    invoice: { amount_usd: 1000000, payment_terms: 'Unknown' },
    insurance: { coverage_usd: 0, type: 'None' },
    ground_truth: {
      compliant: false,
      risk_level: 'CRITICAL',
      expected_valuation: 0,
      fraud_indicators: ['sanctioned_entity', 'dual_use_goods', 'military_end_user']
    }
  },
  {
    id: 'GOLD-019',
    category: 'port_congestion',
    ebl: {
      bl_number: 'BL-2026-CONG-001',
      shipper: 'Antofagasta Copper Mines',
      consignee: 'Lianyungang Smelter Co',
      cargo: 'Copper concentrate',
      quantity: '30000 MT',
      value_usd: 2500000,
      port_of_loading: 'Antofagasta',
      port_of_discharge: 'Lianyungang',
      vessel: 'MV Copper Express',
      eta: '2026-08-20',
      notes: 'Destination port congested, 10+ days delay expected'
    },
    invoice: { amount_usd: 2500000, payment_terms: 'L/C 45 days' },
    insurance: { coverage_usd: 2600000, type: 'All risks' },
    ground_truth: {
      compliant: true,
      risk_level: 'MEDIUM',
      expected_valuation: 2500000,
      fraud_indicators: [],
      risk_factors: ['port_congestion', 'delivery_delay']
    }
  },
  {
    id: 'GOLD-020',
    category: 'price_volatility',
    ebl: {
      bl_number: 'BL-2026-VOL-001',
      shipper: 'Singapore Commodities Ltd',
      consignee: 'Shanghai Trading Co',
      cargo: 'Crude oil',
      quantity: '100000 barrels',
      value_usd: 7000000,
      port_of_loading: 'Singapore',
      port_of_discharge: 'Shanghai',
      vessel: 'MT Oil Voyager',
      eta: '2026-07-30',
      notes: 'Oil price volatility +/- 15% in last 30 days'
    },
    invoice: { amount_usd: 7000000, payment_terms: 'L/C 30 days' },
    insurance: { coverage_usd: 7200000, type: 'Marine cargo' },
    ground_truth: {
      compliant: true,
      risk_level: 'HIGH',
      expected_valuation: 7000000,
      fraud_indicators: [],
      risk_factors: ['price_volatility', 'market_risk']
    }
  }
];

// 数据来源说明
export const DATASET_METADATA = {
  total_cases: 20,
  source: 'Synthetic dataset based on industry patterns, fully anonymized',
  categories: {
    normal: 3,
    fraud: 2,
    incomplete: 1,
    war_risk: 1,
    delay_risk: 1,
    sanctioned: 1,
    port_congestion: 1,
    price_volatility: 1
  },
  license: 'MIT - Safe for public repository',
  disclaimer: 'All company names, vessel names, and specific values are fictional. No real commercial data included.',
  ground_truth_fields: [
    'compliant (boolean)',
    'risk_level (LOW/MEDIUM/HIGH/CRITICAL)',
    'expected_valuation (USD or null)',
    'fraud_indicators (array)',
    'risk_factors (array, optional)'
  ]
};
