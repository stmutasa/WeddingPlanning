import { describe, it, expect } from "vitest";
import { convertToCents, toExpenseRate } from "./fx";
import { fxToCents } from "@/lib/money/cents";

/**
 * DESIGN.md §1: "the expense stores `amountCents` (USD) plus
 * `originalAmount`, `originalCurrency`, `fxRate` for the audit trail". The
 * two directions are easy to confuse, so they are pinned down here.
 */
describe("fx conversion", () => {
  const USD_TO_KES = 130;

  it("inverts the API direction into the one stored on the expense", () => {
    expect(toExpenseRate(USD_TO_KES)).toBeCloseTo(1 / 130, 15);
    expect(toExpenseRate(1)).toBe(1);
  });

  it("round-trips through the stored rate", () => {
    const stored = toExpenseRate(USD_TO_KES);
    expect(fxToCents(15_000, stored)).toBe(convertToCents(15_000, USD_TO_KES));
  });

  it("converts a KES receipt to integer USD cents", () => {
    // KES 15,000 at 130 per USD is $115.3846… which lands on 11,538 cents.
    expect(convertToCents(15_000, USD_TO_KES)).toBe(11_538);
    // KES 35,000 is $269.23.
    expect(convertToCents(35_000, USD_TO_KES)).toBe(26_923);
  });

  it("is exact for a USD amount", () => {
    expect(convertToCents(800, 1)).toBe(80_000);
    expect(convertToCents(1_234.56, 1)).toBe(123_456);
  });

  it("always returns an integer number of cents", () => {
    for (const amount of [1, 7, 99, 1_000, 15_000, 123_456]) {
      const cents = convertToCents(amount, 129.37);
      expect(Number.isInteger(cents)).toBe(true);
    }
  });

  it("does not drift upward across many conversions", () => {
    // Round-half-up would bias this sum high; round-half-even should not.
    // 0.5-cent cases: an amount of 2n+1 half-cents at a rate of 1 USD = 200.
    const rate = 200;
    let total = 0;
    for (let i = 1; i <= 100; i++) total += convertToCents(i, rate);
    // Exact arithmetic: sum(i/200 * 100) = sum(i/2) = 2525 cents.
    expect(total).toBe(2_525);
  });

  it("handles a small currency unit without losing the amount", () => {
    // 1,000,000 KES is a real Ruracio-sized number.
    expect(convertToCents(1_000_000, USD_TO_KES)).toBe(769_231);
  });
});
