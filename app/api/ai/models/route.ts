import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";

export const dynamic = "force-dynamic";

// Phase A stub — real model list fetch + ModelCache land in lib/ai (Phase B).
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return NextResponse.json({ openai: [], anthropic: [], fetchedAt: null });
}
