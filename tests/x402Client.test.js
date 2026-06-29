import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaidFetch,
  fetchPaidIntel,
  classifyPaidFailure,
  X402ClientError
} from '../src/x402/client.js';

// X402-5 client contract tests: the 402 -> sign -> retry flow must give the
// caller a clear, recoverable hint for cancellation, insufficient balance,
// network errors and settlement timeouts, and must never leak the private key.

const PAY_TO = '0x1111111111111111111111111111111111111111';

function challengeBody({ price = 0.001, network = 'eip155:1439', payTo = PAY_TO } = {}) {
  return {
    error: 'Payment Required',
    serviceId: 'premium-risk',
    priceUSDC: price,
    network,
    payTo,
    nonce: 'nonce-abc',
    challenge: 'AgentBL x402 Payment Authorization\nNonce: nonce-abc'
  };
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
  });
}

// Stub fetch emitting the legacy AgentBL 402 challenge on the first request and
// a (configurable) settlement outcome once an X402-Signature header is present.
function makeStubFetch({ challenge = {}, paid } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers ?? {});
    const signature = headers.get('X402-Signature');
    calls.push({ url, init, headers, signature });
    if (!signature) return jsonResponse(challengeBody(challenge), { status: 402 });
    if (typeof paid === 'function') return paid({ headers, init });
    return jsonResponse(
      { service: 'premium-risk', report_envelope: { report_hash: '0xabc' } },
      { status: 200, headers: { 'PAYMENT-RESPONSE': JSON.stringify({ txHash: '0xdeadbeef', network: 'eip155:1439' }) } }
    );
  };
  return { fetchImpl, calls };
}

test('X402-5: a 402 challenge is signed by a demo signer and the retry unlocks the report', async () => {
  const { fetchImpl, calls } = makeStubFetch();
  const result = await fetchPaidIntel('http://stub.invalid', '/api/x402/intel/premium-risk', {
    fetchImpl,
    demoMode: true,
    budgetUSDC: 0.01
  });
  assert.equal(result.x402_required, true);
  assert.ok(result.paid, 'paid report unlocked');
  assert.equal(result.paymentTxHash, '0xdeadbeef');
  assert.equal(result.demoSigner, true);
  assert.equal(calls.length, 2, 'one challenge + one paid retry');
});

test('X402-5: the signer private key is used locally and never sent to the server', async () => {
  const { ethers } = await import('ethers');
  const wallet = ethers.Wallet.createRandom();
  const { fetchImpl, calls } = makeStubFetch();
  await fetchPaidIntel('http://stub.invalid', '/api/x402/intel/premium-risk', {
    fetchImpl,
    privateKey: wallet.privateKey,
    budgetUSDC: 0.01
  });
  const paidCall = calls.find((entry) => entry.signature);
  assert.equal(paidCall.headers.get('X402-Signer').toLowerCase(), wallet.address.toLowerCase());
  const outgoing = JSON.stringify({ headers: [...paidCall.headers], body: paidCall.init.body });
  assert.ok(!outgoing.toLowerCase().includes(wallet.privateKey.toLowerCase()), 'raw private key leaked to server');
});

test('X402-5: a non-402 response passes through untouched without payment', async () => {
  const fetchImpl = async () => jsonResponse({ free: true }, { status: 200 });
  const paidFetch = createPaidFetch({ fetchImpl, demoMode: true });
  const res = await paidFetch('http://stub.invalid/api/free');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { free: true });
});

test('X402-5: a price above the budget is refused before any signature', async () => {
  const { fetchImpl } = makeStubFetch({ challenge: { price: 0.05 } });
  const paidFetch = createPaidFetch({ fetchImpl, demoMode: true, budgetUSDC: 0.01 });
  await assert.rejects(paidFetch('http://stub.invalid/x'), (err) => {
    assert.ok(err instanceof X402ClientError);
    assert.equal(err.code, 'X402_BUDGET_EXCEEDED');
    return true;
  });
});

test('X402-5: a payment on an unexpected network is refused', async () => {
  const { fetchImpl } = makeStubFetch({ challenge: { network: 'eip155:9999' } });
  const paidFetch = createPaidFetch({ fetchImpl, demoMode: true, budgetUSDC: 0.01 });
  await assert.rejects(paidFetch('http://stub.invalid/x'), (err) => {
    assert.equal(err.code, 'X402_WRONG_NETWORK');
    return true;
  });
});

test('X402-5: a cancelled wallet signature is reported as recoverable', async () => {
  const signer = {
    address: '0x2222222222222222222222222222222222222222',
    signMessage: async () => {
      const error = new Error('User rejected the request');
      error.code = 4001;
      throw error;
    }
  };
  const { fetchImpl } = makeStubFetch();
  const paidFetch = createPaidFetch({ fetchImpl, signer, budgetUSDC: 0.01 });
  await assert.rejects(paidFetch('http://stub.invalid/x'), (err) => {
    assert.equal(err.code, 'X402_SIGNATURE_CANCELLED');
    assert.equal(err.recoverable, true);
    return true;
  });
});

test('X402-5: a transport failure surfaces a recoverable network error', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  const paidFetch = createPaidFetch({ fetchImpl, demoMode: true });
  await assert.rejects(paidFetch('http://stub.invalid/x'), (err) => {
    assert.equal(err.code, 'X402_NETWORK_ERROR');
    assert.equal(err.recoverable, true);
    return true;
  });
});

test('X402-5: a hung request aborts with a recoverable timeout', async () => {
  const fetchImpl = (url, init) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  });
  const paidFetch = createPaidFetch({ fetchImpl, demoMode: true, timeoutMs: 50 });
  await assert.rejects(paidFetch('http://stub.invalid/x'), (err) => {
    assert.equal(err.code, 'X402_TIMEOUT');
    assert.equal(err.recoverable, true);
    return true;
  });
});

test('X402-5: an underfunded signer is refused before signing', async () => {
  let signCalls = 0;
  const signer = {
    address: '0x3333333333333333333333333333333333333333',
    signMessage: async () => { signCalls += 1; return '0xsig'; }
  };
  const { fetchImpl } = makeStubFetch({ challenge: { price: 0.001 } });
  const paidFetch = createPaidFetch({ fetchImpl, signer, budgetUSDC: 0.01, balanceOf: async () => 0n });
  await assert.rejects(paidFetch('http://stub.invalid/x'), (err) => {
    assert.equal(err.code, 'X402_INSUFFICIENT_BALANCE');
    assert.equal(err.recoverable, true);
    return true;
  });
  assert.equal(signCalls, 0, 'must not sign when the wallet cannot cover the payment');
});

test('X402-5: a funded signer passes the balance guard and settles', async () => {
  const signer = {
    address: '0x3333333333333333333333333333333333333333',
    signMessage: async () => `0x${'ab'.repeat(65)}`
  };
  const { fetchImpl, calls } = makeStubFetch({ challenge: { price: 0.001 } });
  const paidFetch = createPaidFetch({ fetchImpl, signer, budgetUSDC: 0.01, balanceOf: async () => 1_000_000n });
  const res = await paidFetch('http://stub.invalid/x');
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
});

test('X402-5: live mode without a signer refuses to invent one', async () => {
  const { fetchImpl } = makeStubFetch();
  const paidFetch = createPaidFetch({ fetchImpl, demoMode: false, budgetUSDC: 0.01 });
  await assert.rejects(paidFetch('http://stub.invalid/x'), (err) => {
    assert.equal(err.code, 'X402_SIGNER_REQUIRED');
    return true;
  });
});

test('X402-5: a server settlement failure is classified with a recoverable hint', async () => {
  const { fetchImpl } = makeStubFetch({
    paid: () => jsonResponse({ ok: false, error: 'insufficient USDC balance to settle' }, { status: 500 })
  });
  const result = await fetchPaidIntel('http://stub.invalid', '/api/x402/intel/premium-risk', {
    fetchImpl,
    demoMode: true,
    budgetUSDC: 0.01
  });
  assert.equal(result.paid, null);
  assert.equal(result.failure.code, 'X402_INSUFFICIENT_BALANCE');
  assert.equal(result.failure.recoverable, true);
});

test('X402-5: classifyPaidFailure maps known settlement errors to recoverable codes', () => {
  assert.equal(classifyPaidFailure(500, { error: 'insufficient funds' }).code, 'X402_INSUFFICIENT_BALANCE');
  assert.equal(classifyPaidFailure(401, { error: 'bad signature' }).code, 'X402_SIGNATURE_REJECTED');
  const generic = classifyPaidFailure(503, {});
  assert.equal(generic.code, 'X402_SETTLEMENT_FAILED');
  assert.equal(generic.recoverable, true);
});
