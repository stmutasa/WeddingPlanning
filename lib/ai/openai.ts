import OpenAI from "openai";
import type { ResponseInput, ResponseInputContent, Tool } from "openai/resources/responses/responses";
import type {
  AdapterRequest,
  AdapterResult,
  AiChatMessage,
  AiContentPart,
  AiModelInfo,
  AiToolCall,
} from "./protocol";
import { cleanSchema } from "./protocol";

/**
 * OpenAI adapter — Responses API (DESIGN.md §7). One of only two files in
 * the app allowed to touch a provider SDK.
 *
 * Reasoning effort maps 1:1 from `AppSettings.aiReasoning`; `temperature`
 * is never sent (reasoning models reject it).
 */

let client: OpenAI | null = null;

export function hasKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function openai(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 0 });
  }
  return client;
}

function contentParts(parts: AiContentPart[]): ResponseInputContent[] {
  return parts.map((p): ResponseInputContent => {
    if (p.type === "text") return { type: "input_text", text: p.text };
    if (p.type === "image") {
      return {
        type: "input_image",
        detail: "auto",
        image_url: `data:${p.mediaType};base64,${p.dataBase64}`,
      };
    }
    return {
      type: "input_file",
      filename: p.filename ?? "document.pdf",
      file_data: `data:${p.mediaType};base64,${p.dataBase64}`,
    };
  });
}

function toInput(messages: AiChatMessage[]): ResponseInput {
  const input: ResponseInput = [];

  for (const message of messages) {
    if (message.role === "user") {
      input.push({
        role: "user",
        content:
          typeof message.content === "string"
            ? [{ type: "input_text", text: message.content }]
            : contentParts(message.content),
      });
      continue;
    }

    if (message.role === "assistant") {
      if (message.content.trim()) {
        input.push({ role: "assistant", content: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        input.push({
          type: "function_call",
          call_id: call.id,
          name: call.name,
          arguments: JSON.stringify(call.input ?? {}),
        });
      }
      continue;
    }

    input.push({
      type: "function_call_output",
      call_id: message.toolCallId,
      output: message.content,
    });
  }

  return input;
}

function toTools(req: AdapterRequest): Tool[] | undefined {
  if (!req.tools?.length) return undefined;
  return req.tools.map((t): Tool => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: cleanSchema(t.parameters),
    strict: true,
  }));
}

export async function run(req: AdapterRequest): Promise<AdapterResult> {
  const body = {
    model: req.model,
    instructions: req.system,
    input: toInput(req.messages),
    max_output_tokens: req.maxTokens,
    reasoning: { effort: req.effort },
    store: false,
    ...(req.schema
      ? {
          text: {
            format: {
              type: "json_schema" as const,
              name: req.schema.name,
              schema: cleanSchema(req.schema.schema),
              strict: true,
            },
          },
        }
      : {}),
    ...(toTools(req) ? { tools: toTools(req) } : {}),
  };

  if (req.onText) {
    const stream = openai().responses.stream(body);
    stream.on("response.output_text.delta", (event) => req.onText?.(event.delta));
    return interpret(await stream.finalResponse());
  }

  return interpret(await openai().responses.create(body));
}

type MinimalResponse = {
  output_text?: string;
  output?: unknown[];
  status?: string | null;
  incomplete_details?: { reason?: string } | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  };
};

function interpret(response: MinimalResponse): AdapterResult {
  const toolCalls: AiToolCall[] = [];
  let refusal = false;
  let text = response.output_text ?? "";

  for (const item of response.output ?? []) {
    const node = item as {
      type?: string;
      call_id?: string;
      id?: string;
      name?: string;
      arguments?: string;
      content?: { type?: string; text?: string; refusal?: string }[];
    };

    if (node.type === "function_call" && node.name) {
      toolCalls.push({
        id: node.call_id ?? node.id ?? node.name,
        name: node.name,
        // DESIGN.md §7: parse arguments, never string-match them.
        input: safeParse(node.arguments ?? "{}"),
      });
    }

    if (node.type === "message") {
      for (const part of node.content ?? []) {
        if (part.type === "refusal") {
          refusal = true;
          if (!text && part.refusal) text = part.refusal;
        }
      }
    }
  }

  return {
    text,
    toolCalls,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      cachedTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
    },
    stopReason: response.incomplete_details?.reason ?? response.status ?? null,
    refusal,
  };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * DESIGN.md §7 model list filter: ids starting `gpt-`, `o` followed by a
 * digit, or containing `chatgpt`.
 */
export function isChatModelId(id: string): boolean {
  const lower = id.toLowerCase();
  return lower.startsWith("gpt-") || /^o\d/.test(lower) || lower.includes("chatgpt");
}

export async function listModels(): Promise<AiModelInfo[]> {
  const page = await openai().models.list();
  const models: AiModelInfo[] = [];
  for await (const model of page) {
    if (!isChatModelId(model.id)) continue;
    models.push({
      id: model.id,
      displayName: model.id,
      createdAt: model.created ? new Date(model.created * 1000).toISOString() : null,
    });
  }
  return models.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
