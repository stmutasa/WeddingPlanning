import type { ForecastStatus } from "@/lib/types";
import { NotImplemented } from "./errors";

export interface BudgetEnvelope {
  eventId: string;
  budgetCents: number;
  paidCents: number;
  committedCents: number;
  plannedCents: number;
  forecastCents: number;
  status: ForecastStatus;
}

export interface BudgetSummary {
  totalCents: number;
  envelopes: BudgetEnvelope[];
  unallocatedCents: number;
  paidCents: number;
  committedCents: number;
  remainingCents: number;
}

export interface BudgetLineInput {
  categoryId: string;
  plannedCents: number;
  note?: string | null;
}

/** DESIGN.md §4 — aggregates paid/committed/planned per event with forecast.compute(). */
export async function summary(): Promise<BudgetSummary> {
  throw new NotImplemented("budget.summary");
}

export async function setEnvelopes(
  _envelopes: { eventId: string; budgetCents: number }[]
): Promise<void> {
  throw new NotImplemented("budget.setEnvelopes");
}

export async function setLines(_eventId: string, _lines: BudgetLineInput[]): Promise<void> {
  throw new NotImplemented("budget.setLines");
}
