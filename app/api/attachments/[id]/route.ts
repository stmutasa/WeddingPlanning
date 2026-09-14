import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError, apiError } from "@/lib/http";
import { readUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { id } = await ctx.params;
  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment) return apiError("Attachment not found", 404);

  try {
    const bytes = await readUpload(attachment.path);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": attachment.mime,
        "Content-Length": String(attachment.bytes),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return apiError("File missing on disk", 404);
  }
}
