import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as budget from "@/lib/services/budget";
import * as forecast from "@/lib/services/forecast";

export const dynamic = "force-dynamic";

/**
 * GET /api/forecast — the per-event forecast plus the monthly burn history
 * the digest narrative uses (DESIGN.md §4 `forecast.burn`).
 */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const [summary, burn] = await Promise.all([budget.summary(), forecast.burn()]);
  return NextResponse.json({
    status: summary.status,
    forecastCents: summary.forecastCents,
    totalCents: summary.totalCents,
    envelopes: summary.envelopes,
    burn,
  });
}
