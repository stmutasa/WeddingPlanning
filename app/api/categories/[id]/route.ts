import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";

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
    const category = await db.category.update({ where: { id }, data: body });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Category",
      entityId: category.id,
      summary: `${session.name ?? "Someone"} updated the category ${category.name}`,
    });

    return NextResponse.json(category);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/categories/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const category = await db.category.findUnique({ where: { id } });
    if (!category) return apiError("Category not found", 404);

    await db.category.delete({ where: { id } });

    await recordActivity({
      userId: session.id,
      action: "DELETED",
      entityType: "Category",
      entityId: id,
      summary: `${session.name ?? "Someone"} deleted the category ${category.name}`,
    });

    return NextResponse.json({ ok: true });
  });
}
