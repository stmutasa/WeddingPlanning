import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { ids } = reorderSchema.parse(await request.json());

    await db.$transaction(
      ids.map((id, index) => db.task.update({ where: { id }, data: { sortOrder: index } }))
    );

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Task",
      entityId: null,
      summary: `${session.name ?? "Someone"} reordered tasks`,
    });

    return NextResponse.json({ ok: true });
  });
}
