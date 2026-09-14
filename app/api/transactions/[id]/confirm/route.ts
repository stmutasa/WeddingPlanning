import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zOptionalId } from "@/lib/validation";

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

    const transaction = await db.transaction.findUnique({ where: { id } });
    if (!transaction) return apiError("Transaction not found", 404);
    if (transaction.status === "LINKED") return apiError("Already confirmed", 400);

    const expense = await db.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          description: body.description,
          amountCents: transaction.amountCents,
          date: transaction.date,
          eventId: body.eventId,
          categoryId: body.categoryId ?? null,
          vendorId: body.vendorId ?? null,
          funderId: body.funderId,
          source: "BANK",
          notes: body.notes ?? null,
          createdById: session.id,
        },
      });
      await tx.transaction.update({
        where: { id },
        data: { status: "LINKED", expenseId: created.id },
      });
      return created;
    });

    await recordActivity({
      userId: session.id,
      action: "CONFIRMED",
      entityType: "Transaction",
      entityId: id,
      summary: `${session.name ?? "Someone"} confirmed ${expense.description} from the bank feed`,
    });

    return NextResponse.json(expense, { status: 201 });
  });
}
