const { expect } = require('chai');
const { ethers } = require('hardhat');

// docs/contracts.md §2.3 action codes
const ACTION = {
  OPEN_OFFERING: 0,
  OPEN_WITH_WARNING: 1,
  REPRICE_DOWN: 2,
  PAUSE_OFFERING: 3,
  FREEZE_POOL: 4,
  TRIGGER_LIQUIDATION: 5
};

// RWAOfferingPool.OfferingState enum indices
const STATE = {
  Created: 0,
  Priced: 1,
  Open: 2,
  Subscribed: 3,
  Funded: 4,
  InTransit: 5,
  Repriced: 6,
  Paused: 7,
  Frozen: 8,
  Repaid: 9,
  Redeemed: 10,
  Liquidation: 11,
  Cancelled: 12
};

async function deployStack() {
  const [owner, investor, outsider, aiAgent] = await ethers.getSigners();

  const Registry = await ethers.getContractFactory('EBLRegistry');
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const Token = await ethers.getContractFactory('RWAToken');
  const token = await Token.deploy();
  await token.waitForDeployment();

  const Pool = await ethers.getContractFactory('RWAOfferingPool');
  const pool = await Pool.deploy(await registry.getAddress(), await token.getAddress());
  await pool.waitForDeployment();

  const Oracle = await ethers.getContractFactory('RiskPricingOracle');
  const oracle = await Oracle.deploy(await pool.getAddress());
  await oracle.waitForDeployment();

  // wiring
  await (await token.setPool(await pool.getAddress())).wait();
  await (await pool.setOracle(await oracle.getAddress())).wait();
  await (await pool.setPermissionedInvestor(investor.address, true)).wait();

  return { owner, investor, outsider, aiAgent, registry, token, pool, oracle };
}

async function createDemoOffering(ctx) {
  const metadataHash = ethers.id('EBL-2026-0001');
  await (await ctx.registry.mintEBL(metadataHash, ctx.owner.address)).wait();
  await (await ctx.registry.pledge(1, await ctx.pool.getAddress())).wait();
  // tokenSupply 1,000,000 ; issuePrice 0.90 USD (6 decimals)
  await (await ctx.pool.createOffering(1, 1_000_000n, 900_000n, 1_000_000n)).wait();
  return 1; // poolId
}

describe('TradeShield contracts', () => {
  it('creates an offering and opens it', async () => {
    const ctx = await deployStack();
    const poolId = await createDemoOffering(ctx);

    expect(await ctx.pool.stateOf(poolId)).to.equal(BigInt(STATE.Open));

    const created = await ctx.pool.queryFilter(ctx.pool.filters.OfferingCreated());
    expect(created.length).to.equal(1);
    expect(created[0].args.tokenSupply).to.equal(1_000_000n);
    expect(created[0].args.issuePrice).to.equal(900_000n);
  });

  it('lets a permissioned investor subscribe and mints RWA shares', async () => {
    const ctx = await deployStack();
    const poolId = await createDemoOffering(ctx);

    await (await ctx.pool.connect(ctx.investor).subscribe(poolId, 100_000n)).wait();

    expect(await ctx.token.balanceOf(poolId, ctx.investor.address)).to.equal(100_000n);
    expect(await ctx.token.totalSupply(poolId)).to.equal(100_000n);

    const subs = await ctx.pool.queryFilter(ctx.pool.filters.Subscribed());
    expect(subs.length).to.equal(1);
    expect(subs[0].args.amount).to.equal(100_000n);
    expect(subs[0].args.paidAmount).to.equal(100_000n * 900_000n);

    const minted = await ctx.token.queryFilter(ctx.token.filters.RWAMinted());
    expect(minted.length).to.equal(1);
    expect(minted[0].args.investor).to.equal(ctx.investor.address);
  });

  it('rejects non-permissioned investors', async () => {
    const ctx = await deployStack();
    const poolId = await createDemoOffering(ctx);

    let reverted = false;
    try {
      await ctx.pool.connect(ctx.outsider).subscribe(poolId, 1n);
    } catch (err) {
      reverted = /not permissioned/.test(err.message);
    }
    expect(reverted).to.equal(true);
  });

  it('writes evidence and quote hash on PricingUpdated and reprices the pool', async () => {
    const ctx = await deployStack();
    const poolId = await createDemoOffering(ctx);

    const evidenceHash = ethers.id('evidence-bundle-1');
    const quoteHash = ethers.id('pricing-quote-1');

    await (
      await ctx.oracle.updatePricing(poolId, 800_000n, 2, ACTION.REPRICE_DOWN, evidenceHash, quoteHash)
    ).wait();

    const priced = await ctx.oracle.queryFilter(ctx.oracle.filters.PricingUpdated());
    expect(priced.length).to.equal(1);
    expect(priced[0].args.evidenceHash).to.equal(evidenceHash);
    expect(priced[0].args.quoteHash).to.equal(quoteHash);
    expect(priced[0].args.action).to.equal(BigInt(ACTION.REPRICE_DOWN));

    // persisted hashes (WEB3-9)
    expect(await ctx.oracle.latestEvidenceHash(poolId)).to.equal(evidenceHash);
    expect(await ctx.oracle.latestQuoteHash(poolId)).to.equal(quoteHash);

    // pool repriced
    expect(await ctx.pool.stateOf(poolId)).to.equal(BigInt(STATE.Repriced));
    expect(await ctx.pool.issuePriceOf(poolId)).to.equal(800_000n);

    const repriced = await ctx.pool.queryFilter(ctx.pool.filters.OfferingRepriced());
    expect(repriced.length).to.equal(1);
    expect(repriced[0].args.oldIssuePrice).to.equal(900_000n);
    expect(repriced[0].args.newIssuePrice).to.equal(800_000n);
    expect(repriced[0].args.evidenceHash).to.equal(evidenceHash);
  });

  it('drives the pool into liquidation on a critical action', async () => {
    const ctx = await deployStack();
    const poolId = await createDemoOffering(ctx);

    const evidenceHash = ethers.id('evidence-critical');
    const quoteHash = ethers.id('quote-critical');

    await (
      await ctx.oracle.updatePricing(poolId, 700_000n, 3, ACTION.TRIGGER_LIQUIDATION, evidenceHash, quoteHash)
    ).wait();

    expect(await ctx.pool.stateOf(poolId)).to.equal(BigInt(STATE.Liquidation));

    const stateEvents = await ctx.pool.queryFilter(ctx.pool.filters.OfferingStateChanged());
    const last = stateEvents[stateEvents.length - 1];
    expect(last.args.newState).to.equal(BigInt(STATE.Liquidation));
    expect(last.args.action).to.equal(BigInt(ACTION.TRIGGER_LIQUIDATION));
  });

  it('rejects pricing updates from non-updaters', async () => {
    const ctx = await deployStack();
    const poolId = await createDemoOffering(ctx);

    let reverted = false;
    try {
      await ctx.oracle
        .connect(ctx.outsider)
        .updatePricing(poolId, 800_000n, 2, ACTION.REPRICE_DOWN, ethers.id('e'), ethers.id('q'));
    } catch (err) {
      reverted = /not updater/.test(err.message);
    }
    expect(reverted).to.equal(true);
  });
});
