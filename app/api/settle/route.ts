import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as settle from "@/lib/services/settle";

export const dynamic = "force-dynamic";

/**
 * GET /api/settle — DESIGN.md §4 `settle.summary()`: who has fronted what,
 * who owes whom, and the settlements already recorded. Only USER-funder
 * money counts; joint and family money never enters settle-up.
 */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return NextResponse.json(await settle.summary());
}
