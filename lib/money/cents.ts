/**
 * All money in this app is an integer number of USD cents. Never floats,
 * never arithmetic on money in the UI layer or the Prisma models — only here.
 */

export function add(a: number, b: number): number {
  return a + b;
}

export function sub(a: number, b: number): number {
  return a - b;
}

export function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/**
 * Percentage of `whole` that `part` represents, rounded to the nearest whole
 * percentage point with round-half-to-even (banker's rounding) at the .5
 * boundary. Returns 0 when `whole` is 0 (avoids divide-by-zero).
 */
export function percent(part: number, whole: number): number {
  if (whole === 0) return 0;
  return roundHalfEven((part / whole) * 100);
}

/**
 * Round-half-to-even ("banker's rounding"): 0.5 rounds to the nearest even
 * integer instead of always up. This avoids the systematic upward bias that
 * plain Math.round introduces across many roundings (e.g. FX conversions
 * applied to hundreds of expenses) — a chain of round-half-up conversions
 * drifts high on average, round-half-even does not.
 *   roundHalfEven(0.5) === 0
 *   roundHalfEven(1.5) === 2
 *   roundHalfEven(2.5) === 2
 */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  const epsilon = 1e-9; // guard float noise around the .5 boundary
  if (Math.abs(diff - 0.5) < epsilon) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(value);
}

/**
 * Split `amountCents` into shares proportional to `ratios` (need not sum to
 * exactly 1; they are normalized). Shares are integer cents and always sum
 * back to exactly `amountCents` — the largest-remainder method assigns each
 * leftover cent, one at a time, to the share(s) with the largest fractional
 * remainder (ties broken by earliest index), so the split is deterministic
 * and never loses or invents a cent.
 *
 * Negative amounts are supported by splitting the absolute value and
 * reapplying the sign, so ratios behave the same regardless of sign.
 */
export function splitByRatio(amountCents: number, ratios: number[]): number[] {
  if (ratios.length === 0) return [];
  const sign = amountCents < 0 ? -1 : 1;
  const abs = Math.abs(amountCents);
  const ratioSum = sum(ratios.map((r) => Math.abs(r))) || 1;

  const raw = ratios.map((r) => (Math.abs(r) / ratioSum) * abs);
  const floors = raw.map((v) => Math.floor(v));
  let remainder = abs - sum(floors);

  const order = raw
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const shares = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) {
    shares[order[k].i] += 1;
  }

  return shares.map((c) => c * sign);
}

/**
 * Convert an amount in the original (non-USD) currency to USD cents, given
 * an fx rate expressed as "1 unit of original currency = `rate` USD"
 * (DESIGN.md's `Expense.fxRate`: "original -> USD"). Uses round-half-even so
 * repeated conversions don't drift.
 */
export function fxToCents(originalAmount: number, rate: number): number {
  return roundHalfEven(originalAmount * rate * 100);
}
