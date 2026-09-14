import { db } from "@/lib/db";
import type { AiEffort, AiFeature, AiProvider } from "@/lib/types";
import * as anthropic from "./anthropic";
import * as models from "./models";
import * as openai from "./openai";
import { ServiceError } from "@/lib/services/errors";
import type {
  AdapterRequest,
  AdapterResult,
  AiChatMessage,
  AiContentPart,
  AiModelInfo,
  AiTarget,
  AiToolDef,
  JsonSchema,
} from "./protocol";
import * as usage from "./usage";

export type {
  AiChatMessage,
  AiContentPart,
  AiModelInfo,
  AiToolCall,
  AiToolDef,
  JsonSchema,
} from "./protocol";

/**
 * DESIGN.md §7 facade. Nothing outside `openai.ts` and `anthropic.ts` talks
 * to a provider SDK; everything in the app calls `ai.*` here.
 */

/** AI is switched off in Settings, or no provider key is configured. */
export class AiDisabled extends ServiceError {
  constructor(public readonly reason: string) {
    super(reason, 200);
    this.name = "AiDisabled";
  }
}

/** Primary and backup both failed — routes answer 502 `{ error }`. */
export class AiUnavailable extends ServiceError {
  constructor(message: string, public readonly detail?: string) {
    super(message, 502);
    this.name = "AiUnavailable";
  }
}

export interface AiCompletion<T> {
  data: T;
  text: string;
  provider: AiProvider;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
  fellBack: boolean;
}

export interface AiJsonOptions {
  feature: AiFeature;
  system: string;
  user: string | AiContentPart[];
  schema: JsonSchema;
  schemaName?: string;
  effort?: AiEffort;
  maxTokens?: number;
}

export interface AiTextOptions {
  feature: AiFeature;
  system: string;
  user: string | AiContentPart[];
  effort?: AiEffort;
  maxTokens?: number;
}

export interface AiChatOptions {
  feature: "ASSISTANT";
  system: string;
  messages: AiChatMessage[];
  tools: (AiToolDef & { run: (input: unknown) => Promise<string> })[];
  onText?: (delta: string) => void;
  effort?: AiEffort;
  maxRounds?: number;
}

export type AiChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown; result: string }
  | { type: "error"; message: string }
  | {
      type: "done";
      fellBack: boolean;
      provider: AiProvider;
      model: string;
      text: string;
      toolCalls: { id: string; name: string; input: unknown; result: string }[];
    };

export interface AiModelsResult {
  openai: AiModelInfo[];
  anthropic: AiModelInfo[];
  fetchedAt: string | null;
  errors: Partial<Record<AiProvider, string>>;
}

// ---------------------------------------------------------------- settings

interface Resolved {
  enabled: boolean;
  effort: AiEffort;
  primary: AiTarget | null;
  backup: AiTarget | null;
  tone: string;
}

function hasKeyFor(provider: AiProvider): boolean {
  return provider === "openai" ? openai.hasKey() : anthropic.hasKey();
}

export async function settings(): Promise<Resolved> {
  const row = await db.appSettings.findUnique({ where: { id: "main" } });

  const primaryProvider = (row?.aiPrimaryProvider as AiProvider) ?? "openai";
  const backupProvider = (row?.aiBackupProvider as AiProvider) ?? "anthropic";

  let primaryModel = row?.aiPrimaryModel?.trim() || process.env.AI_MODEL?.trim() || "";
  if (!primaryModel && primaryProvider === "openai") {
    primaryModel = (await models.resolvePrimaryModel()).model ?? "";
  }
  const backupModel =
    row?.aiBackupModel?.trim() || process.env.AI_BACKUP_MODEL?.trim() || "claude-opus-5";

  const primary =
    primaryModel && hasKeyFor(primaryProvider)
      ? { provider: primaryProvider, model: primaryModel }
      : null;
  const backup =
    backupModel && hasKeyFor(backupProvider)
      ? { provider: backupProvider, model: backupModel }
      : null;

  return {
    enabled: row?.aiEnabled ?? true,
    effort: ((row?.aiReasoning as AiEffort) ?? "high") satisfies AiEffort,
    primary,
    backup,
    tone: row?.assistantTone ?? "warm, direct, brief",
  };
}

/** `{ disabled: true }` in every AI route comes from this. */
export async function availability(): Promise<{ enabled: boolean; reason: string | null }> {
  const s = await settings();
  if (!s.enabled) return { enabled: false, reason: "The assistant is switched off in Settings" };
  if (!s.primary && !s.backup) {
    return { enabled: false, reason: "No AI provider key is configured on this server" };
  }
  return { enabled: true, reason: null };
}

// ---------------------------------------------------------------- fallback

/**
 * DESIGN.md §7: fall back to the backup once on 404 / unknown-model 400 /
 * 429-after-one-retry / 5xx / timeout / refusal.
 */
function statusOf(err: unknown): number | null {
  const candidate = err as { status?: unknown };
  return typeof candidate?.status === "number" ? candidate.status : null;
}

function isUnknownModel(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    message.includes("model") &&
    (message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("unknown") ||
      message.includes("invalid"))
  );
}

function shouldFallback(err: unknown): boolean {
  const status = statusOf(err);
  if (status === 404) return true;
  if (status === 400 && isUnknownModel(err)) return true;
  if (status === 429) return true;
  if (status != null && status >= 500) return true;
  const name = err instanceof Error ? err.name : "";
  return (
    name === "APIConnectionTimeoutError" ||
    name === "APIConnectionError" ||
    name === "TimeoutError" ||
    name === "AiRefusal"
  );
}

class AiRefusal extends Error {
  constructor(model: string) {
    super(`${model} declined to answer`);
    this.name = "AiRefusal";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callTarget(
  target: AiTarget,
  feature: AiFeature,
  req: Omit<AdapterRequest, "model">,
  fellBack: boolean
): Promise<AdapterResult> {
  const started = Date.now();
  const adapter = target.provider === "openai" ? openai : anthropic;
  const result = await adapter.run({ ...req, model: target.model });

  // DESIGN.md §7: the usage row is written before the response is read.
  await usage.record({
    provider: target.provider,
    model: target.model,
    feature,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cachedTokens: result.usage.cachedTokens,
    latencyMs: Date.now() - started,
    fellBack,
  });

  if (result.refusal) throw new AiRefusal(target.model);
  return result;
}

interface RunOutcome {
  result: AdapterResult;
  target: AiTarget;
  fellBack: boolean;
}

async function runWithFallback(
  feature: AiFeature,
  req: Omit<AdapterRequest, "model">
): Promise<RunOutcome> {
  const s = await settings();
  if (!s.enabled) throw new AiDisabled("The assistant is switched off in Settings");
  if (!s.primary && !s.backup) {
    throw new AiDisabled("No AI provider key is configured on this server");
  }

  const errors: string[] = [];

  if (s.primary) {
    try {
      return { result: await callTarget(s.primary, feature, req, false), target: s.primary, fellBack: false };
    } catch (err) {
      if (statusOf(err) === 429) {
        // One retry before giving up on the primary.
        await sleep(1_500);
        try {
          return {
            result: await callTarget(s.primary, feature, req, false),
            target: s.primary,
            fellBack: false,
          };
        } catch (retryErr) {
          errors.push(describe(s.primary, retryErr));
          if (!shouldFallback(retryErr)) throw unavailable(errors);
        }
      } else {
        errors.push(describe(s.primary, err));
        if (!shouldFallback(err)) throw unavailable(errors);
      }
    }
  }

  if (s.backup) {
    try {
      return { result: await callTarget(s.backup, feature, req, true), target: s.backup, fellBack: true };
    } catch (err) {
      errors.push(describe(s.backup, err));
    }
  }

  throw unavailable(errors);
}

function describe(target: AiTarget, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `${target.provider}/${target.model}: ${message}`;
}

function unavailable(errors: string[]): AiUnavailable {
  console.error("[ai] all providers failed:", errors.join(" | "));
  return new AiUnavailable(
    "The assistant could not be reached. Use the manual form — nothing is blocked.",
    errors.join(" | ")
  );
}

function asMessages(user: string | AiContentPart[]): AiChatMessage[] {
  return [{ role: "user", content: user }];
}

// -------------------------------------------------------------- the facade

export const ai = {
  availability,
  settings,

  async json<T>(opts: AiJsonOptions): Promise<AiCompletion<T>> {
    const { result, target, fellBack } = await runWithFallback(opts.feature, {
      system: opts.system,
      messages: asMessages(opts.user),
      schema: { name: opts.schemaName ?? opts.feature.toLowerCase(), schema: opts.schema },
      effort: opts.effort ?? (await settings()).effort,
      maxTokens: opts.maxTokens ?? 2000,
    });

    let data: T;
    try {
      data = JSON.parse(extractJson(result.text)) as T;
    } catch {
      throw new AiUnavailable(
        "The assistant replied with something this app could not read. Try again, or use the manual form.",
        result.text.slice(0, 300)
      );
    }

    return {
      data,
      text: result.text,
      provider: target.provider,
      model: target.model,
      usage: result.usage,
      fellBack,
    };
  },

  async text(opts: AiTextOptions): Promise<AiCompletion<string>> {
    const { result, target, fellBack } = await runWithFallback(opts.feature, {
      system: opts.system,
      messages: asMessages(opts.user),
      effort: opts.effort ?? (await settings()).effort,
      maxTokens: opts.maxTokens ?? 1000,
    });

    return {
      data: result.text,
      text: result.text,
      provider: target.provider,
      model: target.model,
      usage: result.usage,
      fellBack,
    };
  },

  /**
   * Drives the tool loop (PROMPTS.md §4: max 8 rounds a turn). Yields text
   * deltas as they stream, one event per completed tool call, and a final
   * `done` carrying the whole turn so the caller can persist it.
   */
  async *chat(opts: AiChatOptions): AsyncIterable<AiChatEvent> {
    const maxRounds = opts.maxRounds ?? 8;
    const effort = opts.effort ?? (await settings()).effort;
    const toolsByName = new Map(opts.tools.map((t) => [t.name, t]));
    const toolDefs = opts.tools.map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
    }));

    const conversation: AiChatMessage[] = [...opts.messages];
    const performed: { id: string; name: string; input: unknown; result: string }[] = [];

    let fellBack = false;
    let lastTarget: AiTarget = { provider: "openai", model: "" };
    let finalText = "";

    for (let round = 0; round < maxRounds; round++) {
      const deltas: string[] = [];
      const outcome = await runWithFallback("ASSISTANT", {
        system: opts.system,
        messages: conversation,
        tools: toolDefs,
        effort,
        maxTokens: 4000,
        onText: (delta) => deltas.push(delta),
      });

      fellBack = fellBack || outcome.fellBack;
      lastTarget = outcome.target;
      finalText = outcome.result.text;

      for (const delta of deltas) yield { type: "text", delta };
      if (deltas.length === 0 && outcome.result.text) {
        yield { type: "text", delta: outcome.result.text };
      }

      if (outcome.result.toolCalls.length === 0) break;

      conversation.push({
        role: "assistant",
        content: outcome.result.text,
        toolCalls: outcome.result.toolCalls,
      });

      for (const call of outcome.result.toolCalls) {
        const tool = toolsByName.get(call.name);
        let summary: string;
        try {
          summary = tool
            ? await tool.run(call.input)
            : `There is no tool called ${call.name}.`;
        } catch (err) {
          summary = `That did not work: ${err instanceof Error ? err.message : "unknown error"}`;
        }
        performed.push({ id: call.id, name: call.name, input: call.input, result: summary });
        yield { type: "tool_call", id: call.id, name: call.name, input: call.input, result: summary };
        conversation.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: summary,
        });
      }
    }

    yield {
      type: "done",
      fellBack,
      provider: lastTarget.provider,
      model: lastTarget.model,
      text: finalText,
      toolCalls: performed,
    };
  },

  async models(force = false): Promise<AiModelsResult> {
    return models.list(force);
  },
};

/**
 * Structured-output responses are pure JSON, but a model that fell back to
 * prose sometimes wraps it in a fence. Take the outermost object either way.
 */
function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}
