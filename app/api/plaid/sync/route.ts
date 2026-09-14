import { NextResponse } from "next/server";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as transactions from "@/lib/services/transactions";

export const dynamic = "force-dynamic";

/**
 * POST /api/plaid/sync — "Sync now" from the inbox. Pulls every item with
 * its cursor, upserts money-out rows on watched accounts, then triages the
 * new ones with the model (PROMPTS.md §3).
 */
export async function POST() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    return NextResponse.json(await transactions.sync(session.id));
  });
}
