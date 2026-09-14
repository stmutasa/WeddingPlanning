import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as digest from "@/lib/services/digest";

export const dynamic = "force-dynamic";

/**
 * GET /api/digest — the latest weekly digest, already parsed out of its
 * `Note` of kind `DIGEST` (DESIGN.md §4). The Home card reads it from here
 * so no client component has to parse the note itself.
 */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return NextResponse.json({ digest: await digest.latest() });
}
