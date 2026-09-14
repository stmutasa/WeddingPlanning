import { NextResponse } from "next/server";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import * as guests from "@/lib/services/guests";

export const dynamic = "force-dynamic";

/**
 * POST /api/guests/import-csv — multipart `file`. Column names are matched
 * by common aliases (name / first name / household / side / rsvp / …), so
 * no mapping step is needed for the spreadsheets people actually have.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return apiError("Attach a CSV file as `file`", 400);

    const result = await guests.importCsv(session.id, file);
    return NextResponse.json(result, { status: 201 });
  });
}
