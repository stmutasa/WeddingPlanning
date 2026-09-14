import { describe, it, expect } from "vitest";
import { formatUSD, formatUSDSigned, formatKESSecondary, formatOriginal } from "./format";

describe("formatUSD", () => {
  it("formats whole dollars over $100 with no decimals", () => {
    expect(formatUSD(4358000)).toBe("$43,580");
  });

  it("formats amounts under $100 with cents", () => {
    expect(formatUSD(4325)).toBe("$43.25");
  });

  it("shows cents when detail is requested even for large amounts", () => {
    expect(formatUSD(4358025, { detail: true })).toBe("$43,580.25");
  });

  it("formats zero", () => {
    expect(formatUSD(0)).toBe("$0.00");
  });

  it("formats negative amounts", () => {
    expect(formatUSD(-500)).toBe("-$5.00");
  });
});

describe("formatUSDSigned", () => {
  it("prefixes a plus for positive amounts", () => {
    expect(formatUSDSigned(12000)).toBe("+$120");
  });
  it("prefixes a minus for negative amounts", () => {
    expect(formatUSDSigned(-12000)).toBe("-$120");
  });
  it("has no sign for zero", () => {
    expect(formatUSDSigned(0)).toBe("$0.00");
  });
});

describe("formatKESSecondary", () => {
  it("formats a KES conversion line", () => {
    expect(formatKESSecondary(10000, 130)).toBe("≈ KES 13,000");
  });
  it("rounds to the nearest whole KES", () => {
    expect(formatKESSecondary(1, 130)).toBe("≈ KES 1");
  });
});

describe("formatOriginal", () => {
  it("formats USD with the currency symbol", () => {
    expect(formatOriginal(43.5, "USD")).toBe("$43.50");
  });
  it("formats a non-USD currency with its code", () => {
    expect(formatOriginal(15000, "KES")).toBe("KES 15,000");
  });
});
