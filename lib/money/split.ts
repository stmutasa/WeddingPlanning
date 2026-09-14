import { splitByRatio, sum } from "./cents";

export type SettleUpPerson = "annette" | "simi";

export interface SettleUpInput {
  annetteFrontedCents: number;
  simiFrontedCents: number;
  /** Wedding.splitNumerator / Wedding.splitDenominator — Annette's settle-up share. */
  splitNumerator: number;
  splitDenominator: number;
}

export interface SettleUpResult {
  totalFrontedCents: number;
  annetteFairShareCents: number;
  simiFairShareCents: number;
  /** Positive = fronted more than their fair share (they are owed money). */
  annetteBalanceCents: number;
  simiBalanceCents: number;
  owedFrom: SettleUpPerson | null;
  owedTo: SettleUpPerson | null;
  owedCents: number;
}

/**
 * DESIGN.md §1 settle-up: the two of them split wedding costs by
 * `Wedding.splitNumerator/splitDenominator` (default 1/2, i.e. 50/50) unless
 * overridden. Only `USER` funder money enters this — JOINT and FAMILY never
 * do (the caller is responsible for excluding them from the fronted totals
 * passed in here).
 */
export function computeSettleUp(input: SettleUpInput): SettleUpResult {
  const { annetteFrontedCents, simiFrontedCents, splitNumerator, splitDenominator } = input;
  const totalFrontedCents = sum([annetteFrontedCents, simiFrontedCents]);

  const annetteRatio = splitDenominator === 0 ? 0.5 : splitNumerator / splitDenominator;
  const simiRatio = 1 - annetteRatio;

  const [annetteFairShareCents, simiFairShareCents] = splitByRatio(totalFrontedCents, [
    annetteRatio,
    simiRatio,
  ]);

  const annetteBalanceCents = annetteFrontedCents - annetteFairShareCents;
  const simiBalanceCents = simiFrontedCents - simiFairShareCents;

  let owedFrom: SettleUpPerson | null = null;
  let owedTo: SettleUpPerson | null = null;
  let owedCents = 0;

  if (annetteBalanceCents > 0) {
    owedFrom = "simi";
    owedTo = "annette";
    owedCents = annetteBalanceCents;
  } else if (simiBalanceCents > 0) {
    owedFrom = "annette";
    owedTo = "simi";
    owedCents = simiBalanceCents;
  }

  return {
    totalFrontedCents,
    annetteFairShareCents,
    simiFairShareCents,
    annetteBalanceCents,
    simiBalanceCents,
    owedFrom,
    owedTo,
    owedCents,
  };
}
