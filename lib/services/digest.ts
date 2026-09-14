import type { Note } from "@prisma/client";
import { db } from "@/lib/db";
import { ai, AiDisabled, AiUnavailable } from "@/lib/ai/client";
import * as aiContext from "@/lib/ai/context";
import * as prompts from "@/lib/ai/prompts";
import { formatUSD } from "@/lib/money/format";
import { sum } from "@/lib/money/cents";
import * as budget from "./budget";
import * as payments from "./payments";
import * as push from "./push";
import * as transactions from "./transactions";

/**
 * PROMPTS.md §7. One model call covers both of them; the per-user push text
 * differs only in the greeting. The result is stored as a `Note` of kind
 * `DIGEST` so the Home card can read the latest one back.
 */

export interface DigestContent {
  headline: string;
  body: string[];
  push: string;
  generatedAt: string;
  /** False when AI is off or unreachable — the numbers are still real. */
  fromModel: boolean;
}

function asNote(content: DigestContent): { title: string; body: string } {
  return {
    title: content.headline,
    body: JSON.stringify(content),
  };
}

export function parseDigestNote(note: Note | null): DigestContent | null {
  if (!note) return null;
  try {
    const parsed = JSON.parse(note.body) as DigestContent;
    if (typeof parsed.headline === "string" && Array.isArray(parsed.body)) return parsed;
  } catch {
    // Fall through to the plain-text shape below.
  }
  return {
    headline: note.title ?? "This week",
    body: note.body.split("\n").filter(Boolean),
    push: note.title ?? "This week",
    generatedAt: note.createdAt.toISOString(),
    fromModel: false,
  };
}

export async function latest(): Promise<DigestContent | null> {
  const note = await db.note.findFirst({ where: { kind: "DIGEST" }, orderBy: { createdAt: "desc" } });
  return parseDigestNote(note);
}

async function gather() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [summary, weekExpenses, dueSoon, overdueTasks, inboxCount, previous] = await Promise.all([
    budget.summary(),
    db.expense.findMany({
      where: { date: { gte: weekAgo } },
      include: { event: true, funder: true },
      orderBy: { date: "desc" },
    }),
    payments.upcoming(14),
    db.task.findMany({
      where: { status: "OPEN", dueDate: { lt: new Date() } },
      include: { event: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    transactions.newCount(),
    latest(),
  ]);

  const weekTotal = sum(weekExpenses.map((e) => e.amountCents));

  return {
    summary,
    weekExpenses,
    weekTotal,
    dueSoon,
    overdueTasks,
    inboxCount,
    previous,
    context: {
      budget: `Budget ${formatUSD(summary.totalCents)}: ${formatUSD(summary.paidCents)} paid, ${formatUSD(summary.committedCents)} committed, ${formatUSD(summary.remainingCents)} remaining, forecast ${formatUSD(summary.forecastCents)} (${summary.status}).`,
      weekExpenses: weekExpenses.map(
        (e) => `${e.description} ${formatUSD(e.amountCents)} · ${e.event.name} · ${e.funder.name}`
      ),
      weekTotalLabel: formatUSD(weekTotal),
      dueSoon: dueSoon.map(
        (p) => `${p.dueDate.toISOString().slice(0, 10)} ${p.vendor.name} ${p.label} ${formatUSD(p.amountCents)}`
      ),
      overdueTasks: overdueTasks.map(
        (t) => `${t.title}${t.dueDate ? ` (due ${t.dueDate.toISOString().slice(0, 10)})` : ""}`
      ),
      inboxCount,
      statuses: summary.envelopes.map((e) => `${e.eventName} ${e.status}`),
      lastWeek: previous ? `${previous.headline} — ${previous.body.join(" ")}` : null,
    },
  };
}

/** The numbers-only digest used when AI is off or unreachable. */
function deterministic(data: Awaited<ReturnType<typeof gather>>): DigestContent {
  const body = [
    `${formatUSD(data.weekTotal)} spent this week across ${data.weekExpenses.length} ${data.weekExpenses.length === 1 ? "expense" : "expenses"}.`,
    `${formatUSD(data.summary.paidCents)} paid and ${formatUSD(data.summary.committedCents)} committed of ${formatUSD(data.summary.totalCents)}.`,
    `${data.dueSoon.length} ${data.dueSoon.length === 1 ? "payment" : "payments"} due in the next 14 days.`,
    `${data.overdueTasks.length} overdue ${data.overdueTasks.length === 1 ? "task" : "tasks"}, ${data.inboxCount} inbox ${data.inboxCount === 1 ? "row" : "rows"} waiting.`,
  ];
  return {
    headline: `This week: ${formatUSD(data.weekTotal)} spent, ${formatUSD(data.summary.remainingCents)} left`,
    body,
    push: `${formatUSD(data.weekTotal)} spent this week. ${formatUSD(data.summary.remainingCents)} of the budget remains.`.slice(0, 120),
    generatedAt: new Date().toISOString(),
    fromModel: false,
  };
}

/**
 * DESIGN.md §4 `digest.weekly()`: one model call, a `DIGEST` note, and one
 * push per user who has notifications on, greeted by name.
 */
export async function weekly(): Promise<DigestContent> {
  const data = await gather();
  const base = await aiContext.base(null);

  let content: DigestContent = deterministic(data);

  try {
    const prompt = prompts.digest(base, data.context);
    const completion = await ai.json<prompts.DigestDraft>({
      feature: "DIGEST",
      system: prompt.system,
      user: prompt.user,
      schema: prompts.jsonSchema(prompts.digestSchema),
      schemaName: "digest",
      effort: "low",
      maxTokens: 500,
    });
    const parsed = prompts.digestSchema.safeParse(completion.data);
    if (parsed.success) {
      content = {
        headline: parsed.data.headline,
        body: parsed.data.body,
        push: parsed.data.push.slice(0, 120),
        generatedAt: new Date().toISOString(),
        fromModel: true,
      };
    }
  } catch (err) {
    if (!(err instanceof AiDisabled) && !(err instanceof AiUnavailable)) throw err;
    if (err instanceof AiUnavailable) {
      console.warn("[digest] model unavailable, using the numbers:", err.detail ?? err.message);
    }
  }

  const note = asNote(content);
  await db.note.create({
    data: { kind: "DIGEST", title: note.title, body: note.body, createdById: "system" },
  });

  const users = await db.user.findMany({ include: { settings: true } });
  for (const user of users) {
    if (!user.settings?.pushEnabled) continue;
    const name = user.settings.displayName ?? user.name ?? "";
    await push.trySend(user.id, {
      title: content.headline,
      body: name ? `${name} — ${content.push}` : content.push,
      url: "/",
      tag: "digest",
    });
  }

  return content;
}
