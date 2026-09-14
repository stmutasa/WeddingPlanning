import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { categories } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;
  return NextResponse.json(await categories.list());
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    return NextResponse.json(await categories.create(session.id, body), { status: 201 });
  });
}
