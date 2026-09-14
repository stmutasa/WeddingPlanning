import { describe, it, expect } from "vitest";
import { compute, statusFor, monthsBetween } from "./forecast";

describe("forecast.compute", () => {
  it("is paid + committed when there are no planned lines", () => {
    const r = compute({
      budgetCents: 1_000_000,
      paidCents: 200_000,
      committedCents: 300_000,
      plannedCents: 0,
    });
    expect(r.forecastCents).toBe(500_000);
    expect(r.status).toBe("ON_TRACK");
  });

  it("adds only the part of the plan that paid + committed does not cover", () => {
    const r = compute({
      budgetCents: 1_000_000,
      paidCents: 200_000,
      committedCents: 100_000,
      plannedCents: 800_000,
    });
    // 300,000 covered, 500,000 of plan still to come.
    expect(r.forecastCents).toBe(800_000);
  });

  it("never subtracts when the plan is already over-covered", () => {
    const r = compute({
      budgetCents: 1_000_000,
      paidCents: 900_000,
      committedCents: 0,
      plannedCents: 400_000,
    });
    expect(r.forecastCents).toBe(900_000);
  });

  it("honours an explicit coveredCents", () => {
    const r = compute({
      budgetCents: 1_000_000,
      paidCents: 200_000,
      committedCents: 300_000,
      plannedCents: 900_000,
      coveredCents: 100_000,
    });
    expect(r.forecastCents).toBe(200_000 + 300_000 + 800_000);
  });

  it("reports the percentage of the envelope", () => {
    const r = compute({
      budgetCents: 800_000,
      paidCents: 400_000,
      committedCents: 0,
      plannedCents: 0,
    });
    expect(r.percentOfBudget).toBe(50);
  });
});

describe("forecast.statusFor thresholds (DESIGN.md §1)", () => {
  const envelope = 1_000_000; // $10,000

  it("is ON_TRACK at and below 95%", () => {
    expect(statusFor(0, envelope)).toBe("ON_TRACK");
    expect(statusFor(949_999, envelope)).toBe("ON_TRACK");
    expect(statusFor(950_000, envelope)).toBe("ON_TRACK");
  });

  it("is AT_RISK between 95% and 105%", () => {
    expect(statusFor(950_001, envelope)).toBe("AT_RISK");
    expect(statusFor(1_000_000, envelope)).toBe("AT_RISK");
    expect(statusFor(1_050_000, envelope)).toBe("AT_RISK");
  });

  it("is OVER above 105%", () => {
    expect(statusFor(1_050_001, envelope)).toBe("OVER");
    expect(statusFor(2_000_000, envelope)).toBe("OVER");
  });

  it("treats a zero envelope as having no room", () => {
    expect(statusFor(0, 0)).toBe("ON_TRACK");
    expect(statusFor(1, 0)).toBe("OVER");
  });

  it("decides the boundary in integer cents, not floats", () => {
    // 3 cents of a 1000-cent envelope must not be nudged by 0.1*3 float noise.
    expect(statusFor(950, 1000)).toBe("ON_TRACK");
    expect(statusFor(951, 1000)).toBe("AT_RISK");
    expect(statusFor(1050, 1000)).toBe("AT_RISK");
    expect(statusFor(1051, 1000)).toBe("OVER");
  });
});

describe("forecast.monthsBetween", () => {
  it("counts whole months across a year boundary", () => {
    expect(monthsBetween("2026-09", "2027-08")).toBe(11);
  });

  it("is zero for the same month and never negative", () => {
    expect(monthsBetween("2027-08", "2027-08")).toBe(0);
    expect(monthsBetween("2027-09", "2027-08")).toBe(0);
  });

  it("is zero for malformed input", () => {
    expect(monthsBetween("2026-09", "")).toBe(0);
  });
});
