import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents } from "@/lib/validation";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  plannedCents: zCents.optional(),
  note: z.string().nullable().optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/budget-lines/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const line = await db.budgetLine.update({ where: { id }, data: body });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "BudgetLine",
      entityId: line.id,
      summary: `${session.name ?? "Someone"} updated a budget line`,
    });

    return NextResponse.json(line);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/budget-lines/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const line = await db.budgetLine.findUnique({ where: { id } });
    if (!line) return apiError("Budget line not found", 404);

    await db.budgetLine.delete({ where: { id } });

    await recordActivity({
      userId: session.id,
      action: "DELETED",
      entityType: "BudgetLine",
      entityId: id,
      summary: `${session.name ?? "Someone"} removed a budget line`,
    });

    return NextResponse.json({ ok: true });
  });
}
