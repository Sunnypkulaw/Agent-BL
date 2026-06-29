import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from '../src/app/server.js';
import { fetchPaidIntel, X402ClientError } from '../src/x402/client.js';
import { X402_SERVICES } from '../src/x402/config.js';

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const has = (flag) => args.includes(flag);

const KIND_ALIASES = Object.freeze({
  risk: 'premium-risk',
  'risk-intelligence': 'premium-risk',
  'premium-risk': 'premium-risk',
  valuation: 'premium-valuation',
  'collateral-valuation': 'premium-valuation',
  'premium-valuation': 'premium-valuation',
  fraud: 'fraud-review',
  documents: 'fraud-review',
  'fraud-review': 'fraud-review'
});

async function loadCase(selector) {
  if (!selector) return JSON.parse(await fs.readFile('data/demo-case.json', 'utf8'));
  const directCandidates = [
    selector,
    path.join('data', 'cases', selector),
    path.join('data', 'cases', selector.endsWith('.json') ? selector : `${selector}.case.json`)
  ];
  for (const candidate of directCandidates) {
    try { return JSON.parse(await fs.readFile(candidate, 'utf8')); } catch { /* try catalog lookup */ }
  }
  for (const file of await fs.readdir(path.join('data', 'cases'))) {
    if (!file.endsWith('.json')) continue;
    const candidate = JSON.parse(await fs.readFile(path.join('data', 'cases', file), 'utf8'));
    if (candidate.case_id === selector) return candidate;
  }
  throw new Error(`Unknown case or file: ${selector}`);
}

async function withServer(run) {
  const configured = process.env.BASE_URL?.replace(/\/$/u, '');
  if (configured) return run(configured);
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function reportHash(report) {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex')}`;
}

const kind = KIND_ALIASES[valueOf('--kind') ?? valueOf('--service') ?? 'risk'];
const service = X402_SERVICES.find((entry) => entry.serviceId === kind);
if (!service) {
  console.error(`Unknown --kind. Use: risk, valuation, or fraud`);
  process.exitCode = 1;
} else {
  try {
    const caseData = await loadCase(valueOf('--case'));
    const live = has('--live') || process.env.X402_MODE === 'live';
    const privateKey = process.env.WHITE_AGENT_PRIVATE_KEY ?? process.env.X402_PRIVATE_KEY;
    if (live && !privateKey) {
      throw new X402ClientError(
        'X402_SIGNER_REQUIRED',
        'Live mode requires WHITE_AGENT_PRIVATE_KEY; the key is used locally and is never printed or sent'
      );
    }

    console.log('AgentBL x402 paid AI report');
    console.log(`  case:       ${caseData.case_id}`);
    console.log(`  kind:       ${service.serviceId}`);
    console.log(`  price cap:  ${service.priceUSDC} USDC`);
    console.log(`  mode:       ${live ? 'LIVE' : 'DEMO (ephemeral signer, no real USDC)'}`);

    await withServer(async (baseUrl) => {
      const result = await fetchPaidIntel(baseUrl, service.endpoint, {
        privateKey,
        demoMode: !live,
        budgetUSDC: Number(valueOf('--budget') ?? 0.005),
        caseData,
        timeoutMs: Number(valueOf('--timeout') ?? 15_000),
        onChallenge(challenge) {
          console.log(`  challenge:  HTTP 402 / nonce ${challenge.body.nonce}`);
          console.log(`  amount:     ${challenge.amount} USDC on ${challenge.network}`);
        }
      });
      if (!result.paid) throw new Error(result.error?.error ?? 'Paid report was not unlocked');
      const envelope = result.paid.report_envelope;
      const hash = envelope?.report_hash ?? reportHash(result.paid);
      const transaction = envelope?.payment_tx ?? (result.payment?.live
        ? result.paymentTxHash
        : `(demo receipt ${result.paymentTxHash ?? 'none'}; not an on-chain settlement tx)`);
      const oracleTransaction = result.payment?.live ? result.paymentTxHash : '(demo: PaymentOracle not written)';
      console.log(`  settlement: ${transaction}`);
      console.log(`  report hash:${hash}`);
      console.log(`  oracle tx:  ${oracleTransaction}`);
      console.log(`  result:     ${result.paid.service} unlocked`);

      if (has('--json')) {
        console.log(JSON.stringify({
          case_id: caseData.case_id,
          kind: service.serviceId,
          amount_usdc: result.priceUSDC,
          network: result.network,
          settlement_tx: result.paymentTxHash,
          oracle_tx: result.payment?.live ? result.paymentTxHash : null,
          report_hash: hash,
          report_id: envelope?.report_id ?? null,
          expires_at: envelope?.expires_at ?? null,
          report: result.paid
        }, null, 2));
      }
    });
  } catch (error) {
    const code = error.code ? ` [${error.code}]` : '';
    console.error(`x402 purchase failed${code}: ${error.message}`);
    process.exitCode = 1;
  }
}
