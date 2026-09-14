import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const n = Number(new URL(request.url).searchParams.get("n") ?? "25");
  const activity = await db.activity.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(n, 1), 200),
  });
  return NextResponse.json(activity);
}
