// Offline ERC-20 accounting lab ONLY. No blockchain deployment, wallets, network or real value.
const requireIdentity = (id) => {
  if (typeof id !== 'string' || !id.trim() || id === '0x0000000000000000000000000000000000000000') {
    throw new Error('INVALID_IDENTITY');
  }
  return id;
};
const amount = (n) => {
  if (typeof n !== 'bigint' || n < 0n) throw new Error('INVALID_AMOUNT');
  return n;
};
export class TokenLedger {
  #balances = new Map();
  #allowances = new Map();
  #supply = 0n;
  constructor({ name, symbol, maxSupply, owner }) {
    this.name = String(name || '');
    this.symbol = String(symbol || '');
    this.owner = requireIdentity(owner);
    this.maxSupply = amount(maxSupply);
    if (!this.name || !this.symbol || this.maxSupply === 0n) throw new Error('INVALID_TOKEN_SPEC');
  }
  get totalSupply() { return this.#supply; }
  balanceOf(account) { return this.#balances.get(requireIdentity(account)) ?? 0n; }
  allowance(holder, spender) {
    return this.#allowances.get(requireIdentity(holder))?.get(requireIdentity(spender)) ?? 0n;
  }
  mint(caller, recipient, n) {
    if (requireIdentity(caller) !== this.owner) throw new Error('NOT_MINTER');
    requireIdentity(recipient); amount(n);
    if (this.#supply + n > this.maxSupply) throw new Error('CAP_EXCEEDED');
    this.#balances.set(recipient, this.balanceOf(recipient) + n);
    this.#supply += n;
    return this;
  }
  transfer(sender, recipient, n) {
    requireIdentity(sender); requireIdentity(recipient); amount(n);
    if (this.balanceOf(sender) < n) throw new Error('INSUFFICIENT_BALANCE');
    if (sender === recipient || n === 0n) return this;
    this.#balances.set(sender, this.balanceOf(sender) - n);
    this.#balances.set(recipient, this.balanceOf(recipient) + n);
    return this;
  }
  approve(holder, spender, n) {
    requireIdentity(holder); requireIdentity(spender); amount(n);
    if (!this.#allowances.has(holder)) this.#allowances.set(holder, new Map());
    this.#allowances.get(holder).set(spender, n);
    return this;
  }
  transferFrom(spender, holder, recipient, n) {
    requireIdentity(spender); requireIdentity(holder); requireIdentity(recipient); amount(n);
    const allowed = this.allowance(holder, spender);
    if (allowed < n) throw new Error('INSUFFICIENT_ALLOWANCE');
    if (this.balanceOf(holder) < n) throw new Error('INSUFFICIENT_BALANCE');
    this.transfer(holder, recipient, n);
    this.#allowances.get(holder).set(spender, allowed - n);
    return this;
  }
  burn(holder, n) {
    requireIdentity(holder); amount(n);
    if (this.balanceOf(holder) < n) throw new Error('INSUFFICIENT_BALANCE');
    this.#balances.set(holder, this.balanceOf(holder) - n);
    this.#supply -= n;
    return this;
  }
  audit() {
    const balances = [...this.#balances.values()];
    const sum = balances.reduce((x, y) => x + y, 0n);
    return {
      invariantHolds: sum === this.#supply && this.#supply <= this.maxSupply,
      supply: this.#supply.toString(),
      accounted: sum.toString(),
      balances: Object.fromEntries([...this.#balances].map(([k, v]) => [k, v.toString()])),
    };
  }
}
