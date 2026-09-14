import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const category = await db.category.create({ data: body });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "Category",
      entityId: category.id,
      summary: `${session.name ?? "Someone"} added the category ${category.name}`,
    });

    return NextResponse.json(category, { status: 201 });
  });
}
