import { Wallet, getAddress, keccak256, toUtf8Bytes, verifyMessage } from 'ethers';
import { canonicalJson, hashCanonical, verifyRevealProof } from './fairness.js';
import { MysteryStoreError } from './store.js';

export const VOYAGE_PASSPORT_SCHEMA = 'voyage-passport-v1';
export const VOYAGE_STAMP_TYPES = Object.freeze(['DISCOVERY', 'INVESTOR_JOURNEY']);
const ARTWORK_VARIANTS = Object.freeze(['DAWN', 'STORM', 'NIGHT', 'PORT_ARRIVAL']);
const HASH_RE = /^0x[0-9a-f]{64}$/u;
const DEMO_ISSUER_KEY = keccak256(toUtf8Bytes('AgentBL Voyage Passport demo issuer v1 - no funds'));

function issuerWallet() {
  const configured = process.env.VOYAGE_PASSPORT_ISSUER_PRIVATE_KEY?.trim();
  return new Wallet(configured || DEMO_ISSUER_KEY);
}

export function passportClaimMessage({ revealId, stampType, walletAddress, revealProofHash }) {
  return [
    'AgentBL Voyage Passport Claim',
    `Reveal: ${String(revealId)}`,
    `Stamp: ${String(stampType)}`,
    `Wallet: ${getAddress(walletAddress).toLowerCase()}`,
    `Proof: ${String(revealProofHash).toLowerCase()}`,
    'This credential is non-transferable and carries no investment or cargo rights.'
  ].join('\n');
}

export function verifyPassportClaimSignature({ record, stampType, walletAddress, signature }) {
  const expectedWallet = getAddress(record.wallet_address).toLowerCase();
  const suppliedWallet = getAddress(walletAddress).toLowerCase();
  if (expectedWallet !== suppliedWallet) {
    throw new MysteryStoreError('wallet_mismatch', 'Claiming wallet does not match the reveal wallet');
  }
  const message = passportClaimMessage({
    revealId: record.reveal_id,
    stampType,
    walletAddress: suppliedWallet,
    revealProofHash: record.proof?.reveal_proof_hash
  });
  let recovered;
  try {
    recovered = verifyMessage(message, String(signature ?? '')).toLowerCase();
  } catch {
    throw new MysteryStoreError('claim_signature_invalid', 'Passport claim signature is invalid');
  }
  if (recovered !== suppliedWallet) {
    throw new MysteryStoreError('claim_signature_invalid', 'Passport claim signature does not match the reveal wallet');
  }
  return suppliedWallet;
}

export async function issueVoyagePassport({ record, stampType, subscription }) {
  if (record?.state !== 'REVEALED' || !record.proof || !record.report) {
    throw new MysteryStoreError('mystery_not_revealed', 'A valid reveal is required before issuing a Passport');
  }
  const normalizedStamp = String(stampType ?? 'DISCOVERY').toUpperCase();
  if (!VOYAGE_STAMP_TYPES.includes(normalizedStamp)) {
    throw new MysteryStoreError('passport_stamp_invalid', 'Unknown Voyage Passport stamp type');
  }
  const proofVerification = verifyRevealProof(record.proof);
  if (!proofVerification.valid) {
    throw new MysteryStoreError('passport_proof_invalid', 'Reveal proof is invalid', proofVerification);
  }
  if (normalizedStamp === 'INVESTOR_JOURNEY' && !subscription) {
    throw new MysteryStoreError(
      'passport_subscription_required',
      'Investor Journey requires an independently confirmed subscription'
    );
  }

  const cargo = record.report.cargo ?? {};
  const fromRegion = routeRegion(cargo.port_of_loading);
  const toRegion = routeRegion(cargo.port_of_discharge);
  const routeCode = `${regionCode(fromRegion)}-${regionCode(toRegion)}`;
  const reportHash = record.report.report_snapshot_hash ?? record.report.evidence_hash;
  const variantIndex = Number(BigInt(hashCanonical({ reveal_id: record.reveal_id, stamp: normalizedStamp })) % BigInt(ARTWORK_VARIANTS.length));
  const unsigned = {
    credential_id: '',
    schema_version: VOYAGE_PASSPORT_SCHEMA,
    stamp_type: normalizedStamp,
    voyage_id: `VOY-${hashCanonical({ reveal_id: record.reveal_id }).slice(2, 10).toUpperCase()}`,
    cargo_category: coarseCargoCategory(cargo.category),
    route_label: fromRegion === toRegion ? `${fromRegion} corridor` : `${fromRegion} to ${toRegion}`,
    route_code: routeCode,
    revealed_at: record.report.generated_at ?? record.updated_at,
    experience_mode: String(record.payment_tx_hash ?? '').startsWith('demo://') ? 'DEMO' : 'LIVE_PROTOTYPE',
    reveal_proof_digest: record.proof.reveal_proof_hash,
    report_hash: reportHash,
    artwork_variant: ARTWORK_VARIANTS[variantIndex],
    issuer: 'AgentBL'
  };
  if (normalizedStamp === 'INVESTOR_JOURNEY') {
    unsigned.subscription_reference = hashCanonical({
      reveal_proof_hash: record.proof.reveal_proof_hash,
      subscription_tx_hash: subscription.txHash
    });
  }
  unsigned.credential_id = `vp_${hashCanonical(unsigned).slice(2, 26)}`;
  const issuer = issuerWallet();
  return {
    ...unsigned,
    issuer_signature: await issuer.signMessage(canonicalJson(unsigned))
  };
}

export function verifyVoyagePassport(credential) {
  const errors = [];
  if (credential?.schema_version !== VOYAGE_PASSPORT_SCHEMA) errors.push('schema_version mismatch');
  if (!VOYAGE_STAMP_TYPES.includes(credential?.stamp_type)) errors.push('stamp_type invalid');
  if (credential?.issuer !== 'AgentBL') errors.push('issuer mismatch');
  for (const field of ['reveal_proof_digest', 'report_hash']) {
    if (!HASH_RE.test(String(credential?.[field] ?? '').toLowerCase())) errors.push(`${field} invalid`);
  }
  if (credential?.subscription_reference && !HASH_RE.test(String(credential.subscription_reference).toLowerCase())) {
    errors.push('subscription_reference invalid');
  }
  if (credential?.revoked_at) errors.push('credential revoked');
  const unsigned = { ...credential };
  delete unsigned.issuer_signature;
  try {
    const recovered = verifyMessage(canonicalJson(unsigned), String(credential?.issuer_signature ?? '')).toLowerCase();
    if (recovered !== issuerWallet().address.toLowerCase()) errors.push('issuer_signature mismatch');
  } catch {
    errors.push('issuer_signature invalid');
  }
  return {
    valid: errors.length === 0,
    revoked: Boolean(credential?.revoked_at),
    errors,
    issuer_address: issuerWallet().address
  };
}

export function safePassportShareView(credential) {
  return {
    credential_id: credential.credential_id,
    schema_version: credential.schema_version,
    brand: 'AgentBL / Mystery Voyage',
    stamp_type: credential.stamp_type,
    voyage_id: credential.voyage_id,
    cargo_category: credential.cargo_category,
    route_label: credential.route_label,
    route_code: credential.route_code,
    reveal_date: String(credential.revealed_at ?? '').slice(0, 10),
    experience_mode: credential.experience_mode,
    verified_reveal: !credential.revoked_at,
    reveal_proof_digest: credential.reveal_proof_digest,
    report_hash: credential.report_hash,
    artwork_variant: credential.artwork_variant,
    issuer: credential.issuer,
    issuer_signature: credential.issuer_signature,
    revoked_at: credential.revoked_at,
    verify_path: `/api/mystery/passport/${encodeURIComponent(credential.credential_id)}/verify`,
    notice: 'A product-experience credential for a verified AI report reveal. Not an RWA, not cargo ownership, not proof of investment performance.'
  };
}

function coarseCargoCategory(value) {
  const cargo = String(value ?? '').toLowerCase();
  if (/copper|aluminium|aluminum|steel|metal/u.test(cargo)) return 'Industrial metals';
  if (/oil|diesel|gas|petroleum|energy/u.test(cargo)) return 'Energy cargo';
  if (/soy|rubber|grain|agri/u.test(cargo)) return 'Agricultural cargo';
  if (/ore|mineral|concentrate/u.test(cargo)) return 'Bulk minerals';
  return 'Trade cargo';
}

function routeRegion(value) {
  const location = String(value ?? '').toLowerCase();
  if (/singapore|shanghai|qingdao|tianjin|china|jakarta|bangkok|ulsan|korea|asia/u.test(location)) return 'Asia';
  if (/hamburg|rotterdam|netherlands|germany|europe/u.test(location)) return 'Europe';
  if (/dubai|uae|emirates|middle east/u.test(location)) return 'Middle East';
  if (/australia|port hedland|oceania/u.test(location)) return 'Oceania';
  if (/chile|antofagasta|america/u.test(location)) return 'Americas';
  return 'Global';
}

function regionCode(region) {
  return region.toUpperCase().replace(/[^A-Z]+/gu, '_').replace(/^_|_$/gu, '') || 'GLOBAL';
}
