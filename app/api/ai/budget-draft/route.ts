import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withAiErrors } from "@/lib/http";
import { ai } from "@/lib/ai/client";
import * as aiContext from "@/lib/ai/context";
import * as prompts from "@/lib/ai/prompts";
import * as budget from "@/lib/services/budget";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/budget-draft — PROMPTS.md §5. Returns a draft only: the UI
 * shows it as a diff against the current envelopes and lines and applies it
 * through /api/budget/envelopes and /api/budget/lines on confirm.
 */
export async function POST() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withAiErrors(async () => {
    const [base, ctx] = await Promise.all([aiContext.base(session.id), aiContext.budgetDraft()]);
    const prompt = prompts.budgetDraft(base, ctx);

    const completion = await ai.json<prompts.BudgetDraft>({
      feature: "BUDGET_DRAFT",
      system: prompt.system,
      user: prompt.user,
      schema: prompts.jsonSchema(prompts.budgetDraftSchema),
      schemaName: "budget_draft",
      effort: "high",
      maxTokens: 4000,
    });

    const draft = prompts.budgetDraftSchema.parse(completion.data);

    // Resolve slugs and category names to ids so the confirm step is a
    // straight PUT, and check the sum the model was told to hit exactly.
    const [events, categories, current] = await Promise.all([
      db.event.findMany(),
      db.category.findMany(),
      budget.summary(),
    ]);
    const eventBySlug = new Map(events.map((e) => [e.slug, e]));
    const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

    const envelopes = draft.envelopes.map((e) => {
      const event = eventBySlug.get(e.eventSlug);
      const before = current.envelopes.find((x) => x.eventSlug === e.eventSlug);
      return {
        eventSlug: e.eventSlug,
        eventId: event?.id ?? null,
        eventName: event?.name ?? e.eventSlug,
        budgetCents: e.budgetCents,
        currentCents: before?.budgetCents ?? 0,
        deltaCents: e.budgetCents - (before?.budgetCents ?? 0),
        rationale: e.rationale,
      };
    });

    const lines = draft.lines.map((l) => ({
      eventSlug: l.eventSlug,
      eventId: eventBySlug.get(l.eventSlug)?.id ?? null,
      categoryName: l.categoryName,
      categoryId: categoryByName.get(l.categoryName.toLowerCase())?.id ?? null,
      plannedCents: l.plannedCents,
      rationale: l.rationale,
    }));

    const proposedTotal = envelopes.reduce((t, e) => t + e.budgetCents, 0);
    const warnings = [...draft.warnings];
    if (proposedTotal !== current.totalCents) {
      warnings.push(
        `The drafted envelopes total ${proposedTotal} cents, not the ${current.totalCents} cent budget.`
      );
    }
    for (const line of lines) {
      if (!line.categoryId) warnings.push(`No category called "${line.categoryName}" exists yet.`);
    }

    return NextResponse.json({
      envelopes,
      lines,
      assumptions: draft.assumptions,
      warnings,
      proposedTotalCents: proposedTotal,
      currentTotalCents: current.totalCents,
      provider: completion.provider,
      model: completion.model,
      fellBack: completion.fellBack,
    });
  });
}
