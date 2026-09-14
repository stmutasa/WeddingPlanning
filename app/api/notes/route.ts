import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { NOTE_KINDS } from "@/lib/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  kind: z.enum(NOTE_KINDS).optional(),
  title: z.string().nullable().optional(),
  body: z.string().min(1),
  pinned: z.boolean().optional(),
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const kind = new URL(request.url).searchParams.get("kind");
  const notes = await db.note.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(notes);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const note = await db.note.create({ data: { ...body, createdById: session.id } });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "Note",
      entityId: note.id,
      summary: `${session.name ?? "Someone"} added a ${note.kind.toLowerCase()}`,
    });

    return NextResponse.json(note, { status: 201 });
  });
}
