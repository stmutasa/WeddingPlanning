import { NextResponse } from "next/server";
import { requireSession, isSessionError } from "@/lib/http";
import { toCsv } from "@/lib/csv";
import * as expenses from "@/lib/services/expenses";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/expenses.csv — DESIGN.md §6 Settings > Data. Money is
 * written as both integer cents and dollars so a spreadsheet can total it
 * without anyone re-deriving the conversion.
 */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { expenses: rows } = await expenses.list({});

  const csv = toCsv(
    [
      "date",
      "description",
      "event",
      "category",
      "vendor",
      "funder",
      "amountCents",
      "amountUSD",
      "originalAmount",
      "originalCurrency",
      "fxRate",
      "source",
      "notes",
    ],
    rows.map((e) => [
      e.date.toISOString().slice(0, 10),
      e.description,
      e.event.name,
      e.category?.name ?? "",
      e.vendor?.name ?? "",
      e.funder.name,
      e.amountCents,
      (e.amountCents / 100).toFixed(2),
      e.originalAmount ?? "",
      e.originalCurrency ?? "",
      e.fxRate ?? "",
      e.source,
      e.notes ?? "",
    ])
  );

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
