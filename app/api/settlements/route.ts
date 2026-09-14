import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zId } from "@/lib/validation";
import * as settle from "@/lib/services/settle";

export const dynamic = "force-dynamic";

// from/to are optional: with neither, the service settles whoever currently
// owes whom (DESIGN.md §4 `settle.record`).
const createSchema = z.object({
  fromUserId: zId.optional(),
  toUserId: zId.optional(),
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
    const settlement = await settle.record(
      session.id,
      body.amountCents,
      body.note ?? null,
      body.fromUserId && body.toUserId
        ? { fromUserId: body.fromUserId, toUserId: body.toUserId }
        : undefined
    );
    return NextResponse.json(settlement, { status: 201 });
  });
}
