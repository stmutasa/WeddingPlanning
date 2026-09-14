import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const status = new URL(request.url).searchParams.get("status") ?? "NEW";
  const transactions = await db.transaction.findMany({
    where: status === "ALL" ? undefined : { status },
    include: { account: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(transactions);
}
