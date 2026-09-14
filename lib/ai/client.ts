import type { AiEffort, AiFeature, AiProvider } from "@/lib/types";

/**
 * DESIGN.md §7 facade. Only `openai.ts` and `anthropic.ts` (Phase B) call a
 * provider SDK — everything else in the app calls `ai.*` here. This file is
 * a Phase A skeleton: every method throws `AiNotImplemented` until Phase B
 * wires the real adapters, model selection and fallback.
 */

export class AiNotImplemented extends Error {
  constructor(method: string) {
    super(`ai.${method}() is not implemented until Phase B`);
    this.name = "AiNotImplemented";
  }
}

/** A minimal, provider-agnostic content part. Phase B fills this out with
 * image/document blocks per PROMPTS.md. */
export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image"; dataUrl: string };

export interface AiCompletion<T> {
  data: T;
  text?: string;
  provider: AiProvider;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
  fellBack: boolean;
}

export interface AiJsonOptions<T> {
  feature: AiFeature;
  system: string;
  user: AiContentPart[];
  schema: unknown; // JSON schema — typed properly once ai/openai.ts + ai/anthropic.ts exist.
  effort?: AiEffort;
  maxTokens?: number;
  _resultType?: T;
}

export interface AiTextOptions {
  feature: AiFeature;
  system: string;
  user: AiContentPart[];
  effort?: AiEffort;
  maxTokens?: number;
}

export interface AiToolDef {
  name: string;
  description: string;
  parameters: unknown;
}

export interface AiChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
}

export interface AiChatOptions {
  feature: "ASSISTANT";
  system: string;
  messages: AiChatMessage[];
  tools: AiToolDef[];
  onText?: (delta: string) => void;
  effort?: AiEffort;
}

export type AiChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; input: unknown; result: string }
  | { type: "done"; fellBack: boolean };

export interface AiModelInfo {
  id: string;
  displayName: string;
  createdAt: string | null;
}

export interface AiModelsResult {
  openai: AiModelInfo[];
  anthropic: AiModelInfo[];
  fetchedAt: string | null;
}

export const ai = {
  async json<T>(_opts: AiJsonOptions<T>): Promise<AiCompletion<T>> {
    throw new AiNotImplemented("json");
  },

  async text(_opts: AiTextOptions): Promise<AiCompletion<string>> {
    throw new AiNotImplemented("text");
  },

  async *chat(_opts: AiChatOptions): AsyncIterable<AiChatEvent> {
    throw new AiNotImplemented("chat");
  },

  async models(): Promise<AiModelsResult> {
    throw new AiNotImplemented("models");
  },
};
