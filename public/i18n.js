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
  try { document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'; } catch { /* non-browser tests */ }
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

export function hasTranslation(key, language = lang) {
  return Object.prototype.hasOwnProperty.call(DICT[language] ?? {}, key);
}

const DATA_DICT = {
  'Primary Aluminum Ingots (P1020, LME Grade)': '原铝锭 (P1020, LME 级)',
  'Copper Cathodes (LME Grade A, Cu-CATH-1)': '阴极铜 (LME A级, Cu-CATH-1)',
  'Copper Concentrate (28% Cu, 5 g/t Au, 30 g/t Ag)': '铜精矿 (含铜28%, 金5g/t, 银30g/t)',
  'Crude Oil (Murban grade, light sweet)': '原油 (Murban 穆尔班级, 轻质低硫)',
  'Refined Oil Products (Gasoline 92 RON 30,000 MT + Diesel 50ppm 20,000 MT)': '成品油 (92号汽油 3万吨 + 柴油 2万吨)',
  'Iron Ore Fines (Pilbara Blend, 62% Fe)': '铁矿粉 (Pilbara 皮尔巴拉混合, 62%品位)',
  'Natural Rubber (TSR20 / STR20, 1,200 MT)': '天然橡胶 (TSR20 / STR20, 1200吨)',
  'Non-GMO Soybeans (非转基因大豆), Bulk': '散装非转基因大豆',

  'Jebel Ali, Dubai, UAE': '阿联酋, 迪拜 (杰贝阿里)',
  'Rotterdam, Netherlands': '荷兰, 鹿特丹',
  'Singapore': '新加坡',
  'Shanghai (Yangshan)': '中国, 上海 (洋山港)',
  'Antofagasta, Chile': '智利, 安托法加斯塔',
  'Lianyungang, China': '中国, 连云港',
  'Universal Terminal, Jurong Island, Singapore': '新加坡 (裕廊岛通用码头)',
  'Ulsan, Republic of Korea': '韩国, 蔚山',
  'Port Hedland, Western Australia': '澳大利亚, 黑德兰港',
  'Tianjin, China': '中国, 天津',
  'Singapore (Jurong Refinery Terminal)': '新加坡 (裕廊炼油厂码头)',
  'Jakarta (Tanjung Priok), Indonesia': '印尼, 雅加达 (丹戎不碌)',
  'Bangkok (Klong Toey), Thailand': '泰国, 曼谷 (孔堤港)',
  'Qingdao, China': '中国, 青岛',
  'Shanghai, China': '中国, 上海'
};

const EN_DATA_DICT = {
  'Non-GMO Soybeans (非转基因大豆), Bulk': 'Non-GMO Soybeans, Bulk',
  '铝锭 AL99.70（P1020 级别，国产重熔用铝锭）': 'Aluminum Ingot AL99.70 (P1020 Grade, Domestic Remelting Ingot)',
  'AL99.70 / P1020 级别': 'AL99.70 / P1020 Grade',
  'ADC12 / A380 级别，铝合金锭': 'ADC12 / A380 Grade Aluminum Alloy Ingot',
  'N/A（库内交货）': 'N/A (Warehouse Delivery)'
};

export function tData(str) {
  if (!str) return str;
  if (lang === 'zh') return DATA_DICT[str] || str;

  const exact = EN_DATA_DICT[str];
  if (exact) return exact;
  return String(str)
    .replace(/佛山南海指定仓库[（(]入库单号\s*([^）)]+)[）)]/gu, 'Designated Warehouse, Nanhai, Foshan (Inbound Receipt $1)')
    .replace(/佛山南海指定仓库[（(]出库单号\s*([^）)]+)[）)]/gu, 'Designated Warehouse, Nanhai, Foshan (Outbound Receipt $1)');
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
    nav_mint: '提单上链 · 铸造 RWA',
    nav_voyage: '航运追踪 · 实时定价',
    nav_intel: 'x402 风控报告',
    wallet_connect: '🦊 连接钱包',
    live_tip: '所有数字均由本地 AI 定价引擎实时产生',
    case_label: '当前提单',
    case_select_aria: '选择交易案例或电子提单',
    lang_switch_to: 'EN',
    lang_btn_title: 'Switch to English',
    wallet_title: '连接钱包，在 {network} 测试网铸造',
    wallet_connected_label: '已连接',
    wallet_copy: '复制地址',
    wallet_view_explorer: '在浏览器中查看',
    wallet_disconnect: '断开连接',
    wallet_choose: '选择钱包',
    wallet_evm: 'EVM 合约钱包',
    wallet_native: 'Injective 原生钱包',
    wallet_verify: '签署测试网验证交易',
    wallet_waiting_signature: '等待钱包签名…',
    wallet_verified: '{wallet} 验证成功：{hash} ↗',
    wallet_signature_rejected: '用户拒绝了签名',
    wallet_verification_failed: '验证失败：{msg}',

    // runtime mode
    demo_mode_copy: '演示模式 · 无需钱包 · 模拟回执不是链上交易',
    live_mode_copy: '真实模式 · 使用真实钱包、USDC 与链上交易',
    switch_to_live: '切换至真实模式',
    switch_to_demo: '切换至演示模式',
    demo_reset: '重置演示',
    demo_reset_done: '演示状态已重置',
    live_config_required: '请先配置 X402_MODE=live、X402_FACILITATOR_URL 与 X402_PAY_TO',

	    // category filter
	    cat_all: '全部',
	    cat_energy_chemical: '能源化工类',
	    cat_metal: '金属',
	    cat_ore: '矿石',
	    search_ph: '搜索提单或 AI 自然语言筛选…',
	    ai_parse: 'AI 筛选',
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

    // investor portfolio
    portfolio_h: '我的持仓',
    portfolio_invested: '已投资：',
    portfolio_avg_yield: '平均收益：',
    portfolio_empty: '暂无持仓。',
    portfolio_metrics: '收益：{yield} | 风险：{risk}',

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
    ebl_upload_h: 'eBL 单据管理',
    ebl_upload_drop: '将 eBL、发票和保险单拖放到此处',
    ebl_upload_or: '或者',
    ebl_upload_browse: '点击选择文件',
    ebl_upload_device: '从本机上传',
    ebl_uploading: '⏳ 正在向 ENI 上传 {n} 个文件…',
    ebl_upload_success: '✅ {n} 份单据上传成功',
    ebl_upload_failed: '❌ {n} 份单据上传失败',
    ebl_upload_toast: '{n} 份单据已上传至 ENI',
    exporter_preferences: '出口商偏好（自主 Agent 约束）',
    pref_min_price: '最低发行价 (USD)',
    pref_speed: '到账速度偏好',
    pref_ai_recommended: 'AI 推荐',
    pref_price_updated: '出口商将最低发行价约束更新为 {value}',
    pref_speed_updated: '出口商将到账速度偏好更新为 {value}',

    // protocol evidence
    protocol_evidence_h: '实时协议凭证',
    protocol_refresh: '刷新事件',
    protocol_loading_deployment: '正在加载部署信息…',
    protocol_loading_events: '正在从 RPC 读取 PricingUpdated 事件…',
    protocol_permissionless: '{network} · 测试网无许可访问 · 任意钱包均可认购',
    protocol_compliance: '{network} · 需要通过生产环境合规准入',
    protocol_no_events: '当前区块范围内未找到 PricingUpdated 事件。',
    protocol_event_pool: '定价更新 · 池 #{pool}',
    network_not_deployed: '未部署',

    // deal modal / agent terminal
    modal_title: '项目详情',
    modal_subtitle: '航运追踪与 AI 风险报告',
    modal_close: '关闭',
    agent_terminal_h: '[ 系统 ] 自主 Agent 终端',
    agent_terminal_ready: '> 系统就绪，等待自主 Agent 执行任务…',

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
    res_failed: '❌ 交易失败',
    res_timeout: '⏱️ 确认超时',
    res_pending: '⛓ 已提交 · 确认中',
    res_confirming: '⏳ 确认中…',
    res_execution_failed: '❌ 交易执行失败，请在区块链浏览器中查看详情。',
    res_timeout_detail: '⏱️ 轮询超时，但交易可能仍在确认中。请在区块链浏览器中手动检查交易状态。',
    res_pending_detail: '⏳ 交易已广播，正在后台轮询链上确认（每 3 秒）…',

    // toasts
    t_need_financing: '请输入大于 0 的融资金额',
    t_cancel_mint: '已取消铸造',
    t_no_wallet_detected: '未检测到钱包',
    t_chain_call_failed: '链上调用失败，已回退模拟：{msg}',
    t_minted_chain: '✅ 已在 {network} 铸造 {n} RWA',
    t_minted_sim: '已生成模拟铸造交易（{n} RWA）',
    t_mint_fail: '铸造失败: {msg}',
    t_mint_confirmed: '🎉 铸造成功！交易已在区块 #{block} 确认',
    t_tx_failed: '❌ 交易失败：{msg}',
    t_confirm_timeout: '⏱️ 确认超时，请在区块链浏览器中手动检查',
    t_tx_submitted: '⛓ 交易已提交，等待链上确认…',
    t_no_wallet_sim: '未检测到钱包 —— 铸造将走模拟交易',
    t_connect_cancel: '已取消连接',
    t_connect_fail: '连接失败: {msg}',
    t_wallet_connected: '钱包已连接 · {network}',
    t_wallet_disconnected: '钱包已断开，并已撤销本站授权',
    t_wallet_disconnected_local: '本站已断开钱包（如需彻底撤销，请在钱包扩展中操作）',
    t_wallet_copied: '地址已复制',
    t_wallet_copy_fail: '复制失败',
    t_load_cases_fail: '加载案例失败: {msg}',
    t_pricing_fail: '定价失败: {msg}',
    t_reprice_fail: '重定价失败: {msg}',
    t_reprice_anchored: '⛓ 重定价已锚定上链: {hash}',
    err_no_contract: '合约尚未部署',
    err_wallet_not_connected: '钱包尚未连接',
    err_invalid_mint_params: '铸造参数无效，请检查定价数据',
    err_rpc_network: 'RPC 网络不稳定，请稍后重试',

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
    footer_left: 'AgentBL Agent',
    footer_right: '所有数字由本地 AI 定价引擎实时产生 · 货值估算、风险评分与哈希均确定性、可离线复现 · 上链锚定于测试网',

    // ── Mystery Voyage ──
    mystery_eyebrow: 'Mystery Voyage · x402',
    mystery_title: '打开一条航线，验证每一次抽签。',
    mystery_subtitle: '选择 Risk Passport，冻结等概率候选航线，用 0.001 USDC 揭晓一份 AI 尽调报告。',
    mystery_tier_legend: 'Risk Passport 风险档',
    mystery_tier_conservative: '稳健', mystery_tier_conservative_hint: '风险 ≤ 500 bps',
    mystery_tier_balanced: '平衡', mystery_tier_balanced_hint: '风险 ≤ 1,000 bps',
    mystery_tier_adventurous: '进取', mystery_tier_adventurous_hint: '风险 ≤ 1,500 bps',
    mystery_yield_range: '收益区间', mystery_stress_cap: '压力损失区间', mystery_price: '开盒价格',
    mystery_preview_btn: '创建公平轮次', mystery_committing: '冻结候选中…', mystery_frozen: '候选已冻结',
    mystery_demo_mode: '演示模式 · 可用本地签名，不转移真实资金',
    mystery_live_mode: 'Live 模式 · 仅接受真实 EVM 结算',
    mystery_modal_title: 'Mystery Voyage 盲盒航线', mystery_modal_subtitle: 'Commit-reveal AI 尽调',
    mystery_step_commit: 'Commit', mystery_step_commit_desc: '冻结合规候选航线',
    mystery_step_402: '402', mystery_step_402_desc: '获取支付挑战',
    mystery_step_settlement: '结算', mystery_step_settlement_desc: '绑定支付证据',
    mystery_step_reveal: '揭晓', mystery_step_reveal_desc: '打开被选航线',
    mystery_step_verify: '验证', mystery_step_verify_desc: '浏览器本地复算',
    mystery_round_frozen: '已冻结的候选集合', mystery_routes: '条合规航线',
    mystery_equal_odds: '1 / {n} 等概率', mystery_risk_boundary: '风险分数区间',
    mystery_server_commitment: 'Server commitment', mystery_candidate_hash: '候选集合哈希',
    mystery_non_subscription: '1 RWA = $1.00 只是目标兑付值，并非保本。购买的是 AI 尽调揭晓，不是 RWA 认购；任何投资都需要单独签名确认。',
    mystery_open_btn: '支付 0.001 USDC 开盒', mystery_demo_receipt_note: 'Demo receipt · 本地可复现',
    mystery_live_settlement_note: 'Live settlement · 真实链上交易才会出现 Explorer 链接',
    mystery_requesting_402: '请求已发送，等待 HTTP 402…', mystery_signing_payment: '等待支付签名…',
    mystery_payment_failed: '支付未完成，航线未揭晓', mystery_opening: '封条开启中…',
    mystery_onchain: '已上链', mystery_demo_receipt: 'Demo receipt', mystery_revealed: '航线已揭晓',
    mystery_failed: '失败', mystery_trade_cargo: '贸易货物',
    mystery_selected_route: '被选航线', mystery_stress_recovery: '压力回收 / token',
    mystery_collateral_coverage: '抵押覆盖', mystery_evidence_freshness: '证据新鲜度',
    mystery_payment_evidence: '支付证据', mystery_match_reasons: '适配理由', mystery_risk_factors: '风险因子',
    mystery_passport_match: '符合 Risk Passport', mystery_passport_mismatch: '需要人工复核',
    mystery_no_match_reason: '未返回适配理由', mystery_no_risk_factor: '未返回额外风险因子',
    mystery_non_guarantee: '目标兑付、AI 分析与证据均非保证，投资者可能损失部分或全部本金。',
    mystery_local_verifier: '浏览器本地验证器', mystery_verifier_title: 'Commit-reveal proof',
    mystery_reset_proof: '恢复原始 proof', mystery_verifying: '复算中…', mystery_proof_valid: '✓ Proof 有效',
    mystery_proof_failed: '✗ Proof 失败', mystery_fail_closed: 'FAIL CLOSED', mystery_verified: '✓ 已验证',
    mystery_selected_pool: '被选池', mystery_candidate_count: '候选数', mystery_selection_hash: '选择哈希',
    mystery_proof_hash: 'Proof 哈希', mystery_payment_binding: '支付绑定',
    mystery_second_confirmation: '独立认购确认', mystery_max_stress_loss: '压力情景损失',
    mystery_amount_label: '独立认购金额（USD）',
    mystery_risk_ack: '我独立授权这次认购，并接受当前展示的损失与风险；盲盒付款没有替我投资。',
    mystery_confirm_subscribe: '签名并认购', mystery_subscribe_selected: '认购被选 RWA', mystery_view_report: '查看 Risk Passport',
    mystery_signing_subscription: '等待第二次独立签名…',
    mystery_subscription_success: '认购已完成 · {tx}', mystery_subscription_complete: '认购交易已记录',
    mystery_evm_wallet_required: 'Live 模式需要连接 EVM 钱包（MetaMask / OKX）',
    mystery_live_v2_required: 'Live 模式需要已部署的 x402 V2 结算网关，当前演示不接受 personal-sign。',

    // ── Voyage Passport collection ──
    passport_eyebrow: 'Voyage Passport 收藏册',
    passport_collection_title: '已验证的航线收藏',
    passport_collection_subtitle: '完成揭晓后领取 Discovery 印章；完成独立 RWA 认购后解锁 Investor Journey 印章。',
    passport_show_hidden: '显示本地隐藏', passport_refresh: '刷新收藏册', passport_stamps: '枚印章',
    passport_empty_title: '还没有 Voyage Passport',
    passport_empty_body: '验证一次 Mystery Voyage 揭晓，即可主动领取第一枚 Discovery 印章。',
    passport_claim_discovery: '领取 Discovery Passport', passport_claim_journey: '领取 Investor Journey', passport_claimed: '已领取',
    passport_stamp_discovery: 'Discovery · 揭晓见证', passport_stamp_investor: 'Investor Journey · 投资旅程',
    passport_verified: '已验证', passport_revoked: '已撤销', passport_reveal_date: '揭晓日期',
    passport_share: '分享', passport_verify: '公开验证', passport_hide: '本地隐藏', passport_unhide: '取消隐藏',
    passport_share_title: '分享 Voyage Passport', passport_nickname: '公开昵称（可选）', passport_nickname_placeholder: '远洋船长',
    passport_advanced_share: '高级：公开交易引用', passport_advanced_note: '仅真实公开交易可用；Demo receipt 永远不会作为链上证据分享。',
    passport_advanced_unavailable: 'Demo receipt 不支持交易披露；分享卡只包含脱敏体验凭证。',
    passport_advanced_enable: '加入公开交易引用', passport_advanced_confirm: '我了解这会暴露永久公开的交易链接。',
    passport_sanitized_json: '脱敏分享载荷', passport_copy: '复制文本', passport_copied: '已复制分享文本', passport_copy_failed: '复制失败，请手动选择文本',
    passport_export_json: '导出 JSON', passport_export_png: '导出 PNG', passport_export_pdf: '打印 / 保存 PDF',
    passport_claim_success: 'Passport 已签名并加入收藏册',
    passport_fixed_disclaimer: '仅为产品体验凭证，不是 RWA、货权、投资证明或收益承诺。',

    // ── x402 AI 风控报告市场 ──
    x402_hero_eyebrow: 'x402 AI 风控报告市场',
    x402_hero_h1: '一份 AI 风控报告，一个 RWA 定价决策。链上审计。',
    x402_hero_sub: '投资 RWA 前，通过 <strong>x402 协议</strong>（HTTP 402）购买 AI 深度风控报告——5 维风险打分、反欺诈审单、估值对比，每份报告签名上链，<strong>PaymentOracle 存证</strong>。你花的每一分钱，都变成可审计的风险评估，直接注入 RWA 发行定价。',
    x402_paid_services: '付费报告',
    x402_demo_mode: '○ x402 演示模式',
    x402_ready: '● x402 已就绪',
    x402_network_label: '网络: {network}',
    x402_price_range: '价格范围 (USDC)',
    x402_services_heading: '可用报告',
    x402_catalog_heading: 'AI 风控报告目录',
    x402_loading: '加载报告中…',
    x402_flow_heading: '购买流程',
    x402_pipeline_heading: 'x402 支付 → AI 报告 → 定价引擎',
    x402_step1_title: '发起购买请求',
    x402_step1_desc: '投资方请求 AI 深度风控报告，服务器返回 402 Payment Required',
    x402_step2_title: 'x402 支付',
    x402_step2_desc: '投资方签署 EIP-3009，通过 x402 协议支付 USDC',
    x402_step3_title: '链上结算',
    x402_step3_desc: 'x402 代言人在链上结算，PaymentOracle 记录支付证据',
    x402_step4_title: '报告解锁',
    x402_step4_desc: 'AI 风控报告解锁，风险数据直接注入 RWA 定价引擎',
    x402_evidence_heading: '链上支付证据',
    x402_evidence_contract: 'PaymentOracle · Injective 测试网',
    x402_tx_hash: '交易哈希',
    x402_service_label: '报告类型',
    x402_amount_label: '金额',
    x402_response_hash: '报告哈希',
    x402_pricing_impact: '报告对 RWA 定价的影响',
    x402_before_label: '购买前（免费概览）',
    x402_after_label: '购买后（深度报告）',
    x402_smoke_btn: '🔥 运行 x402 购买流程演示',
    x402_purchase_btn: '💰 购买 AI 风控报告 (0.001 USDC)',
    x402_purchased_heading: '已购买的报告',
    x402_purchased_sub: '有效期内可重复阅读 — 不再次扣费',
    x402_purchased_reread: '↻ 重新打开（已支付）',
    x402_purchased_expires: '有效期至 {time}',
    x402_purchased_expired: '已过期 — 需重新购买',
    x402_running: '⏳ 正在运行 x402 购买流程…',
    x402_initiating: '⏳ 正在发起 x402 报告购买…',
    x402_failed: '✗ 购买失败',
    x402_error: '错误',
    x402_signed: '✓ 已支付',
    x402_settled: '✓ 已结算',
    x402_unlocked: '✓ 报告已解锁',
    x402_challenge_status: '402 已返回',
    x402_signing_status: '支付中…',
    x402_settling_status: '链上结算中…',
    x402_pass: 'x402 购买流程演示通过 ✓',
    x402_challenge_log: '请求 AI 风控报告 → HTTP 402 Payment Required 已返回',
    x402_signing_log: 'EIP-3009 —— 投资方签署转账授权',
    x402_settlement_log: 'PaymentOracle —— 链上结算进行中',
    x402_unlocked_log: '✓ 报告已解锁 —— {events} 项风险指标, {intel} 条深度分析，已注入定价引擎',
    x402_tx_log: '✓ 链上支付存证: {tx}',
    x402_fail_log: '✗ 购买流程失败: {msg}',
    x402_price_drop: '↓ 折价加深（AI 报告检出更多风险）',
    x402_price_rise: '↑ 折价收窄（AI 报告确认风险可控）',
    x402_price_nochange: '→ 无变化',
    x402_delta: '定价变动: {delta}',
    x402_step1_call: '发起报告购买: 请求 AI 风控端点…',
  },

  en: {
    // topbar / subbar
    document_title: 'AgentBL · eBL-backed RWA Investment Marketplace',
    brand_tag: 'AI-priced eBL-backed RWA · enforced on-chain',
    nav_market: 'Investment Marketplace',
    nav_mint: 'Pricing & Mint',
    nav_voyage: 'Voyage Risk',
    nav_intel: '③ x402 Risk Report',
    wallet_connect: 'Connect Wallet',
    live_tip: 'Every number is produced live by the local AI pricing engine',
    case_label: 'Selected case / eBL',
    case_select_aria: 'Select trade case or eBL',
    lang_switch_to: '中文',
    lang_btn_title: 'Switch to Chinese',
    wallet_title: 'Connect wallet to mint on the {network} testnet',
    wallet_connected_label: 'Connected',
    wallet_copy: 'Copy address',
    wallet_view_explorer: 'View on explorer',
    wallet_disconnect: 'Disconnect',
    wallet_choose: 'Choose wallet',
    wallet_evm: 'EVM contracts',
    wallet_native: 'Injective native',
    wallet_verify: 'Sign testnet verification tx',
    wallet_waiting_signature: 'Waiting for wallet signature…',
    wallet_verified: '{wallet} verified: {hash} ↗',
    wallet_signature_rejected: 'Signature rejected',
    wallet_verification_failed: 'Verification failed: {msg}',

    // runtime mode
    demo_mode_copy: 'DEMO MODE · No wallet required · simulated receipts are not chain transactions',
    live_mode_copy: 'LIVE MODE · Real wallet, USDC and on-chain transactions',
    switch_to_live: 'Switch to Live',
    switch_to_demo: 'Switch to Demo',
    demo_reset: 'Reset demo',
    demo_reset_done: 'Demo state reset',
    live_config_required: 'Configure X402_MODE=live, X402_FACILITATOR_URL and X402_PAY_TO first',

	    // category filter
	    cat_all: 'All',
	    cat_energy_chemical: 'Energy & Chemical',
	    cat_metal: 'Metal',
	    cat_ore: 'Ore',
	    search_ph: 'Search eBL or AI natural language filter…',
	    ai_parse: 'AI Filter',
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

    // investor portfolio
    portfolio_h: 'My Portfolio',
    portfolio_invested: 'Invested:',
    portfolio_avg_yield: 'Avg Yield:',
    portfolio_empty: 'No investments yet.',
    portfolio_metrics: 'Yield: {yield} | Risk: {risk}',

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
    ebl_upload_h: 'eBL Document Management',
    ebl_upload_drop: 'Drag and drop your eBL, invoice and insurance policies here',
    ebl_upload_or: 'or',
    ebl_upload_browse: 'click to browse files',
    ebl_upload_device: 'from your device',
    ebl_uploading: '⏳ Uploading {n} file(s) to ENI…',
    ebl_upload_success: '✅ {n} document(s) uploaded successfully',
    ebl_upload_failed: '❌ {n} upload(s) failed',
    ebl_upload_toast: '{n} document(s) uploaded to ENI',
    exporter_preferences: 'Exporter Preferences (Autonomous Agent Constraints)',
    pref_min_price: 'Min issue price (USD)',
    pref_speed: 'Speed preference',
    pref_ai_recommended: 'AI Recommended',
    pref_price_updated: 'Exporter updated the minimum issue price constraint to {value}',
    pref_speed_updated: 'Exporter updated the payout speed preference to {value}',

    // protocol evidence
    protocol_evidence_h: 'Live protocol evidence',
    protocol_refresh: 'Refresh events',
    protocol_loading_deployment: 'Loading deployment…',
    protocol_loading_events: 'Reading PricingUpdated from RPC…',
    protocol_permissionless: '{network} · permissionless testnet access · any wallet may subscribe',
    protocol_compliance: '{network} · production compliance gate required',
    protocol_no_events: 'No PricingUpdated event found in the configured range.',
    protocol_event_pool: 'Pricing updated · Pool #{pool}',
    network_not_deployed: 'not deployed',

    // deal modal / agent terminal
    modal_title: 'Deal Details',
    modal_subtitle: 'Voyage tracking & AI risk reports',
    modal_close: 'Close',
    agent_terminal_h: '[ SYSTEM ] Autonomous Agent Terminal',
    agent_terminal_ready: '> System ready. Awaiting autonomous agent execution…',

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
    res_failed: '❌ Transaction failed',
    res_timeout: '⏱️ Confirmation timed out',
    res_pending: '⛓ Submitted · confirming',
    res_confirming: '⏳ Confirming…',
    res_execution_failed: '❌ Transaction execution failed. Check the block explorer for details.',
    res_timeout_detail: '⏱️ Confirmation polling timed out, but the transaction may still be pending. Check its status in the block explorer.',
    res_pending_detail: '⏳ Transaction broadcast. Polling for on-chain confirmation every 3 seconds…',

    // toasts
    t_need_financing: 'Enter a financing amount greater than 0',
    t_cancel_mint: 'Mint cancelled',
    t_no_wallet_detected: 'No wallet detected',
    t_chain_call_failed: 'On-chain call failed, fell back to simulation: {msg}',
    t_minted_chain: '✅ Minted {n} RWA on {network}',
    t_minted_sim: 'Generated a simulated mint tx ({n} RWA)',
    t_mint_fail: 'Mint failed: {msg}',
    t_mint_confirmed: '🎉 Mint confirmed in block #{block}',
    t_tx_failed: '❌ Transaction failed: {msg}',
    t_confirm_timeout: '⏱️ Confirmation timed out. Check the block explorer.',
    t_tx_submitted: '⛓ Transaction submitted; awaiting on-chain confirmation…',
    t_no_wallet_sim: 'No wallet detected — minting will use a simulated tx',
    t_connect_cancel: 'Connection cancelled',
    t_connect_fail: 'Connection failed: {msg}',
    t_wallet_connected: 'Wallet connected · {network}',
    t_wallet_disconnected: 'Wallet disconnected and this site’s permission revoked',
    t_wallet_disconnected_local: 'Wallet disconnected here (revoke fully in your wallet extension)',
    t_wallet_copied: 'Address copied',
    t_wallet_copy_fail: 'Copy failed',
    t_load_cases_fail: 'Failed to load cases: {msg}',
    t_pricing_fail: 'Pricing failed: {msg}',
    t_reprice_fail: 'Reprice failed: {msg}',
    t_reprice_anchored: '⛓ Reprice anchored on-chain: {hash}',
    err_no_contract: 'Contract is not deployed',
    err_wallet_not_connected: 'Wallet is not connected',
    err_invalid_mint_params: 'Invalid mint parameters; check the pricing data',
    err_rpc_network: 'RPC network is unstable; try again shortly',

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
    footer_left: 'AgentBL Agent',
    footer_right: 'Every number is produced live by the local AI pricing engine · valuation, risk scoring and hashes are deterministic and offline-reproducible · anchored on the testnet',

    // ── Mystery Voyage ──
    mystery_eyebrow: 'Mystery Voyage · x402',
    mystery_title: 'Open one route. Verify every draw.',
    mystery_subtitle: 'Choose a Risk Passport, freeze an equal-odds candidate set, and reveal an AI due-diligence report for 0.001 USDC.',
    mystery_tier_legend: 'Risk Passport',
    mystery_tier_conservative: 'Conservative', mystery_tier_conservative_hint: 'Risk ≤ 500 bps',
    mystery_tier_balanced: 'Balanced', mystery_tier_balanced_hint: 'Risk ≤ 1,000 bps',
    mystery_tier_adventurous: 'Adventurous', mystery_tier_adventurous_hint: 'Risk ≤ 1,500 bps',
    mystery_yield_range: 'Yield range', mystery_stress_cap: 'Stress loss range', mystery_price: 'Open price',
    mystery_preview_btn: 'Create fair round', mystery_committing: 'Freezing candidates…', mystery_frozen: 'Candidates frozen',
    mystery_demo_mode: 'Demo mode · local signer, no real funds move',
    mystery_live_mode: 'Live mode · verified EVM settlement only',
    mystery_modal_title: 'Mystery Voyage', mystery_modal_subtitle: 'Commit-reveal AI due diligence',
    mystery_step_commit: 'Commit', mystery_step_commit_desc: 'Freeze eligible routes',
    mystery_step_402: '402', mystery_step_402_desc: 'Get payment challenge',
    mystery_step_settlement: 'Settlement', mystery_step_settlement_desc: 'Bind payment evidence',
    mystery_step_reveal: 'Reveal', mystery_step_reveal_desc: 'Open selected route',
    mystery_step_verify: 'Verify', mystery_step_verify_desc: 'Recompute locally',
    mystery_round_frozen: 'Committed candidate set', mystery_routes: 'eligible routes',
    mystery_equal_odds: '1 / {n} equal odds', mystery_risk_boundary: 'Risk score range',
    mystery_server_commitment: 'Server commitment', mystery_candidate_hash: 'Candidate-set hash',
    mystery_non_subscription: '1 RWA = $1.00 is a target redemption value, not principal protection. You are buying an AI due-diligence reveal, not an RWA subscription; any investment requires a separate signature.',
    mystery_open_btn: 'Open for 0.001 USDC', mystery_demo_receipt_note: 'Demo receipt · deterministic and local',
    mystery_live_settlement_note: 'Live settlement · Explorer links appear only for real on-chain transactions',
    mystery_requesting_402: 'Request sent, waiting for HTTP 402…', mystery_signing_payment: 'Waiting for payment signature…',
    mystery_payment_failed: 'Payment did not settle; route was not revealed', mystery_opening: 'Breaking the seal…',
    mystery_onchain: 'On-chain', mystery_demo_receipt: 'Demo receipt', mystery_revealed: 'Route revealed',
    mystery_failed: 'Failed', mystery_trade_cargo: 'Trade cargo',
    mystery_selected_route: 'Selected voyage', mystery_stress_recovery: 'Stress recovery / token',
    mystery_collateral_coverage: 'Collateral coverage', mystery_evidence_freshness: 'Evidence freshness',
    mystery_payment_evidence: 'Payment evidence', mystery_match_reasons: 'Why it matches', mystery_risk_factors: 'Risk factors',
    mystery_passport_match: 'Risk Passport match', mystery_passport_mismatch: 'Manual review',
    mystery_no_match_reason: 'No match reason returned', mystery_no_risk_factor: 'No extra risk factor returned',
    mystery_non_guarantee: 'Target redemption, AI analysis and evidence are not guarantees. Investors may lose some or all principal.',
    mystery_local_verifier: 'Browser-local proof verifier', mystery_verifier_title: 'Commit-reveal proof',
    mystery_reset_proof: 'Reset original proof', mystery_verifying: 'Recomputing…', mystery_proof_valid: '✓ Proof valid',
    mystery_proof_failed: '✗ Proof failed', mystery_fail_closed: 'FAIL CLOSED', mystery_verified: '✓ Verified',
    mystery_selected_pool: 'Selected pool', mystery_candidate_count: 'Candidate count', mystery_selection_hash: 'Selection hash',
    mystery_proof_hash: 'Proof hash', mystery_payment_binding: 'Payment binding',
    mystery_second_confirmation: 'Independent investment confirmation', mystery_max_stress_loss: 'Stress-case loss',
    mystery_amount_label: 'Independent subscription amount (USD)',
    mystery_risk_ack: 'I independently authorize this subscription and accept the displayed loss and risk; the blind-box payment did not invest for me.',
    mystery_confirm_subscribe: 'Sign and subscribe', mystery_subscribe_selected: 'Subscribe selected RWA', mystery_view_report: 'View Risk Passport',
    mystery_signing_subscription: 'Waiting for the second independent signature…',
    mystery_subscription_success: 'Subscription complete · {tx}', mystery_subscription_complete: 'Subscription recorded',
    mystery_evm_wallet_required: 'Live mode requires an EVM wallet (MetaMask / OKX)',
    mystery_live_v2_required: 'Live mode requires a deployed x402 V2 settlement gateway; personal-sign is not accepted here.',

    // ── Voyage Passport collection ──
    passport_eyebrow: 'Voyage Passport collection',
    passport_collection_title: 'Verified voyage collection',
    passport_collection_subtitle: 'Claim a Discovery stamp after a verified reveal; unlock Investor Journey only after an independent RWA subscription.',
    passport_show_hidden: 'Show locally hidden', passport_refresh: 'Refresh collection', passport_stamps: 'stamps',
    passport_empty_title: 'No Voyage Passport yet',
    passport_empty_body: 'Verify a Mystery Voyage reveal, then actively claim your first Discovery stamp.',
    passport_claim_discovery: 'Claim Discovery Passport', passport_claim_journey: 'Claim Investor Journey', passport_claimed: 'Claimed',
    passport_stamp_discovery: 'Discovery · reveal witness', passport_stamp_investor: 'Investor Journey · subscriber',
    passport_verified: 'Verified', passport_revoked: 'Revoked', passport_reveal_date: 'Reveal date',
    passport_share: 'Share', passport_verify: 'Verify publicly', passport_hide: 'Hide locally', passport_unhide: 'Unhide',
    passport_share_title: 'Share Voyage Passport', passport_nickname: 'Public nickname (optional)', passport_nickname_placeholder: 'Captain Atlas',
    passport_advanced_share: 'Advanced: public transaction reference', passport_advanced_note: 'Available only for a real public transaction. Demo receipts can never be shared as on-chain evidence.',
    passport_advanced_unavailable: 'Demo receipts do not support transaction disclosure; the share card stays an anonymized experience credential.',
    passport_advanced_enable: 'Include a public transaction reference', passport_advanced_confirm: 'I understand this reveals a permanent public transaction link.',
    passport_sanitized_json: 'Sanitized share payload', passport_copy: 'Copy text', passport_copied: 'Share text copied', passport_copy_failed: 'Copy failed; select the text manually',
    passport_export_json: 'Export JSON', passport_export_png: 'Export PNG', passport_export_pdf: 'Print / Save PDF',
    passport_claim_success: 'Passport signed and added to your collection',
    passport_fixed_disclaimer: 'Product-experience credential only. Not an RWA, cargo title, investment certificate, or performance promise.',

    // ── x402 AI Risk Report Market ──
    x402_hero_eyebrow: 'x402 AI Risk Report Market',
    x402_hero_h1: 'One AI risk report, one RWA pricing decision. On-chain audit.',
    x402_hero_sub: 'Before investing in an RWA, purchase an AI deep risk report through the <strong>x402 protocol</strong> (HTTP 402) — 5-dimension risk scoring, anti-fraud document checks, valuation comparables. Every report is signed on-chain, recorded in <strong>PaymentOracle</strong>. Every cent you spend becomes auditable risk assessment, fed directly into the RWA issue price.',
    x402_paid_services: 'Paid Reports',
    x402_demo_mode: '○ x402 Demo Mode',
    x402_ready: '● x402 Ready',
    x402_network_label: 'Network: {network}',
    x402_price_range: 'Price Range (USDC)',
    x402_services_heading: 'Available reports',
    x402_catalog_heading: 'AI Risk Report Catalog',
    x402_loading: 'Loading reports…',
    x402_flow_heading: 'Purchase flow',
    x402_pipeline_heading: 'x402 Pay → AI Report → Pricing Engine',
    x402_step1_title: 'Request Report',
    x402_step1_desc: 'Investor requests AI deep risk report — server returns 402 Payment Required',
    x402_step2_title: 'x402 Payment',
    x402_step2_desc: 'Investor signs EIP-3009, pays USDC via x402 protocol',
    x402_step3_title: 'On-chain Settlement',
    x402_step3_desc: 'Facilitator settles on-chain, PaymentOracle records payment evidence',
    x402_step4_title: 'Report Unlocked',
    x402_step4_desc: 'AI risk report unlocked, risk data flows directly into the RWA pricing engine',
    x402_evidence_heading: 'On-chain payment evidence',
    x402_evidence_contract: 'PaymentOracle • Injective Testnet',
    x402_tx_hash: 'Transaction hash',
    x402_service_label: 'Report type',
    x402_amount_label: 'Amount',
    x402_response_hash: 'Report hash',
    x402_pricing_impact: 'Report impact on RWA pricing',
    x402_before_label: 'Before (free overview)',
    x402_after_label: 'After (deep report)',
    x402_smoke_btn: '🔥 Run x402 Purchase Demo',
    x402_purchase_btn: '💰 Buy AI Risk Report (0.001 USDC)',
    x402_purchased_heading: 'Your purchased reports',
    x402_purchased_sub: 'Re-readable within TTL — no second charge',
    x402_purchased_reread: '↻ Re-open (already paid)',
    x402_purchased_expires: 'Valid until {time}',
    x402_purchased_expired: 'Expired — re-purchase required',
    x402_running: '⏳ Running x402 purchase flow…',
    x402_initiating: '⏳ Initiating report purchase…',
    x402_failed: '✗ Purchase Failed',
    x402_error: 'Error',
    x402_signed: '✓ Paid',
    x402_settled: '✓ Settled',
    x402_unlocked: '✓ Report Unlocked',
    x402_challenge_status: '402 Returned',
    x402_signing_status: 'Paying…',
    x402_settling_status: 'Settling…',
    x402_pass: 'x402 purchase demo passed ✓',
    x402_challenge_log: 'Request AI risk report → HTTP 402 Payment Required returned',
    x402_signing_log: 'EIP-3009 — Investor signing TransferWithAuthorization',
    x402_settlement_log: 'PaymentOracle — On-chain settlement in progress',
    x402_unlocked_log: '✓ Report unlocked — {events} risk indicators, {intel} deep analysis entries, fed into pricing engine',
    x402_tx_log: '✓ Payment evidence on-chain: {tx}',
    x402_fail_log: '✗ Purchase flow failed: {msg}',
    x402_price_drop: '↓ deeper discount (AI report found more risk)',
    x402_price_rise: '↑ narrower discount (AI report confirms risk is contained)',
    x402_price_nochange: '→ no change',
    x402_delta: 'price change: {delta}',
    x402_step1_call: 'Requesting AI risk report endpoint…',
  }
};
