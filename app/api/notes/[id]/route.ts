import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { USER_NOTE_KINDS } from "@/lib/types";
import * as notes from "@/lib/services/notes";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  kind: z.enum(USER_NOTE_KINDS).optional(),
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
    const note = await notes.update(session.id, id, body);
    return NextResponse.json(note);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/notes/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await notes.remove(session.id, id);
    return NextResponse.json({ ok: true });
  });
}
