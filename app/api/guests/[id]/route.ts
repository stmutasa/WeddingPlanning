import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { GUEST_SIDES } from "@/lib/types";
import * as guests from "@/lib/services/guests";

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
  const guest = await guests.get(id);
  if (!guest) return apiError("Guest not found", 404);
  return NextResponse.json(guest);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/guests/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const guest = await guests.update(session.id, id, body);
    return NextResponse.json(guest);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/guests/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await guests.remove(session.id, id);
    return NextResponse.json({ ok: true });
  });
}
