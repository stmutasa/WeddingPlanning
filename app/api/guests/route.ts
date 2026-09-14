import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { GUEST_SIDES } from "@/lib/types";
import * as guests from "@/lib/services/guests";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  firstName: z.string().min(1),
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

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const q = new URL(request.url).searchParams.get("q");
  return NextResponse.json(await guests.list({ q: q ?? undefined }));
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const guest = await guests.create(session.id, body);
    return NextResponse.json(guest, { status: 201 });
  });
}
