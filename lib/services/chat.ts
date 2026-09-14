import type { ChatMessage, ChatThread } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "./actor";
import { NotFound } from "./errors";

/**
 * Ask threads. They are shared: both of them see every thread, which is
 * what the assistant is told in its system prompt (PROMPTS.md §4).
 */

export async function threads(): Promise<ChatThread[]> {
  return db.chatThread.findMany({ orderBy: { updatedAt: "desc" } });
}

export async function createThread(userId: string, title?: string | null): Promise<ChatThread> {
  const thread = await db.chatThread.create({
    data: { title: title ?? null, createdById: userId },
  });
  await log({
    userId,
    action: "CREATED",
    entityType: "ChatThread",
    entityId: thread.id,
    summary: "started a new Ask thread",
  });
  return thread;
}

export async function messages(threadId: string): Promise<ChatMessage[]> {
  const thread = await db.chatThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new NotFound("Thread");
  return db.chatMessage.findMany({ where: { threadId }, orderBy: { createdAt: "asc" } });
}

export interface AppendInput {
  threadId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  /** Serialized tool calls; SQLite has no Json column, so this is JSON text. */
  toolCalls?: unknown[] | null;
  authorId?: string | null;
  model?: string | null;
}

export async function append(input: AppendInput): Promise<ChatMessage> {
  const message = await db.chatMessage.create({
    data: {
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      toolCalls:
        input.toolCalls && input.toolCalls.length > 0 ? JSON.stringify(input.toolCalls) : null,
      authorId: input.authorId ?? null,
      model: input.model ?? null,
    },
  });

  await db.chatThread.update({ where: { id: input.threadId }, data: { updatedAt: new Date() } });
  return message;
}

/** Names a thread from its first user turn, so the list is readable. */
export async function titleFromFirstMessage(threadId: string, text: string): Promise<void> {
  const thread = await db.chatThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.title) return;

  const title = text.trim().replace(/\s+/g, " ").slice(0, 60);
  if (title) await db.chatThread.update({ where: { id: threadId }, data: { title } });
}

/** The last `n` turns, oldest first, as the facade's message shape. */
export async function history(
  threadId: string,
  n = 20
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const rows = await db.chatMessage.findMany({
    where: { threadId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "desc" },
    take: n,
  });

  return rows
    .reverse()
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}
