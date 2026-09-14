import { NextResponse } from "next/server";
import { requireSession, isSessionError, apiError, withApiErrors } from "@/lib/http";
import { ATTACHMENT_KINDS, type AttachmentKind } from "@/lib/types";
import * as attachments from "@/lib/services/attachments";
import * as vendors from "@/lib/services/vendors";

export const dynamic = "force-dynamic";

/**
 * Quotes and contracts hang off the vendor, which is what
 * `POST /api/ai/contract` then reads by `attachmentId`.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/vendors/[id]/attachments">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const vendor = await vendors.get(id);
    if (!vendor) return apiError("Vendor not found", 404);
    return NextResponse.json(vendor.attachments);
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/vendors/[id]/attachments">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return apiError("Missing file", 400);

    const kindRaw = String(form.get("kind") ?? "CONTRACT");
    const kind: AttachmentKind = (ATTACHMENT_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as AttachmentKind)
      : "CONTRACT";

    const attachment = await attachments.attach(session.id, {
      file,
      originalName: file instanceof File ? file.name : "upload",
      kind,
      vendorId: id,
    });

    return NextResponse.json(attachment, { status: 201 });
  });
}
