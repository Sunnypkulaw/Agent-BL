// 批量生成铝锭现货采购合同 eBL 数据文件
// 数据来源：企业采购系统导出的已签约合同列表
// 所有公司名称、人名均已脱敏为虚构名称

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// ====== 虚构名称映射 ======
// 买方: 中铝佛山 → 南方有色金属贸易有限公司 (SouthMet International Trade)
// 各供应商已全部替换为虚构名称

const CONTRACTS = [
  {
    slug: 'alu-fs-wh-00017',
    case_id: 'CASE-EWR-2025-ALU-FS-WH-00017',
    contract_no: '2025-FS-AL0-CG-00017',
    contract_name: '铝锭现货采购-鑫源-1.22',
    supplier: '广西鑫源贸易有限公司',
    supplier_en: 'Guangxi Xinyuan Trading Co., Ltd.',
    amount_cny: 2787066.90,
    quantity_mt: 137.565,
    unit_price_cny: 20262,
    payment: '现款现货',
    delivery: '库内交接',
    trade_mode: '现款现货',
    incoterms: 'EXW 佛山仓库',
    sign_date: '2025-01-22',
    commodity: 'Aluminum Ingot（铝锭）',
    commodity_grade: 'AL99.70 / P1020 级别',
    salesperson: '周明远',
    dept: '贸易事业部',
    cost_basis: 18300,
    lme_ref: 2180,
    shfe_ref: 19980,
    smm_ref: 20180,
    premium: 82
  },
  {
    slug: 'alu-fs-wh-00016',
    case_id: 'CASE-EWR-2025-ALU-FS-WH-00016',
    contract_no: '2025-FS-AL0-CG-00016',
    contract_name: '铝锭现货采购-骏达-1.20',
    supplier: '广西骏达供应链管理有限公司',
    supplier_en: 'Guangxi Junda Supply Chain Management Co., Ltd.',
    amount_cny: 3291768.66,
    quantity_mt: 162.276,
    unit_price_cny: 20285,
    payment: '现款现货',
    delivery: '库内交接',
    trade_mode: '现款现货',
    incoterms: 'EXW 佛山仓库',
    sign_date: '2025-01-20',
    commodity: 'Aluminum Ingot（铝锭）',
    commodity_grade: 'AL99.70 / P1020 级别',
    salesperson: '周明远',
    dept: '贸易事业部',
    cost_basis: 18350,
    lme_ref: 2190,
    shfe_ref: 20000,
    smm_ref: 20200,
    premium: 85
  },
  {
    slug: 'alu-fs-wh-00015b',
    case_id: 'CASE-EWR-2025-ALU-FS-WH-00015B',
    contract_no: '2025-FS-ALX-CG-00015',
    contract_name: '铝合金锭现货采购-瑞达通-1.17',
    supplier: '瑞达通金属（广东）有限公司',
    supplier_en: 'Ruidatong Metals (Guangdong) Co., Ltd.',
    amount_cny: 1343100.00,
    quantity_mt: 66.000,
    unit_price_cny: 20350,
    payment: '先货后款',
    delivery: '自提',
    trade_mode: '先货后款',
    incoterms: 'EXW 供方仓库（自提）',
    sign_date: '2025-01-17',
    commodity: 'Aluminum Alloy Ingot（铝合金锭）',
    commodity_grade: 'ADC12 / A380 级别，铝合金锭',
    salesperson: '周明远',
    dept: '贸易事业部',
    cost_basis: 18500,
    lme_ref: 2195,
    shfe_ref: 20100,
    smm_ref: 20260,
    premium: 90,
    note: '铝合金锭（ADC12），不同于纯铝锭 P1020。用于压铸行业，溢价高于普通铝锭。'
  },
  {
    slug: 'alu-fs-wh-00013b',
    case_id: 'CASE-EWR-2025-ALU-FS-WH-00013B',
    contract_no: '2025-FS-AL0-CG-00013',
    contract_name: '铝锭现货采购-同鑫-1.15',
    supplier: '厦门同鑫实业有限公司',
    supplier_en: 'Xiamen Tongxin Industrial Co., Ltd.',
    amount_cny: 2242200.54,
    quantity_mt: 112.054,
    unit_price_cny: 20010,
    payment: '现款现货',
    delivery: '库内交接',
    trade_mode: '现款现货',
    incoterms: 'EXW 佛山仓库',
    sign_date: '2025-01-15',
    commodity: 'Aluminum Ingot（铝锭）',
    commodity_grade: 'AL99.70 / P1020 级别',
    salesperson: '周明远',
    dept: '贸易事业部',
    cost_basis: 18100,
    lme_ref: 2170,
    shfe_ref: 19850,
    smm_ref: 19930,
    premium: 80
  },
  {
    slug: 'alu-fs-wh-00012',
    case_id: 'CASE-EWR-2025-ALU-FS-WH-00012',
    contract_no: '2025-FS-AL0-CG-00012',
    contract_name: '铝锭现货采购-信达-1.14',
    supplier: '信达金属宁波能源有限公司',
    supplier_en: 'Xinda Metals Ningbo Energy Co., Ltd.',
    amount_cny: 5627512.15,
    quantity_mt: 279.281,
    unit_price_cny: 20150,
    payment: '现款现货',
    delivery: '库内交接',
    trade_mode: '现款现货',
    incoterms: 'EXW 佛山仓库',
    sign_date: '2025-01-14',
    commodity: 'Aluminum Ingot（铝锭）',
    commodity_grade: 'AL99.70 / P1020 级别',
    salesperson: '周明远',
    dept: '贸易事业部',
    cost_basis: 18250,
    lme_ref: 2185,
    shfe_ref: 19950,
    smm_ref: 20070,
    premium: 80,
    note: '本批次最大单笔合同，279吨/¥563万。供应商为央企子公司，信用资质极优。'
  },
  {
    slug: 'alu-fs-wh-00011',
    case_id: 'CASE-EWR-2025-ALU-FS-WH-00011',
    contract_no: '2025-FS-AL0-CG-00011',
    contract_name: '铝锭现货采购-兴泰-1.14',
    supplier: '广东兴泰投资有限公司',
    supplier_en: 'Guangdong Xingtai Investment Co., Ltd.',
    amount_cny: 1690746.20,
    quantity_mt: 83.908,
    unit_price_cny: 20150,
    payment: '先货后款',
    delivery: '库内交接',
    trade_mode: '先货后款',
    incoterms: 'EXW 佛山仓库',
    sign_date: '2025-01-14',
    commodity: 'Aluminum Ingot（铝锭）',
    commodity_grade: 'AL99.70 / P1020 级别',
    salesperson: '周明远',
    dept: '贸易事业部',
    cost_basis: 18250,
    lme_ref: 2185,
    shfe_ref: 19950,
    smm_ref: 20070,
    premium: 80
  },
  {
    slug: 'alu-fs-wh-00010',
    case_id: 'CASE-EWR-2025-ALU-FS-WH-00010',
    contract_no: '2025-FS-AL0-CG-00010',
    contract_name: '铝锭现货采购-宏昌-1.13',
    supplier: '广州宏昌金属材料有限公司',
    supplier_en: 'Guangzhou Hongchang Metal Materials Co., Ltd.',
    amount_cny: 4362624.00,
    quantity_mt: 216.400,
    unit_price_cny: 20160,
    payment: '先货后款',
    delivery: '库内交接',
    trade_mode: '先货后款',
    incoterms: 'EXW 佛山仓库',
    sign_date: '2025-01-13',
    commodity: 'Aluminum Ingot（铝锭）',
    commodity_grade: 'AL99.70 / P1020 级别',
    salesperson: '周明远',
    dept: '贸易事业部',
    cost_basis: 18260,
    lme_ref: 2190,
    shfe_ref: 19960,
    smm_ref: 20080,
    premium: 80
  },
  {
    slug: 'alu-fs-wh-00009',
    case_id: 'CASE-EWR-2025-ALU-FS-WH-00009',
    contract_no: '2025-FS-AL0-CG-00009',
    contract_name: '铝锭现货采购-同鑫-1.13',
    supplier: '厦门同鑫实业有限公司',
    supplier_en: 'Xiamen Tongxin Industrial Co., Ltd.',
    amount_cny: 1712574.19,
    quantity_mt: 84.907,
    unit_price_cny: 20170,
    payment: '现款现货',
    delivery: '库内交接',
    trade_mode: '现款现货',
    incoterms: 'EXW 佛山仓库',
    sign_date: '2025-01-13',
    commodity: 'Aluminum Ingot（铝锭）',
    commodity_grade: 'AL99.70 / P1020 级别',
    salesperson: '周明远',
    dept: '贸易事业部',
    cost_basis: 18270,
    lme_ref: 2190,
    shfe_ref: 19970,
    smm_ref: 20090,
    premium: 80
  },
  {
    slug: 'alu-fs-wh-00008',
    case_id: 'CASE-EWR-2025-ALU-FS-WH-00008',
    contract_no: '2025-FS-AL0-CG-00008',
    contract_name: '铝锭现货采购-兴泰-1.13',
    supplier: '广东兴泰投资有限公司',
    supplier_en: 'Guangdong Xingtai Investment Co., Ltd.',
    amount_cny: 2272029.48,
    quantity_mt: 112.644,
    unit_price_cny: 20170,
    payment: '先货后款',
    delivery: '库内交接',
    trade_mode: '先货后款',
    incoterms: 'EXW 佛山仓库',
    sign_date: '2025-01-13',
    commodity: 'Aluminum Ingot（铝锭）',
    commodity_grade: 'AL99.70 / P1020 级别',
    salesperson: '周明远',
    dept: '贸易事业部',
    cost_basis: 18270,
    lme_ref: 2190,
    shfe_ref: 19970,
    smm_ref: 20090,
    premium: 80
  }
];

const USD_RATE = 7.25;

function usd(cny) {
  return Math.round(cny / USD_RATE);
}

function hash(str) {
  return '0x' + crypto.createHash('sha256').update(str).digest('hex');
}

function buildCase(c) {
  const declared_usd = usd(c.amount_cny);
  const unit_usd = Math.round(c.unit_price_cny / USD_RATE);
  const cost_usd = Math.round(c.cost_basis / USD_RATE);
  const cost_total_cny = Math.round(c.cost_basis * c.quantity_mt);
  const cost_total_usd = usd(cost_total_cny);
  const profit_cny = Math.round(c.amount_cny - cost_total_cny);
  const profit_usd = usd(profit_cny);
  const margin = profit_cny / c.amount_cny;
  const ltv = c.payment === '先货后款' ? 0.60 : 0.70;
  const requested_cny = Math.round(c.amount_cny * ltv);
  const requested_usd = usd(requested_cny);
  const payout = c.payment === '先货后款' ? 'BALANCED' : 'FAST';
  const lme_usd = c.lme_ref;
  const smm_cny = c.smm_ref;
  const vat = Math.round(c.amount_cny * 0.13);

  const noteParts = [`${c.supplier}生产成本~${c.cost_basis.toLocaleString()}元/吨`];
  if (c.note) noteParts.push(c.note);
  noteParts.push(`售价${c.unit_price_cny.toLocaleString()}元/吨，毛利率约${(margin * 100).toFixed(1)}%。`);

  return {
    case_id: c.case_id,
    model: 'ai-dynamic-pricing-rwa-v0.2',
    note: `拟真样例数据（虚构）：南方有色佛山 × ${c.supplier} 铝锭现货采购 ${c.contract_no}。金额按~${USD_RATE}汇率折算USD。` + (c.note ? ` ${c.note}` : ''),
    uploaded_documents: {
      warehouse_receipt_file: `data/uploads/${c.slug}/warehouse-receipt.md`,
      commercial_invoice_file: `data/uploads/${c.slug}/commercial-invoice.md`
    },
    bill_of_lading: {
      bl_id: `EWR-${c.contract_no.replace(/\//g, '-')}`,
      bl_no: `FS/WH/AL0/${c.contract_no.split('-').pop()}`,
      bl_type: 'electronic_warehouse_receipt',
      ebl_platform: 'AgentBL ENI (数字仓单)',
      ebl_title_ref: `ENI-EWR-AL0-${c.contract_no.split('-').pop()}-${Math.random().toString(16).slice(2,6).toUpperCase()}`,
      shipper: `${c.supplier} (${c.supplier_en})`,
      consignee: '南方有色金属贸易有限公司 (SouthMet International Trade Co., Ltd.)',
      notify_party: '南方有色金属贸易有限公司，广东省佛山市南海区',
      carrier: '佛山南海正源仓储物流有限公司（指定交割库）',
      vessel: 'N/A（库内交货）',
      voyage_no: 'N/A',
      port_of_loading: `佛山南海指定仓库（入库单号 WH-FS-${c.contract_no.split('-').pop()})`,
      port_of_discharge: `佛山南海指定仓库（出库单号 WH-FS-${c.contract_no.split('-').pop()})`,
      incoterms: c.incoterms,
      cargo: c.commodity_grade,
      quantity_mt: c.quantity_mt,
      containers: 'N/A（散货仓库堆存）',
      declared_value_usd: declared_usd,
      issue_date: c.sign_date,
      shipped_on_board: c.sign_date,
      eta: c.sign_date,
      document_hash: hash(`EWR-${c.contract_no}`)
    },
    commercial_invoice: {
      invoice_no: `JY-AL0-INV-${c.contract_no.split('-').pop()}`,
      invoice_date: c.sign_date,
      sales_contract: c.contract_no,
      incoterms: c.incoterms,
      payment_terms: c.payment === '现款现货' ? '现款现货（T/T 电汇）' : '先货后款（验收后7个工作日内）',
      pricing_basis: 'SMM 佛山铝锭现货价 + 华南升贴水',
      smm_reference_price_cny_per_mt: c.smm_ref,
      regional_premium_cny_per_mt: c.premium,
      unit_price_cny_per_mt: c.unit_price_cny,
      unit_price_usd_per_mt: unit_usd,
      quantity_mt: c.quantity_mt,
      total_amount_cny: c.amount_cny,
      total_amount_usd: declared_usd,
      currency: 'CNY',
      is_provisional: false,
      vat_rate_pct: 13,
      vat_amount_cny: vat
    },
    cargo: {
      commodity: c.commodity,
      grade: `${c.commodity_grade}，GB/T 1196-2017`,
      hs_code: c.commodity.includes('Alloy') ? '760120' : '760110',
      quantity: c.quantity_mt,
      unit: 'MT',
      brand: '西南铝业 / 锦源铝业（国产主流品牌）',
      warehouse: '佛山南海有色金属指定交割仓库'
    },
    insurance: {
      provider: '中国人保财险佛山分公司（PICC Foshan）',
      policy_type: '国内货运险 + 仓至仓条款',
      coverage_ratio: 1.0,
      insured_value_cny: c.amount_cny,
      insured_value_usd: declared_usd,
      expires_at: '2025-03-31',
      policy_hash: hash(`insurance-${c.contract_no}`)
    },
    trade_economics: {
      cost_basis_cny_per_mt: c.cost_basis,
      cost_basis_usd_per_mt: cost_usd,
      cost_of_goods_cny: cost_total_cny,
      cost_of_goods_usd: cost_total_usd,
      expected_gross_profit_cny: profit_cny,
      expected_gross_profit_usd: profit_usd,
      gross_margin_pct: parseFloat(margin.toFixed(4)),
      note: noteParts.join('，')
    },
    financing: {
      requested_cash_cny: requested_cny,
      requested_cash_usd: requested_usd,
      payout_speed: payout,
      target_redemption_value_usd: 1,
      redemption_coverage_limit: 0.9,
      max_ltv: ltv,
      currency: 'USDC',
      note: `仓单质押融资，初始LTV ${(ltv*100).toFixed(0)}%。${c.payment === '先货后款' ? '供方先货后款，买方融资压力较小，LTV偏保守。' : '现款现货模式，按现货价值融出~' + Math.round(requested_cny/10000) + '万人民币等值USDC。'}`
    },
    market: {
      commodity: c.commodity.includes('Alloy') ? 'Aluminum Alloy（铝合金）' : 'Aluminum（铝）',
      benchmark: 'SMM 佛山铝锭现货价 (A00铝)',
      price_unit: 'CNY/MT',
      reference_price_cny_per_mt: c.smm_ref,
      reference_price_usd_per_mt: Math.round(c.smm_ref / USD_RATE),
      regional_premium_cny_per_mt: c.premium,
      landed_price_cny_per_mt: c.unit_price_cny,
      landed_price_usd_per_mt: unit_usd,
      lme_aluminium_cash_usd_per_mt: c.lme_ref,
      shfe_aluminium_cny_per_mt: c.shfe_ref,
      as_of: c.sign_date,
      source: 'SMM / LME / SHFE 2025年1月行情'
    },
    shipment_events: [
      {
        date: c.sign_date,
        type: 'warehouse_receipt_issued',
        description: `${c.quantity_mt}吨${c.commodity_grade}入库完毕，佛山南海指定仓库签发电子仓单。`,
        severity: 'info'
      },
      {
        date: c.sign_date,
        type: 'ownership_transfer',
        description: `买卖双方完成${c.payment}结算，仓单所有权由${c.supplier}转移至南方有色佛山。`,
        severity: 'info'
      }
    ],
    macro_risk_events: [
      {
        date: c.sign_date,
        type: 'domestic_aluminum_market',
        region: '中国 / 华南',
        severity: 'medium',
        description: '2025年1月佛山铝锭社会库存约22万吨，处于年内中性水平。春节前下游备货需求温和，华南现货升水稳定在60-90元/吨。'
      },
      {
        date: c.sign_date,
        type: 'seasonal_demand',
        region: '中国',
        severity: 'low',
        description: '临近春节假期，下游加工企业陆续停产放假，现货采购节奏放缓。预计节后复工需求回暖。'
      }
    ]
  };
}

function buildWarehouseReceipt(c) {
  return `# 电子仓单 (Electronic Warehouse Receipt)

> 拟真样例数据（虚构） — 南方有色佛山 × ${c.supplier} 铝锭现货采购。
> 签发为 ENI 平台上的数字仓单，支持货权确权、流转和质押融资。

| | |
|---|---|
| **仓单类型** | 电子仓单 (Electronic Warehouse Receipt / EWR) |
| **仓单编号** | EWR-${c.contract_no.replace(/\//g, '-')} |
| **签发平台** | AgentBL ENI（数字仓单） |
| **Token / Title Ref** | ENI-EWR-AL0-${c.contract_no.split('-').pop()}-XXXX |
| **入库单号** | WH-FS-${c.contract_no.split('-').pop()} |
| **签发日期** | ${c.sign_date} |

---

## 货权方

**出让人（Shipper / 仓单签发时货主）**
${c.supplier}
（虚构地址）

**受让人（Consignee / 仓单受让方）**
南方有色金属贸易有限公司
广东省佛山市南海区（虚构地址）

---

## 仓储信息

| 字段 | 数值 |
|---|---|
| 交割仓库 | 佛山南海有色金属指定交割仓库 |
| 仓库地址 | 广东省佛山市南海区（虚构地址） |
| 入库日期 | ${c.sign_date} |
| 交货方式 | ${c.delivery} |
| 提货有效期 | ${new Date(new Date(c.sign_date).getTime() + 30*86400000).toISOString().slice(0,10)} |

---

## 货物品名

**唛头:** JINYUAN / AL99.70 / P1020 / 佛山库交 / 合同号 ${c.contract_no}

| 品名 | HS Code | 数量 | 净重 | 品牌 |
|---|---|---|---|---|
| ${c.commodity_grade}，GB/T 1196-2017 | ${c.commodity.includes('Alloy') ? '7601.20' : '7601.10'} | ${c.quantity_mt.toFixed(3)} 吨 | ${(c.quantity_mt * 1000).toFixed(0)} kg | 西南铝业 / 锦源铝业（国产主流品牌） |

**存放形式:** 散货仓库堆存，按批次码放

**申报货值（仓单价值):** CNY ¥${c.amount_cny.toLocaleString('zh-CN', {minimumFractionDigits: 2})}

---

## 声明

- 上述货物已入库完毕，数量/外观经仓库与货主共同核验确认。
- 本仓单为 **ENI 平台电子仓单**，仓单所有权记录在链上，支持转让、质押。
- 谁合法持有本电子仓单，即对仓内对应货物享有提货权/处置权。
- 重量、标牌、含量等由货主申报，仓库仅对数量/外观负责。

| | |
|---|---|
| **签发地点 & 日期** | 广东省佛山市，${c.sign_date} |
| **签发人** | 佛山南海正源仓储物流有限公司（仓库方签章） |
| **Document Hash (SHA-256)** | ${hash('WR-' + c.contract_no)} |

---

> 说明（给团队）：本仓单对应商业发票与结构化案例 \`data/cases/${c.slug}.case.json\`。
> 仓单所有权的链上流转是实现 RWA 货押融资的核心。
`;
}

function buildCommercialInvoice(c) {
  return `# 商业发票 (Commercial Invoice)

> 拟真样例数据（虚构） — 南方有色佛山 × ${c.supplier} 铝锭现货采购。

**${c.supplier}**
（虚构地址）
统一社会信用代码: XXXXXXXXXXXXXX | Tel: XXXX-XXXXXXXX

---

| | | | |
|---|---|---|---|
| **发票号码** | JY-AL0-INV-${c.contract_no.split('-').pop()} | **发票日期** | ${c.sign_date} |
| **销售合同** | ${c.contract_no} | **Incoterms 2020** | **${c.incoterms}** |
| **付款方式** | ${c.payment === '现款现货' ? '现款现货（T/T 电汇）' : '先货后款（验收后7个工作日）'} | **付款期限** | ${c.payment === '现款现货' ? '款到发货' : '货到验收后7个工作日内'} |
| **仓单编号** | EWR-${c.contract_no.replace(/\//g, '-')} | **入库单号** | WH-FS-${c.contract_no.split('-').pop()} |
| **交货仓库** | 佛山南海有色金属指定交割库 | **增值税率** | 13% |

**卖方:** ${c.supplier}
**买方:** 南方有色金属贸易有限公司，广东省佛山市南海区

---

## 货物品名

| # | 品名 | HS Code | 数量 | 单价（含税，${c.incoterms.split(' ')[0]}） | 金额（CNY，含税） |
|---|---|---|---:|---:|---:|
| 1 | ${c.commodity_grade}，GB/T 1196-2017。品牌：西南铝业 / 锦源铝业。 | ${c.commodity.includes('Alloy') ? '7601.20' : '7601.10'} | ${c.quantity_mt.toFixed(3)} 吨 | ¥${c.unit_price_cny.toLocaleString('zh-CN')} / 吨 | ¥${c.amount_cny.toLocaleString('zh-CN', {minimumFractionDigits: 2})} |
| | | | **${c.quantity_mt.toFixed(3)} 吨** | | **¥${c.amount_cny.toLocaleString('zh-CN', {minimumFractionDigits: 2})}** |

**发票总金额（含税）: CNY ¥${c.amount_cny.toLocaleString('zh-CN', {minimumFractionDigits: 2})} — ${c.incoterms.split(' ')[0]}。**

不含税金额: ¥${(c.amount_cny / 1.13).toLocaleString('zh-CN', {minimumFractionDigits: 2})}  |  增值税额（13%）: ¥${(c.amount_cny * 0.13 / 1.13).toLocaleString('zh-CN', {minimumFractionDigits: 2})}

---

## 计价基础

\`\`\`
单价 = SMM 佛山 A00 铝锭现货价 + 华南地区升贴水

  • SMM A00 铝锭佛山现货参考价（${c.sign_date}）: ¥${c.smm_ref.toLocaleString('zh-CN')}.00 / 吨
  • 华南地区品牌升贴水:                              ¥    ${c.premium}.00 / 吨
  • 合同固定单价:                                   ¥${c.unit_price_cny.toLocaleString('zh-CN')}.00 / 吨
\`\`\`

> **现货固定价合同。** 不设暂定价/QP调整机制。签约日锁定价格，以仓库入库验收重量为结算依据。

---

## 结算信息

| | |
|---|---|
| 收款方 | ${c.supplier} |
| 开户行 | 中国工商银行（虚构分行） |
| SWIFT | ICBKCNBJXXX |
| 账号（人民币） | XXXX-XXXX-XXXX-XXXX |

兹证明本发票真实无误，所列货物产地、品质、数量均如上述。

代表 **${c.supplier}**
授权签字人：李某某（贸易部经理）

---

> 合同成交价 = **¥${c.amount_cny.toLocaleString('zh-CN', {minimumFractionDigits: 2})}**（${c.quantity_mt.toFixed(3)} 吨 × ¥${c.unit_price_cny.toLocaleString('zh-CN')}/吨含税）。
> 不含税单价约 ¥${(c.unit_price_cny / 1.13).toFixed(0)}/吨，约合 USD $${(c.unit_price_cny / 1.13 / USD_RATE).toFixed(0)}/吨。
`;
}

// ====== 执行生成 ======
const casesDir = path.join(rootDir, 'data', 'cases');
const uploadsDir = path.join(rootDir, 'data', 'uploads');

await fs.mkdir(casesDir, { recursive: true });

for (const c of CONTRACTS) {
  // Case JSON
  const caseData = buildCase(c);
  await fs.writeFile(
    path.join(casesDir, `${c.slug}.case.json`),
    JSON.stringify(caseData, null, 2) + '\n',
    'utf8'
  );

  // Upload docs
  const caseUploadDir = path.join(uploadsDir, c.slug);
  await fs.mkdir(caseUploadDir, { recursive: true });

  await fs.writeFile(
    path.join(caseUploadDir, 'warehouse-receipt.md'),
    buildWarehouseReceipt(c),
    'utf8'
  );

  await fs.writeFile(
    path.join(caseUploadDir, 'commercial-invoice.md'),
    buildCommercialInvoice(c),
    'utf8'
  );

  console.log(`✓ ${c.slug} (${c.contract_no}) — ${c.supplier} — ¥${(c.amount_cny/10000).toFixed(1)}万 / ${c.quantity_mt.toFixed(1)}吨`);
}

console.log(`\n✅ 生成完成: ${CONTRACTS.length} case JSONs + ${CONTRACTS.length * 2} upload docs = ${CONTRACTS.length * 3} 文件`);
