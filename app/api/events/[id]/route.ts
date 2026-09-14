import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents, zDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  date: zDate.nullable().optional(),
  budgetCents: zCents.optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { id } = await ctx.params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) return apiError("Event not found", 404);
  return NextResponse.json(event);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const event = await db.event.update({ where: { id }, data: body });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Event",
      entityId: event.id,
      summary: `${session.name ?? "Someone"} updated ${event.name}`,
    });

    return NextResponse.json(event);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const event = await db.event.findUnique({ where: { id } });
    if (!event) return apiError("Event not found", 404);
    if (event.locked) return apiError("This event cannot be deleted", 400);

    await db.event.delete({ where: { id } });

    await recordActivity({
      userId: session.id,
      action: "DELETED",
      entityType: "Event",
      entityId: id,
      summary: `${session.name ?? "Someone"} deleted ${event.name}`,
    });

    return NextResponse.json({ ok: true });
  });
}
