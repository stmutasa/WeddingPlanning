import { NextResponse } from "next/server";
import { requireSession, isSessionError, apiError } from "@/lib/http";
import * as brief from "@/lib/services/brief";
import * as drive from "@/lib/services/drive";

export const dynamic = "force-dynamic";

/** GET /api/brief — the latest snapshot, plus the token URL and Drive state. */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const latest = await brief.latest();
  if (!latest) return apiError("No brief has been generated yet", 404);

  return NextResponse.json({
    ...latest,
    token: await brief.token(),
    drive: await drive.state(),
  });
}
