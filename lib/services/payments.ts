import type { Expense, PaymentDue, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fxToCents } from "@/lib/money/cents";
import type { ExpenseInput } from "./expenses";
import { log, money } from "./actor";
import { Conflict, NotFound } from "./errors";
import * as fx from "./fx";

export interface ScheduleItem {
  label: string;
  dueDate: Date;
  amountCents: number;
}

const RELATIONS = {
  vendor: { include: { category: true, event: true } },
} satisfies Prisma.PaymentDueInclude;

export type PaymentWithVendor = Prisma.PaymentDueGetPayload<{ include: typeof RELATIONS }>;

/**
 * DESIGN.md §4: replaces the vendor's whole OPEN set atomically. PAID and
 * CANCELLED rows are history and are left alone.
 */
export async function schedule(
  userId: string,
  vendorId: string,
  items: ScheduleItem[]
): Promise<PaymentWithVendor[]> {
  const vendor = await db.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new NotFound("Vendor");

  const created = await db.$transaction(async (tx) => {
    await tx.paymentDue.deleteMany({ where: { vendorId, status: "OPEN" } });
    const rows: PaymentWithVendor[] = [];
    for (const item of items) {
      rows.push(
        await tx.paymentDue.create({
          data: {
            vendorId,
            label: item.label,
            dueDate: item.dueDate,
            amountCents: item.amountCents,
          },
          include: RELATIONS,
        })
      );
    }
    return rows;
  });

  await log({
    userId,
    action: "UPDATED",
    entityType: "PaymentDue",
    entityId: vendorId,
    summary: `set ${created.length} ${created.length === 1 ? "payment" : "payments"} for ${vendor.name}`,
  });

  return created;
}

export async function addOne(
  userId: string,
  vendorId: string,
  item: ScheduleItem
): Promise<PaymentWithVendor> {
  const vendor = await db.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new NotFound("Vendor");

  const payment = await db.paymentDue.create({
    data: {
      vendorId,
      label: item.label,
      dueDate: item.dueDate,
      amountCents: item.amountCents,
    },
    include: RELATIONS,
  });

  await log({
    userId,
    action: "CREATED",
    entityType: "PaymentDue",
    entityId: payment.id,
    summary: `scheduled ${vendor.name} ${payment.label}, ${money(payment.amountCents)}`,
  });

  return payment;
}

export async function update(
  userId: string,
  id: string,
  input: { label?: string; dueDate?: Date; amountCents?: number; status?: "OPEN" | "CANCELLED" }
): Promise<PaymentWithVendor> {
  const existing = await db.paymentDue.findUnique({ where: { id }, include: RELATIONS });
  if (!existing) throw new NotFound("Payment");
  if (existing.status === "PAID") throw new Conflict("A paid payment cannot be edited");

  const payment = await db.paymentDue.update({ where: { id }, data: input, include: RELATIONS });

  await log({
    userId,
    action: "UPDATED",
    entityType: "PaymentDue",
    entityId: id,
    summary: `updated ${payment.vendor.name} ${payment.label}`,
  });

  return payment;
}

export async function remove(userId: string, id: string): Promise<void> {
  const existing = await db.paymentDue.findUnique({ where: { id }, include: RELATIONS });
  if (!existing) throw new NotFound("Payment");
  if (existing.status === "PAID") throw new Conflict("A paid payment cannot be deleted");

  await db.paymentDue.delete({ where: { id } });

  await log({
    userId,
    action: "DELETED",
    entityType: "PaymentDue",
    entityId: id,
    summary: `removed ${existing.vendor.name} ${existing.label}`,
  });
}

/**
 * DESIGN.md §4: "creates the expense in one transaction". The expense is
 * written, the PaymentDue flips to PAID and points at it, in a single
 * `$transaction` so a half-paid instalment can never exist.
 */
export async function markPaid(
  paymentId: string,
  userId: string,
  expenseInput: Partial<Omit<ExpenseInput, "paymentDueId">> = {}
): Promise<{ payment: PaymentWithVendor; expense: Expense }> {
  const payment = await db.paymentDue.findUnique({ where: { id: paymentId }, include: RELATIONS });
  if (!payment) throw new NotFound("Payment");
  if (payment.status !== "OPEN") throw new Conflict("That payment is not open");

  const eventId =
    expenseInput.eventId ??
    payment.vendor.eventId ??
    (await db.event.findFirst({ where: { slug: "general" } }))?.id;
  if (!eventId) throw new NotFound("Event");

  const funderId =
    expenseInput.funderId ??
    (await db.funder.findUnique({ where: { userId } }))?.id ??
    (await db.funder.findFirst({ where: { kind: "JOINT" } }))?.id;
  if (!funderId) throw new NotFound("Funder");

  const date = expenseInput.date ?? new Date();

  let amountCents = expenseInput.amountCents ?? payment.amountCents;
  let fxRate = expenseInput.fxRate ?? null;
  const currency = expenseInput.originalCurrency?.toUpperCase() ?? null;
  if (expenseInput.originalAmount != null && currency && currency !== "USD") {
    fxRate = fxRate ?? (await fx.rate(date.toISOString().slice(0, 10), currency));
    amountCents = fxToCents(expenseInput.originalAmount, fxRate);
  }

  const result = await db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        description: expenseInput.description ?? `${payment.vendor.name} — ${payment.label}`,
        amountCents,
        originalAmount: expenseInput.originalAmount ?? null,
        originalCurrency: currency,
        fxRate,
        date,
        eventId,
        categoryId: expenseInput.categoryId ?? payment.vendor.categoryId ?? null,
        vendorId: payment.vendorId,
        funderId,
        source: expenseInput.source ?? "MANUAL",
        notes: expenseInput.notes ?? null,
        createdById: userId,
      },
    });

    const updated = await tx.paymentDue.update({
      where: { id: paymentId },
      data: { status: "PAID", expenseId: expense.id },
      include: RELATIONS,
    });

    return { payment: updated, expense };
  });

  await log({
    userId,
    action: "PAID",
    entityType: "PaymentDue",
    entityId: paymentId,
    summary: `paid ${payment.vendor.name} ${payment.label}, ${money(amountCents)}`,
  });

  return result;
}

/** OPEN payments due within `days` days, soonest first; overdue rows included. */
export async function upcoming(days: number): Promise<PaymentWithVendor[]> {
  const until = new Date(Date.now() + days * 86_400_000);
  return db.paymentDue.findMany({
    where: { status: "OPEN", dueDate: { lte: until } },
    include: RELATIONS,
    orderBy: { dueDate: "asc" },
  });
}

export async function list(filters: { status?: string; days?: number }): Promise<PaymentWithVendor[]> {
  const where: Prisma.PaymentDueWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.days != null
      ? { dueDate: { lte: new Date(Date.now() + filters.days * 86_400_000) } }
      : {}),
  };
  return db.paymentDue.findMany({ where, include: RELATIONS, orderBy: { dueDate: "asc" } });
}

export async function forVendor(vendorId: string): Promise<PaymentDue[]> {
  return db.paymentDue.findMany({ where: { vendorId }, orderBy: { dueDate: "asc" } });
}
