import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zDate } from "@/lib/validation";
import * as payments from "@/lib/services/payments";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().min(1),
  dueDate: zDate,
  amountCents: zCents,
});

// PUT replaces the vendor's whole OPEN set at once (DESIGN.md §4
// `payments.schedule`); POST still appends one instalment.
const scheduleSchema = z.object({
  items: z.array(createSchema),
});

export async function GET(_request: Request, ctx: RouteContext<"/api/vendors/[id]/payments">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { id } = await ctx.params;
  return NextResponse.json(await payments.forVendor(id));
}

export async function POST(request: Request, ctx: RouteContext<"/api/vendors/[id]/payments">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = createSchema.parse(await request.json());
    const payment = await payments.addOne(session.id, id, body);
    return NextResponse.json(payment, { status: 201 });
  });
}

export async function PUT(request: Request, ctx: RouteContext<"/api/vendors/[id]/payments">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = scheduleSchema.parse(await request.json());
    const rows = await payments.schedule(session.id, id, body.items);
    return NextResponse.json(rows);
  });
}
