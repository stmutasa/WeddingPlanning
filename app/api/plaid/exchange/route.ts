import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as plaid from "@/lib/services/plaid";

export const dynamic = "force-dynamic";

const schema = z.object({ publicToken: z.string().min(1) });

/** POST /api/plaid/exchange — stores the item with an encrypted access token. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { publicToken } = schema.parse(await request.json());
    const result = await plaid.exchange(session.id, publicToken);
    return NextResponse.json(result, { status: 201 });
  });
}
