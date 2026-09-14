import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withAiErrors } from "@/lib/http";
import * as transactions from "@/lib/services/transactions";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string().min(1)).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

/**
 * POST /api/ai/triage — PROMPTS.md §3, batched 25 rows per model call.
 * Internal: sync and CSV import already call it, this route is for
 * re-triaging the inbox by hand. With no `ids` it takes untriaged NEW rows.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withAiErrors(async () => {
    const raw = await request.text();
    const body = raw ? schema.parse(JSON.parse(raw)) : {};

    let ids = body.ids;
    if (!ids || ids.length === 0) {
      const rows = await db.transaction.findMany({
        where: { status: "NEW", aiIsWedding: null },
        orderBy: { date: "desc" },
        take: body.limit ?? 50,
        select: { id: true },
      });
      ids = rows.map((r) => r.id);
    }

    const results = await transactions.triage(ids);
    return NextResponse.json({ triaged: results.length, results });
  });
}
