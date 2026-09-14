import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zId } from "@/lib/validation";
import * as budget from "@/lib/services/budget";

export const dynamic = "force-dynamic";

const schema = z.object({
  envelopes: z.array(z.object({ eventId: zId, budgetCents: zCents.min(0) })).min(1),
});

/** PUT /api/budget/envelopes — DESIGN.md §4 `budget.setEnvelopes`. */
export async function PUT(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = schema.parse(await request.json());
    const events = await budget.setEnvelopes(session.id, body.envelopes);
    return NextResponse.json({ events, summary: await budget.summary() });
  });
}
