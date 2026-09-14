import { db } from "@/lib/db";
import type { ForecastStatus } from "@/lib/types";
import { sum } from "@/lib/money/cents";

export interface ForecastInput {
  budgetCents: number;
  /** Expenses already recorded against the event. */
  paidCents: number;
  /** OPEN PaymentDue rows against the event's vendors. */
  committedCents: number;
  /** Sum of the event's BudgetLine.plannedCents. */
  plannedCents: number;
  /**
   * How much of `plannedCents` the paid + committed money already covers.
   * DESIGN.md §4 writes this as "openPayments coveredByThoseLines";
   * defaults to paid + committed, which is what the app passes — planned
   * lines are per category and every expense and instalment lands in one.
   */
  coveredCents?: number;
}

export interface ForecastResult {
  forecastCents: number;
  status: ForecastStatus;
  /** forecast as a percentage of the envelope, 0 when the envelope is 0. */
  percentOfBudget: number;
}

export interface BurnPoint {
  month: string; // YYYY-MM
  spentCents: number;
}

export interface BurnResult {
  history: BurnPoint[];
  monthsToGo: number;
  averageMonthlyCents: number;
}

/**
 * DESIGN.md §4, pure:
 *   forecastCents = paid + openPayments
 *     + max(0, sum(plannedLines) − paid − openPayments coveredByThoseLines)
 *
 * In words: what has been spent, plus what is already committed, plus
 * whatever the plan still says is coming that neither of those covers.
 */
export function compute(input: ForecastInput): ForecastResult {
  const { budgetCents, paidCents, committedCents, plannedCents } = input;
  const covered = input.coveredCents ?? paidCents + committedCents;
  const uncoveredPlan = Math.max(0, plannedCents - covered);
  const forecastCents = paidCents + committedCents + uncoveredPlan;

  return {
    forecastCents,
    status: statusFor(forecastCents, budgetCents),
    percentOfBudget: budgetCents === 0 ? 0 : Math.round((forecastCents / budgetCents) * 100),
  };
}

/**
 * DESIGN.md §1 thresholds: ON_TRACK ≤ 95% of the envelope, AT_RISK 95–105%,
 * OVER above 105%. Compared in integer cents (`forecast * 100` vs
 * `budget * 95`) so no float ever decides a status.
 *
 * An envelope of 0 has no room: anything above zero is OVER, zero is on track.
 */
export function statusFor(forecastCents: number, budgetCents: number): ForecastStatus {
  if (budgetCents <= 0) return forecastCents <= 0 ? "ON_TRACK" : "OVER";
  const scaled = forecastCents * 100;
  if (scaled <= budgetCents * 95) return "ON_TRACK";
  if (scaled <= budgetCents * 105) return "AT_RISK";
  return "OVER";
}

/**
 * Monthly spend history and how many months are left, used by the digest
 * narrative (DESIGN.md §4).
 */
export async function burn(): Promise<BurnResult> {
  const [expenses, wedding] = await Promise.all([
    db.expense.findMany({ select: { date: true, amountCents: true }, orderBy: { date: "asc" } }),
    db.wedding.findUnique({ where: { id: "main" } }),
  ]);

  const byMonth = new Map<string, number>();
  for (const e of expenses) {
    const month = e.date.toISOString().slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + e.amountCents);
  }
  const history: BurnPoint[] = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, spentCents]) => ({ month, spentCents }));

  const target = wedding?.weddingDate
    ? wedding.weddingDate.toISOString().slice(0, 7)
    : (wedding?.targetMonth ?? "");

  return {
    history,
    monthsToGo: monthsBetween(new Date().toISOString().slice(0, 7), target),
    averageMonthlyCents:
      history.length === 0 ? 0 : Math.round(sum(history.map((h) => h.spentCents)) / history.length),
  };
}

/** Whole months from `fromMonth` to `toMonth`, both "YYYY-MM"; never negative. */
export function monthsBetween(fromMonth: string, toMonth: string): number {
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || !/^\d{4}-\d{2}$/.test(toMonth)) return 0;
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}
