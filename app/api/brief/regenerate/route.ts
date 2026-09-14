import { NextResponse } from "next/server";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as brief from "@/lib/services/brief";

export const dynamic = "force-dynamic";

/**
 * POST /api/brief/regenerate — DESIGN.md §8 "Regenerate now". The facts are
 * always rebuilt; the "State of play" paragraph is simply omitted when AI
 * is off or unreachable, so this never fails for want of a model.
 */
export async function POST() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const snapshot = await brief.generate("MANUAL");
    return NextResponse.json(snapshot, { status: 201 });
  });
}
