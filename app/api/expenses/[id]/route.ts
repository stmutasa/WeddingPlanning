import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents, zDate, zOptionalId } from "@/lib/validation";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  description: z.string().min(1).optional(),
  amountCents: zCents.optional(),
  originalAmount: z.number().positive().nullable().optional(),
  originalCurrency: z.string().length(3).nullable().optional(),
  fxRate: z.number().positive().nullable().optional(),
  date: zDate.optional(),
  eventId: z.string().min(1).optional(),
  categoryId: zOptionalId,
  vendorId: zOptionalId,
  funderId: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_request: Request, ctx: RouteContext<"/api/expenses/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { id } = await ctx.params;
  const expense = await db.expense.findUnique({
    where: { id },
    include: { event: true, category: true, vendor: true, funder: true, attachments: true },
  });
  if (!expense) return apiError("Expense not found", 404);
  return NextResponse.json(expense);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/expenses/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const expense = await db.expense.update({ where: { id }, data: body });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Expense",
      entityId: expense.id,
      summary: `${session.name ?? "Someone"} updated ${expense.description}`,
    });

    return NextResponse.json(expense);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/expenses/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) return apiError("Expense not found", 404);

    await db.expense.delete({ where: { id } });

    await recordActivity({
      userId: session.id,
      action: "DELETED",
      entityType: "Expense",
      entityId: id,
      summary: `${session.name ?? "Someone"} deleted ${expense.description}`,
    });

    return NextResponse.json({ ok: true });
  });
}
