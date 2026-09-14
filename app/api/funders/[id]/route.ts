import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { funders } from "@/lib/services/catalog";

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
    return NextResponse.json(await funders.update(session.id, id, body));
  });
}
