import test from 'node:test';
import assert from 'node:assert/strict';
import { TokenLedger } from './token-ledger.mjs';
const make = () => new TokenLedger({ name: 'Toy Credit (SIMULATION)', symbol: 'TOY', maxSupply: 1000n, owner: 'alice' });

test('initial supply is zero and cap immutable', () => {
  const t = make();
  assert.equal(t.totalSupply, 0n);
  assert.equal(t.maxSupply, 1000n);
  assert.equal(t.audit().invariantHolds, true);
});
test('only designated owner can mint', () => {
  const t = make();
  assert.throws(() => t.mint('bob', 'bob', 1n), /NOT_MINTER/);
  assert.equal(t.totalSupply, 0n);
});
test('mint respects cap exactly and cannot overflow it', () => {
  const t = make().mint('alice', 'alice', 1000n);
  assert.equal(t.balanceOf('alice'), 1000n);
  assert.throws(() => t.mint('alice', 'bob', 1n), /CAP_EXCEEDED/);
  assert.equal(t.audit().invariantHolds, true);
});
test('transfer preserves supply and balance sum', () => {
  const t = make().mint('alice', 'alice', 100n).transfer('alice', 'bob', 35n);
  assert.equal(t.balanceOf('alice'), 65n);
  assert.equal(t.balanceOf('bob'), 35n);
  assert.equal(t.totalSupply, 100n);
  assert.equal(t.audit().invariantHolds, true);
});
test('insufficient balance cannot transfer or burn', () => {
  const t = make().mint('alice', 'alice', 1n);
  assert.throws(() => t.transfer('alice', 'bob', 2n), /INSUFFICIENT_BALANCE/);
  assert.throws(() => t.burn('bob', 1n), /INSUFFICIENT_BALANCE/);
  assert.equal(t.totalSupply, 1n);
});
test('approve defines allowance, transferFrom spends it', () => {
  const t = make().mint('alice', 'alice', 50n).approve('alice', 'spender', 20n);
  t.transferFrom('spender', 'alice', 'bob', 17n);
  assert.equal(t.allowance('alice', 'spender'), 3n);
  assert.equal(t.balanceOf('bob'), 17n);
  assert.equal(t.audit().invariantHolds, true);
});
test('unauthorized spender and overallowance cannot transfer', () => {
  const t = make().mint('alice', 'alice', 50n).approve('alice', 'spender', 20n);
  assert.throws(() => t.transferFrom('stranger', 'alice', 'bob', 1n), /INSUFFICIENT_ALLOWANCE/);
  assert.throws(() => t.transferFrom('spender', 'alice', 'bob', 21n), /INSUFFICIENT_ALLOWANCE/);
});
test('failed transferFrom does not burn allowance', () => {
  const t = make().mint('alice', 'alice', 5n).approve('alice', 'spender', 9n);
  assert.throws(() => t.transferFrom('spender', 'alice', 'bob', 7n), /INSUFFICIENT_BALANCE/);
  assert.equal(t.allowance('alice', 'spender'), 9n);
});
test('burn lowers supply without violating invariant', () => {
  const t = make().mint('alice', 'alice', 10n).burn('alice', 7n);
  assert.equal(t.totalSupply, 3n);
  assert.equal(t.audit().invariantHolds, true);
});
test('negative or fractional amounts do not pass', () => {
  const t = make();
  assert.throws(() => t.mint('alice', 'alice', -1n), /INVALID_AMOUNT/);
  assert.throws(() => t.mint('alice', 'alice', 1.5), /INVALID_AMOUNT/);
});
test('unbound identities and zero address do not pass', () => {
  const t = make();
  assert.throws(() => t.mint('alice', '', 1n), /INVALID_IDENTITY/);
  assert.throws(() => t.transfer('alice', '0x0000000000000000000000000000000000000000', 0n), /INVALID_IDENTITY/);
});
test('self transfer is neutral and preserves balances', () => {
  const t = make().mint('alice', 'alice', 55n).transfer('alice', 'alice', 30n);
  assert.equal(t.balanceOf('alice'), 55n);
  assert.equal(t.audit().invariantHolds, true);
});
