import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { GUEST_SIDES } from "@/lib/types";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().nullable().optional(),
  household: z.string().nullable().optional(),
  side: z.enum(GUEST_SIDES).optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  dietary: z.string().nullable().optional(),
  plusOnes: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_request: Request, ctx: RouteContext<"/api/guests/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { id } = await ctx.params;
  const guest = await db.guest.findUnique({
    where: { id },
    include: { events: { include: { event: true } } },
  });
  if (!guest) return apiError("Guest not found", 404);
  return NextResponse.json(guest);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/guests/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const guest = await db.guest.update({ where: { id }, data: body });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Guest",
      entityId: guest.id,
      summary: `${session.name ?? "Someone"} updated guest ${guest.firstName}`,
    });

    return NextResponse.json(guest);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/guests/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const guest = await db.guest.findUnique({ where: { id } });
    if (!guest) return apiError("Guest not found", 404);

    await db.guest.delete({ where: { id } });

    await recordActivity({
      userId: session.id,
      action: "DELETED",
      entityType: "Guest",
      entityId: id,
      summary: `${session.name ?? "Someone"} removed guest ${guest.firstName}`,
    });

    return NextResponse.json({ ok: true });
  });
}
