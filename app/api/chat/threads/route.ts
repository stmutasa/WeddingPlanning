import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as chat from "@/lib/services/chat";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().nullable().optional(),
});

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;
  return NextResponse.json(await chat.threads());
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const thread = await chat.createThread(session.id, body.title ?? null);
    return NextResponse.json(thread, { status: 201 });
  });
}
