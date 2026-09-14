import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as budget from "@/lib/services/budget";

export const dynamic = "force-dynamic";

/**
 * GET /api/budget/summary — DESIGN.md §4 `budget.summary()`: the totals the
 * Home screen and the Money > Budget tab are built from, with a forecast
 * and an ON_TRACK / AT_RISK / OVER status per envelope.
 */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return NextResponse.json(await budget.summary());
}
