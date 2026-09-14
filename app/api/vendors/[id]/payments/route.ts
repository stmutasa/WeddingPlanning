import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents, zDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().min(1),
  dueDate: zDate,
  amountCents: zCents,
});

export async function GET(_request: Request, ctx: RouteContext<"/api/vendors/[id]/payments">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { id } = await ctx.params;
  const payments = await db.paymentDue.findMany({
    where: { vendorId: id },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(payments);
}

// Phase A: appends a single OPEN payment. `payments.schedule()` (Phase B)
// replaces the whole OPEN set atomically per DESIGN.md §4.
export async function POST(request: Request, ctx: RouteContext<"/api/vendors/[id]/payments">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = createSchema.parse(await request.json());
    const payment = await db.paymentDue.create({ data: { ...body, vendorId: id } });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "PaymentDue",
      entityId: payment.id,
      summary: `${session.name ?? "Someone"} scheduled a payment: ${payment.label}`,
    });

    return NextResponse.json(payment, { status: 201 });
  });
}
