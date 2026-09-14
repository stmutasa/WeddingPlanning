import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError, apiError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { saveUpload } from "@/lib/uploads";
import { ATTACHMENT_KINDS, type AttachmentKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteContext<"/api/expenses/[id]/attachments">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) return apiError("Expense not found", 404);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return apiError("Missing file", 400);

    const kindRaw = String(form.get("kind") ?? "RECEIPT");
    const kind: AttachmentKind = (ATTACHMENT_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as AttachmentKind)
      : "RECEIPT";

    const originalName = file instanceof File ? file.name : "upload";
    const { relativePath, bytes } = await saveUpload(file, originalName);

    const attachment = await db.attachment.create({
      data: {
        expenseId: id,
        kind,
        path: relativePath,
        mime: file.type || "application/octet-stream",
        bytes,
      },
    });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "Expense",
      entityId: id,
      summary: `${session.name ?? "Someone"} attached a ${kind.toLowerCase()} to ${expense.description}`,
    });

    return NextResponse.json(attachment, { status: 201 });
  });
}
