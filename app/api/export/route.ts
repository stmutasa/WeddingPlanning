import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/export — DESIGN.md §6 Settings > Data > "Export JSON".
// Secrets (briefToken, encrypted Plaid access tokens) are never included.
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const [
    wedding,
    appSettings,
    events,
    categories,
    budgetLines,
    funders,
    vendors,
    paymentDues,
    expenses,
    contributions,
    settlements,
    transactions,
    tasks,
    notes,
    guests,
    activity,
  ] = await Promise.all([
    db.wedding.findUnique({ where: { id: "main" } }),
    db.appSettings.findUnique({ where: { id: "main" } }),
    db.event.findMany(),
    db.category.findMany(),
    db.budgetLine.findMany(),
    db.funder.findMany(),
    db.vendor.findMany(),
    db.paymentDue.findMany(),
    db.expense.findMany(),
    db.contribution.findMany(),
    db.settlement.findMany(),
    db.transaction.findMany(),
    db.task.findMany(),
    db.note.findMany(),
    db.guest.findMany({ include: { events: true } }),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    wedding,
    appSettings: appSettings ? { ...appSettings, briefToken: undefined } : null,
    events,
    categories,
    budgetLines,
    funders,
    vendors,
    paymentDues,
    expenses,
    contributions,
    settlements,
    transactions,
    tasks,
    notes,
    guests,
    activity,
  });
}
