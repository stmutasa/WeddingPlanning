import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { zCents, zDate, zOptionalId } from "@/lib/validation";
import * as expenses from "@/lib/services/expenses";

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
  const expense = await expenses.get(id);
  if (!expense) return apiError("Expense not found", 404);
  return NextResponse.json(expense);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/expenses/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const expense = await expenses.update(session.id, id, body);
    return NextResponse.json(expense);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/expenses/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await expenses.remove(session.id, id);
    return NextResponse.json({ ok: true });
  });
}
