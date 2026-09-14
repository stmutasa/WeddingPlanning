import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fxToCents, sum } from "@/lib/money/cents";
import type { ExpenseSource } from "@/lib/types";
import { log, money } from "./actor";
import { Conflict, NotFound, ServiceError } from "./errors";
import * as fx from "./fx";

export interface ExpenseInput {
  description: string;
  amountCents?: number;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  fxRate?: number | null;
  date: Date;
  eventId: string;
  categoryId?: string | null;
  vendorId?: string | null;
  funderId: string;
  source?: ExpenseSource;
  notes?: string | null;
  paymentDueId?: string | null;
}

export interface ExpenseFilters {
  eventId?: string;
  categoryId?: string;
  vendorId?: string;
  funderId?: string;
  q?: string;
  from?: Date;
  to?: Date;
  source?: string;
}

const RELATIONS = {
  event: true,
  category: true,
  vendor: true,
  funder: true,
} satisfies Prisma.ExpenseInclude;

export type ExpenseWithRelations = Prisma.ExpenseGetPayload<{ include: typeof RELATIONS }>;

/**
 * Resolves the USD cents for an expense. Either the caller gives cents
 * outright, or gives an original-currency amount and we convert: the
 * caller's `fxRate` wins (DESIGN.md §1 "overridable per expense"), else
 * today's cached rate from `open.er-api.com`.
 */
async function resolveAmount(input: {
  amountCents?: number;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  fxRate?: number | null;
  date: Date;
}): Promise<{ amountCents: number; fxRate: number | null; originalCurrency: string | null }> {
  const currency = input.originalCurrency?.toUpperCase() ?? null;

  if (input.originalAmount != null && currency && currency !== "USD") {
    const day = input.date.toISOString().slice(0, 10);
    const rate = input.fxRate ?? (await fx.rate(day, currency));
    return { amountCents: fxToCents(input.originalAmount, rate), fxRate: rate, originalCurrency: currency };
  }

  if (input.amountCents != null) {
    return {
      amountCents: input.amountCents,
      fxRate: input.fxRate ?? null,
      originalCurrency: currency,
    };
  }

  if (input.originalAmount != null) {
    // Original amount in USD (or no currency given) — dollars to cents.
    return { amountCents: Math.round(input.originalAmount * 100), fxRate: null, originalCurrency: currency };
  }

  throw new ServiceError("Provide amountCents, or originalAmount with a currency");
}

export async function create(userId: string, input: ExpenseInput): Promise<ExpenseWithRelations> {
  const [event, funder] = await Promise.all([
    db.event.findUnique({ where: { id: input.eventId } }),
    db.funder.findUnique({ where: { id: input.funderId } }),
  ]);
  if (!event) throw new NotFound("Event");
  if (!funder) throw new NotFound("Funder");

  if (input.paymentDueId) {
    const due = await db.paymentDue.findUnique({ where: { id: input.paymentDueId } });
    if (!due) throw new NotFound("Payment");
    if (due.status !== "OPEN") throw new Conflict("That payment is not open");
  }

  const { amountCents, fxRate, originalCurrency } = await resolveAmount(input);

  const expense = await db.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        description: input.description,
        amountCents,
        originalAmount: input.originalAmount ?? null,
        originalCurrency,
        fxRate,
        date: input.date,
        eventId: input.eventId,
        categoryId: input.categoryId ?? null,
        vendorId: input.vendorId ?? null,
        funderId: input.funderId,
        source: input.source ?? "MANUAL",
        notes: input.notes ?? null,
        createdById: userId,
      },
      include: RELATIONS,
    });

    if (input.paymentDueId) {
      await tx.paymentDue.update({
        where: { id: input.paymentDueId },
        data: { status: "PAID", expenseId: created.id },
      });
    }

    return created;
  });

  await log({
    userId,
    action: "CREATED",
    entityType: "Expense",
    entityId: expense.id,
    // DESIGN.md §3's example, exactly: "Annette added Ruracio venue hold, $800".
    summary: `added ${expense.description}, ${money(amountCents)}`,
  });

  return expense;
}

export async function update(
  userId: string,
  id: string,
  input: Partial<ExpenseInput>
): Promise<ExpenseWithRelations> {
  const existing = await db.expense.findUnique({ where: { id } });
  if (!existing) throw new NotFound("Expense");

  const date = input.date ?? existing.date;
  const wantsRecompute =
    input.amountCents != null ||
    input.originalAmount !== undefined ||
    input.originalCurrency !== undefined ||
    input.fxRate !== undefined;

  let amountCents = existing.amountCents;
  let fxRate = existing.fxRate;
  let originalCurrency = existing.originalCurrency;
  let originalAmount = existing.originalAmount;

  if (wantsRecompute) {
    originalAmount = input.originalAmount !== undefined ? input.originalAmount : existing.originalAmount;
    const resolved = await resolveAmount({
      amountCents: input.amountCents,
      originalAmount,
      originalCurrency:
        input.originalCurrency !== undefined ? input.originalCurrency : existing.originalCurrency,
      fxRate: input.fxRate !== undefined ? input.fxRate : existing.fxRate,
      date,
    });
    amountCents = resolved.amountCents;
    fxRate = resolved.fxRate;
    originalCurrency = resolved.originalCurrency;
  }

  const expense = await db.expense.update({
    where: { id },
    data: {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.eventId !== undefined ? { eventId: input.eventId } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
      ...(input.funderId !== undefined ? { funderId: input.funderId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(wantsRecompute ? { amountCents, fxRate, originalCurrency, originalAmount } : {}),
    },
    include: RELATIONS,
  });

  await log({
    userId,
    action: "UPDATED",
    entityType: "Expense",
    entityId: expense.id,
    summary:
      wantsRecompute && amountCents !== existing.amountCents
        ? `changed ${expense.description} to ${money(amountCents)}`
        : `updated ${expense.description}`,
  });

  return expense;
}

export async function remove(userId: string, id: string): Promise<void> {
  const existing = await db.expense.findUnique({
    where: { id },
    include: { paymentDue: true, transaction: true },
  });
  if (!existing) throw new NotFound("Expense");

  await db.$transaction(async (tx) => {
    if (existing.paymentDue) {
      await tx.paymentDue.update({
        where: { id: existing.paymentDue.id },
        data: { status: "OPEN", expenseId: null },
      });
    }
    if (existing.transaction) {
      await tx.transaction.update({
        where: { id: existing.transaction.id },
        data: { status: "NEW", expenseId: null },
      });
    }
    await tx.expense.delete({ where: { id } });
  });

  await log({
    userId,
    action: "DELETED",
    entityType: "Expense",
    entityId: id,
    summary: `deleted ${existing.description}, ${money(existing.amountCents)}`,
  });
}

export async function list(filters: ExpenseFilters): Promise<{
  expenses: ExpenseWithRelations[];
  totalCents: number;
  count: number;
}> {
  const where: Prisma.ExpenseWhereInput = {
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(filters.funderId ? { funderId: filters.funderId } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.q
      ? {
          OR: [
            { description: { contains: filters.q } },
            { notes: { contains: filters.q } },
            { vendor: { name: { contains: filters.q } } },
          ],
        }
      : {}),
    ...(filters.from || filters.to
      ? {
          date: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const expenses = await db.expense.findMany({
    where,
    include: RELATIONS,
    orderBy: { date: "desc" },
  });

  return {
    expenses,
    totalCents: sum(expenses.map((e) => e.amountCents)),
    count: expenses.length,
  };
}

export async function get(id: string): Promise<Prisma.ExpenseGetPayload<{
  include: typeof RELATIONS & { attachments: true };
}> | null> {
  return db.expense.findUnique({
    where: { id },
    include: { ...RELATIONS, attachments: true },
  });
}
