import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents, zDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  date: zDate.nullable().optional(),
  budgetCents: zCents.optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const events = await db.event.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const event = await db.event.create({ data: body });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "Event",
      entityId: event.id,
      summary: `${session.name ?? "Someone"} added the event ${event.name}`,
    });

    return NextResponse.json(event, { status: 201 });
  });
}
