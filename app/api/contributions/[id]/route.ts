import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/contributions/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const contribution = await db.contribution.findUnique({ where: { id } });
    if (!contribution) return apiError("Contribution not found", 404);

    await db.contribution.delete({ where: { id } });

    await recordActivity({
      userId: session.id,
      action: "DELETED",
      entityType: "Contribution",
      entityId: id,
      summary: `${session.name ?? "Someone"} removed a contribution`,
    });

    return NextResponse.json({ ok: true });
  });
}
