import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as activity from "@/lib/services/activity";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const n = Number(new URL(request.url).searchParams.get("n") ?? "25");
  return NextResponse.json(await activity.recent(Number.isFinite(n) ? n : 25));
}
