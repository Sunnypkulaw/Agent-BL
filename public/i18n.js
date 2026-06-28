// Lightweight dependency-free i18n for the AgentBL dashboard.
//
// `t(key, vars)` returns the string for the current language with {var}
// interpolation. UI chrome (headings, labels, buttons, toasts) is translated;
// the AI engine's own prose (exporter/investor explanations, risk_factors,
// timeline events, RAG text) comes from the backend in English and is shown
// as-is in both languages. Language choice persists in localStorage.

const STORAGE_KEY = 'ts_lang';
const SUPPORTED = ['zh', 'en'];

let lang = 'zh';
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED.includes(saved)) lang = saved;
  else if (!navigator.language.toLowerCase().startsWith('zh')) lang = 'en';
} catch { /* ignore */ }
try { document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; } catch { /* ignore */ }

const listeners = new Set();

export function getLang() { return lang; }

export function setLang(next) {
  if (!SUPPORTED.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  for (const fn of listeners) { try { fn(next); } catch { /* ignore */ } }
}

export function toggleLang() { setLang(lang === 'zh' ? 'en' : 'zh'); }

/** Register a callback fired whenever the language changes. */
export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Translate a key with optional {var} interpolation. Falls back to English, then the key. */
export function t(key, vars) {
  const table = DICT[lang] || DICT.en;
  let str = table[key];
  if (str == null) str = DICT.en[key];
  if (str == null) return key;
  if (vars) str = str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
  return str;
}

/**
 * Apply translations to static markup. Walks elements carrying:
 *   data-i18n         -> textContent
 *   data-i18n-html    -> innerHTML
 *   data-i18n-ph      -> placeholder
 *   data-i18n-title   -> title
 */
export function applyStaticI18n(root = document) {
  const title = t('document_title');
  if (title !== 'document_title') document.title = title;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
}

// ===========================================================================
// Dictionary
// ===========================================================================
const DICT = {
  zh: {
    // topbar / subbar
    document_title: 'AgentBL · eBL-backed RWA 投资市场',
    brand_tag: 'AI 为提单背书 RWA 动态定价 · 链上执行',
    nav_market: '投资市场',
    nav_mint: '① 提单上链 · 铸造 RWA',
    nav_voyage: '② 航运追踪 · 实时定价',
    wallet_connect: '🦊 连接钱包',
    live_tip: '所有数字均由本地 AI 定价引擎实时产生',
    case_label: '当前提单',
    case_select_aria: '选择交易案例或电子提单',
    lang_switch_to: 'EN',
    lang_btn_title: 'Switch to English',
    wallet_title: '连接 MetaMask，在 {network} 测试网铸造',

	    // category filter
	    cat_all: '全部',
	    cat_energy_chemical: '能源化工类',
	    cat_metal: '金属',
	    cat_ore: '矿石',
	    search_ph: '搜索提单或 AI 自然语言筛选…',
	    ai_search_title: 'AI 解析自然语言偏好，智能筛选提单',
	    ai_searching: '🤖 AI 解析中…',

	    // search / filter feedback
	    no_case_match: '没有匹配的提单案例',
	    ai_empty_query: '请输入筛选条件或自然语言描述',
	    ai_no_match: 'AI 未找到匹配的提单，请尝试其他描述',
	    ai_error: 'AI 解析失败: {msg}',
    ai_match_toast: 'AI: {reasoning}（匹配 {n} 张 eBL）',
    keyword_match_toast: '关键词匹配 {n} 张 eBL',
    keyword_ai_unavailable_toast: '关键词匹配 {n} 张 eBL（AI 暂不可用）',

    // chain status
    chain_deployed: '● 合约已部署 · 连接钱包铸造真实 {network} 交易',
    chain_not_deployed: '○ 合约未部署 · 当前为模拟上链（运行 deploy 脚本后切真实链）',

    // marketplace
    market_eyebrow: '投资市场',
    market_h1: '选择一笔 eBL 支撑的贸易项目。',
    market_subtitle: '浏览由 AI 实时定价的贸易金融项目。每张卡片都绑定电子提单、航线风险评分、航运进度和认购进度。',
    market_sort_label: '项目排序',
    market_sort_recommended: '推荐排序',
    market_sort_yield: '潜在收益最高',
    market_sort_risk: '风险最低',
    market_sort_funding: '认购最多',
    market_sort_eta: '最早到港',
    market_board_label: 'eBL 项目卡片',
    market_board_h: '项目列表',
    market_count: '{n} 个项目',
    market_empty: '没有匹配的 eBL 项目。',
    market_loading: '定价中…',
    market_stat_deals: '可见项目',
    market_stat_target: '融资目标',
    market_stat_yield: '平均潜在收益',
    market_stat_open: '开放项目',
    market_summary_visible: '可见',
    market_summary_selected: '已选',
    market_summary_price: '发行价',
    market_issue_price: 'AI 发行价',
    market_upside: '潜在收益',
    market_fact_ebl: 'eBL',
    market_fact_vessel: '船舶',
    market_fact_qty: '货物',
    market_fact_target: '目标',
    market_funding: '认购进度',
    market_card_subscribe: '认购',
    market_card_track: '追踪',
    market_detail_loading: '正在加载所选项目…',
    market_detail_label: '所选项目',
    market_detail_upside: '潜在收益',
    market_detail_risk: '风险',
    market_detail_collateral: '抵押货值',
    market_detail_eta: '预计到港',
    market_subscription_label: '投资金额 (USD)',
    market_subscribe_btn: '模拟认购',
    market_paused_btn: '发行已暂停',
    market_open_pricing: '打开定价页',
    market_open_voyage: '打开航运页',
    market_readout_receive: '预计获得',
    market_readout_target: '目标兑付',
    market_readout_foot: '目标兑付不保本，取决于进口商付款、货物结算与保险覆盖。',
    market_need_amount: '请输入大于 0 的投资金额',
    market_subscribing: '模拟中…',
    market_subscribed_toast: '已按当前 AI 报价完成模拟认购。',
    market_subscribe_fail: '模拟认购失败: {msg}',
    market_subscribe_result: '已模拟发行生命周期 · {n} 个步骤',
    market_voyage_note: '到 {disch} 已完成 {pct}% · ETA {eta}',
    market_arrived: '已抵达 {disch}',

    // dynamic labels
    action_OPEN_OFFERING: '开放',
    action_OPEN_WITH_WARNING: '开放 · 预警',
    action_REPRICE_DOWN: '下调定价',
    action_PAUSE_OFFERING: '已暂停',
    action_FREEZE_POOL: '已冻结',
    action_TRIGGER_LIQUIDATION: '清算',
    risk_LOW: '低',
    risk_MEDIUM: '中',
    risk_WARNING: '预警',
    risk_CRITICAL: '严重',
    riskdim_war: '战争 / 地缘',
    riskdim_weather: '天气',
    riskdim_port: '港口 / 物流',
    riskdim_insurance: '保险',
    riskdim_price: '价格波动',
    riskdim_docs: '单据',
    risk_clear: '无风险项',
    speed_FAST_label: '快速',
    speed_BALANCED_label: '均衡',
    speed_LOW_COST_label: '低成本',
    speed_FAST_blurb: '数小时内到账，以更高利润分成换速度。',
    speed_BALANCED_blurb: '标准结算，融资成本与速度更均衡。',
    speed_LOW_COST_blurb: '耐心资金，融资成本更低但到账更慢。',

    // hero (view 1)
    hero_eyebrow: '提单上链 · RWA 折价发行',
    hero_h1: '把在途货物权变成链上 RWA。',
    hero_subtitle: '出口商质押电子提单，AI Pricing &amp; Risk Agent 读取货值、单据与实时宏观风险，给出可解释的 RWA 发行折价 —— <em>风险越高 → 发行价越低 → 投资者潜在收益越高</em>。输入融资金额即可铸造 RWA 并锚定上链（测试网）。',

    // view 1 panels
    p1_h: 'AI 货值估算 & 航线风险',
    p1_sub: 'AI 核验的抵押货值，以及这条航线各类风险的分数与<strong>数据来源</strong>。',
    collateral_label: 'AI 核验抵押货值',
    riskdims_h: '航线风险维度',
    sources_head: '📑 数据来源',
    p2_h: 'AI 定价台',
    p2_sub: '发行价如何从 $1.00 目标兑付价一步步折下来：base 锚点 → 减急用折价 → 减风险折价。',
    p3_h: '融资 & 铸造 RWA',
    p3_sub: '选择到账速度（AI 按可验证毛利分成定价），输入融资金额，铸造 RWA 并上链。',
    payout_speed_label: '出口商到账速度',
    financing_label: '商家融资金额 (USD)',
    mint_btn: '⛓ 铸造 RWA 上链',
    minting: '⛓ 铸造中…',
    compliance: '<strong>非保本。</strong> 1 RWA = $1.00 是<em>目标</em>兑付价，取决于进口商付款、货物结算与保险覆盖。仅限合格投资者。',
    onchain_h: '链上锚定 · AgentBLRWA',
    mint_hint: '输入融资金额并点击「铸造 RWA 上链」。连接钱包且合约已部署时铸造真实链上交易，否则走高保真模拟交易。',

    // deal strip
    ds_route: '航线', ds_cargo: '货物', ds_ebl: '电子提单', ds_declared: '申报货值', ds_collateral: 'AI 核验货值',

    // hero price
    hp_label: 'AI 发行价 / RWA token',
    hp_upside: '潜在毛收益',
    hp_redeem: '兑付目标 <strong>$1.00</strong> · {speed} 到账',

    // valuation
    val_declared: '申报货值', val_insured: '投保金额', val_safe_exposure: '安全兑付敞口', val_supply: '建议 token 供给',
    risk_cite_head: '风险折价援引 RAG 情报:',
    src_rag: 'RAG 情报', src_market: '市场基准', src_valuation: 'AI 货值核验', src_docs: '单据核验',
    src_valuation_detail: '落地价 × 数量，经波动率 haircut，并按 {cov}% 兑付覆盖率封顶安全敞口',

    // payout speeds (sub label)
    speed_FAST_sub: '很快到账', speed_BALANCED_sub: '正常到账', speed_LOW_COST_sub: '耐心资本',

    // waterfall
    wf_target: '目标兑付', wf_base: 'Base 锚点', wf_urgency: '急用折价', wf_risk: '风险折价',
    wf_indicative: '指示价', wf_floor: '抵押下限', wf_final: '最终发行价',
    wf_note_redemption: 'redemption value', wf_note_anchor: 'patient-money anchor',
    wf_note_profit: 'profit-share price', wf_note_floor: 'lifted to safe coverage',
    wf_final_note: '{pct} 上行至 $1.00',
    wf_axis_target: '$1.00 目标',
    wf_axis_foot: '坐标缩放至 {lo}–1.00 · 绑定约束: {bc}',

    // exporter cards
    ec_cash: '到账现金', ec_cost: '融资成本', ec_share: '占贸易毛利', ec_net: '保留净利',
    ec_aipick: '★ AI 推荐', unit_per_token: '/ token',

    // mint readout
    mr_receive_pre: '铸造后获得', mr_receive_post: 'RWA @ ${price} / token',
    mr_price: '发行价', mr_invest: '投入', mr_redeem: '目标兑付', mr_upside: '潜在毛收益',
    mr_foot: '目标兑付非保本——取决于进口商付款与货物结算。',
    mr_paused: 'AI 已暂停发行（{action}）——当前风险下不开放铸造。',

    // mint result
    res_chain: '⛓ {network} 链上', res_sim: '🧪 模拟交易',
    res_minted_pre: '已铸', res_unit_rwa: 'RWA',
    res_price: '发行价', res_balance: '链上 RWA 余额', res_reading: '读取中…',
    res_sim_foot: '运行 deploy 脚本并连接钱包后，此处将是真实链上交易。',

    // toasts
    t_need_financing: '请输入大于 0 的融资金额',
    t_cancel_mint: '已取消铸造',
    t_no_wallet_detected: '未检测到钱包',
    t_chain_call_failed: '链上调用失败，已回退模拟：{msg}',
    t_minted_chain: '✅ 已在 {network} 铸造 {n} RWA',
    t_minted_sim: '已生成模拟铸造交易（{n} RWA）',
    t_mint_fail: '铸造失败: {msg}',
    t_no_wallet_sim: '未检测到 MetaMask —— 铸造将走模拟交易',
    t_connect_cancel: '已取消连接',
    t_connect_fail: '连接失败: {msg}',
    t_wallet_connected: '钱包已连接 · {network}',
    t_load_cases_fail: '加载案例失败: {msg}',
    t_pricing_fail: '定价失败: {msg}',
    t_reprice_fail: '重定价失败: {msg}',
    t_reprice_anchored: '⛓ 重定价已锚定上链: {hash}',

    // voyage
    vp1_h: '航运进度（虚拟时间）',
    vp1_sub: '将鼠标移到船上可查看当前虚拟时间与所在航段。',
    vp_dep: '出发', vp_arr: '预计到达',
    voyage_sub_vessel: '船舶 <strong>{vessel}</strong>{voyage}{carrier} —— 将鼠标移到船上查看当前虚拟时间与航段。',
    voyage_voyage_no: ' · 航次 {no}',
    play_label: '▶ 播放', pause_label: '⏸ 暂停',
    eta_arrived: '已抵达目的港', eta_current: '虚拟当前 {when} · 航程 {pct}%',
    wp_at_load: '在 {load} 装船待发', wp_leaving: '驶离 {load}',
    wp_scs: '航行于南海 (South China Sea)', wp_open: '航行于东海 / 公海 (open water)',
    wp_approaching: '接近 {disch}', wp_arrived: '抵达 {disch}',

    vp2_h: '实时 RWA 定价 & 认购进度',
    vp2_sub: '在途风险一旦升级，AI 立即重定价；下方价格随之变化。',
    live_price_label: '当前 RWA 发行价',
    live_upside: '潜在毛收益',
    live_risk_label: '风险等级', live_riskbps_label: '风险分数',
    fin_head: '认购进度', fin_paused: ' (已暂停)',

    vp3_h: '突发事件模拟（Demo）',
    vp3_sub: '点击模拟航运途中发生的突发事件，观察 AI 如何重定价 RWA。',
    reset_btn: '↺ 重置航程',

    vp4_h: 'AI 风险情报（含来源）',
    vp4_sub: 'AI 收集的宏观/地缘风险事件，每条标注信息来源；可搜索 RAG 知识库。',
    judge_h: '评委问答 Judge Q&A',
    rag_ph: '搜索情报："Strait of Hormuz"、"copper volatility"、"Yangshan"…',
    rag_btn: '搜索', rag_searching: '搜索中…', rag_none: '没有「{q}」的情报。', rag_hits: '{n} 条情报命中',
    feed_loading: '加载中…', feed_none: '暂无风险情报。',
    feed_source: '来源: ', feed_injected_date: '刚刚 · 模拟注入', feed_new: 'NEW',
    qa_loading: '加载中…', qa_unavailable: 'Q&A 不可用: {msg}',
    lc_fail: '生命周期加载失败: {msg}',

    // events
    ev_typhoon_label: '🌪 东海台风',
    ev_typhoon_desc: '台风季系统逼近，威胁卸货窗口。',
    ev_hormuz_label: '⚔ 霍尔木兹冲突升级',
    ev_hormuz_desc1: '海峡近乎关闭，金属与能源战争溢价飙升，供应路线受阻。',
    ev_hormuz_desc2: '大宗价格在供应冲击恐慌中剧烈波动，估值须深度 haircut。',
    ev_deviation_label: '🧭 改道绕行',
    ev_deviation_desc: '为避开安全警示区改道绕行，航程延长。',
    ev_insurance_label: '🛡 保险拒赔争议',
    ev_insurance_desc: '承保人援引海湾「战争除外」条款，部分拒赔，抵押覆盖塌陷。',

    // callout
    co_paused: '⏸ 在途风险升级至 {level} —— AI 暂停了发行。新证据 {hash}。',
    co_repriced: '↓ 风险升至 {level} —— AI 将发行价 {a} 重定价至 {b}（投资者潜在收益扩大至 {y}）。',
    co_held: '风险重估为 {level}；价格维持在 {p}。',

    // world risk (xAPI)
    wp_h: '实时世界风险情报（xAPI）',
    wp_sub: '通过 xAPI 拉取 X/推特、官方发言、新闻与预测市场等真实信号，AI 据此对这批货实时风控并重新定价。',
    wr_refresh: '↻ 刷新实时信号', wr_apply: '⚡ 用实时情报重新定价', wr_applied: '✓ 已并入实时风控定价',
    wr_loading: '拉取实时世界风险…', wr_none: '未发现升高的真实世界风险信号。',
    wr_live: '● 实时 (xAPI)', wr_offline: '○ 离线兜底（设 XAPI_KEY 启用实时）',
    wr_impact_head: 'AI 实时重定价影响', wr_before: '当前', wr_after: '并入实时风险后',
    wr_signals_head: '抓取到的实时信号（含来源）',
    wr_sig_tweets: '推文 / X', wr_sig_officials: '官方 / 政要发言', wr_sig_news: '新闻', wr_sig_markets: '预测市场赔率',
    wr_events_head: 'AI 据此推导的风险事件',
    wr_fetch_fail: '拉取实时风险失败: {msg}',

    // footer
    footer_left: 'AgentBL Agent · ETHBeijing 2026 hackathon',
    footer_right: '所有数字由本地 AI 定价引擎实时产生 · 货值估算、风险评分与哈希均确定性、可离线复现 · 上链锚定于测试网'
  },

  en: {
    // topbar / subbar
    document_title: 'AgentBL · eBL-backed RWA Investment Marketplace',
    brand_tag: 'AI-priced eBL-backed RWA · enforced on-chain',
    nav_market: 'Investment Marketplace',
    nav_mint: 'Pricing & Mint',
    nav_voyage: 'Voyage Risk',
    wallet_connect: 'Connect Wallet',
    live_tip: 'Every number is produced live by the local AI pricing engine',
    case_label: 'Selected case / eBL',
    case_select_aria: 'Select trade case or eBL',
    lang_switch_to: '中文',
    lang_btn_title: 'Switch to Chinese',
    wallet_title: 'Connect MetaMask to mint on the {network} testnet',

	    // category filter
	    cat_all: 'All',
	    cat_energy_chemical: 'Energy & Chemical',
	    cat_metal: 'Metal',
	    cat_ore: 'Ore',
	    search_ph: 'Search eBL or AI natural language filter…',
	    ai_search_title: 'AI parses natural-language preferences to filter eBLs',
	    ai_searching: 'AI parsing…',

	    // search / filter feedback
	    no_case_match: 'No matching eBL cases',
	    ai_empty_query: 'Please enter filter criteria or natural language description',
	    ai_no_match: 'AI found no matching eBLs, try a different description',
	    ai_error: 'AI parsing failed: {msg}',
    ai_match_toast: 'AI: {reasoning} ({n} eBL matches)',
    keyword_match_toast: 'Keyword matched {n} eBL deals',
    keyword_ai_unavailable_toast: 'Keyword matched {n} eBL deals (AI unavailable)',

    // chain status
    chain_deployed: '● Contract deployed · connect a wallet to mint a real {network} tx',
    chain_not_deployed: '○ Not deployed · simulated minting (run the deploy script to go live)',

    // marketplace
    market_eyebrow: 'Investment marketplace',
    market_h1: 'Choose an eBL-backed trade project.',
    market_subtitle: 'Browse live AI-priced trade-finance offerings. Each sticker is backed by an electronic bill of lading, route risk scoring, voyage progress, and a funding progress bar.',
    market_sort_label: 'Sort deals',
    market_sort_recommended: 'Recommended',
    market_sort_yield: 'Highest upside',
    market_sort_risk: 'Lowest risk',
    market_sort_funding: 'Most funded',
    market_sort_eta: 'Earliest ETA',
    market_board_label: 'eBL deal stickers',
    market_board_h: 'Project shelf',
    market_count: '{n} deals',
    market_empty: 'No matching eBL-backed deals.',
    market_loading: 'Pricing…',
    market_stat_deals: 'Visible deals',
    market_stat_target: 'Funding target',
    market_stat_yield: 'Avg upside',
    market_stat_open: 'Open deals',
    market_summary_visible: 'Visible',
    market_summary_selected: 'Selected',
    market_summary_price: 'Issue price',
    market_issue_price: 'AI issue price',
    market_upside: 'upside',
    market_fact_ebl: 'eBL',
    market_fact_vessel: 'Vessel',
    market_fact_qty: 'Cargo',
    market_fact_target: 'Target',
    market_funding: 'Funding progress',
    market_card_subscribe: 'Subscribe',
    market_card_track: 'Track',
    market_detail_loading: 'Loading selected project…',
    market_detail_label: 'Selected project',
    market_detail_upside: 'Upside',
    market_detail_risk: 'Risk',
    market_detail_collateral: 'Collateral',
    market_detail_eta: 'ETA',
    market_subscription_label: 'Investment amount (USD)',
    market_subscribe_btn: 'Simulate subscription',
    market_paused_btn: 'Offering paused',
    market_open_pricing: 'Open pricing page',
    market_open_voyage: 'Open voyage view',
    market_readout_receive: 'Estimated allocation',
    market_readout_target: 'target redemption',
    market_readout_foot: 'Target redemption is not guaranteed and depends on importer payment, cargo settlement, and insurance coverage.',
    market_need_amount: 'Enter an investment amount greater than 0',
    market_subscribing: 'Simulating…',
    market_subscribed_toast: 'Subscription simulated with the current AI quote.',
    market_subscribe_fail: 'Subscription simulation failed: {msg}',
    market_subscribe_result: 'Offering lifecycle simulated · {n} steps',
    market_voyage_note: '{pct}% to {disch} · ETA {eta}',
    market_arrived: 'Arrived at {disch}',

    // dynamic labels
    action_OPEN_OFFERING: 'OPEN',
    action_OPEN_WITH_WARNING: 'OPEN · WARNING',
    action_REPRICE_DOWN: 'REPRICE DOWN',
    action_PAUSE_OFFERING: 'PAUSED',
    action_FREEZE_POOL: 'FROZEN',
    action_TRIGGER_LIQUIDATION: 'LIQUIDATION',
    risk_LOW: 'LOW',
    risk_MEDIUM: 'MEDIUM',
    risk_WARNING: 'WARNING',
    risk_CRITICAL: 'CRITICAL',
    riskdim_war: 'War / Geopolitics',
    riskdim_weather: 'Weather',
    riskdim_port: 'Port / Logistics',
    riskdim_insurance: 'Insurance',
    riskdim_price: 'Price volatility',
    riskdim_docs: 'Documents',
    risk_clear: 'clear',
    speed_FAST_label: 'FAST',
    speed_BALANCED_label: 'BALANCED',
    speed_LOW_COST_label: 'LOW COST',
    speed_FAST_blurb: 'Cash in hours — give up more margin for speed.',
    speed_BALANCED_blurb: 'Standard settlement — a balanced financing cost.',
    speed_LOW_COST_blurb: 'Patient capital — cheapest financing, slower cash.',

    // hero (view 1)
    hero_eyebrow: 'Tokenize eBL · discounted RWA issuance',
    hero_h1: 'Turn in-transit cargo title into on-chain RWA.',
    hero_subtitle: 'An exporter pledges an electronic Bill of Lading; the AI Pricing &amp; Risk Agent reads cargo value, documents and live macro risk to issue a defensible RWA discount — <em>higher risk → lower price → higher investor upside</em>. Enter a financing amount to mint RWA and anchor it on-chain (testnet).',

    // view 1 panels
    p1_h: 'AI Cargo Valuation & Route Risk',
    p1_sub: 'The AI-verified collateral value, plus this route\'s risk scores and <strong>data sources</strong>.',
    collateral_label: 'AI-verified collateral value',
    riskdims_h: 'Route risk dimensions',
    sources_head: '📑 Data sources',
    p2_h: 'AI Pricing Console',
    p2_sub: 'How the issue price discounts from the $1.00 target redemption: base anchor → − urgency → − risk.',
    p3_h: 'Financing & Mint RWA',
    p3_sub: 'Pick a payout speed (the AI prices it as a share of verified profit), enter a financing amount, mint RWA on-chain.',
    payout_speed_label: 'Exporter payout speed',
    financing_label: 'Merchant financing amount (USD)',
    mint_btn: '⛓ Mint RWA on-chain',
    minting: '⛓ Minting…',
    compliance: '<strong>Not principal-protected.</strong> 1 RWA = $1.00 is a <em>target</em> redemption value, depending on importer payment, cargo settlement and insurance coverage. Permissioned investors only.',
    onchain_h: 'On-chain anchoring · AgentBLRWA',
    mint_hint: 'Enter a financing amount and click “Mint RWA on-chain”. With a wallet connected and the contract deployed it mints a real on-chain tx, otherwise a high-fidelity simulated tx.',

    // deal strip
    ds_route: 'Route', ds_cargo: 'Cargo', ds_ebl: 'eBL', ds_declared: 'Declared value', ds_collateral: 'AI-verified value',

    // hero price
    hp_label: 'AI issue price / RWA token',
    hp_upside: 'implied gross upside',
    hp_redeem: 'redeems toward <strong>$1.00</strong> · {speed} payout',

    // valuation
    val_declared: 'Declared value', val_insured: 'Insured value', val_safe_exposure: 'Safe redemption exposure', val_supply: 'Suggested token supply',
    risk_cite_head: 'Risk discount cites RAG intel:',
    src_rag: 'RAG intel', src_market: 'Market benchmark', src_valuation: 'AI valuation', src_docs: 'Document check',
    src_valuation_detail: 'Landed price × quantity, after a volatility haircut, capped at {cov}% redemption coverage',

    // payout speeds (sub label)
    speed_FAST_sub: 'cash in hours', speed_BALANCED_sub: 'standard settlement', speed_LOW_COST_sub: 'patient capital',

    // waterfall
    wf_target: 'Target', wf_base: 'Base anchor', wf_urgency: 'Urgency', wf_risk: 'Risk',
    wf_indicative: 'Indicative', wf_floor: 'Collateral floor', wf_final: 'Final issue price',
    wf_note_redemption: 'redemption value', wf_note_anchor: 'patient-money anchor',
    wf_note_profit: 'profit-share price', wf_note_floor: 'lifted to safe coverage',
    wf_final_note: '{pct} upside to $1.00',
    wf_axis_target: '$1.00 target',
    wf_axis_foot: 'axis zoomed to {lo}–1.00 · binding constraint: {bc}',

    // exporter cards
    ec_cash: 'Cash to exporter', ec_cost: 'Financing cost', ec_share: '% of trade profit', ec_net: 'Net profit kept',
    ec_aipick: '★ AI pick', unit_per_token: '/ token',

    // mint readout
    mr_receive_pre: 'You receive', mr_receive_post: 'RWA @ ${price} / token',
    mr_price: 'Issue price', mr_invest: 'Invested', mr_redeem: 'Target redemption', mr_upside: 'Implied upside',
    mr_foot: 'Target redemption is not guaranteed — subject to importer payment & settlement.',
    mr_paused: 'AI has paused the offering ({action}) — minting is closed at the current risk.',

    // mint result
    res_chain: '⛓ {network} on-chain', res_sim: '🧪 Simulated tx',
    res_minted_pre: 'Minted', res_unit_rwa: 'RWA',
    res_price: 'Issue price', res_balance: 'On-chain RWA balance', res_reading: 'reading…',
    res_sim_foot: 'After running the deploy script and connecting a wallet, this becomes a real on-chain tx.',

    // toasts
    t_need_financing: 'Enter a financing amount greater than 0',
    t_cancel_mint: 'Mint cancelled',
    t_no_wallet_detected: 'No wallet detected',
    t_chain_call_failed: 'On-chain call failed, fell back to simulation: {msg}',
    t_minted_chain: '✅ Minted {n} RWA on {network}',
    t_minted_sim: 'Generated a simulated mint tx ({n} RWA)',
    t_mint_fail: 'Mint failed: {msg}',
    t_no_wallet_sim: 'No MetaMask detected — minting will use a simulated tx',
    t_connect_cancel: 'Connection cancelled',
    t_connect_fail: 'Connection failed: {msg}',
    t_wallet_connected: 'Wallet connected · {network}',
    t_load_cases_fail: 'Failed to load cases: {msg}',
    t_pricing_fail: 'Pricing failed: {msg}',
    t_reprice_fail: 'Reprice failed: {msg}',
    t_reprice_anchored: '⛓ Reprice anchored on-chain: {hash}',

    // voyage
    vp1_h: 'Voyage progress (virtual time)',
    vp1_sub: 'Hover over the ship to see its current virtual time and leg.',
    vp_dep: 'Departure', vp_arr: 'ETA',
    voyage_sub_vessel: 'Vessel <strong>{vessel}</strong>{voyage}{carrier} — hover the ship for its current virtual time and leg.',
    voyage_voyage_no: ' · voyage {no}',
    play_label: '▶ Play', pause_label: '⏸ Pause',
    eta_arrived: 'Arrived at destination', eta_current: 'Virtual now {when} · {pct}% of voyage',
    wp_at_load: 'Loading at {load}', wp_leaving: 'Departing {load}',
    wp_scs: 'Transiting the South China Sea', wp_open: 'East China Sea / open water',
    wp_approaching: 'Approaching {disch}', wp_arrived: 'Arrived at {disch}',

    vp2_h: 'Live RWA Pricing & Subscription',
    vp2_sub: 'The moment in-transit risk escalates, the AI reprices and the figure below moves.',
    live_price_label: 'Current RWA issue price',
    live_upside: 'implied gross upside',
    live_risk_label: 'Risk level', live_riskbps_label: 'Risk score',
    fin_head: 'Subscription', fin_paused: ' (paused)',

    vp3_h: 'In-transit Event Simulation (Demo)',
    vp3_sub: 'Click to simulate an in-transit incident and watch the AI reprice the RWA.',
    reset_btn: '↺ Reset voyage',

    vp4_h: 'AI Risk Intelligence (sourced)',
    vp4_sub: 'Macro / geopolitical risk events the AI collected, each tagged with its source; search the RAG knowledge base.',
    judge_h: 'Judge Q&A',
    rag_ph: 'Search intel: “Strait of Hormuz”, “copper volatility”, “Yangshan”…',
    rag_btn: 'Search', rag_searching: 'Searching…', rag_none: 'No intel for “{q}”.', rag_hits: '{n} intel hits',
    feed_loading: 'Loading…', feed_none: 'No risk intel.',
    feed_source: 'Source: ', feed_injected_date: 'just now · simulated', feed_new: 'NEW',
    qa_loading: 'Loading…', qa_unavailable: 'Q&A unavailable: {msg}',
    lc_fail: 'Lifecycle failed: {msg}',

    // events
    ev_typhoon_label: '🌪 East China Sea typhoon',
    ev_typhoon_desc: 'A typhoon-season system threatens the discharge window.',
    ev_hormuz_label: '⚔ Strait of Hormuz escalation',
    ev_hormuz_desc1: 'The strait is near closure; war premium across metals & energy spikes, supply routes disrupted.',
    ev_hormuz_desc2: 'Commodity prices whipsaw on supply-shock fears; valuation needs a deep haircut.',
    ev_deviation_label: '🧭 Route deviation',
    ev_deviation_desc: 'Vessel reroutes around a security advisory zone; longer transit.',
    ev_insurance_label: '🛡 Insurance dispute',
    ev_insurance_desc: 'Underwriter invokes a Gulf “war exclusion”, partially declines cover; collateral coverage collapses.',

    // callout
    co_paused: '⏸ In-transit risk escalated to {level} — the AI PAUSED the offering. New evidence {hash}.',
    co_repriced: '↓ Risk rose to {level} — AI repriced {a} → {b} (investor upside widened to {y}).',
    co_held: 'Risk reassessed to {level}; price held at {p}.',

    // world risk (xAPI)
    wp_h: 'Live World-Risk Intelligence (xAPI)',
    wp_sub: 'Pulls real signals via xAPI — X/Twitter, officials, news and prediction markets — so the AI risk-controls and reprices this cargo in real time.',
    wr_refresh: '↻ Refresh live signals', wr_apply: '⚡ Reprice with live intel', wr_applied: '✓ Folded into live risk pricing',
    wr_loading: 'Fetching live world risk…', wr_none: 'No elevated real-world risk signals detected.',
    wr_live: '● Live (xAPI)', wr_offline: '○ Offline fixtures (set XAPI_KEY to go live)',
    wr_impact_head: 'AI live re-pricing impact', wr_before: 'Current', wr_after: 'With live risk',
    wr_signals_head: 'Live signals captured (with sources)',
    wr_sig_tweets: 'Tweets / X', wr_sig_officials: 'Officials', wr_sig_news: 'News', wr_sig_markets: 'Prediction markets',
    wr_events_head: 'Risk events the AI derived',
    wr_fetch_fail: 'Failed to fetch live risk: {msg}',

    // footer
    footer_left: 'AgentBL Agent · ETHBeijing 2026 hackathon',
    footer_right: 'Every number is produced live by the local AI pricing engine · valuation, risk scoring and hashes are deterministic and offline-reproducible · anchored on the testnet'
  }
};
