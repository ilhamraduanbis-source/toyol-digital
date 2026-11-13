// Mech Market budget-ledger candidate. Pure, deterministic, JSON-serializable.
// Author: Toyol Digital. Not yet submitted to Forge.
function fail(code) { throw Object.assign(new Error(code), { code }); }
function micros(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_MICROS');
  return value;
}
function keyOf(key) {
  if (typeof key !== 'string' || !key.length || key.length > 1024) fail('INVALID_RESERVATION_KEY');
  return key;
}
function validate(ledger) {
  if (!ledger || typeof ledger !== 'object' || !ledger.reservations ||
      typeof ledger.reservations !== 'object' || Array.isArray(ledger.reservations)) fail('INVALID_LEDGER');
  const { capMicros, committedMicros, spentMicros } = ledger;
  micros(capMicros); micros(committedMicros); micros(spentMicros);
  if (spentMicros > capMicros || committedMicros > capMicros - spentMicros) fail('BUDGET_EXCEEDED');
  let committed = 0, spent = 0;
  for (const entry of Object.values(ledger.reservations)) {
    if (!entry || typeof entry !== 'object') fail('INVALID_RESERVATION');
    micros(entry.amountMicros);
    if (entry.state === 'reserved') {
      committed += entry.amountMicros;
    } else if (entry.state === 'settled') {
      micros(entry.paidMicros);
      if (entry.paidMicros > entry.amountMicros) fail('OVER_SETTLEMENT');
      spent += entry.paidMicros;
    } else if (entry.state !== 'released') fail('INVALID_RESERVATION_STATE');
    if (!Number.isSafeInteger(committed) || !Number.isSafeInteger(spent)) fail('INVALID_MICROS');
  }
  if (committed !== committedMicros || spent !== spentMicros) fail('LEDGER_TOTAL_MISMATCH');
}
function get(ledger, key) {
  return Object.hasOwn(ledger.reservations, key) ? ledger.reservations[key] : null;
}
function update(ledger, key, entry, committedMicros, spentMicros) {
  return { ...ledger, committedMicros, spentMicros,
    reservations: { ...ledger.reservations, [key]: entry } };
}
export function createBudget(capMicros) {
  return { capMicros: micros(capMicros), committedMicros: 0, spentMicros: 0, reservations: {} };
}
export function reserveBudget(ledger, key, amount) {
  validate(ledger); keyOf(key); micros(amount);
  const prior = get(ledger, key);
  if (prior) {
    if (prior.amountMicros !== amount) fail('RESERVATION_AMOUNT_CHANGED');
    // A replay cannot revive a released or settled reservation.
    return ledger;
  }
  if (amount > ledger.capMicros - ledger.spentMicros - ledger.committedMicros) fail('BUDGET_EXCEEDED');
  return update(ledger, key, { state: 'reserved', amountMicros: amount },
    ledger.committedMicros + amount, ledger.spentMicros);
}
export function settleBudget(ledger, key, paidMicros) {
  validate(ledger); keyOf(key); micros(paidMicros);
  const prior = get(ledger, key);
  if (!prior) fail('UNKNOWN_RESERVATION');
  if (prior.state === 'settled') {
    if (prior.paidMicros !== paidMicros) fail('SETTLEMENT_AMOUNT_CHANGED');
    return ledger;
  }
  if (prior.state !== 'reserved') fail('RESERVATION_NOT_ACTIVE');
  if (paidMicros > prior.amountMicros) fail('OVER_SETTLEMENT');
  return update(ledger, key, { ...prior, state: 'settled', paidMicros },
    ledger.committedMicros - prior.amountMicros, ledger.spentMicros + paidMicros);
}
export function releaseBudget(ledger, key) {
  validate(ledger); keyOf(key);
  const prior = get(ledger, key);
  if (!prior) fail('UNKNOWN_RESERVATION');
  if (prior.state === 'released') return ledger;
  if (prior.state !== 'reserved') fail('RESERVATION_NOT_ACTIVE');
  return update(ledger, key, { ...prior, state: 'released' },
    ledger.committedMicros - prior.amountMicros, ledger.spentMicros);
}
