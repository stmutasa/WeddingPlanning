import { NextResponse } from "next/server";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as usage from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/usage?window=24h|7d|30d|90d|all — DESIGN.md §4 `ai.usage()`:
 * the Settings tiles. `costMicros` is null wherever a model has no rate on
 * file, which the UI shows as "n/a".
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const window = new URL(request.url).searchParams.get("window") ?? "30d";
    return NextResponse.json(await usage.usage(window));
  });
}
