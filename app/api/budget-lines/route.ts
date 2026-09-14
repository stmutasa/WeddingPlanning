import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents, zId } from "@/lib/validation";
import { BUDGET_LINE_SOURCES } from "@/lib/types";

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
  const lines = await db.budgetLine.findMany({
    where: eventId ? { eventId } : undefined,
    include: { category: true, event: true },
  });
  return NextResponse.json(lines);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const line = await db.budgetLine.create({ data: body });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "BudgetLine",
      entityId: line.id,
      summary: `${session.name ?? "Someone"} added a budget line`,
    });

    return NextResponse.json(line, { status: 201 });
  });
}
