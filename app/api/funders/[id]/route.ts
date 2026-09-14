import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/funders/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const funder = await db.funder.update({ where: { id }, data: body });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Funder",
      entityId: funder.id,
      summary: `${session.name ?? "Someone"} updated the funder ${funder.name}`,
    });

    return NextResponse.json(funder);
  });
}
