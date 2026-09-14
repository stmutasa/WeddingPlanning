import type { Settlement } from "@prisma/client";
import { NotImplemented } from "./errors";

export interface SettleSummary {
  annetteFrontedCents: number;
  simiFrontedCents: number;
  ratio: { numerator: number; denominator: number };
  owedFromUserId: string | null;
  owedToUserId: string | null;
  owedCents: number;
  settlements: Settlement[];
}

/** DESIGN.md §4 — wraps lib/money/split.ts's computeSettleUp() with live DB totals. */
export async function summary(): Promise<SettleSummary> {
  throw new NotImplemented("settle.summary");
}

export async function record(
  _userId: string,
  _amountCents: number,
  _note?: string
): Promise<Settlement> {
  throw new NotImplemented("settle.record");
}
