const { expect } = require('chai');
const { ethers } = require('hardhat');

const ACTION = {
  OPEN: 0,
  REPRICE: 2,
  PAUSE: 3,
  RESUME: 6
};

const STATE = {
  Open: 2n,
  Subscribed: 3n,
  Funded: 4n,
  InTransit: 5n,
  Repriced: 6n,
  Paused: 7n,
  Repaid: 9n
};

async function expectRevert(promise, pattern) {
  let message = '';
  try {
    const tx = await promise;
    await tx.wait();
  } catch (error) {
    message = error.message;
  }
  expect(message).to.match(pattern);
}

async function deployStack() {
  const [owner, investor, outsider, agent] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory('EBLRegistry');
  const registry = await Registry.deploy();
  const Token = await ethers.getContractFactory('RWAToken');
  const token = await Token.deploy();
  const Pool = await ethers.getContractFactory('RWAOfferingPool');
  const pool = await Pool.deploy(await registry.getAddress(), await token.getAddress());
  const Oracle = await ethers.getContractFactory('RiskPricingOracle');
  const oracle = await Oracle.deploy(await pool.getAddress());
  const Gate = await ethers.getContractFactory('InvestorComplianceGate');
  const gate = await Gate.deploy();
  await Promise.all([
    registry.waitForDeployment(), token.waitForDeployment(), pool.waitForDeployment(),
    oracle.waitForDeployment(), gate.waitForDeployment()
  ]);
  await (await token.setPool(await pool.getAddress())).wait();
  await (await pool.setOracle(await oracle.getAddress())).wait();
  await (await pool.setAgentExecutor(agent.address, true)).wait();
  return { owner, investor, outsider, agent, registry, token, pool, oracle, gate };
}

async function createOffering(ctx, suffix = '1', supply = 100n) {
  await (await ctx.registry.mintEBL(ethers.id(`metadata-${suffix}`), ctx.owner.address)).wait();
  const eblId = (await ctx.registry.nextEblId()) - 1n;
  await (await ctx.registry.pledge(eblId, await ctx.pool.getAddress())).wait();
  await (await ctx.pool.createOffering(eblId, supply, 800_000n, 1_000_000n)).wait();
  return (await ctx.pool.nextPoolId()) - 1n;
}

describe('RWAOfferingPool autonomous state machine (WEB3-15/16)', () => {
  it('allows permissionless testnet subscriptions but enforces a pluggable production gate', async () => {
    const ctx = await deployStack();
    const poolId = await createOffering(ctx);
    await (await ctx.pool.connect(ctx.outsider).subscribe(poolId, 1n)).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Subscribed);

    await (await ctx.pool.setComplianceGate(await ctx.gate.getAddress())).wait();
    await (await ctx.pool.setAccessMode(1)).wait();
    await expectRevert(ctx.pool.connect(ctx.investor).subscribe(poolId, 1n), /not eligible/u);
    await (await ctx.gate.setEligible(ctx.investor.address, true)).wait();
    await (await ctx.pool.connect(ctx.investor).subscribe(poolId, 1n)).wait();
    await (await ctx.gate.setPoolEligible(poolId, ctx.investor.address, false)).wait();
    await expectRevert(ctx.pool.connect(ctx.investor).subscribe(poolId, 1n), /not eligible/u);
  });

  it('lets only an authorized executor pause and resume the exact prior state', async () => {
    const ctx = await deployStack();
    const poolId = await createOffering(ctx);
    await expectRevert(ctx.pool.connect(ctx.outsider).pauseOffering(poolId, ethers.id('x')), /not authorized/u);
    await (await ctx.pool.connect(ctx.agent).pauseOffering(poolId, ethers.id('pause'))).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Paused);
    await (await ctx.pool.connect(ctx.agent).resumeOffering(poolId, ethers.id('resume'))).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Open);
    await expectRevert(ctx.pool.connect(ctx.agent).resumeOffering(poolId, ethers.id('again')), /not paused/u);
  });

  it('resumes a paused offering through the oracle RESUME_OFFERING action', async () => {
    const ctx = await deployStack();
    const poolId = await createOffering(ctx);
    await (await ctx.oracle.updatePricing(poolId, 800_000n, 3, ACTION.PAUSE, ethers.id('pause-e'), ethers.id('pause-q'))).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Paused);
    await (await ctx.oracle.updatePricing(poolId, 800_000n, 1, ACTION.RESUME, ethers.id('resume-e'), ethers.id('resume-q'))).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Open);
  });

  it('requires payment and arrival proofs before settlement and rejects duplicates', async () => {
    const ctx = await deployStack();
    const poolId = await createOffering(ctx);
    await expectRevert(ctx.pool.connect(ctx.agent).settle(poolId, 100n), /settlement proof missing/u);
    await (await ctx.pool.connect(ctx.agent).recordImporterPayment(poolId, ethers.id('payment'), 100n)).wait();
    await expectRevert(
      ctx.pool.connect(ctx.agent).recordImporterPayment(poolId, ethers.id('payment-2'), 100n),
      /payment already recorded/u
    );
    await (await ctx.pool.connect(ctx.agent).recordCargoArrival(poolId, ethers.id('arrival'))).wait();
    await (await ctx.pool.connect(ctx.agent).settle(poolId, 100n)).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Repaid);
    await expectRevert(ctx.pool.connect(ctx.agent).settle(poolId, 100n), /bad settlement state/u);
  });

  it('settles a fully funded offering and records an ordered legal lifecycle', async () => {
    const ctx = await deployStack();
    const poolId = await createOffering(ctx, 'funded', 10n);
    await (await ctx.pool.connect(ctx.investor).subscribe(poolId, 10n)).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Funded);
    await (await ctx.pool.connect(ctx.agent).markInTransit(poolId, ethers.id('departure'))).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.InTransit);
    await (await ctx.pool.connect(ctx.agent).recordImporterPayment(poolId, ethers.id('paid'), 10_000_000n)).wait();
    await (await ctx.pool.connect(ctx.agent).recordCargoArrival(poolId, ethers.id('arrived'))).wait();
    await (await ctx.pool.connect(ctx.agent).settle(poolId, 10_000_000n)).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Repaid);
  });

  it('global emergency stop blocks autonomous and investor actions while preserving human pause', async () => {
    const ctx = await deployStack();
    const poolId = await createOffering(ctx);
    await (await ctx.pool.setEmergencyStop(true, ethers.id('incident'))).wait();
    await expectRevert(ctx.pool.connect(ctx.investor).subscribe(poolId, 1n), /emergency stopped/u);
    await expectRevert(
      ctx.oracle.updatePricing(poolId, 700_000n, 2, ACTION.REPRICE, ethers.id('e'), ethers.id('q')),
      /emergency stopped/u
    );
    await (await ctx.pool.emergencyPause(poolId, ethers.id('manual'))).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Paused);
    await (await ctx.pool.setEmergencyStop(false, ethers.id('cleared'))).wait();
    await (await ctx.pool.connect(ctx.agent).resumeOffering(poolId, ethers.id('resume'))).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Open);
  });

  it('rejects executor impersonation, illegal transitions and repayment mismatch', async () => {
    const ctx = await deployStack();
    const poolId = await createOffering(ctx);
    await expectRevert(ctx.pool.connect(ctx.outsider).recordCargoArrival(poolId, ethers.id('arrival')), /not executor/u);
    await expectRevert(ctx.pool.connect(ctx.agent).markInTransit(poolId, ethers.id('departure')), /not funded/u);
    await (await ctx.pool.connect(ctx.agent).recordImporterPayment(poolId, ethers.id('payment'), 100n)).wait();
    await (await ctx.pool.connect(ctx.agent).recordCargoArrival(poolId, ethers.id('arrival'))).wait();
    await expectRevert(ctx.pool.connect(ctx.agent).settle(poolId, 99n), /repayment mismatch/u);
  });

  it('rejects replaying one oracle decision', async () => {
    const ctx = await deployStack();
    const poolId = await createOffering(ctx);
    const args = [poolId, 750_000n, 2, ACTION.REPRICE, ethers.id('replay-e'), ethers.id('replay-q')];
    await (await ctx.oracle.updatePricing(...args)).wait();
    expect(await ctx.pool.stateOf(poolId)).to.equal(STATE.Repriced);
    const decisionId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint256', 'uint8', 'bytes32', 'bytes32'], [args[0], args[1], args[3], args[4], args[5]]
    ));
    expect(await ctx.oracle.isDecisionProcessed(decisionId)).to.equal(true);
    await expectRevert(ctx.oracle.updatePricing(...args), /revert|transaction reverted/u);
  });
});
