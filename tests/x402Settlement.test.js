import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  FacilitatorAdapter,
  JsonReceiptStore,
  PaymentSettlementError,
  SETTLEMENT_STATES,
  X402SettlementService,
  paymentIdFor
} from '../src/x402/settlement.js';

const PAYER = '0x1111111111111111111111111111111111111111';
const PAY_TO = '0x2222222222222222222222222222222222222222';
const ASSET = '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d';
const TX = `0x${'ab'.repeat(32)}`;

function fixture(now = 2_000_000_000) {
  const requirement = {
    scheme: 'exact',
    network: 'eip155:1439',
    amount: '1000',
    asset: ASSET,
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    extra: { name: 'USDC', version: '2', assetTransferMethod: 'eip3009' }
  };
  return {
    paymentRequirements: requirement,
    paymentPayload: {
      x402Version: 2,
      accepted: structuredClone(requirement),
      payload: {
        signature: `0x${'cd'.repeat(65)}`,
        authorization: {
          from: PAYER,
          to: PAY_TO,
          value: '1000',
          validAfter: String(now - 10),
          validBefore: String(now + 60),
          nonce: `0x${'01'.repeat(32)}`
        }
      }
    }
  };
}

function successAdapter(counters = {}) {
  return {
    async verify() {
      counters.verify = (counters.verify ?? 0) + 1;
      await new Promise((resolve) => setImmediate(resolve));
      return { response: { isValid: true, payer: PAYER }, attempts: 1 };
    },
    async settle() {
      counters.settle = (counters.settle ?? 0) + 1;
      await new Promise((resolve) => setImmediate(resolve));
      return {
        response: { success: true, payer: PAYER, transaction: TX, network: 'eip155:1439' },
        attempts: 1
      };
    }
  };
}

async function temporaryStore(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbl-x402-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return path.join(directory, 'receipts.json');
}

test('X402-6: concurrent duplicate submissions verify and settle exactly once', async () => {
  const counters = {};
  const service = new X402SettlementService({ mode: 'live', adapter: successAdapter(counters) });
  const input = { ...fixture(), resource: 'https://agentbl.example/api/x402/smoke' };
  const [first, second] = await Promise.all([service.process(input), service.process(input)]);
  assert.equal(counters.verify, 1);
  assert.equal(counters.settle, 1);
  assert.equal(first.record.payment_id, second.record.payment_id);
  assert.equal(first.record.state, SETTLEMENT_STATES.SETTLED);
  assert.deepEqual(first.record.history.map((entry) => entry.state), [
    'CHALLENGED', 'SIGNED', 'SETTLING', 'SETTLED'
  ]);
});

test('X402-6: settled and unlocked receipts survive process restart without re-settlement', async (t) => {
  const filePath = await temporaryStore(t);
  const input = { ...fixture(), resource: 'https://agentbl.example/api/x402/smoke' };
  const firstService = new X402SettlementService({
    mode: 'live',
    adapter: successAdapter({}),
    store: new JsonReceiptStore({ filePath })
  });
  const settled = await firstService.process(input);
  await firstService.markUnlocked(settled.record.payment_id, { reportId: 'REPORT-1' });

  const counters = {};
  const restarted = new X402SettlementService({
    mode: 'live',
    adapter: successAdapter(counters),
    store: new JsonReceiptStore({ filePath })
  });
  const replay = await restarted.process(input);
  assert.equal(replay.replayed, true);
  assert.equal(replay.record.state, SETTLEMENT_STATES.UNLOCKED);
  assert.equal(replay.record.unlock.reportId, 'REPORT-1');
  assert.equal(counters.verify, undefined);
  assert.equal(counters.settle, undefined);
});

test('X402-6: verification failure persists FAILED and can never unlock', async () => {
  const service = new X402SettlementService({
    mode: 'live',
    adapter: {
      async verify() {
        return {
          response: { isValid: false, invalidReason: 'signature_verification_failed', invalidMessage: 'bad signature' },
          attempts: 1
        };
      },
      async settle() { throw new Error('must not settle'); }
    }
  });
  const input = { ...fixture(), resource: 'https://agentbl.example/api/x402/smoke' };
  await assert.rejects(service.process(input), (error) => error.code === 'signature_verification_failed');
  const id = paymentIdFor(input.paymentPayload, input.paymentRequirements);
  const record = await service.get(id);
  assert.equal(record.state, SETTLEMENT_STATES.FAILED);
  assert.equal(record.transaction, null);
  await assert.rejects(service.markUnlocked(id), /Cannot unlock/u);
});

test('X402-6: transient facilitator errors retry with bounded attempts', async () => {
  let verifyCalls = 0;
  let settleCalls = 0;
  const adapter = new FacilitatorAdapter({
    facilitatorUrl: 'https://facilitator.example',
    maxAttempts: 3,
    baseDelayMs: 1,
    delay: async () => {},
    fetchImpl: async (url) => {
      if (url.endsWith('/verify')) {
        verifyCalls += 1;
        if (verifyCalls === 1) return new Response('{}', { status: 503 });
        return new Response(JSON.stringify({ isValid: true, payer: PAYER }), { status: 200 });
      }
      settleCalls += 1;
      return new Response(JSON.stringify({
        success: true,
        payer: PAYER,
        transaction: TX,
        network: 'eip155:1439'
      }), { status: 200 });
    }
  });
  const service = new X402SettlementService({ mode: 'live', adapter });
  const result = await service.process({ ...fixture(), resource: 'https://agentbl.example/api/x402/smoke' });
  assert.equal(result.record.state, SETTLEMENT_STATES.SETTLED);
  assert.equal(result.record.verify_attempts, 2);
  assert.equal(verifyCalls, 2);
  assert.equal(settleCalls, 1);
});

test('X402-6: the same authorization cannot unlock a different resource', async () => {
  const service = new X402SettlementService({ mode: 'live', adapter: successAdapter({}) });
  const payment = fixture();
  await service.process({ ...payment, resource: 'https://agentbl.example/api/x402/smoke' });
  await assert.rejects(
    service.process({ ...payment, resource: 'https://agentbl.example/api/x402/intelligence/risk' }),
    (error) => error instanceof PaymentSettlementError && error.code === 'payment_already_bound'
  );
});

test('X402-6: restart converts an ambiguous SETTLING record to fail-closed reconciliation', async (t) => {
  const filePath = await temporaryStore(t);
  const payment = fixture();
  const paymentId = paymentIdFor(payment.paymentPayload, payment.paymentRequirements);
  const store = new JsonReceiptStore({ filePath });
  await store.upsert({
    payment_id: paymentId,
    state: 'SETTLING',
    resource: 'https://agentbl.example/api/x402/smoke',
    history: [{ state: 'CHALLENGED', at: '2026-01-01T00:00:00.000Z' }, { state: 'SIGNED', at: '2026-01-01T00:00:01.000Z' }, { state: 'SETTLING', at: '2026-01-01T00:00:02.000Z' }],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:02.000Z',
    transaction: null
  });
  const service = new X402SettlementService({
    mode: 'live',
    adapter: successAdapter({}),
    store: new JsonReceiptStore({ filePath })
  });
  await service.init();
  const record = await service.get(paymentId);
  assert.equal(record.state, SETTLEMENT_STATES.FAILED);
  assert.equal(record.error.code, 'settlement_reconciliation_required');
  await assert.rejects(service.markUnlocked(paymentId), /Cannot unlock/u);
});

test('X402-6: demo settlement is explicit, non-onchain, and has no fake tx hash', async () => {
  const service = new X402SettlementService({ mode: 'demo' });
  const result = await service.process({ ...fixture(), resource: 'https://agentbl.example/api/x402/smoke' });
  assert.equal(result.record.state, SETTLEMENT_STATES.SETTLED);
  assert.equal(result.record.settlement, 'simulated');
  assert.equal(result.record.onchain, false);
  assert.equal(result.record.transaction, null);
});

