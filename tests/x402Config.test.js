import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_PAY_TO,
  X402ConfigError,
  formatUsdcAtomic,
  loadX402Config,
  routeMapFromConfig,
  validateFacilitatorSupport
} from '../src/x402/config.js';

const PAY_TO = '0x2222222222222222222222222222222222222222';
const TESTNET_USDC = '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d';

function liveEnv(overrides = {}) {
  return {
    X402_MODE: 'live',
    X402_NETWORK: 'eip155:1439',
    X402_PAY_TO: PAY_TO,
    X402_FACILITATOR_URL: 'https://facilitator.example',
    ...overrides
  };
}

function supportedBody(overrides = {}) {
  return {
    kinds: [{
      x402Version: 2,
      scheme: 'exact',
      network: 'eip155:1439',
      extra: {
        supportedAssets: [{
          address: TESTNET_USDC,
          decimals: 6,
          assetTransferMethod: 'eip3009',
          eip712: { name: 'USDC', version: '2', primaryType: 'TransferWithAuthorization' }
        }]
      },
      ...overrides
    }],
    extensions: [],
    signers: { 'eip155:1439': ['0x3333333333333333333333333333333333333333'] }
  };
}

test('X402-3: demo mode has safe deterministic testnet defaults and three priced endpoints', () => {
  const config = loadX402Config({});
  assert.equal(config.mode, 'demo');
  assert.equal(config.network, 'eip155:1439');
  assert.equal(config.asset, TESTNET_USDC);
  assert.equal(config.payTo, DEMO_PAY_TO);
  assert.equal(config.facilitatorUrl, null);
  assert.equal(config.endpoints.length, 3);
  assert.deepEqual(config.endpoints.map((entry) => entry.amount), ['50000', '100000', '1000']);
  assert.equal(Object.keys(routeMapFromConfig(config)).length, 3);
});

test('X402-3: live mode fails fast when payTo or facilitator URL is missing', () => {
  assert.throws(() => loadX402Config({ X402_MODE: 'live' }), /X402_PAY_TO is required/u);
  assert.throws(() => loadX402Config({ X402_MODE: 'live', X402_PAY_TO: PAY_TO }), /X402_FACILITATOR_URL is required/u);
});

test('X402-3: unsupported CAIP-2 identifiers are rejected', () => {
  assert.throws(() => loadX402Config({ X402_NETWORK: 'eip155:8453' }), /Unsupported X402_NETWORK/u);
  assert.throws(() => loadX402Config({ X402_NETWORK: 'injective-888' }), /Unsupported X402_NETWORK/u);
});

test('X402-3: malformed, non-canonical, and wrongly-scaled USDC configuration is rejected', () => {
  assert.throws(() => loadX402Config({ X402_ASSET: '0x1234' }), /20-byte/u);
  assert.throws(() => loadX402Config({ X402_ASSET: PAY_TO }), /canonical USDC/u);
  assert.throws(() => loadX402Config({ X402_ASSET_DECIMALS: '18' }), /uses 6 decimals/u);
});

test('X402-3: prices must be positive integer atomic units with no precision ambiguity', () => {
  for (const invalid of ['0', '-1', '0.01', '1e6', '']) {
    assert.throws(
      () => loadX402Config({ X402_PRICE_RISK_ATOMIC: invalid }),
      X402ConfigError,
      `price ${invalid}`
    );
  }
  assert.equal(formatUsdcAtomic('1000'), '0.001');
  assert.equal(formatUsdcAtomic('100000'), '0.1');
});

test('X402-3: live mainnet always requires HTTPS', () => {
  assert.throws(() => loadX402Config(liveEnv({
    X402_NETWORK: 'eip155:1776',
    X402_ASSET: '0xa00C59fF5a080D2b954d0c75e46E22a0c371235a',
    X402_FACILITATOR_URL: 'http://mainnet.example',
    X402_ALLOW_INSECURE_TESTNET: 'true'
  })), /must use HTTPS/u);
});

test('X402-3: insecure HTTP is limited to an explicit testnet opt-in', () => {
  assert.throws(() => loadX402Config(liveEnv({ X402_FACILITATOR_URL: 'http://staging.example' })), /testnet opt-in/u);
  const config = loadX402Config(liveEnv({
    X402_FACILITATOR_URL: 'http://staging.example/',
    X402_ALLOW_INSECURE_TESTNET: 'true'
  }));
  assert.equal(config.facilitatorUrl, 'http://staging.example');
  assert.equal(config.allowInsecureTestnet, true);
});

test('X402-3: demo mode skips facilitator network I/O', async () => {
  let calls = 0;
  const result = await validateFacilitatorSupport(loadX402Config({}), {
    fetchImpl: async () => { calls += 1; throw new Error('must not run'); }
  });
  assert.equal(result.skipped, true);
  assert.equal(calls, 0);
});

test('X402-3: live startup accepts exact/V2 testnet USDC EIP-3009 support', async () => {
  const config = loadX402Config(liveEnv());
  const result = await validateFacilitatorSupport(config, {
    fetchImpl: async (url) => {
      assert.equal(url, 'https://facilitator.example/supported');
      return new Response(JSON.stringify(supportedBody()), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.equal(result.signer, '0x3333333333333333333333333333333333333333');
});

test('X402-3: live startup fails closed on wrong network, asset, or transfer metadata', async () => {
  const config = loadX402Config(liveEnv());
  await assert.rejects(
    validateFacilitatorSupport(config, {
      fetchImpl: async () => new Response(JSON.stringify(supportedBody({ network: 'eip155:1776' })), { status: 200 })
    }),
    /does not advertise exact\/V2 support/u
  );
  const wrongAsset = supportedBody();
  wrongAsset.kinds[0].extra.supportedAssets[0].address = PAY_TO;
  await assert.rejects(
    validateFacilitatorSupport(config, {
      fetchImpl: async () => new Response(JSON.stringify(wrongAsset), { status: 200 })
    }),
    /does not advertise configured USDC/u
  );
  const wrongMethod = supportedBody();
  wrongMethod.kinds[0].extra.supportedAssets[0].assetTransferMethod = 'permit2';
  await assert.rejects(
    validateFacilitatorSupport(config, {
      fetchImpl: async () => new Response(JSON.stringify(wrongMethod), { status: 200 })
    }),
    /6 decimals and eip3009/u
  );
});

