import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zDate } from "@/lib/validation";
import * as settings from "@/lib/services/settings";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  coupleNames: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  eventTimezone: z.string().min(1).optional(),
  targetMonth: z.string().min(1).optional(),
  weddingDate: zDate.nullable().optional(),
  budgetCents: zCents.optional(),
  currency: z.string().min(1).optional(),
  splitNumerator: z.number().int().positive().optional(),
  splitDenominator: z.number().int().positive().optional(),
});

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;
  return NextResponse.json(await settings.wedding());
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = patchSchema.parse(await request.json());
    return NextResponse.json(await settings.updateWedding(session.id, body));
  });
}
