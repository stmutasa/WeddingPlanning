import { NextResponse } from "next/server";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as transactions from "@/lib/services/transactions";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: RouteContext<"/api/transactions/[id]/ignore">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const transaction = await transactions.ignore(session.id, id);
    return NextResponse.json(transaction);
  });
}
