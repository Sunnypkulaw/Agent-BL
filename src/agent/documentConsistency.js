// Document consistency checker (AI-8).
//
// Trade finance fraud usually shows up as MISMATCHES between the three documents
// that should describe the same shipment: the electronic bill of lading (eBL),
// the commercial invoice, and the insurance policy. Before the protocol prices
// an RWA against this cargo, the AI cross-checks that the documents agree.
//
// Pure function. Returns a structured report plus a basis-point risk penalty
// that the pricing engine folds into its risk discount (see scoreRisk).

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function relDiff(a, b) {
  if (a === undefined || b === undefined || a === 0) return undefined;
  return Math.abs(a - b) / Math.abs(a);
}

function normalizeIncoterm(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().toUpperCase() : value;
}

/**
 * Cross-check eBL / invoice / insurance / cargo fields for consistency.
 * @param {object} caseData
 * @returns {{ ok:boolean, checks:Array, issues:string[], penalty_bps:number }}
 */
export function checkDocumentConsistency(caseData = {}) {
  const bl = caseData.bill_of_lading ?? {};
  const invoice = caseData.commercial_invoice ?? {};
  const insurance = caseData.insurance ?? {};
  const cargo = caseData.cargo ?? {};
  const market = caseData.market ?? {};

  const checks = [];
  const add = (id, label, status, detail, penalty = 0) =>
    checks.push({ id, label, status, detail, penalty_bps: status === 'ok' ? 0 : penalty });

  // 1. Quantity agreement across eBL / invoice / cargo.
  const qtys = [
    ['eBL', num(bl.quantity_mt)],
    ['invoice', num(invoice.quantity_mt)],
    ['cargo', num(cargo.quantity_mt ?? cargo.quantity)]
  ].filter(([, v]) => v !== undefined);
  if (qtys.length >= 2) {
    const values = qtys.map(([, v]) => v);
    const spread = relDiff(Math.max(...values), Math.min(...values));
    if (spread !== undefined && spread > 0.01) {
      add('quantity_match', 'Quantity agreement (eBL/invoice/cargo)', 'critical',
        `Quantities differ: ${qtys.map(([k, v]) => `${k}=${v}`).join(', ')}`, 250);
    } else {
      add('quantity_match', 'Quantity agreement (eBL/invoice/cargo)', 'ok',
        `All ~${values[0]} MT`);
    }
  }

  // 2. Declared value vs invoice total.
  const declared = num(bl.declared_value_usd);
  const invoiceTotal = num(invoice.total_amount_usd);
  if (declared !== undefined && invoiceTotal !== undefined) {
    const spread = relDiff(invoiceTotal, declared);
    if (spread !== undefined && spread > 0.02) {
      add('declared_vs_invoice', 'eBL declared value vs invoice total', 'warning',
        `eBL ${declared} vs invoice ${invoiceTotal} (${(spread * 100).toFixed(1)}% apart)`, 120);
    } else {
      add('declared_vs_invoice', 'eBL declared value vs invoice total', 'ok',
        `Both ~USD ${invoiceTotal}`);
    }
  }

  // 3. Invoice unit price vs market landed price (over-/under-invoicing).
  const unitPrice = num(invoice.unit_price_usd_per_mt ?? invoice.unit_price_usd_per_bbl);
  const landed = num(market.landed_price_usd_per_mt ?? market.landed_price_usd_per_bbl);
  if (unitPrice !== undefined && landed !== undefined) {
    const spread = relDiff(landed, unitPrice);
    if (spread !== undefined && spread > 0.1) {
      add('invoice_vs_market', 'Invoice unit price vs market', 'warning',
        `Invoice ${unitPrice} vs market ${landed} (${(spread * 100).toFixed(1)}% off — possible mis-invoicing)`, 150);
    } else {
      add('invoice_vs_market', 'Invoice unit price vs market', 'ok',
        `Invoice ${unitPrice} ~ market ${landed}`);
    }
  }

  // 4. Incoterms match between eBL and invoice.
  const blInco = normalizeIncoterm(bl.incoterms);
  const invInco = normalizeIncoterm(invoice.incoterms);
  if (blInco && invInco) {
    if (blInco !== invInco) {
      add('incoterms_match', 'Incoterms agreement (eBL/invoice)', 'warning',
        `eBL "${bl.incoterms}" vs invoice "${invoice.incoterms}"`, 80);
    } else {
      add('incoterms_match', 'Incoterms agreement (eBL/invoice)', 'ok', `Both ${bl.incoterms}`);
    }
  }

  // 5. Insurance covers the cargo value (coverage ratio >= 1.0).
  const insured = num(insurance.insured_value_usd);
  const coverBasis = invoiceTotal ?? declared;
  if (insured !== undefined && coverBasis !== undefined) {
    if (insured < coverBasis) {
      add('insurance_coverage', 'Insurance covers cargo value', 'critical',
        `Insured ${insured} < cargo value ${coverBasis} (coverage gap)`, 220);
    } else {
      add('insurance_coverage', 'Insurance covers cargo value', 'ok',
        `Insured ${insured} >= cargo value ${coverBasis}`);
    }
  }

  // 6. Insurance still valid at expected arrival (ETA) with buffer.
  const eta = bl.eta ? Date.parse(bl.eta) : undefined;
  const expiry = insurance.expires_at ? Date.parse(insurance.expires_at) : undefined;
  if (Number.isFinite(eta) && Number.isFinite(expiry)) {
    const bufferDays = (expiry - eta) / 86_400_000;
    if (bufferDays < 0) {
      add('insurance_expiry', 'Insurance valid through ETA', 'critical',
        `Policy expires ${insurance.expires_at} BEFORE ETA ${bl.eta}`, 250);
    } else if (bufferDays < 7) {
      add('insurance_expiry', 'Insurance valid through ETA', 'warning',
        `Only ${Math.round(bufferDays)}d of cover after ETA ${bl.eta}`, 120);
    } else {
      add('insurance_expiry', 'Insurance valid through ETA', 'ok',
        `${Math.round(bufferDays)}d of cover beyond ETA`);
    }
  }

  // 7. HS code present (needed for historical comparable valuation).
  if (cargo.hs_code === undefined && invoice.hs_code === undefined) {
    add('hs_code_present', 'HS code present for valuation', 'warning',
      'No HS code on cargo/invoice — historical comparables unavailable', 40);
  } else {
    add('hs_code_present', 'HS code present for valuation', 'ok', `HS ${cargo.hs_code ?? invoice.hs_code}`);
  }

  const issues = checks.filter((c) => c.status !== 'ok').map((c) => `${c.label}: ${c.detail}`);
  const penaltyBps = Math.min(600, checks.reduce((sum, c) => sum + c.penalty_bps, 0));
  const hasCritical = checks.some((c) => c.status === 'critical');

  return { ok: issues.length === 0, has_critical: hasCritical, checks, issues, penalty_bps: penaltyBps };
}
