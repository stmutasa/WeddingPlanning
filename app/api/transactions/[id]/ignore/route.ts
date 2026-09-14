import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: RouteContext<"/api/transactions/[id]/ignore">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const transaction = await db.transaction.findUnique({ where: { id } });
    if (!transaction) return apiError("Transaction not found", 404);

    const updated = await db.transaction.update({ where: { id }, data: { status: "IGNORED" } });

    await recordActivity({
      userId: session.id,
      action: "IGNORED",
      entityType: "Transaction",
      entityId: id,
      summary: `${session.name ?? "Someone"} marked "${transaction.name}" as not wedding`,
    });

    return NextResponse.json(updated);
  });
}
