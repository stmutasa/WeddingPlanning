import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as plaid from "@/lib/services/plaid";

export const dynamic = "force-dynamic";

/** GET /api/plaid — connected institutions and their accounts, for Settings. */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const items = await plaid.items();
  return NextResponse.json({
    configured: plaid.isConfigured(),
    environment: plaid.environment(),
    // The encrypted access token never leaves the server.
    items: items.map(({ accessTokenEnc: _secret, ...item }) => item),
  });
}
