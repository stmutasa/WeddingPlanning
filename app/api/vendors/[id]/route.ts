import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { zCents, zOptionalId } from "@/lib/validation";
import { VENDOR_STATUSES } from "@/lib/types";
import * as vendors from "@/lib/services/vendors";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  categoryId: zOptionalId,
  eventId: zOptionalId,
  status: z.enum(VENDOR_STATUSES).optional(),
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  quotedCents: zCents.nullable().optional(),
  quotedOriginalAmount: z.number().nullable().optional(),
  quotedOriginalCurrency: z.string().nullable().optional(),
  contractSummary: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export async function GET(_request: Request, ctx: RouteContext<"/api/vendors/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { id } = await ctx.params;
  const vendor = await vendors.get(id);
  if (!vendor) return apiError("Vendor not found", 404);
  return NextResponse.json(vendor);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/vendors/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const vendor = await vendors.update(session.id, id, body);
    return NextResponse.json(vendor);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/vendors/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await vendors.remove(session.id, id);
    return NextResponse.json({ ok: true });
  });
}
