import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError, apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

// The generator (brief.generate()) is Phase B. Phase A only reads the
// latest stored snapshot, if one exists.
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const latest = await db.briefSnapshot.findFirst({ orderBy: { generatedAt: "desc" } });
  if (!latest) return apiError("No brief has been generated yet", 404);
  return NextResponse.json(latest);
}
