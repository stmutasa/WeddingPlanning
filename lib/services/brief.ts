import { randomBytes } from "node:crypto";
import type { BriefSnapshot } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { ai, AiDisabled, AiUnavailable } from "@/lib/ai/client";
import * as aiContext from "@/lib/ai/context";
import * as prompts from "@/lib/ai/prompts";
import { formatUSD } from "@/lib/money/format";
import type { BriefTrigger } from "@/lib/types";
import * as budget from "./budget";
import * as guests from "./guests";
import * as payments from "./payments";
import * as settle from "./settle";
import * as tasks from "./tasks";
import * as vendors from "./vendors";
import { syncBriefToDrive } from "./drive";

/**
 * DESIGN.md §8. The facts are assembled deterministically from the DB — no
 * model is needed or used for them — and exactly one paragraph, "State of
 * play", is written by the model. With AI off, section 14 is omitted
 * entirely and everything else is unchanged.
 */

const SNAPSHOTS_KEPT = 30;

export const HEADINGS = [
  "## 1. The wedding",
  "## 2. Budget at a glance",
  "## 3. By event",
  "## 4. Budget lines",
  "## 5. Upcoming payments",
  "## 6. Vendors",
  "## 7. Recent expenses",
  "## 8. Who has fronted what",
  "## 9. Tasks",
  "## 10. Guests",
  "## 11. Decisions & notes",
  "## 12. Open questions",
  "## 13. Recent activity",
  "## 14. State of play",
  "## 15. Glossary",
] as const;

function appName(): string {
  return process.env.APP_NAME?.trim() || "Harusi";
}

function table(header: string[], rows: (string | number)[][]): string {
  if (rows.length === 0) return "_None yet._";
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function day(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

interface Built {
  markdown: string;
  /** Sections 2, 3, 5, 9 and 12 — the input to PROMPTS.md §8. */
  forModel: string;
}

/** Everything except section 14; pure reads, no model. */
export async function buildDeterministic(): Promise<Built> {
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
    openByEvent,
    guestCounts,
    pendingHouseholds,
    noteRows,
    activityRows,
  ] = await Promise.all([
    db.wedding.findUnique({ where: { id: "main" } }),
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
    db.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { user: { include: { settings: true } } },
    }),
  ]);

  const timezone = wedding?.eventTimezone ?? "Africa/Nairobi";
  const coupleNames = wedding?.coupleNames ?? "Annette & Simi";

  const header = [
    `# ${appName()} Brief — ${coupleNames} — generated ${formatInTimeZone(now, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX")} (${timezone})`,
    `> How to use this: paste it into any AI chat, then ask your question. Everything below is`,
    `> the current truth from the app. Money is USD. "Committed" = agreed but unpaid.`,
  ].join("\n");

  // ---- 1. The wedding
  const targetLabel = wedding?.weddingDate
    ? day(wedding.weddingDate, timezone)
    : `${wedding?.targetMonth ?? "2027-08"} (exact date not set)`;
  const daysToGo = wedding?.weddingDate ? daysBetween(now, wedding.weddingDate) : null;

  const section1 = [
    HEADINGS[0],
    ``,
    `- **Couple:** ${coupleNames}`,
    `- **Where:** ${wedding?.city ?? "Nairobi"}, ${wedding?.country ?? "Kenya"} (${timezone})`,
    `- **When:** ${targetLabel}${daysToGo != null ? ` — ${daysToGo} days to go` : ""}`,
    `- **Total budget:** ${formatUSD(wedding?.budgetCents ?? 0)}`,
    `- **Split:** ${wedding?.splitNumerator ?? 1}/${wedding?.splitDenominator ?? 2} to ${settleSummary.annette.name}`,
    ``,
    table(
      ["Event", "Date", "Envelope"],
      events.map((e) => [
        e.name,
        e.date ? day(e.date, timezone) : "not set",
        formatUSD(e.budgetCents),
      ])
    ),
  ].join("\n");

  // ---- 2. Budget at a glance
  const section2 = [
    HEADINGS[1],
    ``,
    table(
      ["Total", "Paid", "Committed", "Forecast", "Remaining", "Status"],
      [
        [
          formatUSD(summary.totalCents),
          formatUSD(summary.paidCents),
          formatUSD(summary.committedCents),
          formatUSD(summary.forecastCents),
          formatUSD(summary.remainingCents),
          summary.status,
        ],
      ]
    ),
    ``,
    summary.unallocatedCents === 0
      ? `Envelopes account for the whole budget.`
      : summary.unallocatedCents > 0
        ? `${formatUSD(summary.unallocatedCents)} of the budget is not allocated to any envelope.`
        : `Envelopes exceed the total budget by ${formatUSD(-summary.unallocatedCents)}.`,
  ].join("\n");

  // ---- 3. By event
  const section3 = [
    HEADINGS[2],
    ``,
    table(
      ["Event", "Envelope", "Paid", "Committed", "Planned lines", "Forecast", "Status"],
      summary.envelopes.map((e) => [
        e.eventName,
        formatUSD(e.budgetCents),
        formatUSD(e.paidCents),
        formatUSD(e.committedCents),
        formatUSD(e.plannedCents),
        formatUSD(e.forecastCents),
        e.status,
      ])
    ),
  ].join("\n");

  // ---- 4. Budget lines (only where lines exist)
  const section4 = [
    HEADINGS[3],
    ``,
    lines.length === 0
      ? `_No planned lines yet — envelopes only._`
      : table(
          ["Event", "Category", "Planned", "Actual", "Difference"],
          lines.map((l) => [
            l.eventName,
            l.categoryName,
            formatUSD(l.plannedCents),
            formatUSD(l.actualCents),
            formatUSD(l.plannedCents - l.actualCents),
          ])
        ),
  ].join("\n");

  // ---- 5. Upcoming payments (next 90 days)
  const section5 = [
    HEADINGS[4],
    ``,
    table(
      ["Due", "Vendor", "Label", "Amount", "Status"],
      duePayments.map((p) => [
        day(p.dueDate, timezone),
        p.vendor.name,
        p.label,
        formatUSD(p.amountCents),
        p.dueDate < now ? "OVERDUE" : p.status,
      ])
    ),
  ].join("\n");

  // ---- 6. Vendors, by event
  const vendorsByEvent = new Map<string, typeof vendorRows>();
  for (const v of vendorRows) {
    const key = v.event?.name ?? "No event";
    if (!vendorsByEvent.has(key)) vendorsByEvent.set(key, []);
    vendorsByEvent.get(key)!.push(v);
  }
  const section6 = [
    HEADINGS[5],
    ``,
    vendorRows.length === 0
      ? `_No vendors yet._`
      : [...vendorsByEvent.entries()]
          .map(([eventName, group]) =>
            [
              `### ${eventName}`,
              ``,
              table(
                ["Vendor", "Category", "Status", "Quoted", "Paid", "Next due", "Contact", "Notes"],
                group.map((v) => [
                  v.name,
                  v.category?.name ?? "—",
                  v.status,
                  v.quotedCents != null ? formatUSD(v.quotedCents) : "—",
                  formatUSD(v.paidCents),
                  v.nextDue
                    ? `${day(v.nextDue.dueDate, timezone)} ${v.nextDue.label} ${formatUSD(v.nextDue.amountCents)}`
                    : "—",
                  [v.contactName, v.phone ?? v.whatsapp, v.email].filter(Boolean).join(" · ") || "—",
                  (v.notes ?? "").replace(/\s+/g, " ").slice(0, 80) || "—",
                ])
              ),
            ].join("\n")
          )
          .join("\n\n"),
  ].join("\n");

  // ---- 7. Recent expenses (last 30 days)
  const section7 = [
    HEADINGS[6],
    ``,
    table(
      ["Date", "Description", "Event", "Amount", "Paid by"],
      recentExpenses.map((e) => [
        day(e.date, timezone),
        e.description + (e.vendor ? ` (${e.vendor.name})` : ""),
        e.event.name,
        formatUSD(e.amountCents) +
          (e.originalCurrency && e.originalCurrency !== "USD"
            ? ` (${e.originalCurrency} ${e.originalAmount ?? "?"})`
            : ""),
        e.funder.name,
      ])
    ),
  ].join("\n");

  // ---- 8. Who has fronted what
  const owedLine =
    settleSummary.owedCents > 0
      ? `**${settleSummary.owedFromUserId === settleSummary.annette.userId ? settleSummary.annette.name : settleSummary.simi.name} owes ${settleSummary.owedToUserId === settleSummary.annette.userId ? settleSummary.annette.name : settleSummary.simi.name} ${formatUSD(settleSummary.owedCents)}.**`
      : `**They are square.**`;

  const section8 = [
    HEADINGS[7],
    ``,
    table(
      ["Who", "Fronted", "Fair share", "Balance"],
      [
        [
          settleSummary.annette.name,
          formatUSD(settleSummary.annette.frontedCents),
          formatUSD(settleSummary.annette.fairShareCents),
          formatUSD(settleSummary.annette.balanceCents),
        ],
        [
          settleSummary.simi.name,
          formatUSD(settleSummary.simi.frontedCents),
          formatUSD(settleSummary.simi.fairShareCents),
          formatUSD(settleSummary.simi.balanceCents),
        ],
        ["Joint account", formatUSD(settleSummary.jointCents), "—", "—"],
        ["Family & other", formatUSD(settleSummary.familyCents), "—", "—"],
      ]
    ),
    ``,
    owedLine,
    ``,
    `Settlements recorded:`,
    settleSummary.settlements.length === 0
      ? `_None yet._`
      : settleSummary.settlements
          .map((s) => `- ${day(s.settledAt, timezone)}: ${formatUSD(s.amountCents)}${s.note ? ` — ${s.note}` : ""}`)
          .join("\n"),
  ].join("\n");

  // ---- 9. Tasks
  const openTasks = taskRows.filter((t) => t.status === "OPEN");
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < now);
  const soon = openTasks.filter(
    (t) => t.dueDate && t.dueDate >= now && daysBetween(now, t.dueDate) <= 30
  );
  const milestones = taskRows.filter((t) => t.milestone);
  const taskLine = (t: (typeof taskRows)[number]) =>
    `- ${t.dueDate ? day(t.dueDate, timezone) : "no date"} · ${t.title}${t.event ? ` · ${t.event.name}` : ""}${
      t.assignee ? ` · ${t.assignee.settings?.displayName ?? t.assignee.name ?? "assigned"}` : ""
    }${t.status === "DONE" ? " ✓" : ""}`;

  const section9 = [
    HEADINGS[8],
    ``,
    `**Overdue (${overdue.length})**`,
    overdue.length ? overdue.map(taskLine).join("\n") : `_None._`,
    ``,
    `**Due in the next 30 days (${soon.length})**`,
    soon.length ? soon.map(taskLine).join("\n") : `_None._`,
    ``,
    `**Milestones**`,
    milestones.length ? milestones.map(taskLine).join("\n") : `_None._`,
    ``,
    `**Open tasks by event**`,
    openByEvent.length
      ? openByEvent.map((r) => `- ${r.eventName}: ${r.count}`).join("\n")
      : `_None._`,
  ].join("\n");

  // ---- 10. Guests
  const countRows = Object.entries(guestCounts).map(([slug, c]) => [
    slug,
    c.total,
    c.INVITED ?? 0,
    c.YES ?? 0,
    c.NO ?? 0,
    c.MAYBE ?? 0,
    c.NOT_INVITED ?? 0,
    c.heads,
  ]);
  const section10 = [
    HEADINGS[9],
    ``,
    table(
      ["Event", "On the list", "Invited", "Yes", "No", "Maybe", "Not invited", "Heads (yes + plus-ones)"],
      countRows
    ),
    ``,
    `**Households with nobody answered yet (${pendingHouseholds.length})**`,
    pendingHouseholds.length ? pendingHouseholds.map((h) => `- ${h}`).join("\n") : `_None._`,
  ].join("\n");

  // ---- 11. Decisions & notes
  const decisions = noteRows.filter((n) => n.kind === "DECISION");
  const pinned = noteRows.filter((n) => n.pinned && n.kind !== "DECISION");
  const others = noteRows
    .filter((n) => n.kind !== "DECISION" && n.kind !== "QUESTION" && n.kind !== "DIGEST" && !n.pinned)
    .slice(0, 10);
  const noteLine = (n: (typeof noteRows)[number]) =>
    `- **${n.title ?? n.kind}** — ${n.body.replace(/\s+/g, " ")}`;

  const section11 = [
    HEADINGS[10],
    ``,
    `**Decisions (${decisions.length})**`,
    decisions.length ? decisions.map(noteLine).join("\n") : `_None recorded._`,
    ``,
    `**Pinned**`,
    pinned.length ? pinned.map(noteLine).join("\n") : `_None._`,
    ``,
    `**Latest notes**`,
    others.length ? others.map(noteLine).join("\n") : `_None._`,
  ].join("\n");

  // ---- 12. Open questions (recorded + generated)
  const questions = noteRows.filter((n) => n.kind === "QUESTION");
  const generated: string[] = [];
  if (summary.unallocatedCents !== 0) {
    generated.push(
      summary.unallocatedCents > 0
        ? `${formatUSD(summary.unallocatedCents)} of the budget is not in any envelope — where should it go?`
        : `Envelopes are ${formatUSD(-summary.unallocatedCents)} over the total budget — which one comes down?`
    );
  }
  const envelopesWithoutLines = summary.envelopes.filter(
    (e) => e.budgetCents > 0 && e.plannedCents === 0
  );
  for (const e of envelopesWithoutLines) {
    generated.push(`${e.eventName} has an envelope of ${formatUSD(e.budgetCents)} but no planned lines.`);
  }
  for (const v of vendorRows) {
    if (v.status === "BOOKED" && !v.nextDue && v.paidCents === 0) {
      generated.push(`${v.name} is booked but has no payment schedule.`);
    }
  }
  for (const e of events) {
    if (!e.date) generated.push(`${e.name} has no date set.`);
  }

  const section12 = [
    HEADINGS[11],
    ``,
    `**Asked in the app (${questions.length})**`,
    questions.length ? questions.map(noteLine).join("\n") : `_None._`,
    ``,
    `**Raised by the numbers (${generated.length})**`,
    generated.length ? generated.map((g) => `- ${g}`).join("\n") : `_Nothing outstanding._`,
  ].join("\n");

  // ---- 13. Recent activity
  const section13 = [
    HEADINGS[12],
    ``,
    activityRows.length === 0
      ? `_Nothing yet._`
      : activityRows
          .map((a) => `- ${day(a.createdAt, timezone)} — ${a.summary}`)
          .join("\n"),
  ].join("\n");

  // ---- 15. Glossary
  const section15 = [
    HEADINGS[14],
    ``,
    `- **Ruracio** — the Kenyan bride-price negotiation and family ceremony, held before the wedding. It carries its own budget envelope, including gifts to the bride's family.`,
    `- **Envelope** — the budget allocated to one event. Envelopes should sum to the total budget.`,
    `- **Committed** — money agreed but not yet paid: open vendor instalments (\`PaymentDue\` rows).`,
    `- **Fronted** — what one of them paid personally. Joint-account and family money is not fronted by either.`,
    `- **Settle-up** — squaring the personal spending between them at the split ratio, recorded as a settlement.`,
    `- **Inbox** — bank and CSV rows waiting for a human to confirm, edit or mark as not wedding spending. Nothing becomes an expense until confirmed.`,
  ].join("\n");

  const forModel = [section2, section3, section5, section9, section12].join("\n\n");

  return {
    markdown: [
      header,
      section1,
      section2,
      section3,
      section4,
      section5,
      section6,
      section7,
      section8,
      section9,
      section10,
      section11,
      section12,
      section13,
      "@@STATE_OF_PLAY@@",
      section15,
      "",
    ].join("\n\n"),
    forModel,
  };
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
  const paragraph = await stateOfPlay(built.forModel);

  const markdown = built.markdown.replace(
    "@@STATE_OF_PLAY@@\n\n",
    paragraph ? `${HEADINGS[13]}\n\n${paragraph}\n\n` : ""
  );

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

  const fresh = randomBytes(16).toString("hex");
  await db.appSettings.upsert({
    where: { id: "main" },
    update: { briefToken: fresh },
    create: { id: "main", briefToken: fresh },
  });
  return fresh;
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
