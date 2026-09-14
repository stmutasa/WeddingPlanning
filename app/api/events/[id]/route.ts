import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { zCents, zDate } from "@/lib/validation";
import { events } from "@/lib/services/catalog";

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
  const event = await events.get(id);
  if (!event) return apiError("Event not found", 404);
  return NextResponse.json(event);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    return NextResponse.json(await events.update(session.id, id, body));
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await events.remove(session.id, id);
    return NextResponse.json({ ok: true });
  });
}
