import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zOptionalId } from "@/lib/validation";
import * as transactions from "@/lib/services/transactions";

export const dynamic = "force-dynamic";

// Confirming a transaction creates an Expense from the given fields and
// links it back — DESIGN.md §1 "Confirming creates an Expense linked back to
// the transaction. Manual and bank paths produce identical Expense rows."
const confirmSchema = z.object({
  description: z.string().min(1),
  eventId: z.string().min(1),
  categoryId: zOptionalId,
  vendorId: zOptionalId,
  funderId: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/transactions/[id]/confirm">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = confirmSchema.parse(await request.json());
    const expense = await transactions.confirm(session.id, id, body);
    return NextResponse.json(expense, { status: 201 });
  });
}
