import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { sum } from "@/lib/money/cents";
import type { ForecastStatus } from "@/lib/types";
import { log, money } from "./actor";
import { NotFound } from "./errors";
import * as forecast from "./forecast";

export interface BudgetEnvelope {
  eventId: string;
  eventSlug: string;
  eventName: string;
  budgetCents: number;
  paidCents: number;
  committedCents: number;
  plannedCents: number;
  forecastCents: number;
  status: ForecastStatus;
  percentOfBudget: number;
}

export interface BudgetSummary {
  totalCents: number;
  envelopes: BudgetEnvelope[];
  unallocatedCents: number;
  paidCents: number;
  committedCents: number;
  plannedCents: number;
  forecastCents: number;
  remainingCents: number;
  status: ForecastStatus;
}

export interface BudgetLineInput {
  categoryId: string;
  plannedCents: number;
  note?: string | null;
  source?: "USER" | "AI";
}

/**
 * DESIGN.md §4. Committed money lives on `PaymentDue`, which hangs off a
 * vendor rather than an event, so an OPEN instalment counts against the
 * vendor's event — and against General when the vendor has no event, which
 * is where cross-event spend belongs.
 */
export async function summary(): Promise<BudgetSummary> {
  const [wedding, events, expenses, payments, lines] = await Promise.all([
    db.wedding.findUnique({ where: { id: "main" } }),
    db.event.findMany({ orderBy: { sortOrder: "asc" } }),
    db.expense.groupBy({ by: ["eventId"], _sum: { amountCents: true } }),
    db.paymentDue.findMany({
      where: { status: "OPEN" },
      select: { amountCents: true, vendor: { select: { eventId: true } } },
    }),
    db.budgetLine.groupBy({ by: ["eventId"], _sum: { plannedCents: true } }),
  ]);

  const generalId = events.find((e) => e.slug === "general")?.id ?? null;
  const paidByEvent = new Map(expenses.map((r) => [r.eventId, r._sum.amountCents ?? 0]));
  const plannedByEvent = new Map(lines.map((r) => [r.eventId, r._sum.plannedCents ?? 0]));

  const committedByEvent = new Map<string, number>();
  for (const p of payments) {
    const key = p.vendor.eventId ?? generalId;
    if (!key) continue;
    committedByEvent.set(key, (committedByEvent.get(key) ?? 0) + p.amountCents);
  }

  const envelopes: BudgetEnvelope[] = events.map((event) => {
    const paidCents = paidByEvent.get(event.id) ?? 0;
    const committedCents = committedByEvent.get(event.id) ?? 0;
    const plannedCents = plannedByEvent.get(event.id) ?? 0;
    const f = forecast.compute({
      budgetCents: event.budgetCents,
      paidCents,
      committedCents,
      plannedCents,
    });
    return {
      eventId: event.id,
      eventSlug: event.slug,
      eventName: event.name,
      budgetCents: event.budgetCents,
      paidCents,
      committedCents,
      plannedCents,
      forecastCents: f.forecastCents,
      status: f.status,
      percentOfBudget: f.percentOfBudget,
    };
  });

  const totalCents = wedding?.budgetCents ?? 0;
  const paidCents = sum(envelopes.map((e) => e.paidCents));
  const committedCents = sum(envelopes.map((e) => e.committedCents));
  const plannedCents = sum(envelopes.map((e) => e.plannedCents));
  const forecastCents = sum(envelopes.map((e) => e.forecastCents));

  return {
    totalCents,
    envelopes,
    unallocatedCents: totalCents - sum(envelopes.map((e) => e.budgetCents)),
    paidCents,
    committedCents,
    plannedCents,
    forecastCents,
    remainingCents: totalCents - paidCents - committedCents,
    status: forecast.statusFor(forecastCents, totalCents),
  };
}

export async function setEnvelopes(
  userId: string,
  envelopes: { eventId: string; budgetCents: number }[]
): Promise<Event[]> {
  const ids = envelopes.map((e) => e.eventId);
  const found = await db.event.findMany({ where: { id: { in: ids } } });
  if (found.length !== new Set(ids).size) throw new NotFound("Event");

  const updated = await db.$transaction(
    envelopes.map((e) =>
      db.event.update({ where: { id: e.eventId }, data: { budgetCents: e.budgetCents } })
    )
  );

  await log({
    userId,
    action: "UPDATED",
    entityType: "Event",
    summary:
      updated.length === 1
        ? `set the ${updated[0].name} envelope to ${money(updated[0].budgetCents)}`
        : `updated ${updated.length} budget envelopes`,
  });

  return updated;
}

/** Replaces the event's whole set of planned lines (DESIGN.md §4). */
export async function setLines(
  userId: string,
  eventId: string,
  lines: BudgetLineInput[]
): Promise<void> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFound("Event");

  await db.$transaction(async (tx) => {
    await tx.budgetLine.deleteMany({ where: { eventId } });
    for (const line of lines) {
      await tx.budgetLine.create({
        data: {
          eventId,
          categoryId: line.categoryId,
          plannedCents: line.plannedCents,
          note: line.note ?? null,
          source: line.source ?? "USER",
        },
      });
    }
  });

  await log({
    userId,
    action: "UPDATED",
    entityType: "BudgetLine",
    entityId: eventId,
    summary: `set ${lines.length} budget ${lines.length === 1 ? "line" : "lines"} for ${event.name}`,
  });
}

/** Event × category planned vs actual, used by the Brief's section 4. */
export async function linesWithActuals(): Promise<
  {
    eventId: string;
    eventName: string;
    categoryId: string;
    categoryName: string;
    plannedCents: number;
    actualCents: number;
    note: string | null;
  }[]
> {
  const [lines, actuals] = await Promise.all([
    db.budgetLine.findMany({
      include: { event: true, category: true },
      orderBy: [{ event: { sortOrder: "asc" } }, { category: { sortOrder: "asc" } }],
    }),
    db.expense.groupBy({ by: ["eventId", "categoryId"], _sum: { amountCents: true } }),
  ]);

  const actualBy = new Map(
    actuals.map((a) => [`${a.eventId}::${a.categoryId ?? ""}`, a._sum.amountCents ?? 0])
  );

  return lines.map((l) => ({
    eventId: l.eventId,
    eventName: l.event.name,
    categoryId: l.categoryId,
    categoryName: l.category.name,
    plannedCents: l.plannedCents,
    actualCents: actualBy.get(`${l.eventId}::${l.categoryId}`) ?? 0,
    note: l.note,
  }));
}
