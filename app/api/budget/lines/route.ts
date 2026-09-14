import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zId } from "@/lib/validation";
import { BUDGET_LINE_SOURCES } from "@/lib/types";
import * as budget from "@/lib/services/budget";

export const dynamic = "force-dynamic";

const schema = z.object({
  eventId: zId,
  lines: z.array(
    z.object({
      categoryId: zId,
      plannedCents: zCents.min(0),
      note: z.string().nullable().optional(),
      source: z.enum(BUDGET_LINE_SOURCES).optional(),
    })
  ),
});

/**
 * PUT /api/budget/lines — DESIGN.md §4 `budget.setLines`: replaces the
 * event's whole set of planned lines. Single-line edits stay on
 * /api/budget-lines.
 */
export async function PUT(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = schema.parse(await request.json());
    await budget.setLines(session.id, body.eventId, body.lines);
    return NextResponse.json({ ok: true, summary: await budget.summary() });
  });
}
