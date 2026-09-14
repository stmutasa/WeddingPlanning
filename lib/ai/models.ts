import { db } from "@/lib/db";
import type { AiModelInfo } from "./client";

/** Shape stored as JSON text in ModelCache.json. */
export interface CachedModelList {
  models: AiModelInfo[];
}

/** Reads a provider's cached model list (DESIGN.md §7: refreshed hourly by the scheduler). */
export async function readModelCache(provider: "openai" | "anthropic"): Promise<{
  models: AiModelInfo[];
  fetchedAt: Date | null;
}> {
  const row = await db.modelCache.findUnique({ where: { provider } });
  if (!row) return { models: [], fetchedAt: null };

  try {
    const parsed = JSON.parse(row.json) as AiModelInfo[];
    return { models: parsed, fetchedAt: row.fetchedAt };
  } catch {
    return { models: [], fetchedAt: row.fetchedAt };
  }
}

/**
 * DESIGN.md §7 "Resolution by match": when AI_MODEL is blank and
 * AI_MODEL_MATCH is set, resolve the primary model to the newest OpenAI
 * model whose id contains the match string. Phase B calls this at boot and
 * after each cache refresh, and writes the result to
 * AppSettings.aiPrimaryModel / aiPrimaryResolvedFrom. Phase A ships the
 * lookup logic only — nothing calls it yet.
 */
export async function resolvePrimaryModel(): Promise<{
  model: string | null;
  resolvedFrom: "" | "env" | "match";
}> {
  const envModel = process.env.AI_MODEL?.trim();
  if (envModel) {
    return { model: envModel, resolvedFrom: "env" };
  }

  const match = (process.env.AI_MODEL_MATCH ?? "astra").toLowerCase();
  const { models } = await readModelCache("openai");
  const candidates = models.filter((m) => m.id.toLowerCase().includes(match));
  if (candidates.length === 0) {
    return { model: null, resolvedFrom: "" };
  }

  candidates.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return { model: candidates[0].id, resolvedFrom: "match" };
}
