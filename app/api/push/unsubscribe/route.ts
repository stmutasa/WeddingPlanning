import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as push from "@/lib/services/push";

export const dynamic = "force-dynamic";

const schema = z.object({ endpoint: z.string().min(1) });

export async function DELETE(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { endpoint } = schema.parse(await request.json());
    await push.unsubscribe(session.id, endpoint);
    return NextResponse.json({ ok: true });
  });
}
