import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { NOTE_KINDS } from "@/lib/types";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  kind: z.enum(NOTE_KINDS).optional(),
  title: z.string().nullable().optional(),
  body: z.string().min(1).optional(),
  pinned: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/notes/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const note = await db.note.update({ where: { id }, data: body });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Note",
      entityId: note.id,
      summary: `${session.name ?? "Someone"} updated a note`,
    });

    return NextResponse.json(note);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/notes/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const note = await db.note.findUnique({ where: { id } });
    if (!note) return apiError("Note not found", 404);

    await db.note.delete({ where: { id } });

    await recordActivity({
      userId: session.id,
      action: "DELETED",
      entityType: "Note",
      entityId: id,
      summary: `${session.name ?? "Someone"} deleted a note`,
    });

    return NextResponse.json({ ok: true });
  });
}
