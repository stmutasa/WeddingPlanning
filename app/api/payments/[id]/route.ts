import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents, zDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Phase A allows editing an OPEN payment or cancelling it. Marking one PAID
// atomically with its expense is `payments.markPaid()` in Phase B.
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
    const payment = await db.paymentDue.update({ where: { id }, data: body });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "PaymentDue",
      entityId: payment.id,
      summary: `${session.name ?? "Someone"} updated the payment ${payment.label}`,
    });

    return NextResponse.json(payment);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/payments/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const payment = await db.paymentDue.findUnique({ where: { id } });
    if (!payment) return apiError("Payment not found", 404);
    if (payment.status === "PAID") return apiError("A paid payment cannot be deleted", 400);

    await db.paymentDue.delete({ where: { id } });

    await recordActivity({
      userId: session.id,
      action: "DELETED",
      entityType: "PaymentDue",
      entityId: id,
      summary: `${session.name ?? "Someone"} removed the payment ${payment.label}`,
    });

    return NextResponse.json({ ok: true });
  });
}
