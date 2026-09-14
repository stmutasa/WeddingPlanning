import { NextResponse } from "next/server";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as plaid from "@/lib/services/plaid";

export const dynamic = "force-dynamic";

/** DELETE /api/plaid/items/[id] — calls /item/remove, then drops the row. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/plaid/items/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await plaid.removeItem(session.id, id);
    return NextResponse.json({ ok: true });
  });
}
