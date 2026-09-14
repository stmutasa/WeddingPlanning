import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { FUNDER_KINDS } from "@/lib/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(FUNDER_KINDS),
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  const funders = await db.funder.findMany({
    where: includeArchived ? undefined : { archived: false },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(funders);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    if (body.kind === "USER") {
      return NextResponse.json(
        { error: "USER funders are created automatically on sign-in" },
        { status: 400 }
      );
    }
    const funder = await db.funder.create({ data: body });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "Funder",
      entityId: funder.id,
      summary: `${session.name ?? "Someone"} added the funder ${funder.name}`,
    });

    return NextResponse.json(funder, { status: 201 });
  });
}
