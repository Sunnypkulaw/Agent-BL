// TradeShield RAG: Judge Q&A Pairs (Mock)
// 4 prepared Q&A pairs for hackathon judge Q&A sessions
// Each pair includes the question, a model answer, search keywords,
// and a pointer to the relevant documentation or source code.

export const JUDGE_QA_PAIRS = [
  {
    id: 'QA-1',
    question: 'How does an electronic Bill of Lading serve as valid collateral for trade finance?',
    answer: 'An electronic Bill of Lading (eBL) is a transferable document of title recognized under frameworks like MLETR (Model Law on Electronic Transferable Records, adopted by 8 jurisdictions) and the UK Electronic Trade Documents Act 2023. In the TradeShield model, the exporter pledges the eBL to a smart contract (EBLRegistry), which records the pledge on-chain. The eBL represents the legal right to claim the cargo at destination — it is not just a data record, but a title document that can be enforced through admiralty law. The AI Agent validates the eBL against insurance coverage, market value, and shipment events before allowing the financing pool to open. If the exporter defaults, the contract can transfer the eBL to investors or trigger cargo sale for recovery. This transforms a traditionally paper-based, bank-intermediated process into a programmable, AI-verified financing instrument.',
    keywords: ['ebl', 'bill of lading', 'collateral', 'document of title', 'mletr', 'pledge', 'smart contract', 'enforcement'],
    source: 'docs/background.md, docs/PRD.md section 2',
    searchQuery: 'eBL legal status document of title trade finance collateral',
    relatedKnowledgeIds: ['WAR-003', 'BUY-002']
  },

  {
    id: 'QA-2',
    question: 'Why does the AI Agent recommend different issue prices (0.80 / 0.86 / 0.90)? What makes the price change?',
    answer: 'The AI issue price is determined by three components: (1) Base Issue Price — determined by the exporter\'s chosen payout speed. FAST payout means the exporter gets cash quickly but accepts a deeper discount (0.80). BALANCED is 0.86, and LOW_COST is 0.90. This is essentially a time-value tradeoff: faster access to cash costs more. (2) Urgency Discount — additional discount if the exporter signals exceptional urgency beyond the standard speed tiers, reflecting the higher opportunity cost of waiting. (3) Risk Discount — the most dynamic component. The AI Agent analyzes shipment events (bad weather, cargo damage, route deviation, insurance expiry), market data (copper price changes, LME inventory levels), and macro risk events (war, sanctions, port congestion, extreme weather). Each risk factor maps to a penalty that reduces the Cargo Health Score, which in turn reduces the collateral value and increases the risk discount. For example: if copper drops 12% AND the vessel encounters monsoon weather AND insurance is close to expiry, the system may drop from a 0.90 base price to a 0.60-to-0.75 final price. All discounts are evidenced and hashed on-chain via the RiskPricingOracle so investors can verify the pricing logic.',
    keywords: ['issue price', 'discount', 'payout speed', 'risk', 'base price', 'urgency', 'health score', 'evidence'],
    source: 'docs/PRD.md sections 2.2, 2.3, 5.3, 8.4',
    searchQuery: 'copper price drop Indian Ocean monsoon insurance expiry risk discount',
    relatedKnowledgeIds: ['COM-001', 'WEA-001', 'POR-001', 'WAR-001']
  },

  {
    id: 'QA-3',
    question: 'How does the AI Agent\'s output trigger on-chain contract actions? Is the AI itself on-chain?',
    answer: 'The AI Agent runs off-chain and produces a structured output (RiskReport and PricingQuote) that includes a contract_action field (APPROVE_FINANCING, TRIGGER_MARGIN_CALL, FREEZE_POOL, or TRIGGER_LIQUIDATION) and an evidence_hash. This is NOT the AI making on-chain decisions directly — instead, the AI\'s output is pushed to an on-chain RiskPricingOracle contract via the push_pricing_to_oracle MCP tool. The oracle emits a PricingUpdated event containing the pool ID, the new issue price, the risk level, the recommended action, and the evidence hash. The RWAOfferingPool contract reads this event and executes state transitions: Open → Repriced, Paused, Frozen, or Liquidation. This design keeps the AI off-chain (where it can process complex, unstructured data like weather reports and news) while keeping the execution on-chain (where it is transparent, auditable, and irreversible). The evidence hash stored on-chain allows anyone to verify that the AI\'s pricing decision was based on specific, timestamped evidence — preventing "black box" pricing.',
    keywords: ['on-chain', 'contract action', 'risk oracle', 'off-chain', 'evidence hash', 'pricing event', 'state machine', 'transparency'],
    source: 'docs/PRD.md sections 5.5, 9.3; src/core/workflow.js',
    searchQuery: 'AI off-chain oracle on-chain pricing event evidence hash verification',
    relatedKnowledgeIds: []
  },

  {
    id: 'QA-4',
    question: 'What happens if the insurance expires while the cargo is still in transit? How does the AI protect investors?',
    answer: 'This is one of the core risk scenarios the AI Agent is designed to detect and respond to. The process works as follows: (1) Detection — the AI Agent monitors the insurance.expires_at field from the TradeCase and compares it against the vessel\'s ETA. If the ETA is close to or past the insurance expiry date, and a shipment event of type insurance_expiry_risk is logged, the risk engine applies a 20-point penalty to the Cargo Health Score. (2) Impact Assessment — the 20-point penalty, combined with any other risk events (weather, delays, price drops), reduces the Health Factor. If the Health Factor drops below 1.25, the AI recommends TRIGGER_MARGIN_CALL — requiring the exporter to either extend the insurance policy, provide proof of extension, or post additional collateral. (3) Escalation — if the Health Factor drops below 1.0 (meaning the adjusted collateral value no longer covers the requested financing), the AI triggers FREEZE_POOL or TRIGGER_LIQUIDATION, freezing investor funds and initiating cargo liquidation procedures. (4) Investor Protection — throughout this process, investors can see the AI\'s risk assessment and the evidence behind it in real time via the Investor RWA Offering page. The system never relies on the exporter\'s promise alone — it requires verifiable evidence (insurance policy hash on-chain, updated ETA from AIS data) before restoring the pool to normal status.',
    keywords: ['insurance expiry', 'health factor', 'margin call', 'liquidation', 'cargo health', 'investor protection', 'evidence'],
    source: 'src/core/riskEngine.js lines 13, 92-97; docs/PRD.md section 5.3',
    searchQuery: 'insurance expiry risk cargo in transit health factor margin call liquidation',
    relatedKnowledgeIds: ['WEA-001', 'POR-003', 'WAR-003']
  }
];

// ---- Helper functions ----

export function getAllQAPairs() {
  return JUDGE_QA_PAIRS;
}

export function getQAById(id) {
  return JUDGE_QA_PAIRS.find(p => p.id === id) || null;
}

/**
 * Search Q&A pairs by query keywords. Simulates RAG retrieval for judge Q&A.
 *
 * @param {string} query - The judge's question or keywords
 * @param {number} [limit=2] - Max pairs to return
 * @returns {Array<Object>} Matching Q&A pairs with scores
 */
export function searchQA(query, limit = 2) {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return [];

  const scored = JUDGE_QA_PAIRS.map(pair => {
    let score = 0;
    const answerLower = pair.answer.toLowerCase();
    const questionLower = pair.question.toLowerCase();
    const keywordsLower = pair.keywords.map(k => k.toLowerCase());

    for (const token of tokens) {
      if (keywordsLower.some(k => k === token)) score += 10;
      else if (keywordsLower.some(k => k.includes(token))) score += 6;
      else if (questionLower.includes(token)) score += 4;
      else if (answerLower.includes(token)) score += 2;
    }

    return { ...pair, _score: score };
  });

  return scored
    .filter(s => s._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}
