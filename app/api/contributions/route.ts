import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zCents, zDate, zId } from "@/lib/validation";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  funderId: zId,
  amountCents: zCents,
  date: zDate,
  note: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const funderId = new URL(request.url).searchParams.get("funderId");
  const contributions = await db.contribution.findMany({
    where: funderId ? { funderId } : undefined,
    include: { funder: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(contributions);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const contribution = await db.contribution.create({ data: body });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "Contribution",
      entityId: contribution.id,
      summary: `${session.name ?? "Someone"} logged a contribution, $${(body.amountCents / 100).toFixed(2)}`,
    });

    return NextResponse.json(contribution, { status: 201 });
  });
}
