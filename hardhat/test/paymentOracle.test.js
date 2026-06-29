const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('PaymentOracle', () => {
  const receiptId = ethers.id('receipt:rpt_001');
  const reportHash = ethers.sha256(ethers.toUtf8Bytes('paid-report-envelope'));
  const caseIdHash = ethers.sha256(ethers.toUtf8Bytes('CASE-EBL-2026-CU-SG-SHA'));
  const paymentTxHash = ethers.id('injective-usdc-settlement-transaction');
  const amount = 1_000n;

  async function fixture() {
    const [owner, attestor, payer, asset, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('PaymentOracle');
    const oracle = await Factory.deploy();
    await oracle.waitForDeployment();
    return { oracle, owner, attestor, payer, asset, outsider };
  }

  async function attest(ctx, overrides = {}, signer = ctx.owner) {
    return ctx.oracle.connect(signer).attestPayment(
      overrides.receiptId ?? receiptId,
      overrides.reportHash ?? reportHash,
      overrides.caseIdHash ?? caseIdHash,
      overrides.paymentTxHash ?? paymentTxHash,
      overrides.payer ?? ctx.payer.address,
      overrides.asset ?? ctx.asset.address,
      overrides.amount ?? amount
    );
  }

  async function expectCustomError(operation, errorName, contract) {
    let caught;
    try {
      await operation;
    } catch (error) {
      caught = error;
    }
    expect(caught, `expected ${errorName} revert`).to.exist;
    if (!caught.message.includes(errorName)) {
      const data = caught.data ?? caught.error?.data ?? caught.info?.error?.data;
      const diagnostic = `${caught.message} ${typeof data === 'object' ? JSON.stringify(data) : String(data)}`;
      expect(diagnostic).to.include(contract.interface.getError(errorName).selector);
    }
    return caught;
  }

  it('binds report, case, original payment transaction, payer, asset and amount', async () => {
    const ctx = await fixture();
    await (await attest(ctx)).wait();
    const events = await ctx.oracle.queryFilter(ctx.oracle.filters.PaymentAttested());
    expect(events).to.have.length(1);
    const event = events[0].args;
    expect(event.receiptId).to.equal(receiptId);
    expect(event.reportHash).to.equal(reportHash);
    expect(event.caseIdHash).to.equal(caseIdHash);
    expect(event.paymentTxHash).to.equal(paymentTxHash);
    expect(event.payer).to.equal(ctx.payer.address);
    expect(event.asset).to.equal(ctx.asset.address);
    expect(event.amount).to.equal(amount);
    expect(event.attestor).to.equal(ctx.owner.address);
    expect(event.timestamp > 0n).to.equal(true);

    const stored = await ctx.oracle.getAttestation(receiptId);
    expect(stored.reportHash).to.equal(reportHash);
    expect(stored.caseIdHash).to.equal(caseIdHash);
    expect(stored.paymentTxHash).to.equal(paymentTxHash);
    expect(stored.payer).to.equal(ctx.payer.address);
    expect(stored.asset).to.equal(ctx.asset.address);
    expect(stored.amount).to.equal(amount);
    expect(stored.attestor).to.equal(ctx.owner.address);
    expect(await ctx.oracle.hasAttestation(receiptId)).to.equal(true);
    expect(await ctx.oracle.attestationCount()).to.equal(1n);
  });

  it('rejects a duplicate receipt id', async () => {
    const ctx = await fixture();
    await (await attest(ctx)).wait();
    await expectCustomError(
      attest(ctx, { paymentTxHash: ethers.id('another-tx') }),
      'DuplicateReceipt',
      ctx.oracle
    );
  });

  it('rejects replaying an original payment tx under a different receipt', async () => {
    const ctx = await fixture();
    await (await attest(ctx)).wait();
    await expectCustomError(
      attest(ctx, { receiptId: ethers.id('receipt:rpt_002') }),
      'DuplicatePaymentTransaction',
      ctx.oracle
    );
  });

  it('rejects zero receipt, report, case and payment transaction hashes', async () => {
    const ctx = await fixture();
    const zero = ethers.ZeroHash;
    for (const field of ['receiptId', 'reportHash', 'caseIdHash', 'paymentTxHash']) {
      await expectCustomError(attest(ctx, { [field]: zero }), 'ZeroHash', ctx.oracle);
    }
  });

  it('rejects zero payer and asset addresses', async () => {
    const ctx = await fixture();
    await expectCustomError(attest(ctx, { payer: ethers.ZeroAddress }), 'ZeroAddress', ctx.oracle);
    await expectCustomError(attest(ctx, { asset: ethers.ZeroAddress }), 'ZeroAddress', ctx.oracle);
  });

  it('rejects a zero payment amount', async () => {
    const ctx = await fixture();
    await expectCustomError(attest(ctx, { amount: 0n }), 'ZeroAmount', ctx.oracle);
  });

  it('rejects unauthorised callers and supports owner-managed attestors', async () => {
    const ctx = await fixture();
    await expectCustomError(attest(ctx, {}, ctx.outsider), 'UnauthorizedAttestor', ctx.oracle);

    await (await ctx.oracle.setAttestor(ctx.attestor.address, true)).wait();
    expect(await ctx.oracle.isAttestor(ctx.attestor.address)).to.equal(true);
    await (await attest(ctx, {}, ctx.attestor)).wait();

    await (await ctx.oracle.setAttestor(ctx.attestor.address, false)).wait();
    await expectCustomError(attest(ctx, {
      receiptId: ethers.id('receipt:rpt_003'),
      paymentTxHash: ethers.id('third-tx')
    }, ctx.attestor), 'UnauthorizedAttestor', ctx.oracle);
  });

  it('only lets the owner manage attestors and exposes unknown-receipt failure', async () => {
    const ctx = await fixture();
    await expectCustomError(
      ctx.oracle.connect(ctx.outsider).setAttestor(ctx.attestor.address, true),
      'NotOwner',
      ctx.oracle
    );
    await expectCustomError(ctx.oracle.getAttestation(receiptId), 'UnknownReceipt', ctx.oracle);
  });
});
