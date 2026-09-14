import type { AiEffort, AiProvider } from "@/lib/types";

/**
 * The provider-neutral shapes the facade (`client.ts`) and the two adapters
 * (`openai.ts`, `anthropic.ts`) speak. Nothing here imports a provider SDK,
 * so importing this file from either direction is free of cycles.
 */

export type JsonSchema = Record<string, unknown>;

export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: string; dataBase64: string }
  | { type: "document"; mediaType: string; dataBase64: string; filename?: string };

export interface AiToolDef {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface AiToolCall {
  id: string;
  name: string;
  input: unknown;
}

export type AiChatMessage =
  | { role: "user"; content: string | AiContentPart[] }
  | { role: "assistant"; content: string; toolCalls?: AiToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export interface AiTarget {
  provider: AiProvider;
  model: string;
}

export interface AdapterRequest {
  model: string;
  /** Stable text, sent first so both providers can cache it. */
  system: string;
  messages: AiChatMessage[];
  /** Present for `ai.json`: strict structured output. */
  schema?: { name: string; schema: JsonSchema } | null;
  tools?: AiToolDef[];
  effort: AiEffort;
  maxTokens: number;
  /** When set, the adapter streams and calls this with each text delta. */
  onText?: (delta: string) => void;
}

export interface AdapterUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface AdapterResult {
  text: string;
  toolCalls: AiToolCall[];
  usage: AdapterUsage;
  stopReason: string | null;
  /** Anthropic `stop_reason === "refusal"`, or an OpenAI refusal content part. */
  refusal: boolean;
}

export interface AiModelInfo {
  id: string;
  displayName: string;
  createdAt: string | null;
}

export const EMPTY_USAGE: AdapterUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

/** Strips the keys OpenAI's strict mode and Anthropic's schema reader reject. */
export function cleanSchema(schema: JsonSchema): JsonSchema {
  const { $schema: _schema, ...rest } = schema as { $schema?: unknown } & JsonSchema;
  return rest;
}
