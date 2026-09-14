import { NextResponse } from "next/server";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import * as plaid from "@/lib/services/plaid";

export const dynamic = "force-dynamic";

/**
 * POST /api/plaid/link-token — step one of the Link flow (DESIGN.md §9).
 * Without Plaid credentials the service throws PlaidNotConfigured, which
 * the error wrapper answers as 503 `{ error }`.
 */
export async function POST() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { linkToken, expiration } = await plaid.createLinkToken(session.id);
    return NextResponse.json({ linkToken, expiration, environment: plaid.environment() });
  });
}
