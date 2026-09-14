import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withAiErrors } from "@/lib/http";
import { ai } from "@/lib/ai/client";
import * as aiContext from "@/lib/ai/context";
import * as prompts from "@/lib/ai/prompts";
import { fxToCents } from "@/lib/money/cents";
import * as fx from "@/lib/services/fx";

export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().min(1) });

/**
 * POST /api/ai/quick-add — PROMPTS.md §1. Parses one line into an expense
 * draft and resolves the names it returned to real ids, so the capture
 * sheet can show chips and save without a second round trip. Nothing is
 * written here: the person taps Save.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withAiErrors(async () => {
    const { text } = schema.parse(await request.json());

    const [base, ctx] = await Promise.all([
      aiContext.base(session.id),
      aiContext.capture(session.id),
    ]);
    const prompt = prompts.quickAdd(base, ctx, text);

    const completion = await ai.json<prompts.QuickAddDraft>({
      feature: "QUICK_ADD",
      system: prompt.system,
      user: prompt.user,
      schema: prompts.jsonSchema(prompts.quickAddSchema),
      schemaName: "quick_add",
      effort: "low",
      maxTokens: 600,
    });

    const draft = prompts.quickAddSchema.parse(completion.data);

    const [event, category, vendor, funder] = await Promise.all([
      draft.eventSlug ? db.event.findUnique({ where: { slug: draft.eventSlug } }) : null,
      draft.categoryName
        ? db.category.findFirst({ where: { name: draft.categoryName } })
        : null,
      draft.vendorId ? db.vendor.findUnique({ where: { id: draft.vendorId } }) : null,
      draft.funderName
        ? db.funder.findFirst({ where: { name: draft.funderName, archived: false } })
        : db.funder.findUnique({ where: { userId: session.id } }),
    ]);

    // Convert here so the chips can show USD straight away; the rate is
    // returned too, and stays editable on the form.
    const currency = (draft.originalCurrency || "USD").toUpperCase();
    const day = draft.date ?? new Date().toISOString().slice(0, 10);
    let amountCents: number | null = null;
    let fxRate: number | null = null;

    if (draft.amount != null) {
      if (currency === "USD") {
        amountCents = Math.round(draft.amount * 100);
      } else {
        try {
          fxRate = await fx.rate(day, currency);
          amountCents = fxToCents(draft.amount, fxRate);
        } catch {
          // FX is down: hand back the original amount and let the form ask
          // for the rate rather than failing the parse.
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
        vendorName: vendor?.name ?? draft.vendorNameNew,
        funderId: funder?.id ?? null,
        funderName: funder?.name ?? null,
        date: day,
        amountCents,
        fxRate,
        originalAmount: draft.amount,
        originalCurrency: currency,
      },
      provider: completion.provider,
      model: completion.model,
      fellBack: completion.fellBack,
    });
  });
}
