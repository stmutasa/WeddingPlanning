import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zDate } from "@/lib/validation";
import { events } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  date: zDate.nullable().optional(),
  budgetCents: zCents.optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;
  return NextResponse.json(await events.list());
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    return NextResponse.json(await events.create(session.id, body), { status: 201 });
  });
}
