import { db } from "@/lib/db";
import type { AiProvider } from "@/lib/types";
import type { AiModelInfo } from "./protocol";
import * as anthropic from "./anthropic";
import * as openai from "./openai";

/**
 * Live model lists, cached in `ModelCache` for an hour (DESIGN.md §7), plus
 * the `AI_MODEL` / `AI_MODEL_MATCH` resolution that picks the primary model
 * at boot because the exact OpenAI id is not known at contract time
 * (CONTEXT.md §3).
 */

const CACHE_TTL_MS = 60 * 60 * 1000;

export interface ModelsResult {
  openai: AiModelInfo[];
  anthropic: AiModelInfo[];
  fetchedAt: string | null;
  errors: Partial<Record<AiProvider, string>>;
}

export async function readModelCache(provider: AiProvider): Promise<{
  models: AiModelInfo[];
  fetchedAt: Date | null;
}> {
  const row = await db.modelCache.findUnique({ where: { provider } });
  if (!row) return { models: [], fetchedAt: null };

  try {
    return { models: JSON.parse(row.json) as AiModelInfo[], fetchedAt: row.fetchedAt };
  } catch {
    return { models: [], fetchedAt: row.fetchedAt };
  }
}

async function writeModelCache(provider: AiProvider, models: AiModelInfo[]): Promise<Date> {
  const fetchedAt = new Date();
  await db.modelCache.upsert({
    where: { provider },
    update: { json: JSON.stringify(models), fetchedAt },
    create: { provider, json: JSON.stringify(models), fetchedAt },
  });
  return fetchedAt;
}

function isStale(fetchedAt: Date | null, ttlMs = CACHE_TTL_MS): boolean {
  return !fetchedAt || Date.now() - fetchedAt.getTime() > ttlMs;
}

interface ProviderList {
  models: AiModelInfo[];
  fetchedAt: Date | null;
  error?: string;
}

async function refreshProvider(provider: AiProvider): Promise<ProviderList> {
  const hasKey = provider === "openai" ? openai.hasKey() : anthropic.hasKey();
  if (!hasKey) {
    const cached = await readModelCache(provider);
    return { ...cached, error: `No ${provider === "openai" ? "OPENAI" : "ANTHROPIC"}_API_KEY is set` };
  }

  try {
    const models = provider === "openai" ? await openai.listModels() : await anthropic.listModels();
    const fetchedAt = await writeModelCache(provider, models);
    return { models, fetchedAt };
  } catch (err) {
    const cached = await readModelCache(provider);
    return {
      ...cached,
      error: err instanceof Error ? err.message : `Could not list ${provider} models`,
    };
  }
}

/** Both lists, from cache unless `force` or the cache is over an hour old. */
export async function list(force = false): Promise<ModelsResult> {
  const [cachedOpenai, cachedAnthropic] = await Promise.all([
    readModelCache("openai"),
    readModelCache("anthropic"),
  ]);

  const needOpenai = force || isStale(cachedOpenai.fetchedAt);
  const needAnthropic = force || isStale(cachedAnthropic.fetchedAt);

  const [o, a]: [ProviderList, ProviderList] = await Promise.all([
    needOpenai ? refreshProvider("openai") : Promise.resolve(cachedOpenai),
    needAnthropic ? refreshProvider("anthropic") : Promise.resolve(cachedAnthropic),
  ]);

  const errors: Partial<Record<AiProvider, string>> = {};
  if (o.error) errors.openai = o.error;
  if (a.error) errors.anthropic = a.error;

  const fetchedAt = [o.fetchedAt, a.fetchedAt]
    .filter((d): d is Date => d instanceof Date)
    .sort((x, y) => y.getTime() - x.getTime())[0];

  return {
    openai: o.models,
    anthropic: a.models,
    fetchedAt: fetchedAt ? fetchedAt.toISOString() : null,
    errors,
  };
}

/** Refreshes both caches when either is older than `ttlMs` (the nightly job). */
export async function refreshIfStale(ttlMs = 24 * 60 * 60 * 1000): Promise<boolean> {
  const [o, a] = await Promise.all([readModelCache("openai"), readModelCache("anthropic")]);
  if (!isStale(o.fetchedAt, ttlMs) && !isStale(a.fetchedAt, ttlMs)) return false;
  await list(true);
  await resolvePrimaryModel();
  return true;
}

export interface PrimaryResolution {
  model: string | null;
  resolvedFrom: "" | "env" | "match" | "user";
  /** Set when nothing could be resolved — Settings shows this as a banner. */
  problem: string | null;
}

/**
 * DESIGN.md §7 "Resolution by match". Precedence:
 *   1. a model the user picked in Settings (`aiPrimaryResolvedFrom = "user"`)
 *   2. `AI_MODEL` from the environment
 *   3. the newest OpenAI model whose id contains `AI_MODEL_MATCH` (default
 *      `astra`) in the cached live list
 * The result is written back to `AppSettings` so Settings can show both the
 * id and where it came from.
 */
export async function resolvePrimaryModel(): Promise<PrimaryResolution> {
  const settings = await db.appSettings.findUnique({ where: { id: "main" } });

  if (settings?.aiPrimaryResolvedFrom === "user" && settings.aiPrimaryModel) {
    return { model: settings.aiPrimaryModel, resolvedFrom: "user", problem: null };
  }

  const envModel = process.env.AI_MODEL?.trim();
  if (envModel) {
    await persist(envModel, "env");
    return { model: envModel, resolvedFrom: "env", problem: null };
  }

  const match = (process.env.AI_MODEL_MATCH ?? "astra").trim().toLowerCase();
  let { models } = await readModelCache("openai");
  if (models.length === 0 && openai.hasKey()) {
    models = (await refreshProvider("openai")).models;
  }

  const candidates = models.filter((m) => m.id.toLowerCase().includes(match));
  if (candidates.length === 0) {
    const problem =
      models.length === 0
        ? `No OpenAI model list is available, so the primary model could not be resolved from "${match}". The backup model runs instead.`
        : `No OpenAI model id contains "${match}". Set AI_MODEL, or pick a model in Settings. The backup model runs instead.`;
    return { model: settings?.aiPrimaryModel || null, resolvedFrom: "", problem };
  }

  candidates.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const resolved = candidates[0].id;
  await persist(resolved, "match");
  console.log(`[ai] primary model resolved from "${match}": ${resolved}`);
  return { model: resolved, resolvedFrom: "match", problem: null };
}

async function persist(model: string, resolvedFrom: "env" | "match"): Promise<void> {
  const settings = await db.appSettings.findUnique({ where: { id: "main" } });
  if (!settings) return;
  if (settings.aiPrimaryModel === model && settings.aiPrimaryResolvedFrom === resolvedFrom) return;
  await db.appSettings.update({
    where: { id: "main" },
    data: { aiPrimaryModel: model, aiPrimaryResolvedFrom: resolvedFrom },
  });
}
