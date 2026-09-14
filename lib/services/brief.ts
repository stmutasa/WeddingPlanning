import { randomBytes } from "node:crypto";
import type { BriefSnapshot } from "@prisma/client";
import { db } from "@/lib/db";
import { ai, AiDisabled, AiUnavailable } from "@/lib/ai/client";
import * as aiContext from "@/lib/ai/context";
import * as prompts from "@/lib/ai/prompts";
import type { BriefTrigger } from "@/lib/types";
import * as budget from "./budget";
import type { BriefData } from "./brief-data";
import { buildBrief, HEADINGS, withStateOfPlay, type BuiltBrief } from "./brief-markdown";
import { syncBriefToDrive } from "./drive";
import * as guests from "./guests";
import * as payments from "./payments";
import * as settle from "./settle";
import * as tasks from "./tasks";
import * as vendors from "./vendors";

/**
 * DESIGN.md §8. The facts are assembled deterministically from the DB — no
 * model is needed or used for them — and exactly one paragraph, "State of
 * play", is written by the model. With AI off, section 14 is omitted
 * entirely and everything else is unchanged.
 *
 * The rendering itself lives in `brief-markdown.ts` as a pure function of
 * `BriefData`, which is what the unit tests exercise.
 */

export { HEADINGS } from "./brief-markdown";

const SNAPSHOTS_KEPT = 30;

function appName(): string {
  return process.env.APP_NAME?.trim() || "Harusi";
}

/** Reads everything the Brief renders. No writes, no model. */
export async function collect(): Promise<BriefData> {
  const now = new Date();

  const [
    wedding,
    events,
    summary,
    lines,
    duePayments,
    vendorRows,
    recentExpenses,
    settleSummary,
    taskRows,
    openTasksByEvent,
    guestCounts,
    pendingHouseholds,
    notes,
    activity,
  ] = await Promise.all([
    db.wedding.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } }),
    db.event.findMany({ orderBy: { sortOrder: "asc" } }),
    budget.summary(),
    budget.linesWithActuals(),
    payments.upcoming(90),
    vendors.withMoney(),
    db.expense.findMany({
      where: { date: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
      include: { event: true, funder: true, vendor: true },
      orderBy: { date: "desc" },
    }),
    settle.summary(),
    db.task.findMany({
      include: { event: true, assignee: { include: { settings: true } } },
      orderBy: { dueDate: "asc" },
    }),
    tasks.openCountByEvent(),
    guests.counts(),
    guests.pendingHouseholds(),
    db.note.findMany({ orderBy: { updatedAt: "desc" } }),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);

  return {
    now,
    appName: appName(),
    wedding,
    events,
    summary,
    lines,
    duePayments,
    vendors: vendorRows,
    recentExpenses,
    settle: settleSummary,
    tasks: taskRows,
    openTasksByEvent,
    guestCounts,
    pendingHouseholds,
    notes,
    activity,
  };
}

/** Everything except section 14 (DESIGN.md §8). */
export async function buildDeterministic(): Promise<BuiltBrief> {
  return buildBrief(await collect());
}

/**
 * The one model-written paragraph (PROMPTS.md §8). Returns null when AI is
 * disabled or unreachable, in which case section 14 is omitted entirely.
 */
async function stateOfPlay(forModel: string): Promise<string | null> {
  try {
    const base = await aiContext.base(null);
    const prompt = prompts.briefStateOfPlay(base, forModel);
    const completion = await ai.text({
      feature: "BRIEF",
      system: prompt.system,
      user: prompt.user,
      effort: "medium",
      maxTokens: 700,
    });
    const text = completion.data.trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    if (err instanceof AiDisabled) return null;
    if (err instanceof AiUnavailable) {
      console.warn("[brief] state of play unavailable:", err.detail ?? err.message);
      return null;
    }
    throw err;
  }
}

export async function generate(trigger: BriefTrigger): Promise<BriefSnapshot> {
  const built = await buildDeterministic();
  const markdown = withStateOfPlay(built.markdown, await stateOfPlay(built.forModel));

  const snapshot = await db.briefSnapshot.create({
    data: {
      markdown,
      words: markdown.split(/\s+/).filter(Boolean).length,
      trigger,
    },
  });

  const stale = await db.briefSnapshot.findMany({
    orderBy: { generatedAt: "desc" },
    skip: SNAPSHOTS_KEPT,
    select: { id: true },
  });
  if (stale.length > 0) {
    await db.briefSnapshot.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  // Flag-gated and failure-tolerant: never blocks generation (DESIGN.md §8).
  await syncBriefToDrive(markdown);

  return snapshot;
}

export async function latest(): Promise<BriefSnapshot | null> {
  return db.briefSnapshot.findFirst({ orderBy: { generatedAt: "desc" } });
}

/** The token that gates `/api/brief.md?token=`; created on first use. */
export async function token(): Promise<string> {
  const settings = await db.appSettings.findUnique({ where: { id: "main" } });
  if (settings?.briefToken) return settings.briefToken;
  return rotateToken();
}

export async function rotateToken(): Promise<string> {
  const fresh = randomBytes(16).toString("hex");
  await db.appSettings.upsert({
    where: { id: "main" },
    update: { briefToken: fresh },
    create: { id: "main", briefToken: fresh },
  });
  return fresh;
}

/** Re-exported so callers can assert on the section list (the smoke test does). */
export const SECTION_HEADINGS = HEADINGS;
