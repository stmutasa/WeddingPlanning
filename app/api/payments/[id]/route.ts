import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zDate, zOptionalId } from "@/lib/validation";
import * as payments from "@/lib/services/payments";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  label: z.string().min(1).optional(),
  dueDate: zDate.optional(),
  amountCents: zCents.optional(),
  status: z.enum(["OPEN", "CANCELLED"]).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/payments/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const payment = await payments.update(session.id, id, body);
    return NextResponse.json(payment);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/payments/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await payments.remove(session.id, id);
    return NextResponse.json({ ok: true });
  });
}

const paySchema = z.object({
  description: z.string().min(1).optional(),
  amountCents: zCents.optional(),
  originalAmount: z.number().positive().optional(),
  originalCurrency: z.string().length(3).optional(),
  fxRate: z.number().positive().optional(),
  date: zDate.optional(),
  eventId: z.string().min(1).optional(),
  categoryId: zOptionalId,
  funderId: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
});

/**
 * POST /api/payments/[id] — marks the payment PAID and records the matching
 * expense in one transaction (DESIGN.md §4 `payments.markPaid`). Everything
 * in the body is optional: the vendor, event, category and amount all
 * default from the scheduled payment.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/payments/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const raw = await request.text();
    const body = raw ? paySchema.parse(JSON.parse(raw)) : {};
    const result = await payments.markPaid(id, session.id, body);
    return NextResponse.json(result, { status: 201 });
  });
}
