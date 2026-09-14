import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().nullable().optional(),
});

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const threads = await db.chatThread.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(threads);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const thread = await db.chatThread.create({
      data: { title: body.title ?? null, createdById: session.id },
    });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "ChatThread",
      entityId: thread.id,
      summary: `${session.name ?? "Someone"} started a new Ask thread`,
    });

    return NextResponse.json(thread, { status: 201 });
  });
}
