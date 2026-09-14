import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/payments?status=OPEN&days=30 — DESIGN.md §6 Money > Payments tab.
export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const days = searchParams.get("days");

  const dueDate = days
    ? { lte: new Date(Date.now() + Number(days) * 86_400_000) }
    : undefined;

  const payments = await db.paymentDue.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(dueDate ? { dueDate } : {}),
    },
    include: { vendor: true },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(payments);
}
