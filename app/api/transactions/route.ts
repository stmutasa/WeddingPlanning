import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import * as transactions from "@/lib/services/transactions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const status = new URL(request.url).searchParams.get("status") ?? "NEW";
  return NextResponse.json(await transactions.list({ status }));
}
