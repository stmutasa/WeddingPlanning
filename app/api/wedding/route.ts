import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents, zDate } from "@/lib/validation";

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

async function getOrCreateWedding() {
  return db.wedding.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
  });
}

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const wedding = await getOrCreateWedding();
  return NextResponse.json(wedding);
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = patchSchema.parse(await request.json());
    await getOrCreateWedding();
    const wedding = await db.wedding.update({ where: { id: "main" }, data: body });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Wedding",
      entityId: "main",
      summary: `${session.name ?? "Someone"} updated the wedding details`,
    });

    return NextResponse.json(wedding);
  });
}
