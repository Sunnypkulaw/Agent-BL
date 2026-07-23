const STAMP_TYPES = new Set(['DISCOVERY', 'INVESTOR_JOURNEY']);
const EXPERIENCE_MODES = new Set(['DEMO', 'RECORDED_REPLAY', 'LIVE_PROTOTYPE', 'VESSEL_LIVE']);
const FORBIDDEN_KEYS = [
  'wallet', 'amount', 'balance', 'token_count', 'pnl', 'yield', 'upside', 'risk',
  'kyc', 'sanction', 'gps', 'position', 'camera', 'ebl', 'invoice', 'insurance',
  'address', 'phone', 'email', 'real_name'
];

export function shortPassportDigest(value) {
  const text = String(value ?? '');
  return text.length > 13 ? `${text.slice(0, 6)}...${text.slice(-6)}` : text;
}

export function buildPassportShareCard(credential, options = {}) {
  const source = credential?.share ?? credential ?? {};
  const stampType = STAMP_TYPES.has(source.stamp_type) ? source.stamp_type : 'DISCOVERY';
  const experienceMode = EXPERIENCE_MODES.has(source.experience_mode) ? source.experience_mode : 'DEMO';
  const nickname = String(options.nickname ?? '').trim().replace(/\s+/gu, ' ').slice(0, 32);
  const verifyPath = String(source.verify_path ?? '');
  const origin = String(options.origin ?? '').replace(/\/$/u, '');
  const card = {
    brand: 'AgentBL / Mystery Voyage',
    credential_id: String(source.credential_id ?? ''),
    stamp_type: stampType,
    voyage_id: String(source.voyage_id ?? ''),
    cargo_category: String(source.cargo_category ?? 'Trade cargo'),
    route_label: String(source.route_label ?? 'Global trade corridor'),
    route_code: String(source.route_code ?? 'GLOBAL-GLOBAL'),
    reveal_date: String(source.reveal_date ?? source.revealed_at ?? '').slice(0, 10),
    experience_mode: experienceMode,
    verified_reveal: source.verified_reveal !== false,
    proof_digest: shortPassportDigest(source.reveal_proof_digest),
    report_digest: shortPassportDigest(source.report_hash),
    artwork_variant: String(source.artwork_variant ?? 'DAWN'),
    verify_url: verifyPath ? `${origin}${verifyPath}` : '',
    nickname,
    notice: 'A product-experience credential for a verified AI report reveal. Not an RWA, not cargo ownership, not proof of investment performance.'
  };
  if (options.includePublicTx === true
    && options.advancedConfirmed === true
    && /^0x[0-9a-fA-F]{64}$/u.test(String(options.publicTxHash ?? ''))
    && /^https:\/\//u.test(String(options.explorerUrl ?? ''))) {
    card.public_tx_hash = String(options.publicTxHash);
    card.explorer_url = String(options.explorerUrl);
  }
  assertSafePassportShareCard(card);
  return card;
}

export function assertSafePassportShareCard(card) {
  for (const key of Object.keys(card ?? {})) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN_KEYS.some((forbidden) => normalized.includes(forbidden))) {
      throw new TypeError(`Forbidden Passport share field: ${key}`);
    }
  }
  if (!STAMP_TYPES.has(card?.stamp_type)) throw new TypeError('Invalid Passport stamp type');
  if (!EXPERIENCE_MODES.has(card?.experience_mode)) throw new TypeError('Invalid Passport experience mode');
  return card;
}

export function buildPassportShareText(card) {
  assertSafePassportShareCard(card);
  return [
    `${card.brand} | ${card.stamp_type.replace('_', ' ')}`,
    card.nickname ? `${card.nickname} | ${card.voyage_id}` : card.voyage_id,
    `${card.cargo_category} | ${card.route_label}`,
    `${card.experience_mode} | ${card.reveal_date} | Verified reveal ${card.proof_digest}`,
    card.verify_url,
    card.notice
  ].filter(Boolean).join('\n');
}
