import { NextResponse } from "next/server";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as brief from "@/lib/services/brief";

export const dynamic = "force-dynamic";

/** POST /api/brief/rotate-token — invalidates the old /api/brief.md link. */
export async function POST() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    return NextResponse.json({ token: await brief.rotateToken() });
  });
}
