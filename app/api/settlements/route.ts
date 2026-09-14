import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents, zId } from "@/lib/validation";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  fromUserId: zId,
  toUserId: zId,
  amountCents: zCents.positive(),
  note: z.string().nullable().optional(),
});

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const settlements = await db.settlement.findMany({ orderBy: { settledAt: "desc" } });
  return NextResponse.json(settlements);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const settlement = await db.settlement.create({ data: body });

    await recordActivity({
      userId: session.id,
      action: "SETTLED",
      entityType: "Settlement",
      entityId: settlement.id,
      summary: `${session.name ?? "Someone"} recorded a settle-up, $${(body.amountCents / 100).toFixed(2)}`,
    });

    return NextResponse.json(settlement, { status: 201 });
  });
}
