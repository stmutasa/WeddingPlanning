import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  MessageCreateParamsNonStreaming,
  MessageParam,
  TextBlockParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages";
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
 * Anthropic adapter — Messages API (DESIGN.md §7). The other of the two
 * files allowed to touch a provider SDK.
 *
 * Hard rules from CLAUDE.md and DESIGN.md §7, all enforced below:
 *   · never send `temperature`, `top_p` or `top_k`
 *   · never send a `thinking` parameter (adaptive by default)
 *   · effort travels in `output_config.effort`
 *   · structured output travels in `output_config.format`
 *   · the stable system prompt and the tool list carry
 *     `cache_control: { type: "ephemeral" }`; volatile context goes in the
 *     first user turn instead
 *   · `stop_reason === "refusal"` is always checked and is a fallback trigger
 *   · tool input is read with `JSON.parse`, never string-matched
 */

let client: Anthropic | null = null;

export function hasKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 120_000,
      maxRetries: 0,
    });
  }
  return client;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function contentParts(parts: AiContentPart[]): ContentBlockParam[] {
  return parts.map((p): ContentBlockParam => {
    if (p.type === "text") return { type: "text", text: p.text };
    if (p.type === "image") {
      const mediaType = IMAGE_TYPES.has(p.mediaType) ? p.mediaType : "image/jpeg";
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: p.dataBase64,
        },
      };
    }
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: p.dataBase64 },
      ...(p.filename ? { title: p.filename } : {}),
    };
  });
}

function toMessages(messages: AiChatMessage[]): MessageParam[] {
  const out: MessageParam[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      out.push({
        role: "user",
        content:
          typeof message.content === "string"
            ? [{ type: "text", text: message.content }]
            : contentParts(message.content),
      });
      continue;
    }

    if (message.role === "assistant") {
      const blocks: ContentBlockParam[] = [];
      if (message.content.trim()) blocks.push({ type: "text", text: message.content });
      for (const call of message.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input ?? {} });
      }
      if (blocks.length > 0) out.push({ role: "assistant", content: blocks });
      continue;
    }

    // Tool results are user-role blocks in the Messages API; consecutive
    // results merge into the one user turn the API expects.
    const block: ContentBlockParam = {
      type: "tool_result",
      tool_use_id: message.toolCallId,
      content: [{ type: "text", text: message.content }],
    };
    const last = out[out.length - 1];
    if (last?.role === "user" && Array.isArray(last.content)) {
      last.content.push(block);
    } else {
      out.push({ role: "user", content: [block] });
    }
  }

  return out;
}

function toTools(req: AdapterRequest): Tool[] | undefined {
  if (!req.tools?.length) return undefined;
  const tools = req.tools.map((t): Tool => {
    const schema = cleanSchema(t.parameters) as Tool.InputSchema;
    return {
      name: t.name,
      description: t.description,
      input_schema: { ...schema, type: "object" },
      strict: true,
    };
  });
  // Cache breakpoint on the last tool: the whole stable tool list above it
  // is reused across turns of a thread.
  tools[tools.length - 1] = {
    ...tools[tools.length - 1],
    cache_control: { type: "ephemeral" },
  };
  return tools;
}

export async function run(req: AdapterRequest): Promise<AdapterResult> {
  const system: TextBlockParam[] = [
    { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
  ];

  const body: MessageCreateParamsNonStreaming = {
    model: req.model,
    max_tokens: req.maxTokens,
    system,
    messages: toMessages(req.messages),
    output_config: {
      effort: req.effort,
      ...(req.schema
        ? { format: { type: "json_schema", schema: cleanSchema(req.schema.schema) } }
        : {}),
    },
    ...(toTools(req) ? { tools: toTools(req) } : {}),
    // No temperature / top_p / top_k, and no `thinking`: see the file header.
  };

  if (req.onText) {
    const stream = anthropic().messages.stream(body);
    stream.on("text", (delta) => req.onText?.(delta));
    return interpret(await stream.finalMessage());
  }

  return interpret(await anthropic().messages.create(body));
}

type MinimalMessage = {
  content: unknown[];
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
};

function interpret(message: MinimalMessage): AdapterResult {
  let text = "";
  const toolCalls: AiToolCall[] = [];

  for (const raw of message.content) {
    const block = raw as { type?: string; text?: string; id?: string; name?: string; input?: unknown };
    if (block.type === "text" && block.text) text += block.text;
    if (block.type === "tool_use" && block.name && block.id) {
      toolCalls.push({
        id: block.id,
        name: block.name,
        // The SDK already hands back parsed input; a string only turns up
        // when a block was assembled by hand, and JSON.parse handles it.
        input: typeof block.input === "string" ? safeParse(block.input) : (block.input ?? {}),
      });
    }
  }

  return {
    text,
    toolCalls,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cachedTokens: message.usage.cache_read_input_tokens ?? 0,
    },
    stopReason: message.stop_reason,
    refusal: message.stop_reason === "refusal",
  };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export async function listModels(): Promise<AiModelInfo[]> {
  const page = await anthropic().models.list({ limit: 100 });
  const models: AiModelInfo[] = [];
  for await (const model of page) {
    models.push({
      id: model.id,
      displayName: model.display_name || model.id,
      createdAt: model.created_at ?? null,
    });
  }
  return models.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
