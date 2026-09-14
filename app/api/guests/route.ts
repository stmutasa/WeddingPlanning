import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { GUEST_SIDES } from "@/lib/types";

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
  const guests = await db.guest.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { household: { contains: q } },
          ],
        }
      : undefined,
    include: { events: { include: { event: true } } },
    orderBy: [{ household: "asc" }, { firstName: "asc" }],
  });
  return NextResponse.json(guests);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const guest = await db.guest.create({ data: body });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "Guest",
      entityId: guest.id,
      summary: `${session.name ?? "Someone"} added guest ${guest.firstName}`,
    });

    return NextResponse.json(guest, { status: 201 });
  });
}
