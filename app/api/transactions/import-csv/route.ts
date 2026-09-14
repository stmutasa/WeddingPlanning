import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { csvHeaders } from "@/lib/csv";
import * as transactions from "@/lib/services/transactions";

export const dynamic = "force-dynamic";

const mappingSchema = z.object({
  dateColumn: z.string().min(1),
  nameColumn: z.string().min(1),
  amountColumn: z.string().min(1),
  merchantColumn: z.string().nullable().optional(),
  currencyColumn: z.string().nullable().optional(),
  amountSign: z.enum(["negative-is-spend", "positive-is-spend"]).optional(),
});

/**
 * POST /api/transactions/import-csv — multipart: `file` plus the column
 * mapping, either as individual form fields or as a JSON `mapping` field.
 * Rows land in the inbox like bank rows and are deduped by a hash of
 * date + amount + name (DESIGN.md §4).
 *
 * Posting the file with no mapping returns the header names so the UI can
 * ask which column is which.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return apiError("Attach a CSV file as `file`", 400);

    const raw = form.get("mapping");
    const fields = raw
      ? JSON.parse(String(raw))
      : {
          dateColumn: form.get("dateColumn"),
          nameColumn: form.get("nameColumn"),
          amountColumn: form.get("amountColumn"),
          merchantColumn: form.get("merchantColumn"),
          currencyColumn: form.get("currencyColumn"),
          amountSign: form.get("amountSign"),
        };

    const cleaned = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v != null && v !== "")
    );

    const parsed = mappingSchema.safeParse(cleaned);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Tell the importer which columns to use",
          headers: csvHeaders(await file.text()),
          needs: ["dateColumn", "nameColumn", "amountColumn"],
        },
        { status: 400 }
      );
    }

    const result = await transactions.importCsv(session.id, file, parsed.data);
    return NextResponse.json(result, { status: 201 });
  });
}
