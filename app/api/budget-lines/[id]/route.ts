import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents } from "@/lib/validation";
import { budgetLines } from "@/lib/services/catalog";

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
    return NextResponse.json(await budgetLines.update(session.id, id, body));
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/budget-lines/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await budgetLines.remove(session.id, id);
    return NextResponse.json({ ok: true });
  });
}
