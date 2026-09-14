import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withAiErrors } from "@/lib/http";
import * as tasks from "@/lib/services/tasks";

export const dynamic = "force-dynamic";

const schema = z.object({ apply: z.boolean().optional() });

/**
 * POST /api/ai/timeline — PROMPTS.md §6. `{ apply: false }` returns the
 * draft for review without writing; the default applies it, skipping any
 * title that already exists so running it twice is harmless.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withAiErrors(async () => {
    const raw = await request.text();
    const body = raw ? schema.parse(JSON.parse(raw)) : {};
    const result = await tasks.generateTimeline(session.id, { apply: body.apply });

    return NextResponse.json({
      drafted: result.drafted,
      created: result.created,
      createdCount: result.created.length,
      skipped: result.skipped,
      applied: body.apply !== false,
      provider: result.provider,
      model: result.model,
      fellBack: result.fellBack,
    });
  });
}
