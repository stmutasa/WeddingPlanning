import { db } from "@/lib/db";
import type { AiFeature, AiProvider } from "@/lib/types";

/**
 * DESIGN.md §7: "Cost from a rate table... OpenAI rows filled in by Simi
 * when he confirms the model id; unpriced -> costMicros = null, shown as
 * 'n/a'." Prices are USD per million tokens (MTok); costMicros is USD
 * micro-dollars (1 USD = 1,000,000 micros), so `tokens * pricePerMTok`
 * already gives micros directly (tokens/1e6 * price, times 1e6 to get
 * micros, cancels to tokens * price).
 */

export interface ModelRate {
  inputPerMTok: number;
  outputPerMTok: number;
}

// Keyed by a lowercase substring of the model id.
export const RATE_TABLE: Record<string, ModelRate> = {
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-haiku-4.5": { inputPerMTok: 1, outputPerMTok: 5 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  // OpenAI rows: left unpriced until Simi confirms the resolved model id.
};

function findRate(model: string): ModelRate | null {
  const key = model.toLowerCase();
  for (const [needle, rate] of Object.entries(RATE_TABLE)) {
    if (key.includes(needle)) return rate;
  }
  return null;
}

/** Returns micro-dollars, or null when the model has no rate on file ("n/a" in the UI). */
export function computeCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const rate = findRate(model);
  if (!rate) return null;
  return Math.round(inputTokens * rate.inputPerMTok + outputTokens * rate.outputPerMTok);
}

export interface RecordUsageInput {
  provider: AiProvider;
  model: string;
  feature: AiFeature;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  latencyMs?: number | null;
  fellBack?: boolean;
}

/**
 * One row per provider call, written *before* the response is interpreted
 * (DESIGN.md §7) so a call that later fails validation is still accounted
 * for. Never throws: metering must not break a feature.
 */
export async function record(input: RecordUsageInput): Promise<void> {
  try {
    await db.aiUsage.create({
      data: {
        provider: input.provider,
        model: input.model,
        feature: input.feature,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cachedTokens: input.cachedTokens ?? 0,
        costMicros: computeCostMicros(input.model, input.inputTokens, input.outputTokens),
        latencyMs: input.latencyMs ?? null,
        fellBack: input.fellBack ?? false,
      },
    });
  } catch (err) {
    console.error("[ai] could not record usage", err);
  }
}

export interface UsageBreakdownRow {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costMicros: number | null;
}

export interface UsageReport {
  window: string;
  since: string;
  totals: UsageBreakdownRow;
  byFeature: UsageBreakdownRow[];
  byModel: UsageBreakdownRow[];
  fellBackCalls: number;
  unpricedCalls: number;
}

const WINDOWS: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: 36_500,
};

/** DESIGN.md §4 `ai.usage(window)` — the Settings usage tiles. */
export async function usage(window = "30d"): Promise<UsageReport> {
  const days = WINDOWS[window] ?? WINDOWS["30d"];
  const since = new Date(Date.now() - days * 86_400_000);

  const rows = await db.aiUsage.findMany({ where: { createdAt: { gte: since } } });

  const blank = (key: string): UsageBreakdownRow => ({
    key,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    costMicros: 0,
  });

  const totals = blank("total");
  const byFeature = new Map<string, UsageBreakdownRow>();
  const byModel = new Map<string, UsageBreakdownRow>();
  let fellBackCalls = 0;
  let unpricedCalls = 0;

  for (const r of rows) {
    for (const bucket of [
      totals,
      byFeature.get(r.feature) ?? byFeature.set(r.feature, blank(r.feature)).get(r.feature)!,
      byModel.get(r.model) ?? byModel.set(r.model, blank(r.model)).get(r.model)!,
    ]) {
      bucket.calls += 1;
      bucket.inputTokens += r.inputTokens;
      bucket.outputTokens += r.outputTokens;
      bucket.cachedTokens += r.cachedTokens;
      if (r.costMicros == null) bucket.costMicros = null;
      else if (bucket.costMicros != null) bucket.costMicros += r.costMicros;
    }
    if (r.fellBack) fellBackCalls += 1;
    if (r.costMicros == null) unpricedCalls += 1;
  }

  const sortByCalls = (a: UsageBreakdownRow, b: UsageBreakdownRow) => b.calls - a.calls;

  return {
    window,
    since: since.toISOString(),
    totals,
    byFeature: [...byFeature.values()].sort(sortByCalls),
    byModel: [...byModel.values()].sort(sortByCalls),
    fellBackCalls,
    unpricedCalls,
  };
}
