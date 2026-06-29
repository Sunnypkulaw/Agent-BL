const { expect } = require('chai');
const { ethers } = require('hardhat');

const metadata = {
  vessel: 'MV Pacific Dawn',
  voyage: 'PD-2026-0618',
  portOfLoading: 'Singapore',
  portOfDischarge: 'Shanghai',
  cargo: 'Copper Cathodes Grade A',
  quantity: 5_000n,
  quantityUnit: 'MT',
  hsCode: '740311',
  declaredValueUsdE6: 42_000_000_000_000n,
  incoterms: 'CIF',
  mletr: true,
  eucp: true,
  dcsa: true
};

async function expectRevert(promise, reason) {
  try {
    const transaction = await promise;
    await transaction.wait();
  } catch (error) {
    expect(error.message).to.include(reason);
    return;
  }
  throw new Error(`Expected transaction to revert with: ${reason}`);
}

async function deployRegistry() {
  const [owner, holder, nextHolder, thirdHolder] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory('EBLRegistry');
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  return { owner, holder, nextHolder, thirdHolder, registry };
}

async function mintV2(ctx, cargo = 'cargo-1') {
  const cargoHash = ethers.id(cargo);
  const metadataHash = ethers.id(`${cargo}:metadata`);
  await (await ctx.registry.mintEBLV2(cargoHash, metadataHash, ctx.holder.address, metadata)).wait();
  return { eblId: 1, cargoHash, metadataHash };
}

describe('EBLRegistry V2', () => {
  it('registers one unique cargo with structured trade metadata', async () => {
    const ctx = await deployRegistry();
    const minted = await mintV2(ctx);
    expect(await ctx.registry.isUnique(minted.cargoHash)).to.equal(false);
    expect(await ctx.registry.eblIdForCargo(minted.cargoHash)).to.equal(1n);
    expect(await ctx.registry.cargoHashOf(1)).to.equal(minted.cargoHash);
    const stored = await ctx.registry.metadataOf(1);
    expect(stored.vessel).to.equal(metadata.vessel);
    expect(stored.hsCode).to.equal(metadata.hsCode);
    expect(stored.declaredValueUsdE6).to.equal(metadata.declaredValueUsdE6);
    expect(stored.mletr && stored.eucp && stored.dcsa).to.equal(true);
  });

  it('rejects duplicate cargoHash while accepting a distinct cargo', async () => {
    const ctx = await deployRegistry();
    const minted = await mintV2(ctx);
    await expectRevert(
      ctx.registry.mintEBLV2(minted.cargoHash, ethers.id('other metadata'), ctx.holder.address, metadata)
    , 'cargo already registered');
    await (await ctx.registry.mintEBLV2(
      ethers.id('cargo-2'), ethers.id('cargo-2 metadata'), ctx.holder.address, metadata
    )).wait();
  });

  it('records ordered transfer and endorsement history', async () => {
    const ctx = await deployRegistry();
    await mintV2(ctx);
    await (await ctx.registry.connect(ctx.holder).transfer(1, ctx.nextHolder.address)).wait();
    const endorsementHash = ethers.id('endorsement-2');
    await (await ctx.registry.connect(ctx.nextHolder).endorse(1, ctx.thirdHolder.address, endorsementHash)).wait();
    expect(await ctx.registry.holderOf(1)).to.equal(ctx.thirdHolder.address);
    const history = await ctx.registry.getTransferHistory(1);
    expect(history).to.have.length(3);
    expect(history[1].from).to.equal(ctx.holder.address);
    expect(history[1].to).to.equal(ctx.nextHolder.address);
    expect(history[2].to).to.equal(ctx.thirdHolder.address);
    expect(history[2].endorsementHash).to.equal(endorsementHash);
    expect(history[2].timestamp >= history[1].timestamp).to.equal(true);
  });

  it('locks transfers while pledged and releases custody safely', async () => {
    const ctx = await deployRegistry();
    await mintV2(ctx);
    await (await ctx.registry.connect(ctx.holder).pledge(1, ctx.owner.address)).wait();
    await expectRevert(ctx.registry.connect(ctx.holder).transfer(1, ctx.nextHolder.address), 'ebl pledged');
    await (await ctx.registry.releasePledge(1)).wait();
    await (await ctx.registry.connect(ctx.holder).transfer(1, ctx.nextHolder.address)).wait();
  });

  it('prevents an offering from opening before the eBL is pledged to that pool', async () => {
    const ctx = await deployRegistry();
    await mintV2(ctx);
    const Token = await ethers.getContractFactory('RWAToken');
    const token = await Token.deploy();
    await token.waitForDeployment();
    const Pool = await ethers.getContractFactory('RWAOfferingPool');
    const pool = await Pool.deploy(await ctx.registry.getAddress(), await token.getAddress());
    await pool.waitForDeployment();
    await expectRevert(
      pool.createOffering(1, 1_000_000n, 800_000n, 1_000_000n),
      'ebl not pledged to pool'
    );
    await (await ctx.registry.connect(ctx.holder).pledge(1, await pool.getAddress())).wait();
    await (await pool.createOffering(1, 1_000_000n, 800_000n, 1_000_000n)).wait();
  });
});
