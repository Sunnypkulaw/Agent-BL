const { expect } = require('chai');
const { ethers } = require('hardhat');

// Off-chain pricing_action codes (docs/contracts.md §2.3) mirrored by the enum.
const ACTION = {
  OPEN_OFFERING: 0,
  OPEN_WITH_WARNING: 1,
  REPRICE_DOWN: 2,
  PAUSE_OFFERING: 3,
  FREEZE_POOL: 4,
  TRIGGER_LIQUIDATION: 5
};

async function deploy() {
  const [creator, other] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory('TradeShieldRWA');
  const rwa = await Factory.deploy();
  await rwa.waitForDeployment();
  return { creator, other, rwa };
}

// Copper FAST reference: issue 0.848 USD (e6 = 848000), financing 3,300,000 USD.
const PRICE_E6 = 848000n;
const SUPPLY = 4_000_000n;
const FINANCING = 3_300_000n;
const COLLATERAL = 7_500_000n;
const evidenceHash = ethers.id('evidence-bundle-copper');
const quoteHash = ethers.id('pricing-quote-copper');

describe('TradeShieldRWA (browser demo contract)', () => {
  it('tokenizes an eBL, mints RWA = floor(financing*1e6/price) to the caller', async () => {
    const { creator, rwa } = await deploy();

    const tx = await rwa.tokenize(
      'EBL-2026-CU-04417', PRICE_E6, SUPPLY, FINANCING, COLLATERAL, 350, 1, quoteHash, evidenceHash
    );
    await tx.wait();

    const expectedMinted = (FINANCING * 1_000_000n) / PRICE_E6; // 3,891,509
    expect(await rwa.balanceOf(1, creator.address)).to.equal(expectedMinted);

    const offering = await rwa.offeringOf(1);
    expect(offering.blId).to.equal('EBL-2026-CU-04417');
    expect(offering.issuePriceE6).to.equal(PRICE_E6);
    expect(offering.minted).to.equal(expectedMinted);
    expect(offering.riskLevel).to.equal(1n);

    const events = await rwa.queryFilter(rwa.filters.Tokenized());
    expect(events.length).to.equal(1);
    expect(events[0].args.poolId).to.equal(1n);
    expect(events[0].args.mintedAmount).to.equal(expectedMinted);
    expect(events[0].args.quoteHash).to.equal(quoteHash);
    expect(events[0].args.evidenceHash).to.equal(evidenceHash);
  });

  it('caps minted RWA at tokenSupply when financing exceeds it', async () => {
    const { creator, rwa } = await deploy();
    // financing 10M / 0.848 ~= 11.79M tokens, capped to a 1M supply.
    await (await rwa.tokenize('EBL-X', PRICE_E6, 1_000_000n, 10_000_000n, COLLATERAL, 350, 1, quoteHash, evidenceHash)).wait();
    expect(await rwa.balanceOf(1, creator.address)).to.equal(1_000_000n);
  });

  it('increments poolId per tokenize call', async () => {
    const { rwa } = await deploy();
    await (await rwa.tokenize('EBL-A', PRICE_E6, SUPPLY, FINANCING, COLLATERAL, 350, 1, quoteHash, evidenceHash)).wait();
    await (await rwa.tokenize('EBL-B', PRICE_E6, SUPPLY, FINANCING, COLLATERAL, 350, 1, quoteHash, evidenceHash)).wait();
    expect(await rwa.nextPoolId()).to.equal(3n);
    expect((await rwa.offeringOf(2)).blId).to.equal('EBL-B');
  });

  it('reprices an offering on an in-transit event and emits Repriced', async () => {
    const { rwa } = await deploy();
    await (await rwa.tokenize('EBL-2026-CU-04417', PRICE_E6, SUPPLY, FINANCING, COLLATERAL, 350, 1, quoteHash, evidenceHash)).wait();

    const newEvidence = ethers.id('evidence-hormuz-escalation');
    await (await rwa.reprice(1, 790000n, ACTION.REPRICE_DOWN, 1410, 3, newEvidence, 'Strait of Hormuz escalation')).wait();

    const offering = await rwa.offeringOf(1);
    expect(offering.issuePriceE6).to.equal(790000n);
    expect(offering.riskScoreBps).to.equal(1410n);
    expect(offering.riskLevel).to.equal(3n);

    const repriced = await rwa.queryFilter(rwa.filters.Repriced());
    expect(repriced.length).to.equal(1);
    expect(repriced[0].args.oldIssuePriceE6).to.equal(PRICE_E6);
    expect(repriced[0].args.newIssuePriceE6).to.equal(790000n);
    expect(repriced[0].args.action).to.equal(BigInt(ACTION.REPRICE_DOWN));
    expect(repriced[0].args.reason).to.equal('Strait of Hormuz escalation');
  });

  it('rejects price=0 / supply=0 and reprice on a missing pool', async () => {
    const { rwa } = await deploy();

    let reverted = false;
    try { await rwa.tokenize('EBL-X', 0n, SUPPLY, FINANCING, COLLATERAL, 0, 0, quoteHash, evidenceHash); }
    catch (err) { reverted = /issuePrice=0/.test(err.message); }
    expect(reverted).to.equal(true);

    reverted = false;
    try { await rwa.reprice(99, 1n, ACTION.REPRICE_DOWN, 0, 0, evidenceHash, 'x'); }
    catch (err) { reverted = /pool missing/.test(err.message); }
    expect(reverted).to.equal(true);
  });
});
