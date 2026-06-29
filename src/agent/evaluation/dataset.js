// SP-9: Microsoft Foundry Evaluation Dataset
// ≥20 test cases covering Agent AI quality: Task Completion, Tool Call Success, Groundedness

export const EVAL_DATASET = [
  // 1-5: Document parsing and validation
  {
    id: 'eval-001',
    category: 'document_parsing',
    input: {
      task: 'Parse eBL and extract cargo value',
      document: {
        bl_id: 'BL-2026-001',
        cargo: 'Copper ore',
        quantity: '25000 MT',
        value_usd: 2100000
      }
    },
    expected: {
      tool_calls: ['parse_bill_of_lading'],
      output_fields: ['cargo', 'value_usd'],
      task_completion: true
    }
  },
  {
    id: 'eval-002',
    category: 'compliance_check',
    input: {
      task: 'Check if cargo is sanctioned',
      cargo: 'Refined petroleum products',
      shipper: 'Singapore Trading Co',
      consignee: 'Jakarta Refinery Ltd'
    },
    expected: {
      tool_calls: ['check_sanctions', 'check_dual_use'],
      result: 'PASS',
      task_completion: true
    }
  },
  {
    id: 'eval-003',
    category: 'compliance_check',
    input: {
      task: 'Flag sanctioned entity',
      cargo: 'Iron ore',
      shipper: 'Sanctioned Corp',
      consignee: 'Military Entity'
    },
    expected: {
      tool_calls: ['check_sanctions'],
      result: 'BLOCK',
      reasons: ['sanctioned_entity'],
      task_completion: true
    }
  },
  {
    id: 'eval-004',
    category: 'document_validation',
    input: {
      task: 'Validate insurance coverage',
      cargo_value: 2100000,
      insurance_amount: 2200000,
      coverage_ratio: 1.05
    },
    expected: {
      validation: 'PASS',
      task_completion: true
    }
  },
  {
    id: 'eval-005',
    category: 'document_validation',
    input: {
      task: 'Flag insufficient insurance',
      cargo_value: 2100000,
      insurance_amount: 1500000,
      coverage_ratio: 0.71
    },
    expected: {
      validation: 'WARNING',
      issues: ['insufficient_insurance'],
      task_completion: true
    }
  },

  // 6-10: Risk assessment
  {
    id: 'eval-006',
    category: 'risk_assessment',
    input: {
      task: 'Assess route risk for Singapore to Shanghai',
      route: { from: 'Singapore', to: 'Shanghai' },
      cargo: 'Copper ore'
    },
    expected: {
      tool_calls: ['assess_route_risk'],
      risk_level: ['LOW', 'MEDIUM'],
      task_completion: true
    }
  },
  {
    id: 'eval-007',
    category: 'risk_assessment',
    input: {
      task: 'Flag high-risk route through Hormuz',
      route: { from: 'Dubai', to: 'Rotterdam', via: 'Strait of Hormuz' },
      events: ['war_risk_hormuz']
    },
    expected: {
      tool_calls: ['assess_geopolitical_risk'],
      risk_level: ['HIGH', 'CRITICAL'],
      task_completion: true
    }
  },
  {
    id: 'eval-008',
    category: 'risk_assessment',
    input: {
      task: 'Calculate cargo value at risk',
      cargo_value: 2100000,
      risk_factors: ['weather', 'port_congestion']
    },
    expected: {
      tool_calls: ['calculate_risk_discount'],
      output_fields: ['risk_discount_bps'],
      task_completion: true
    }
  },
  {
    id: 'eval-009',
    category: 'risk_escalation',
    input: {
      task: 'Detect price crash event',
      commodity: 'copper',
      price_change: -0.15
    },
    expected: {
      tool_calls: ['detect_market_event'],
      action: 'REPRICE',
      task_completion: true
    }
  },
  {
    id: 'eval-010',
    category: 'risk_escalation',
    input: {
      task: 'Pause offering on war escalation',
      event: 'war_escalation_hormuz',
      severity: 'CRITICAL'
    },
    expected: {
      tool_calls: ['assess_geopolitical_risk'],
      action: 'PAUSE_OFFERING',
      task_completion: true
    }
  },

  // 11-15: Valuation and pricing
  {
    id: 'eval-011',
    category: 'valuation',
    input: {
      task: 'Value copper cargo at market price',
      commodity: 'copper',
      quantity_mt: 25000,
      market_price_per_mt: 8400
    },
    expected: {
      tool_calls: ['value_commodity'],
      valuation_usd: 2100000,
      task_completion: true
    }
  },
  {
    id: 'eval-012',
    category: 'pricing',
    input: {
      task: 'Calculate RWA issue price',
      requested_cash: 1000000,
      payout_speed: 'FAST',
      risk_level: 'MEDIUM'
    },
    expected: {
      tool_calls: ['calculate_issue_price'],
      output_fields: ['final_issue_price_usd'],
      price_range: [0.75, 0.95],
      task_completion: true
    }
  },
  {
    id: 'eval-013',
    category: 'pricing',
    input: {
      task: 'Reject pricing below minimum acceptable',
      requested_cash: 1000000,
      calculated_price: 0.65,
      min_acceptable_price: 0.75
    },
    expected: {
      action: 'REJECT_OFFERING',
      reason: 'below_min_price',
      task_completion: true
    }
  },
  {
    id: 'eval-014',
    category: 'pricing_comparison',
    input: {
      task: 'Compare three payout speeds',
      speeds: ['FAST', 'BALANCED', 'LOW_COST']
    },
    expected: {
      tool_calls: ['compare_payout_speeds'],
      output_fields: ['quotes'],
      quotes_count: 3,
      task_completion: true
    }
  },
  {
    id: 'eval-015',
    category: 'repricing',
    input: {
      task: 'Reprice on risk event',
      original_price: 0.85,
      event: 'port_closure',
      risk_increase_bps: 500
    },
    expected: {
      tool_calls: ['recalculate_price'],
      new_price_lower: true,
      task_completion: true
    }
  },

  // 16-20: Agent orchestration
  {
    id: 'eval-016',
    category: 'orchestration',
    input: {
      task: 'Complete full pricing workflow',
      case_id: 'CASE-EBL-2026-TEST'
    },
    expected: {
      tool_calls: ['parse_document', 'check_compliance', 'assess_risk', 'value_cargo', 'calculate_price'],
      min_tool_calls: 3,
      task_completion: true
    }
  },
  {
    id: 'eval-017',
    category: 'investment_recommendation',
    input: {
      task: 'Recommend safe investments',
      investor_preference: 'conservative',
      available_pools: 5
    },
    expected: {
      tool_calls: ['filter_by_risk', 'rank_investments'],
      output_fields: ['recommendations'],
      task_completion: true
    }
  },
  {
    id: 'eval-018',
    category: 'evidence_grounding',
    input: {
      task: 'Generate explanation with citations',
      decision: 'REPRICE',
      price_change: -0.10
    },
    expected: {
      output_fields: ['explanation', 'evidence'],
      evidence_count: { min: 1 },
      grounded: true,
      task_completion: true
    }
  },
  {
    id: 'eval-019',
    category: 'error_handling',
    input: {
      task: 'Handle missing data gracefully',
      cargo: 'Unknown commodity',
      market_data: null
    },
    expected: {
      fallback_behavior: true,
      error_handled: true,
      task_completion: true
    }
  },
  {
    id: 'eval-020',
    category: 'idempotency',
    input: {
      task: 'Process duplicate event',
      event_id: 'EVT-001',
      already_processed: true
    },
    expected: {
      tool_calls: ['check_event_processed'],
      action: 'SKIP',
      no_duplicate_action: true,
      task_completion: true
    }
  }
];

// Evaluation metrics
export const EVAL_METRICS = {
  TASK_COMPLETION_TARGET: 0.85,  // ≥85%
  TOOL_CALL_SUCCESS_TARGET: 0.95, // ≥95%
  GROUNDEDNESS_TARGET: 0.8        // ≥0.8
};
