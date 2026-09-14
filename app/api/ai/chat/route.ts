import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError } from "@/lib/http";
import { ai, AiDisabled, AiUnavailable, type AiChatMessage } from "@/lib/ai/client";
import * as aiContext from "@/lib/ai/context";
import * as prompts from "@/lib/ai/prompts";
import { assistantTools } from "@/lib/ai/tools";
import { formatUSD } from "@/lib/money/format";
import * as activity from "@/lib/services/activity";
import * as budget from "@/lib/services/budget";
import * as chat from "@/lib/services/chat";
import * as guests from "@/lib/services/guests";
import * as payments from "@/lib/services/payments";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  threadId: z.string().min(1).optional(),
  message: z.string().min(1),
});

/**
 * POST /api/ai/chat — PROMPTS.md §4, streaming.
 *
 * The response is Server-Sent Events (`text/event-stream`), one JSON object
 * per event:
 *
 *   event: start      data: { "threadId": "..." }
 *   event: text       data: { "delta": "…" }
 *   event: tool_call  data: { "id", "name", "input", "result" }
 *   event: done       data: { "threadId", "messageId", "text", "toolCalls",
 *                             "provider", "model", "fellBack" }
 *   event: error      data: { "error": "…" }
 *
 * The user turn is persisted before the model runs, and the assistant turn
 * (with its tool calls as JSON text) on `done`, so a dropped connection
 * never loses the conversation.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const availability = await ai.availability();
  if (!availability.enabled) {
    return NextResponse.json({ disabled: true, reason: availability.reason });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Invalid body";
    return NextResponse.json({ error: message ?? "Invalid body" }, { status: 400 });
  }

  const thread = body.threadId
    ? await db.chatThread.findUnique({ where: { id: body.threadId } })
    : await chat.createThread(session.id, null);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  await chat.append({
    threadId: thread.id,
    role: "user",
    content: body.message,
    authorId: session.id,
  });
  await chat.titleFromFirstMessage(thread.id, body.message);

  const [base, history, summary, upcoming, openTasks, counts, recent] = await Promise.all([
    aiContext.base(session.id),
    chat.history(thread.id, 20),
    budget.summary(),
    payments.upcoming(30),
    db.task.count({ where: { status: "OPEN" } }),
    guests.counts(),
    activity.recent(10),
  ]);

  const system = prompts.assistantSystem(base);
  const contextTurn = prompts.assistantContextTurn({
    budget: [
      `Budget ${formatUSD(summary.totalCents)}: ${formatUSD(summary.paidCents)} paid, ${formatUSD(summary.committedCents)} committed, ${formatUSD(summary.remainingCents)} remaining (${summary.status}).`,
      ...summary.envelopes.map(
        (e) =>
          `· ${e.eventName}: ${formatUSD(e.paidCents)} paid of ${formatUSD(e.budgetCents)}, forecast ${formatUSD(e.forecastCents)} (${e.status})`
      ),
    ].join("\n"),
    upcoming: upcoming.length
      ? upcoming
          .map(
            (p) =>
              `· ${p.dueDate.toISOString().slice(0, 10)} ${p.vendor.name} ${p.label} ${formatUSD(p.amountCents)}`
          )
          .join("\n")
      : "· none",
    openTasks,
    guests: Object.entries(counts)
      .map(([slug, c]) => `${slug} ${c.YES ?? 0} yes of ${c.total}`)
      .join(", "),
    activity: recent.map((a) => a.summary),
  });

  // The volatile context goes in the first user turn, not the system
  // prompt, so the cached prefix stays stable (DESIGN.md §7).
  const messages: AiChatMessage[] = [
    { role: "user", content: contextTurn },
    { role: "assistant", content: "Understood — I have the current numbers." },
    ...history.map((m): AiChatMessage => ({ role: m.role, content: m.content })),
  ];

  const encoder = new TextEncoder();
  const tools = assistantTools(session.id);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("start", { threadId: thread.id });

      try {
        for await (const chunk of ai.chat({
          feature: "ASSISTANT",
          system,
          messages,
          tools,
        })) {
          if (chunk.type === "text") {
            send("text", { delta: chunk.delta });
            continue;
          }
          if (chunk.type === "tool_call") {
            send("tool_call", {
              id: chunk.id,
              name: chunk.name,
              input: chunk.input,
              result: chunk.result,
            });
            continue;
          }
          if (chunk.type === "done") {
            const message = await chat.append({
              threadId: thread.id,
              role: "assistant",
              content: chunk.text,
              toolCalls: chunk.toolCalls,
              model: chunk.model,
            });
            send("done", {
              threadId: thread.id,
              messageId: message.id,
              text: chunk.text,
              toolCalls: chunk.toolCalls,
              provider: chunk.provider,
              model: chunk.model,
              fellBack: chunk.fellBack,
            });
          }
        }
      } catch (err) {
        const message =
          err instanceof AiDisabled || err instanceof AiUnavailable
            ? err.message
            : err instanceof Error
              ? err.message
              : "The assistant stopped unexpectedly";
        console.error("[ai/chat]", err);
        send("error", { error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
