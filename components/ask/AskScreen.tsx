"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { apiPost, fetcher } from "@/lib/api";
import { useAiEnabled, useRefreshAll } from "@/lib/hooks";
import { relativeShort } from "@/lib/dates";
import type { ChatMessageDto, ChatThreadDto } from "@/lib/api-types";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionLabel,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { Banner, NeutralBadge } from "@/components/common";
import { speechRecognition } from "./speech";

const SUGGESTED = [
  "What's due this month?",
  "Are we on track for the wedding?",
  "Add 15,000 KES to Ruracio gifts, Annette paid",
];

interface ToolCard {
  id: string;
  name: string;
  result: string;
}

/**
 * Ask (DESIGN.md §6): shared threads, streaming answers over the documented
 * SSE, tool calls rendered as compact cards, and a mic when the browser has
 * one. With the assistant switched off the route answers plain JSON and the
 * screen says so instead of hanging on a stream that never starts.
 */
export function AskScreen() {
  const threads = useSWR<ChatThreadDto[]>("/api/chat/threads", fetcher);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messages = useSWR<ChatMessageDto[]>(
    threadId ? `/api/chat/threads/${threadId}/messages` : null,
    fetcher,
  );
  const refreshAll = useRefreshAll();
  const ai = useAiEnabled();

  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [toolCards, setToolCards] = useState<ToolCard[]>([]);
  const [sending, setSending] = useState(false);
  const [aiOffFromRoute, setAiOff] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof speechRecognition>>(null);
  // The server cannot know whether this browser has speech recognition, so
  // the mic is decided after hydration rather than during it — otherwise
  // the first client render disagrees with the HTML React was given.
  const micAvailable = useSyncExternalStore(
    subscribeNever,
    () => Boolean(speechRecognition()),
    () => false,
  );

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setPendingUser(message);
    setStreamingText("");
    setToolCards([]);
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, threadId: threadId ?? undefined }),
      });

      // The route answers plain JSON, not a stream, when AI is off.
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const body = (await res.json().catch(() => ({}))) as {
          disabled?: boolean;
          reason?: string;
          error?: string;
        };
        if (body.disabled) setAiOff(body.reason ?? "The assistant is switched off.");
        else setError(body.error ?? "The assistant could not answer");
        setPendingUser(null);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      let newThreadId = threadId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const eventLine = chunk.split("\n").find((line) => line.startsWith("event: "));
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(6)) as Record<string, string>;

          if (event === "start") {
            newThreadId = data.threadId;
            setThreadId(data.threadId);
          } else if (event === "text") {
            setStreamingText((prev) => prev + (data.delta ?? ""));
          } else if (event === "tool_call") {
            setToolCards((prev) => [
              ...prev,
              {
                id: data.id ?? String(prev.length),
                name: data.name ?? "tool",
                result: data.result ?? "",
              },
            ]);
          } else if (event === "error") {
            setError(data.error ?? "The assistant stopped early");
          }
        }
      }

      setPendingUser(null);
      setStreamingText("");
      setToolCards([]);
      await threads.mutate();
      if (newThreadId) {
        await messages.mutate();
      }
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not answer");
      setPendingUser(null);
    } finally {
      setSending(false);
    }
  }

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = speechRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
    setListening(true);
  }

  async function newThread() {
    const thread = await apiPost<ChatThreadDto>("/api/chat/threads", {});
    await threads.mutate();
    setThreadId(thread.id);
  }

  // Known before the first send when the models route says so; otherwise
  // the route's plain-JSON `disabled` answer tells us on the first try.
  const aiOff = aiOffFromRoute ?? (ai.ready && !ai.enabled ? ai.reason : null);
  const history = messages.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ask"
        subtitle="Both of you can read every thread"
        right={
          <Button size="sm" variant="secondary" onClick={newThread}>
            New thread
          </Button>
        }
      />

      {aiOff ? (
        <EmptyState
          title="The assistant is switched off"
          description={`${aiOff} Everything else in the app works without it — add expenses by hand, and the Brief still carries the numbers to any other chat.`}
        />
      ) : null}

      {threads.data && threads.data.length > 0 ? (
        <Card>
          <SectionLabel>Threads</SectionLabel>
          <ul className="flex flex-col">
            {threads.data.map((thread) => (
              <li key={thread.id} className="border-t border-line first:border-t-0">
                <button
                  onClick={() => setThreadId(thread.id)}
                  className={`focus-ring flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm ${
                    thread.id === threadId ? "text-primary" : "text-ink"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{thread.title ?? "New thread"}</span>
                  <span className="shrink-0 text-xs text-ink-soft">
                    {relativeShort(thread.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {aiOff ? null : (
        <Card className="flex min-h-[40vh] flex-col gap-3">
          {history.length === 0 && !pendingUser ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-soft">
                Ask about the money, the vendors, the tasks or the guests. The assistant can add an
                expense or a task for you; deleting and the total budget stay in your hands.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => send(prompt)}
                    className="focus-ring min-h-11 rounded-lg border-2 border-ink px-3 text-left text-[13px] font-semibold text-ink"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <ul className="flex flex-col gap-3">
            {history.map((message) => (
              <li key={message.id}>
                <Bubble role={message.role} text={message.content} toolCalls={message.toolCalls} />
              </li>
            ))}
            {pendingUser ? (
              <li>
                <Bubble role="user" text={pendingUser} toolCalls={null} />
              </li>
            ) : null}
            {toolCards.map((card) => (
              <li key={card.id}>
                <div className="card-frame rounded-lg bg-sunken px-3 py-2">
                  <NeutralBadge>{card.name.replace(/_/g, " ")}</NeutralBadge>
                  <p className="mt-1 text-sm text-ink">{card.result}</p>
                </div>
              </li>
            ))}
            {streamingText ? (
              <li>
                <Bubble role="assistant" text={streamingText} toolCalls={null} />
              </li>
            ) : null}
            {sending && !streamingText ? (
              <li>
                <Skeleton className="h-4 w-40" />
              </li>
            ) : null}
          </ul>
        </Card>
      )}

      {error ? <Banner tone="warn">{error}</Banner> : null}

      {aiOff ? null : (
        <div className="flex items-end gap-2">
          <Textarea
            className="flex-1"
            label="Ask anything"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          {micAvailable ? (
            <Button
              variant="secondary"
              onClick={toggleMic}
              aria-pressed={listening}
              aria-label={listening ? "Stop dictating" : "Dictate"}
            >
              {listening ? "Stop" : "Mic"}
            </Button>
          ) : null}
          <Button onClick={() => send(input)} disabled={sending || !input.trim()}>
            {sending ? "…" : "Send"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Bubble({
  role,
  text,
  toolCalls,
}: {
  role: string;
  text: string;
  toolCalls: string | null;
}) {
  const cards = parseToolCalls(toolCalls);

  if (role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-[15px] text-on-primary">
        {text}
      </div>
    );
  }

  return (
    <div className="max-w-[92%]">
      {cards.map((card, i) => (
        <div key={i} className="card-frame mb-2 rounded-lg bg-sunken px-3 py-2">
          <NeutralBadge>{card.name.replace(/_/g, " ")}</NeutralBadge>
          <p className="mt-1 text-sm text-ink">{card.result}</p>
        </div>
      ))}
      <p className="whitespace-pre-wrap text-[15px] text-ink">{text}</p>
    </div>
  );
}

function parseToolCalls(raw: string | null): { name: string; result: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { name?: string; result?: string }[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((call) => call && typeof call.result === "string")
      .map((call) => ({ name: call.name ?? "tool", result: call.result ?? "" }));
  } catch {
    return [];
  }
}

/** No store to subscribe to: mic support does not change while the page is open. */
function subscribeNever(): () => void {
  return () => {};
}
