import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { USER_NOTE_KINDS } from "@/lib/types";
import * as notes from "@/lib/services/notes";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  kind: z.enum(USER_NOTE_KINDS).optional(),
  title: z.string().nullable().optional(),
  body: z.string().min(1),
  pinned: z.boolean().optional(),
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const kind = new URL(request.url).searchParams.get("kind");
  return NextResponse.json(await notes.list({ kind: kind ?? undefined }));
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const note = await notes.create(session.id, body);
    return NextResponse.json(note, { status: 201 });
  });
}
