import { describe, it, expect } from "vitest";
import { applySettlements } from "./settle";
import { computeSettleUp } from "@/lib/money/split";

const ANNETTE = "user_annette";
const SIMI = "user_simi";

/**
 * DESIGN.md §1 settle-up: only `USER` funder money is fronted, the pair
 * split it by `Wedding.splitNumerator/Denominator`, and a settlement that
 * has been paid must leave them reading as square.
 */
describe("settle.applySettlements", () => {
  it("is a no-op when nothing has been settled", () => {
    const net = applySettlements({
      annetteFrontedCents: 400_000,
      simiFrontedCents: 11_538,
      annetteUserId: ANNETTE,
      simiUserId: SIMI,
      settlements: [],
    });
    expect(net).toEqual({ annetteNetCents: 400_000, simiNetCents: 11_538 });
  });

  it("moves the payer up and the receiver down by the same amount", () => {
    const net = applySettlements({
      annetteFrontedCents: 400_000,
      simiFrontedCents: 0,
      annetteUserId: ANNETTE,
      simiUserId: SIMI,
      settlements: [{ fromUserId: SIMI, toUserId: ANNETTE, amountCents: 200_000 }],
    });
    expect(net.simiNetCents).toBe(200_000);
    expect(net.annetteNetCents).toBe(200_000);
    // The pair's total spend never changes.
    expect(net.annetteNetCents + net.simiNetCents).toBe(400_000);
  });

  it("squares a pair once the exact owed amount has been paid", () => {
    const annetteFrontedCents = 400_000;
    const simiFrontedCents = 11_538;

    const before = computeSettleUp({
      annetteFrontedCents,
      simiFrontedCents,
      splitNumerator: 1,
      splitDenominator: 2,
    });
    expect(before.owedFrom).toBe("simi");
    expect(before.owedCents).toBe(194_231);

    const net = applySettlements({
      annetteFrontedCents,
      simiFrontedCents,
      annetteUserId: ANNETTE,
      simiUserId: SIMI,
      settlements: [{ fromUserId: SIMI, toUserId: ANNETTE, amountCents: before.owedCents }],
    });

    const after = computeSettleUp({
      annetteFrontedCents: net.annetteNetCents,
      simiFrontedCents: net.simiNetCents,
      splitNumerator: 1,
      splitDenominator: 2,
    });
    expect(after.owedCents).toBe(0);
    expect(after.owedFrom).toBeNull();
  });

  it("accumulates several settlements in both directions", () => {
    const net = applySettlements({
      annetteFrontedCents: 100_000,
      simiFrontedCents: 100_000,
      annetteUserId: ANNETTE,
      simiUserId: SIMI,
      settlements: [
        { fromUserId: SIMI, toUserId: ANNETTE, amountCents: 30_000 },
        { fromUserId: ANNETTE, toUserId: SIMI, amountCents: 10_000 },
      ],
    });
    expect(net.simiNetCents).toBe(100_000 + 30_000 - 10_000);
    expect(net.annetteNetCents).toBe(100_000 - 30_000 + 10_000);
  });

  it("ignores settlements involving somebody else entirely", () => {
    const net = applySettlements({
      annetteFrontedCents: 50_000,
      simiFrontedCents: 50_000,
      annetteUserId: ANNETTE,
      simiUserId: SIMI,
      settlements: [{ fromUserId: "user_mum", toUserId: "user_dad", amountCents: 99_999 }],
    });
    expect(net).toEqual({ annetteNetCents: 50_000, simiNetCents: 50_000 });
  });

  it("copes with a user who has never signed in", () => {
    const net = applySettlements({
      annetteFrontedCents: 50_000,
      simiFrontedCents: 0,
      annetteUserId: null,
      simiUserId: SIMI,
      settlements: [{ fromUserId: SIMI, toUserId: ANNETTE, amountCents: 25_000 }],
    });
    expect(net.simiNetCents).toBe(25_000);
    expect(net.annetteNetCents).toBe(50_000);
  });
});

describe("settle-up ratio (DESIGN.md §1)", () => {
  it("honours a non-even split", () => {
    // 1/3 to Annette, 2/3 to Simi, over $900 of joint personal spending.
    const result = computeSettleUp({
      annetteFrontedCents: 90_000,
      simiFrontedCents: 0,
      splitNumerator: 1,
      splitDenominator: 3,
    });
    expect(result.annetteFairShareCents).toBe(30_000);
    expect(result.simiFairShareCents).toBe(60_000);
    expect(result.owedFrom).toBe("simi");
    expect(result.owedCents).toBe(60_000);
  });

  it("never loses a cent to rounding", () => {
    const result = computeSettleUp({
      annetteFrontedCents: 33_333,
      simiFrontedCents: 0,
      splitNumerator: 1,
      splitDenominator: 2,
    });
    expect(result.annetteFairShareCents + result.simiFairShareCents).toBe(33_333);
  });
});
