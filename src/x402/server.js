import crypto from 'node:crypto';
import { decodePaymentSignatureHeader } from '@injectivelabs/x402/client';
import {
  loadX402Config,
  routeMapFromConfig,
  validateFacilitatorSupport,
  x402FacilitatorUrl,
  x402Network,
  x402PayTo
} from './config.js';
import {
  JsonReceiptStore,
  PaymentSettlementError,
  X402SettlementService
} from './settlement.js';

function base64Json(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function sameAddress(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();
}

function requirementFor(config, route) {
  return {
    scheme: 'exact',
    network: config.network,
    amount: route.amount,
    asset: config.asset,
    payTo: config.payTo,
    maxTimeoutSeconds: config.ttlSeconds,
    extra: {
      name: 'USDC',
      version: '2',
      assetTransferMethod: 'eip3009',
      chainId: config.chainId,
      verifyingContract: config.asset,
      primaryType: 'TransferWithAuthorization'
    }
  };
}

function resourceFor(req, route, baseUrl) {
  const origin = baseUrl ?? `${req.protocol}://${req.get('host') ?? 'localhost'}`;
  return {
    url: `${origin.replace(/\/$/u, '')}${route.path}`,
    description: route.description,
    mimeType: route.mimeType,
    serviceName: 'agentbl-paid-intelligence',
    tags: ['agentbl', 'injective', 'x402', route.id]
  };
}

export function buildPaymentRequired(config, route, resource, error = {}) {
  return {
    x402Version: 2,
    error: error.message ?? 'PAYMENT-SIGNATURE header is required',
    resource,
    accepts: [requirementFor(config, route)],
    extensions: {
      mode: config.mode,
      state: 'CHALLENGED',
      ...(error.code ? { errorCode: error.code } : {})
    }
  };
}

function exposePaymentHeaders(res) {
  res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE');
}

function sendPaymentRequired(res, body) {
  exposePaymentHeaders(res);
  res.setHeader('PAYMENT-REQUIRED', base64Json(body));
  return res.status(402).json(body);
}

function sendSettlementFailure(res, body, error, paymentId = null) {
  const receipt = {
    success: false,
    transaction: null,
    network: body.accepts[0].network,
    payer: null,
    paymentId,
    error: { code: error.code, message: error.message }
  };
  exposePaymentHeaders(res);
  const encoded = base64Json(receipt);
  res.setHeader('PAYMENT-RESPONSE', encoded);
  res.setHeader('X-PAYMENT-RESPONSE', encoded);
  return sendPaymentRequired(res, body);
}

function mismatch(code, message) {
  throw new PaymentSettlementError(code, message);
}

export function assertPaymentMatches(paymentPayload, requirement, options = {}) {
  const accepted = paymentPayload.accepted;
  const authorization = paymentPayload.payload.authorization;
  if (paymentPayload.x402Version !== 2) mismatch('x402_version_mismatch', 'Only x402 V2 payment payloads are accepted');
  if (accepted.scheme !== 'exact') mismatch('payment_scheme_mismatch', 'Only the exact payment scheme is accepted');
  if (accepted.network !== requirement.network) mismatch('payment_network_mismatch', 'Payment network does not match the protected resource');
  if (!sameAddress(accepted.asset, requirement.asset)) mismatch('payment_asset_mismatch', 'Payment asset does not match the protected resource');
  if (accepted.amount !== requirement.amount) mismatch('payment_amount_mismatch', 'Payment amount does not match the protected resource');
  if (!sameAddress(accepted.payTo, requirement.payTo)) mismatch('payment_recipient_mismatch', 'Payment recipient does not match the protected resource');
  if (accepted.maxTimeoutSeconds !== requirement.maxTimeoutSeconds) mismatch('payment_ttl_mismatch', 'Payment timeout does not match the protected resource');
  if (!sameAddress(authorization.to, requirement.payTo)) mismatch('payment_recipient_mismatch', 'Signed authorization has the wrong recipient');
  if (authorization.value !== requirement.amount) mismatch('payment_amount_mismatch', 'Signed authorization has the wrong amount');

  const nowSeconds = BigInt(Math.floor((options.now?.() ?? Date.now()) / 1000));
  let validAfter;
  let validBefore;
  try {
    validAfter = BigInt(authorization.validAfter);
    validBefore = BigInt(authorization.validBefore);
  } catch {
    mismatch('payment_time_invalid', 'Payment authorization timestamps must be integers');
  }
  if (validAfter > nowSeconds) mismatch('payment_not_yet_valid', 'Payment authorization is not yet valid');
  if (validBefore < nowSeconds) mismatch('payment_expired', 'Payment authorization has expired');
  const maximumValidity = BigInt(requirement.maxTimeoutSeconds + 15);
  if (validBefore - validAfter > maximumValidity || validBefore > nowSeconds + maximumValidity) {
    mismatch('payment_ttl_exceeded', 'Payment authorization exceeds the resource timeout');
  }

  const expectedExtra = requirement.extra;
  for (const key of ['name', 'version', 'assetTransferMethod']) {
    if (accepted.extra?.[key] !== expectedExtra[key]) {
      mismatch('payment_domain_mismatch', `Payment EIP-712 ${key} does not match`);
    }
  }
  if (accepted.extra?.chainId !== undefined && Number(accepted.extra.chainId) !== Number(expectedExtra.chainId)) {
    mismatch('payment_domain_mismatch', 'Payment EIP-712 chainId does not match');
  }
  if (accepted.extra?.verifyingContract !== undefined && !sameAddress(accepted.extra.verifyingContract, expectedExtra.verifyingContract)) {
    mismatch('payment_domain_mismatch', 'Payment EIP-712 verifyingContract does not match');
  }
  if (accepted.extra?.primaryType !== undefined && accepted.extra.primaryType !== expectedExtra.primaryType) {
    mismatch('payment_domain_mismatch', 'Payment EIP-712 primaryType does not match');
  }
  return true;
}

export function createX402PaymentMiddleware(options = {}) {
  const config = options.config;
  const settlementService = options.settlementService;
  if (!config) throw new TypeError('config is required');
  if (!settlementService) throw new TypeError('settlementService is required');
  const routes = options.routes ?? routeMapFromConfig(config);
  const now = options.now;

  return async function x402PaymentMiddleware(req, res, next) {
    const route = routes[`${req.method.toUpperCase()} ${req.path}`];
    if (!route) return next();

    const resource = resourceFor(req, route, options.baseUrl);
    const requirement = requirementFor(config, route);
    const challenge = (error) => buildPaymentRequired(config, route, resource, error);
    const paymentHeader = req.get('PAYMENT-SIGNATURE') ?? req.get('X-PAYMENT');
    if (!paymentHeader) return sendPaymentRequired(res, challenge());

    let paymentPayload;
    try {
      paymentPayload = decodePaymentSignatureHeader(paymentHeader);
      assertPaymentMatches(paymentPayload, requirement, { now });
      if (paymentPayload.resource?.url && paymentPayload.resource.url !== resource.url) {
        mismatch('payment_resource_mismatch', 'Payment payload is bound to a different resource');
      }
    } catch (error) {
      const normalized = error instanceof PaymentSettlementError
        ? error
        : new PaymentSettlementError('payment_signature_invalid', 'Invalid PAYMENT-SIGNATURE header');
      return sendPaymentRequired(res, challenge(normalized));
    }

    try {
      const result = await settlementService.process({
        paymentPayload,
        paymentRequirements: requirement,
        resource: resource.url
      });
      const record = result.record;
      const receipt = {
        success: true,
        transaction: record.transaction,
        network: record.network,
        payer: record.payer,
        amount: record.amount,
        paymentId: record.payment_id,
        mode: record.mode,
        onchain: record.onchain,
        replayed: result.replayed
      };
      exposePaymentHeaders(res);
      const encoded = base64Json(receipt);
      res.setHeader('PAYMENT-RESPONSE', encoded);
      res.setHeader('X-PAYMENT-RESPONSE', encoded);
      req.x402 = {
        ...receipt,
        state: record.state,
        asset: record.asset,
        payTo: record.pay_to
      };
      res.once('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        void settlementService.markUnlocked(record.payment_id, {
          resource: resource.url,
          statusCode: res.statusCode
        }).catch(() => {});
      });
      return next();
    } catch (error) {
      const normalized = error instanceof PaymentSettlementError
        ? error
        : new PaymentSettlementError('payment_settlement_failed', 'Payment settlement failed');
      return sendSettlementFailure(res, challenge(normalized), normalized, normalized.paymentId);
    }
  };
}

export async function createX402Runtime(options = {}) {
  const config = options.config ?? loadX402Config(options.env, options.configOverrides);
  const support = await validateFacilitatorSupport(config, { fetchImpl: options.fetchImpl });
  const store = options.store ?? new JsonReceiptStore({ filePath: options.receiptStorePath ?? config.receiptStorePath });
  const settlementService = options.settlementService ?? new X402SettlementService({
    mode: config.mode,
    facilitatorUrl: config.facilitatorUrl,
    fetchImpl: options.fetchImpl,
    timeoutMs: config.requestTimeoutMs,
    maxAttempts: config.maxAttempts,
    store,
    clock: options.clock,
    delay: options.delay,
    baseDelayMs: options.baseDelayMs
  });
  await settlementService.init();
  return {
    config,
    support,
    settlementService,
    middleware: createX402PaymentMiddleware({
      config,
      settlementService,
      routes: options.routes,
      baseUrl: options.baseUrl,
      now: options.now
    })
  };
}

// Compatibility API used by the built-in paid-intelligence UI and CLI. The
// production Express integration above remains the canonical x402 V2 path;
// this adapter supports the repository's existing Node HTTP server flow.
export function buildPaymentRequiredResponse(serviceId, priceUSDC, network, payTo, resource) {
  const nonce = `${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
  const challenge = buildLegacySignatureMessage({ serviceId, priceUSDC, nonce, network });

  return {
    error: 'Payment Required',
    message: `This endpoint requires a payment of ${priceUSDC} USDC via x402`,
    serviceId,
    priceUSDC,
    network,
    payTo,
    nonce,
    challenge,
    resource: resource || `agentbl://x402/${serviceId}`,
    paymentInstructions: {
      scheme: 'exact',
      asset: 'USDC',
      amount: Math.floor(priceUSDC * 1_000_000),
      facilitatorUrl: x402FacilitatorUrl(),
      signMethod: 'personal_sign'
    },
    headers: {
      'PAYMENT-REQUIRED': 'true',
      'X-Network': network,
      'X-Price-USDC': String(priceUSDC),
      'X-Pay-To': payTo
    }
  };
}

function buildLegacySignatureMessage({ serviceId, priceUSDC, nonce, network }) {
  return [
    'AgentBL x402 Payment Authorization',
    '',
    `Service:   ${serviceId}`,
    `Amount:    ${priceUSDC} USDC`,
    `Network:   ${network}`,
    `Nonce:     ${nonce}`,
    '',
    'By signing this message, you authorize this payment via the x402 protocol.',
    'This signature records payment intent; settlement is verified separately.'
  ].join('\n');
}

export async function recoverSigner(message, signature) {
  const { ethers } = await import('ethers');
  return ethers.verifyMessage(message, signature);
}

export function createX402Route({ serviceId, priceUSDC, handler }) {
  if (!serviceId || !Number.isFinite(priceUSDC) || priceUSDC <= 0 || typeof handler !== 'function') {
    throw new TypeError('serviceId, a positive priceUSDC, and handler are required');
  }
  const network = x402Network();
  const payTo = x402PayTo();

  return async function x402Route(request, response) {
    if (process.env.DEMO_MODE === 'false') {
      response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: false,
        code: 'x402_v2_live_transport_required',
        error: 'The personal-sign compatibility route is disabled in Live mode; use the verified x402 V2 middleware'
      }));
      return;
    }
    const signature = request.headers['x402-signature'];
    const claimedSigner = request.headers['x402-signer'];
    if (!signature || !claimedSigner) {
      const body = buildPaymentRequiredResponse(serviceId, priceUSDC, network, payTo);
      response.writeHead(402, {
        'Content-Type': 'application/json; charset=utf-8',
        'PAYMENT-REQUIRED': 'true',
        'X-Network': network,
        'X-Price-USDC': String(priceUSDC),
        'X-Pay-To': payTo || ''
      });
      response.end(JSON.stringify(body, null, 2));
      return;
    }

    try {
      let nonce = 'onchain';
      try {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString('utf8').trim();
        if (body) {
          request.x402Body = JSON.parse(body);
          nonce = request.x402Body.nonce || nonce;
        }
      } catch {
        // A body is optional for compatibility clients.
      }

      const message = buildLegacySignatureMessage({ serviceId, priceUSDC, nonce, network });
      const payer = await recoverSigner(message, signature);
      if (payer.toLowerCase() !== String(claimedSigner).toLowerCase()) {
        response.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: 'Payment signature does not match the claimed signer' }));
        return;
      }

      let payment;
      const clientTransaction = request.headers['x402-txhash'];
      if (clientTransaction) {
        payment = { txHash: clientTransaction, live: true, payer };
      } else {
        const { recordPaymentEvidence } = await import('./settlement.js');
        const result = await recordPaymentEvidence({
          serviceId,
          amountUSDC: priceUSDC,
          payer,
          responseData: { serviceId, priceUSDC, payer, nonce }
        });
        payment = result.payment;
      }

      const report = await handler(request);
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'PAYMENT-RESPONSE': JSON.stringify({
          network,
          txHash: payment.txHash,
          amount: Math.floor(priceUSDC * 1_000_000),
          payer
        })
      });
      response.end(JSON.stringify({
        ...report,
        payment: {
          status: 'settled',
          payer,
          txHash: payment.txHash,
          explorerUrl: payment.explorerUrl || null,
          live: payment.live === true,
          serviceId,
          amountUSDC: priceUSDC
        }
      }, null, 2));
    } catch (error) {
      const status = error?.code === 'INVALID_ARGUMENT' ? 401 : 500;
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: false,
        error: status === 401 ? 'Invalid payment signature' : error.message,
        serviceId,
        payment: { status: 'failed' }
      }));
    }
  };
}

export {
  buildPremiumFraudReview,
  buildPremiumRiskIntel,
  buildPremiumValuation
} from './endpoints.js';
