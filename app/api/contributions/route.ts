import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zDate, zId } from "@/lib/validation";
import { contributions } from "@/lib/services/catalog";

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
  return NextResponse.json(await contributions.list(funderId ?? undefined));
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    return NextResponse.json(await contributions.create(session.id, body), { status: 201 });
  });
}
