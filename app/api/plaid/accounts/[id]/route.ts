import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as plaid from "@/lib/services/plaid";

export const dynamic = "force-dynamic";

const schema = z.object({ watched: z.boolean() });

/**
 * PATCH /api/plaid/accounts/[id] — untick a card that is never wedding
 * related and sync stops importing it (DESIGN.md §3 `PlaidAccount.watched`).
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/plaid/accounts/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const { watched } = schema.parse(await request.json());
    return NextResponse.json(await plaid.setAccountWatched(session.id, id, watched));
  });
}
