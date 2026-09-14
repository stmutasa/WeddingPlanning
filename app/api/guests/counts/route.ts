import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as guests from "@/lib/services/guests";

export const dynamic = "force-dynamic";

/** GET /api/guests/counts — per event × RSVP, plus heads and pending households. */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const [counts, pendingHouseholds] = await Promise.all([
    guests.counts(),
    guests.pendingHouseholds(),
  ]);
  return NextResponse.json({ counts, pendingHouseholds });
}
