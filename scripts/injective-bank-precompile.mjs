/** SP-5: live read/write spike for Injective's Bank precompile and MTS USDC. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { ethers } from 'ethers';
import {
  BANK_PRECOMPILE,
  CANONICAL_USDC,
  INJECTIVE_TESTNET,
  createCanonicalUsdc,
  readCanonicalUsdcParity
} from '../src/injective/precompiles.js';
import { atomicJson, loadDotEnv, requiredEnv, waitBlockscoutTransaction } from './lib/injective-live.mjs';

const root = path.resolve(import.meta.dirname, '..');
const live = process.argv.includes('--live');
const explorerApi = 'https://testnet.blockscout-api.injective.network/api/v2';
const defaultAccount = '0xFf86f010D005d15bd43e1f254C12ACabEFae218d';

await loadDotEnv(root);
const provider = new ethers.JsonRpcProvider(
  process.env.INJECTIVE_RPC_URL?.trim() || INJECTIVE_TESTNET.rpcUrl,
  INJECTIVE_TESTNET.chainId,
  { staticNetwork: true }
);

try {
  const network = await provider.getNetwork();
  assert.equal(network.chainId, 1439n, 'SP-5 is pinned to Injective Testnet chain 1439');
  const account = live
    ? new ethers.Wallet(requiredEnv('DEPLOYER_PRIVATE_KEY')).address
    : (process.env.SP5_ACCOUNT?.trim() || defaultAccount);
  const before = await readCanonicalUsdcParity(provider, account);
  assert.equal(before.parity, true, 'Bank and ERC-20 USDC views must agree');

  if (!live) {
    console.log(JSON.stringify({
      mode: 'read-only',
      network: INJECTIVE_TESTNET.network,
      bank_precompile: BANK_PRECOMPILE,
      result: before
    }, null, 2));
    console.log('SP-5 READ PASS - canonical USDC is one MTS balance in ERC-20 and x/bank views');
    process.exitCode = 0;
  } else {
    if (process.env.SP5_LIVE_CONFIRM !== 'injective-testnet') {
      throw new Error('Set SP5_LIVE_CONFIRM=injective-testnet to approve the 1-atomic test-only self-transfer');
    }
    const signer = new ethers.Wallet(requiredEnv('DEPLOYER_PRIVATE_KEY'), provider);
    assert.equal(signer.address, ethers.getAddress(account));
    assert.ok(BigInt(before.bank.balance) >= 1n, 'The test wallet has no canonical testnet USDC');
    assert.ok(await provider.getBalance(signer.address) > 0n, 'The test wallet has no testnet INJ for gas');

    // BankERC20._update calls 0x64.transfer(from, to, amount). Calling 0x64
    // directly from an EOA would identify the EOA itself as the token contract.
    const token = createCanonicalUsdc(signer);
    const amount = 1n;
    const simulated = await token.transfer.staticCall(signer.address, amount);
    assert.equal(simulated, true, 'MTS USDC transfer simulation returned false');
    const tx = await token.transfer(signer.address, amount, {
      gasLimit: 300_000n,
      gasPrice: 500_000_000n
    });
    const transaction = await waitBlockscoutTransaction(tx.hash, explorerApi);
    const after = await readCanonicalUsdcParity(provider, signer.address);
    assert.equal(after.parity, true);
    assert.equal(after.bank.balance, before.bank.balance, 'Test-only self-transfer must preserve the canonical balance');
    assert.equal(transaction.to?.hash?.toLowerCase(), CANONICAL_USDC.toLowerCase());
    assert.equal(transaction.raw_input?.slice(0, 10).toLowerCase(), token.interface.getFunction('transfer').selector.toLowerCase());

    const evidence = {
      schema: 'agentbl-injective-bank-precompile-v1',
      verified_at: new Date().toISOString(),
      network: INJECTIVE_TESTNET.network,
      chain_id: INJECTIVE_TESTNET.chainId,
      official_precompile: BANK_PRECOMPILE,
      asset: CANONICAL_USDC,
      denom: before.denom,
      account: signer.address,
      read: { before, after },
      write: {
        kind: 'test-only-mts-self-transfer',
        entrypoint: CANONICAL_USDC,
        native_state_transition: `${BANK_PRECOMPILE}.transfer(from,to,amount)`,
        amount_atomic: amount.toString(),
        balance_preserved: true,
        tx_hash: tx.hash,
        explorer: `${INJECTIVE_TESTNET.explorerUrl}/tx/${tx.hash}`,
        status: transaction.status
      },
      decision: {
        usdc_bank_precompile: 'promote-to-p0',
        current_rwa_token: 'defer-mapping',
        rationale: 'Use native MTS USDC now. The current RWAToken is a multi-pool receipt, not ERC-20; V2 needs one MTS-compatible fungible contract per pool before native mapping.'
      },
      secrets_logged: false
    };
    const output = path.join(root, 'docs', 'evidence', 'injective-bank-precompile.json');
    await atomicJson(output, evidence);
    console.log('SP-5 PASS - real Bank precompile read/write verified on Injective Testnet');
    console.log(`  tx:       ${evidence.write.explorer}`);
    console.log(`  evidence: ${output}`);
  }
} finally {
  await provider.destroy();
}
