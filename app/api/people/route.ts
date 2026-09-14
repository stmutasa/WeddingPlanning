import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as people from "@/lib/services/people";

export const dynamic = "force-dynamic";

/** GET /api/people — both users with their display name and hue, for attribution. */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return NextResponse.json(await people.list());
}
