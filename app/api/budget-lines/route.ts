import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zId } from "@/lib/validation";
import { BUDGET_LINE_SOURCES } from "@/lib/types";
import { budgetLines } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  eventId: zId,
  categoryId: zId,
  plannedCents: zCents,
  note: z.string().nullable().optional(),
  source: z.enum(BUDGET_LINE_SOURCES).optional(),
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const eventId = new URL(request.url).searchParams.get("eventId");
  return NextResponse.json(await budgetLines.list(eventId ?? undefined));
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    return NextResponse.json(await budgetLines.create(session.id, body), { status: 201 });
  });
}
