import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zOptionalId } from "@/lib/validation";
import { VENDOR_STATUSES } from "@/lib/types";
import * as vendors from "@/lib/services/vendors";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
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
  notes: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const withMoney = searchParams.get("withMoney") === "1";

  // ?withMoney=1 adds paidCents and nextDue to every row; without it the
  // shape is the Phase A one, plus `payments`.
  if (withMoney) return NextResponse.json(await vendors.withMoney());

  const rows = await vendors.list({
    status: searchParams.get("status") ?? undefined,
    eventId: searchParams.get("eventId") ?? undefined,
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const vendor = await vendors.create(session.id, body);
    return NextResponse.json(vendor, { status: 201 });
  });
}
