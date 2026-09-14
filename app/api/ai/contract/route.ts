import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withAiErrors, apiError } from "@/lib/http";
import { ai, type AiContentPart } from "@/lib/ai/client";
import * as aiContext from "@/lib/ai/context";
import * as prompts from "@/lib/ai/prompts";
import { readUpload } from "@/lib/uploads";
import * as vendors from "@/lib/services/vendors";

export const dynamic = "force-dynamic";

const schema = z.object({
  attachmentId: z.string().min(1),
  save: z.boolean().optional(),
});

/**
 * POST /api/ai/contract — PROMPTS.md §9. Reads a stored attachment (or its
 * cached `extractedText`) and summarises it. `save: true` also writes the
 * summary onto the vendor. The UI offers "Apply schedule" afterwards, which
 * is a PUT to /api/vendors/[id]/payments.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withAiErrors(async () => {
    const { attachmentId, save } = schema.parse(await request.json());

    const attachment = await db.attachment.findUnique({
      where: { id: attachmentId },
      include: { vendor: true },
    });
    if (!attachment) return apiError("Attachment not found", 404);

    const base = await aiContext.base(session.id);
    const prompt = prompts.contract(base, attachment.vendor?.name ?? null);

    const content: AiContentPart[] = [{ type: "text", text: prompt.user }];

    if (attachment.extractedText) {
      content.push({ type: "text", text: attachment.extractedText });
    } else {
      const bytes = await readUpload(attachment.path);
      content.push(
        attachment.mime === "application/pdf"
          ? {
              type: "document",
              mediaType: "application/pdf",
              dataBase64: bytes.toString("base64"),
              filename: attachment.path,
            }
          : { type: "image", mediaType: attachment.mime, dataBase64: bytes.toString("base64") }
      );
    }

    const completion = await ai.json<prompts.ContractDraft>({
      feature: "CONTRACT",
      system: prompt.system,
      user: content,
      schema: prompts.jsonSchema(prompts.contractSchema),
      schemaName: "contract",
      effort: "medium",
      maxTokens: 1200,
    });

    const draft = prompts.contractSchema.parse(completion.data);

    if (save && attachment.vendorId) {
      await vendors.update(session.id, attachment.vendorId, { contractSummary: draft.summary });
    }

    return NextResponse.json({
      ...draft,
      attachmentId,
      vendorId: attachment.vendorId,
      vendorName: attachment.vendor?.name ?? null,
      saved: Boolean(save && attachment.vendorId),
      provider: completion.provider,
      model: completion.model,
      fellBack: completion.fellBack,
    });
  });
}
