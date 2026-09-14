import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { categories } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/categories/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    return NextResponse.json(await categories.update(session.id, id, body));
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/categories/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await categories.remove(session.id, id);
    return NextResponse.json({ ok: true });
  });
}
