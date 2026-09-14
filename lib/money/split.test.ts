import { describe, it, expect } from "vitest";
import { computeSettleUp } from "./split";

describe("computeSettleUp", () => {
  it("is settled when both fronted their 50/50 fair share", () => {
    const result = computeSettleUp({
      annetteFrontedCents: 5000,
      simiFrontedCents: 5000,
      splitNumerator: 1,
      splitDenominator: 2,
    });
    expect(result.owedFrom).toBeNull();
    expect(result.owedTo).toBeNull();
    expect(result.owedCents).toBe(0);
  });

  it("Simi owes Annette when Annette fronted more (50/50)", () => {
    const result = computeSettleUp({
      annetteFrontedCents: 8000,
      simiFrontedCents: 2000,
      splitNumerator: 1,
      splitDenominator: 2,
    });
    expect(result.totalFrontedCents).toBe(10000);
    expect(result.annetteFairShareCents).toBe(5000);
    expect(result.simiFairShareCents).toBe(5000);
    expect(result.owedFrom).toBe("simi");
    expect(result.owedTo).toBe("annette");
    expect(result.owedCents).toBe(3000);
  });

  it("Annette owes Simi when Simi fronted more (50/50)", () => {
    const result = computeSettleUp({
      annetteFrontedCents: 1000,
      simiFrontedCents: 9000,
      splitNumerator: 1,
      splitDenominator: 2,
    });
    expect(result.owedFrom).toBe("annette");
    expect(result.owedTo).toBe("simi");
    expect(result.owedCents).toBe(4000);
  });

  it("respects a non-50/50 split ratio (1/3 Annette, 2/3 Simi)", () => {
    const result = computeSettleUp({
      annetteFrontedCents: 0,
      simiFrontedCents: 9000,
      splitNumerator: 1,
      splitDenominator: 3,
    });
    expect(result.annetteFairShareCents).toBe(3000);
    expect(result.simiFairShareCents).toBe(6000);
    expect(result.owedFrom).toBe("annette");
    expect(result.owedCents).toBe(3000);
  });

  it("handles zero fronted by both", () => {
    const result = computeSettleUp({
      annetteFrontedCents: 0,
      simiFrontedCents: 0,
      splitNumerator: 1,
      splitDenominator: 2,
    });
    expect(result.owedCents).toBe(0);
    expect(result.owedFrom).toBeNull();
  });

  it("is cent-exact even when the total is odd", () => {
    const result = computeSettleUp({
      annetteFrontedCents: 10001,
      simiFrontedCents: 0,
      splitNumerator: 1,
      splitDenominator: 2,
    });
    expect(result.annetteFairShareCents + result.simiFairShareCents).toBe(10001);
  });
});
