import { NextResponse } from "next/server";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { ai } from "@/lib/ai/client";
import * as models from "@/lib/ai/models";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/models — the live lists, cached an hour (DESIGN.md §7).
 * `?refresh=1` forces a fetch. The response also carries the resolved
 * primary model and where it was resolved from, which Settings shows as
 * "resolved from 'astra'", plus any problem to show as a banner.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const force = new URL(request.url).searchParams.get("refresh") === "1";
    const [list, resolution, settings] = await Promise.all([
      ai.models(force),
      models.resolvePrimaryModel(),
      ai.settings(),
    ]);

    return NextResponse.json({
      openai: list.openai,
      anthropic: list.anthropic,
      fetchedAt: list.fetchedAt,
      errors: list.errors,
      primary: settings.primary,
      backup: settings.backup,
      resolvedFrom: resolution.resolvedFrom,
      problem: resolution.problem,
      enabled: settings.enabled,
    });
  });
}
