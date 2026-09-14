import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as tasks from "@/lib/services/tasks";

export const dynamic = "force-dynamic";

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { ids } = reorderSchema.parse(await request.json());
    await tasks.reorder(ids);
    return NextResponse.json({ ok: true });
  });
}
