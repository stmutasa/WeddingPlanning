import { NextResponse } from "next/server";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { contributions } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/contributions/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await contributions.remove(session.id, id);
    return NextResponse.json({ ok: true });
  });
}
