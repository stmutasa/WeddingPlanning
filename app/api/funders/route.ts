import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { FUNDER_KINDS } from "@/lib/types";
import { funders } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(FUNDER_KINDS),
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  return NextResponse.json(await funders.list(includeArchived));
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    return NextResponse.json(await funders.create(session.id, body), { status: 201 });
  });
}
