import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as push from "@/lib/services/push";

export const dynamic = "force-dynamic";

/** GET /api/push/vapid — the public key the browser needs to subscribe. */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return NextResponse.json({
    publicKey: push.publicKey(),
    configured: push.isConfigured(),
  });
}
