import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withAiErrors, apiError } from "@/lib/http";
import { ai, type AiContentPart } from "@/lib/ai/client";
import * as aiContext from "@/lib/ai/context";
import * as prompts from "@/lib/ai/prompts";
import { fxToCents } from "@/lib/money/cents";
import { readUpload } from "@/lib/uploads";
import * as fx from "@/lib/services/fx";

export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * POST /api/ai/receipt — PROMPTS.md §2. Multipart `file` (image or PDF), or
 * `attachmentId` to re-read something already stored. Creates nothing: the
 * capture sheet prefills a form the person confirms.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withAiErrors(async () => {
    const form = await request.formData();
    const file = form.get("file");
    const attachmentId = form.get("attachmentId");

    let bytes: Buffer;
    let mediaType: string;
    let filename: string;

    if (file instanceof Blob) {
      if (file.size > MAX_BYTES) return apiError("That file is too large (12MB max)", 413);
      bytes = Buffer.from(await file.arrayBuffer());
      mediaType = file.type || "image/jpeg";
      filename = file instanceof File ? file.name : "receipt";
    } else if (typeof attachmentId === "string" && attachmentId) {
      const attachment = await db.attachment.findUnique({ where: { id: attachmentId } });
      if (!attachment) return apiError("Attachment not found", 404);
      bytes = await readUpload(attachment.path);
      mediaType = attachment.mime;
      filename = attachment.path;
    } else {
      return apiError("Attach a `file`, or give an `attachmentId`", 400);
    }

    const isPdf = mediaType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
    const [base, ctx] = await Promise.all([
      aiContext.base(session.id),
      aiContext.capture(session.id),
    ]);
    const prompt = prompts.receipt(base, ctx);

    const content: AiContentPart[] = [
      { type: "text", text: prompt.user },
      isPdf
        ? {
            type: "document",
            mediaType: "application/pdf",
            dataBase64: bytes.toString("base64"),
            filename,
          }
        : { type: "image", mediaType, dataBase64: bytes.toString("base64") },
    ];

    const completion = await ai.json<prompts.ReceiptDraft>({
      feature: "RECEIPT",
      system: prompt.system,
      user: content,
      schema: prompts.jsonSchema(prompts.receiptSchema),
      schemaName: "receipt",
      effort: "medium",
      maxTokens: 1500,
    });

    const draft = prompts.receiptSchema.parse(completion.data);

    const [event, category, vendor] = await Promise.all([
      draft.suggestedEventSlug
        ? db.event.findUnique({ where: { slug: draft.suggestedEventSlug } })
        : null,
      draft.suggestedCategoryName
        ? db.category.findFirst({ where: { name: draft.suggestedCategoryName } })
        : null,
      draft.vendorMatchId ? db.vendor.findUnique({ where: { id: draft.vendorMatchId } }) : null,
    ]);

    const currency = (draft.currency || "USD").toUpperCase();
    const day = draft.date ?? new Date().toISOString().slice(0, 10);
    let amountCents: number | null = null;
    let fxRate: number | null = null;

    const total = draft.paidAmount ?? draft.total;
    if (total != null) {
      if (currency === "USD") {
        amountCents = Math.round(total * 100);
      } else {
        try {
          fxRate = await fx.rate(day, currency);
          amountCents = fxToCents(total, fxRate);
        } catch {
          amountCents = null;
        }
      }
    }

    return NextResponse.json({
      draft,
      resolved: {
        eventId: event?.id ?? null,
        eventName: event?.name ?? null,
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? null,
        vendorId: vendor?.id ?? null,
        vendorName: vendor?.name ?? draft.merchant,
        date: day,
        amountCents,
        fxRate,
        originalAmount: total,
        originalCurrency: currency,
        // A quote or invoice with instalments: the UI offers
        // "Create vendor + payment schedule" alongside the expense.
        offersSchedule: draft.schedule.length > 0,
      },
      provider: completion.provider,
      model: completion.model,
      fellBack: completion.fellBack,
    });
  });
}
