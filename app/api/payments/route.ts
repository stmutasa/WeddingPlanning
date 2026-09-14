import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as payments from "@/lib/services/payments";

export const dynamic = "force-dynamic";

// GET /api/payments?status=OPEN&days=30 — DESIGN.md §6 Money > Payments tab.
export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const days = searchParams.get("days");

  return NextResponse.json(
    await payments.list({
      status: searchParams.get("status") ?? undefined,
      days: days ? Number(days) : undefined,
    })
  );
}
