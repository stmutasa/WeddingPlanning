import { describe, it, expect } from "vitest";
import { add, sub, sum, percent, roundHalfEven, splitByRatio, fxToCents } from "./cents";

describe("add/sub/sum", () => {
  it("adds and subtracts integer cents", () => {
    expect(add(100, 50)).toBe(150);
    expect(sub(100, 50)).toBe(50);
    expect(add(-100, 50)).toBe(-50);
  });

  it("sums an array, including empty and negative values", () => {
    expect(sum([100, 200, 300])).toBe(600);
    expect(sum([])).toBe(0);
    expect(sum([100, -50])).toBe(50);
  });
});

describe("roundHalfEven", () => {
  it("rounds .5 to the nearest even integer", () => {
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(3.5)).toBe(4);
  });

  it("rounds normally away from the .5 boundary", () => {
    expect(roundHalfEven(1.2)).toBe(1);
    expect(roundHalfEven(1.8)).toBe(2);
    expect(roundHalfEven(-1.5)).toBe(-2);
  });
});

describe("percent", () => {
  it("computes a rounded percentage", () => {
    expect(percent(50, 100)).toBe(50);
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
  });

  it("returns 0 for a zero whole instead of dividing by zero", () => {
    expect(percent(50, 0)).toBe(0);
    expect(percent(0, 0)).toBe(0);
  });

  it("handles negative parts", () => {
    expect(percent(-50, 100)).toBe(-50);
  });
});

describe("splitByRatio", () => {
  it("splits evenly in half, cent-exact", () => {
    const [a, b] = splitByRatio(100, [1, 1]);
    expect(a + b).toBe(100);
    expect(a).toBe(50);
    expect(b).toBe(50);
  });

  it("splits an odd amount in half without losing a cent", () => {
    const [a, b] = splitByRatio(101, [1, 1]);
    expect(a + b).toBe(101);
    expect([a, b].sort()).toEqual([50, 51]);
  });

  it("splits into thirds, cent-exact", () => {
    const shares = splitByRatio(100, [1, 1, 1]);
    expect(sum(shares)).toBe(100);
    expect(shares.sort((x, y) => x - y)).toEqual([33, 33, 34]);
  });

  it("handles a zero amount", () => {
    expect(splitByRatio(0, [1, 1])).toEqual([0, 0]);
  });

  it("handles a negative amount, preserving sign and cent-exactness", () => {
    const shares = splitByRatio(-101, [1, 1]);
    expect(sum(shares)).toBe(-101);
    shares.forEach((s) => expect(s).toBeLessThanOrEqual(0));
  });

  it("supports unequal ratios (1/2 and 1/3 style splits)", () => {
    const [annette, simi] = splitByRatio(9000, [1, 2]); // 1/3 vs 2/3
    expect(annette + simi).toBe(9000);
    expect(annette).toBe(3000);
    expect(simi).toBe(6000);
  });

  it("returns an empty array for no ratios", () => {
    expect(splitByRatio(100, [])).toEqual([]);
  });
});

describe("fxToCents", () => {
  it("converts an original-currency amount to USD cents", () => {
    // 15,000 KES at an example rate of 1 KES = 0.0077 USD -> $115.50
    expect(fxToCents(15000, 0.0077)).toBe(11550);
  });

  it("handles a zero amount", () => {
    expect(fxToCents(0, 0.0077)).toBe(0);
  });

  it("handles a zero rate", () => {
    expect(fxToCents(500, 0)).toBe(0);
  });

  it("uses round-half-even at an exact .5 cent boundary", () => {
    // 0.5 cents at odd base -> rounds to nearest even cent
    expect(fxToCents(0.5, 0.01)).toBe(0); // 0.005 -> rounds to 0
  });

  it("handles a negative amount (refund/credit)", () => {
    expect(fxToCents(-100, 0.5)).toBe(-5000);
  });
});
