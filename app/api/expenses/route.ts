import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents, zDate, zOptionalId } from "@/lib/validation";
import { fxToCents, sum } from "@/lib/money/cents";
import { EXPENSE_SOURCES } from "@/lib/types";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    description: z.string().min(1),
    amountCents: zCents.optional(),
    originalAmount: z.number().positive().optional(),
    originalCurrency: z.string().length(3).optional(),
    fxRate: z.number().positive().optional(),
    date: zDate,
    eventId: z.string().min(1),
    categoryId: zOptionalId,
    vendorId: zOptionalId,
    funderId: z.string().min(1),
    source: z.enum(EXPENSE_SOURCES).optional(),
    notes: z.string().nullable().optional(),
    paymentDueId: zOptionalId,
  })
  .refine((v) => v.amountCents != null || (v.originalAmount != null && v.fxRate != null), {
    message: "Provide amountCents, or originalAmount together with fxRate",
  });

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const categoryId = searchParams.get("categoryId");
  const vendorId = searchParams.get("vendorId");
  const funderId = searchParams.get("funderId");
  const source = searchParams.get("source");
  const q = searchParams.get("q");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where = {
    ...(eventId ? { eventId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(funderId ? { funderId } : {}),
    ...(source ? { source } : {}),
    ...(q ? { description: { contains: q } } : {}),
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const expenses = await db.expense.findMany({
    where,
    include: { event: true, category: true, vendor: true, funder: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({
    expenses,
    totalCents: sum(expenses.map((e) => e.amountCents)),
    count: expenses.length,
  });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());

    const amountCents =
      body.amountCents ?? fxToCents(body.originalAmount as number, body.fxRate as number);

    if (body.paymentDueId) {
      const paymentDue = await db.paymentDue.findUnique({ where: { id: body.paymentDueId } });
      if (!paymentDue) return apiError("Payment not found", 404);
      if (paymentDue.status !== "OPEN") return apiError("Payment is not open", 400);
    }

    const expense = await db.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          description: body.description,
          amountCents,
          originalAmount: body.originalAmount ?? null,
          originalCurrency: body.originalCurrency ?? null,
          fxRate: body.fxRate ?? null,
          date: body.date,
          eventId: body.eventId,
          categoryId: body.categoryId ?? null,
          vendorId: body.vendorId ?? null,
          funderId: body.funderId,
          source: body.source ?? "MANUAL",
          notes: body.notes ?? null,
          createdById: session.id,
        },
      });

      if (body.paymentDueId) {
        await tx.paymentDue.update({
          where: { id: body.paymentDueId },
          data: { status: "PAID", expenseId: created.id },
        });
      }

      return created;
    });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "Expense",
      entityId: expense.id,
      summary: `${session.name ?? "Someone"} added ${expense.description}, $${(amountCents / 100).toFixed(2)}`,
    });

    return NextResponse.json(expense, { status: 201 });
  });
}
