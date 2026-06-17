import crypto from 'node:crypto';

const EVENT_PENALTIES = {
  loaded_on_board: 0,
  no_damage_reported: 0,
  bad_weather: 10,
  delay: 5,
  route_deviation: 12,
  port_strike: 15,
  cargo_damage: 30,
  partial_loss: 35,
  insurance_expiry_risk: 20,
  insurance_invalid: 40
};

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function requiredNumber(value, fieldName) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid or missing number: ${fieldName}`);
  }
  return value;
}

function hashEvidence(payload) {
  return '0x' + crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function calculateRisk(caseData) {
  const bl = caseData.bill_of_lading ?? {};
  const financing = caseData.financing ?? {};
  const market = caseData.market ?? {};
  const insurance = caseData.insurance ?? {};
  const events = Array.isArray(caseData.shipment_events) ? caseData.shipment_events : [];

  const quantityMt = requiredNumber(bl.quantity_mt, 'bill_of_lading.quantity_mt');
  const declaredValue = requiredNumber(bl.declared_value_usd, 'bill_of_lading.declared_value_usd');
  const insuredValue = requiredNumber(insurance.insured_value_usd, 'insurance.insured_value_usd');
  const currentPrice = requiredNumber(market.current_price_usd_per_mt, 'market.current_price_usd_per_mt');
  const initialPrice = requiredNumber(market.initial_price_usd_per_mt, 'market.initial_price_usd_per_mt');
  const requestedAmount = requiredNumber(financing.requested_amount_usd, 'financing.requested_amount_usd');
  const liquidationThreshold = financing.liquidation_threshold ?? 0.85;

  const marketValue = quantityMt * currentPrice;
  const initialMarketValue = quantityMt * initialPrice;
  const verifiedCargoValue = Math.min(declaredValue, insuredValue, marketValue);
  const priceChangePct = (currentPrice - initialPrice) / initialPrice;

  const eventPenalty = events.reduce((sum, event) => {
    const base = EVENT_PENALTIES[event.type] ?? 8;
    if (event.type === 'delay' && typeof event.delay_days === 'number') {
      return sum + Math.min(20, base + Math.max(0, event.delay_days - 3));
    }
    return sum + base;
  }, 0);

  const pricePenalty = priceChangePct < 0 ? Math.min(25, Math.round(Math.abs(priceChangePct) * 100)) : 0;
  const totalPenalty = Math.min(95, eventPenalty + pricePenalty);
  const cargoHealthScore = Math.max(0, 100 - totalPenalty);
  const cargoHealthFactor = cargoHealthScore / 100;
  const adjustedCollateralValue = verifiedCargoValue * cargoHealthFactor;
  const healthFactor = adjustedCollateralValue * liquidationThreshold / requestedAmount;

  let recommendedLtv;
  if (cargoHealthScore >= 85) recommendedLtv = 0.7;
  else if (cargoHealthScore >= 70) recommendedLtv = 0.6;
  else if (cargoHealthScore >= 55) recommendedLtv = 0.5;
  else recommendedLtv = 0.35;

  let action;
  let riskLevel;
  if (healthFactor < 1) {
    action = 'TRIGGER_LIQUIDATION';
    riskLevel = 'CRITICAL';
  } else if (healthFactor < 1.05) {
    action = 'FREEZE_POOL';
    riskLevel = 'CRITICAL';
  } else if (healthFactor < 1.25) {
    action = 'TRIGGER_MARGIN_CALL';
    riskLevel = 'WARNING';
  } else if (cargoHealthScore < 75) {
    action = 'CONTINUE_WITH_WARNING';
    riskLevel = 'MEDIUM';
  } else {
    action = 'APPROVE_FINANCING';
    riskLevel = 'LOW';
  }

  const detectedRisks = [];
  if (priceChangePct < -0.05) detectedRisks.push('commodity_price_drop');
  for (const event of events) {
    if ((EVENT_PENALTIES[event.type] ?? 8) > 0) detectedRisks.push(event.type);
  }
  if (declaredValue > marketValue * 1.05) detectedRisks.push('declared_value_above_market_value');
  if (declaredValue > insuredValue) detectedRisks.push('declared_value_above_insured_value');

  const reportCore = {
    case_id: caseData.case_id,
    bl_id: bl.bl_id,
    risk_level: riskLevel,
    cargo_health_score: round(cargoHealthScore, 0),
    verified_cargo_value_usd: round(verifiedCargoValue, 2),
    adjusted_collateral_value_usd: round(adjustedCollateralValue, 2),
    requested_amount_usd: requestedAmount,
    health_factor: round(healthFactor, 4),
    recommended_ltv: round(recommendedLtv, 2),
    contract_action: action,
    detected_risks: [...new Set(detectedRisks)],
    explanation: buildExplanation({ riskLevel, action, priceChangePct, cargoHealthScore, healthFactor })
  };

  return {
    ...reportCore,
    evidence_hash: hashEvidence({ reportCore, events, market, insurance, document_hash: bl.document_hash })
  };
}

function buildExplanation({ riskLevel, action, priceChangePct, cargoHealthScore, healthFactor }) {
  if (action === 'TRIGGER_LIQUIDATION') {
    return `Health factor is ${round(healthFactor, 2)}, below 1.00. The collateral buffer is insufficient, so liquidation should be triggered.`;
  }
  if (action === 'TRIGGER_MARGIN_CALL') {
    return `Shipment and market risks reduced cargo health to ${round(cargoHealthScore, 0)}. Commodity price changed by ${round(priceChangePct * 100, 2)}%, so the pool should request extra collateral or repayment.`;
  }
  if (action === 'CONTINUE_WITH_WARNING') {
    return `Risk level is ${riskLevel}. Financing may continue, but investors should see the warning and the latest risk evidence.`;
  }
  return 'Documents, insurance coverage, market value and shipment status are within the demo risk limits.';
}
