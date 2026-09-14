import type { ForecastStatus } from "@/lib/types";
import { NotImplemented } from "./errors";

export interface ForecastInput {
  budgetCents: number;
  paidCents: number;
  committedCents: number;
  plannedCents: number;
}

export interface ForecastResult {
  forecastCents: number;
  status: ForecastStatus;
}

export interface BurnPoint {
  month: string; // YYYY-MM
  spentCents: number;
}

export interface BurnResult {
  history: BurnPoint[];
  monthsToGo: number;
}

/**
 * DESIGN.md §4 (pure, tested once implemented):
 *   forecastCents = paid + openPayments
 *     + max(0, sum(plannedLines) - paid - openPayments coveredByThoseLines)
 * Status: ON_TRACK <= 95%, AT_RISK 95-105%, OVER > 105% of the envelope.
 */
export function compute(_input: ForecastInput): ForecastResult {
  throw new NotImplemented("forecast.compute");
}

export async function burn(): Promise<BurnResult> {
  throw new NotImplemented("forecast.burn");
}
