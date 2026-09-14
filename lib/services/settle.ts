import type { Settlement } from "@prisma/client";
import { db } from "@/lib/db";
import { computeSettleUp } from "@/lib/money/split";
import { log, money } from "./actor";
import { NotFound, ServiceError } from "./errors";

export interface SettlePerson {
  userId: string | null;
  funderId: string | null;
  name: string;
  frontedCents: number;
  /** Fronted, adjusted for settlements already paid across. */
  netFrontedCents: number;
  fairShareCents: number;
  balanceCents: number;
}

export interface SettleSummary {
  annette: SettlePerson;
  simi: SettlePerson;
  /** Flat fields kept for DESIGN.md §4's stated shape. */
  annetteFrontedCents: number;
  simiFrontedCents: number;
  jointCents: number;
  familyCents: number;
  ratio: { numerator: number; denominator: number };
  owedFromUserId: string | null;
  owedToUserId: string | null;
  owedCents: number;
  settlements: Settlement[];
}

/**
 * DESIGN.md §1: only `USER` funder money is "fronted"; `JOINT` and `FAMILY`
 * never enter settle-up. `Wedding.splitNumerator/Denominator` is Annette's
 * share of the pair's spend.
 *
 * Annette is identified by the display name on her `UserSettings` (the seed
 * and the auth bootstrap both set it), with a stable alphabetical fallback
 * so the maths is deterministic even before either has signed in.
 */
async function people() {
  const funders = await db.funder.findMany({
    where: { kind: "USER" },
    include: { user: { include: { settings: true } } },
    orderBy: { name: "asc" },
  });

  const named = funders.map((f) => ({
    funderId: f.id,
    userId: f.userId,
    name: f.user?.settings?.displayName?.trim() || f.name,
  }));

  const annette =
    named.find((p) => p.name.toLowerCase().startsWith("annette")) ?? named[0] ?? null;
  const simi = named.find((p) => p.funderId !== annette?.funderId) ?? null;

  return { annette, simi };
}

export async function summary(): Promise<SettleSummary> {
  const [wedding, { annette, simi }, byFunder, funders, settlements] = await Promise.all([
    db.wedding.findUnique({ where: { id: "main" } }),
    people(),
    db.expense.groupBy({ by: ["funderId"], _sum: { amountCents: true } }),
    db.funder.findMany(),
    db.settlement.findMany({ orderBy: { settledAt: "desc" } }),
  ]);

  const spentBy = new Map(byFunder.map((r) => [r.funderId, r._sum.amountCents ?? 0]));
  const kindOf = new Map(funders.map((f) => [f.id, f.kind]));

  const annetteFrontedCents = annette ? (spentBy.get(annette.funderId) ?? 0) : 0;
  const simiFrontedCents = simi ? (spentBy.get(simi.funderId) ?? 0) : 0;

  let jointCents = 0;
  let familyCents = 0;
  for (const [funderId, cents] of spentBy) {
    const kind = kindOf.get(funderId);
    if (kind === "JOINT") jointCents += cents;
    else if (kind === "FAMILY" || kind === "OTHER") familyCents += cents;
  }

  // A settlement already paid moves the payer's effective contribution up
  // and the receiver's down, so a settled pair nets to zero.
  let annetteNet = annetteFrontedCents;
  let simiNet = simiFrontedCents;
  for (const s of settlements) {
    if (annette?.userId && s.fromUserId === annette.userId) annetteNet += s.amountCents;
    if (simi?.userId && s.fromUserId === simi.userId) simiNet += s.amountCents;
    if (annette?.userId && s.toUserId === annette.userId) annetteNet -= s.amountCents;
    if (simi?.userId && s.toUserId === simi.userId) simiNet -= s.amountCents;
  }

  const ratio = {
    numerator: wedding?.splitNumerator ?? 1,
    denominator: wedding?.splitDenominator ?? 2,
  };

  const result = computeSettleUp({
    annetteFrontedCents: annetteNet,
    simiFrontedCents: simiNet,
    splitNumerator: ratio.numerator,
    splitDenominator: ratio.denominator,
  });

  const owedFromUserId =
    result.owedFrom === "annette" ? (annette?.userId ?? null) : result.owedFrom === "simi" ? (simi?.userId ?? null) : null;
  const owedToUserId =
    result.owedTo === "annette" ? (annette?.userId ?? null) : result.owedTo === "simi" ? (simi?.userId ?? null) : null;

  return {
    annette: {
      userId: annette?.userId ?? null,
      funderId: annette?.funderId ?? null,
      name: annette?.name ?? "Annette",
      frontedCents: annetteFrontedCents,
      netFrontedCents: annetteNet,
      fairShareCents: result.annetteFairShareCents,
      balanceCents: result.annetteBalanceCents,
    },
    simi: {
      userId: simi?.userId ?? null,
      funderId: simi?.funderId ?? null,
      name: simi?.name ?? "Simi",
      frontedCents: simiFrontedCents,
      netFrontedCents: simiNet,
      fairShareCents: result.simiFairShareCents,
      balanceCents: result.simiBalanceCents,
    },
    annetteFrontedCents,
    simiFrontedCents,
    jointCents,
    familyCents,
    ratio,
    owedFromUserId,
    owedToUserId,
    owedCents: result.owedCents,
    settlements,
  };
}

/**
 * Records a settlement. Direction defaults to whoever currently owes whom
 * (DESIGN.md §4's `settle.record(userId, amountCents, note)`); the
 * `/api/settlements` route passes both ids explicitly so the existing
 * request shape keeps working.
 */
export async function record(
  userId: string,
  amountCents: number,
  note?: string | null,
  direction?: { fromUserId: string; toUserId: string }
): Promise<Settlement> {
  let fromUserId = direction?.fromUserId;
  let toUserId = direction?.toUserId;

  if (!fromUserId || !toUserId) {
    const s = await summary();
    if (!s.owedFromUserId || !s.owedToUserId) {
      throw new ServiceError("Nothing to settle — both have fronted their share");
    }
    fromUserId = s.owedFromUserId;
    toUserId = s.owedToUserId;
  }

  const [from, to] = await Promise.all([
    db.user.findUnique({ where: { id: fromUserId }, include: { settings: true } }),
    db.user.findUnique({ where: { id: toUserId }, include: { settings: true } }),
  ]);
  if (!from || !to) throw new NotFound("User");
  if (amountCents <= 0) throw new ServiceError("A settlement must be a positive amount");

  const settlement = await db.settlement.create({
    data: { fromUserId, toUserId, amountCents, note: note ?? null },
  });

  const fromName = from.settings?.displayName ?? from.name ?? "Someone";
  const toName = to.settings?.displayName ?? to.name ?? "Someone";

  await log({
    userId,
    action: "SETTLED",
    entityType: "Settlement",
    entityId: settlement.id,
    summary: `recorded a settlement: ${fromName} → ${toName}, ${money(amountCents)}`,
  });

  return settlement;
}
