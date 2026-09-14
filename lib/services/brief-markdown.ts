import { formatInTimeZone } from "date-fns-tz";
import { formatUSD } from "@/lib/money/format";
import type { BriefData, BriefTask, BriefNote } from "./brief-data";

/**
 * Every figure in the Brief is exact to the cent. The app's own formatter
 * drops cents above $100 because that reads better on a phone; a document
 * an external AI will reason over should not round $115.38 to $115.
 */
function usd(cents: number): string {
  return formatUSD(cents, { detail: true });
}

/**
 * The deterministic half of the Brief (DESIGN.md §8): fifteen headings, in
 * order, rendered from `BriefData` and nothing else. No database, no model,
 * no clock of its own — which is what makes it unit-testable.
 *
 * Section 14 is left as a placeholder for `brief.generate()` to fill with
 * the model's paragraph, or to drop entirely when AI is off.
 */

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

export const STATE_OF_PLAY_PLACEHOLDER = "@@STATE_OF_PLAY@@";

export interface BuiltBrief {
  markdown: string;
  /** Sections 2, 3, 5, 9 and 12 — the input to PROMPTS.md §8. */
  forModel: string;
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

function oneLine(text: string | null | undefined, max = 80): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "—";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function buildBrief(data: BriefData): BuiltBrief {
  const { now, wedding, summary, settle } = data;
  const tz = wedding.eventTimezone;

  const header = [
    `# ${data.appName} Brief — ${wedding.coupleNames} — generated ${formatInTimeZone(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")} (${tz})`,
    `> How to use this: paste it into any AI chat, then ask your question. Everything below is`,
    `> the current truth from the app. Money is USD. "Committed" = agreed but unpaid.`,
  ].join("\n");

  // ---- 1. The wedding
  const targetLabel = wedding.weddingDate
    ? day(wedding.weddingDate, tz)
    : `${wedding.targetMonth} (exact date not set)`;
  const daysToGo = wedding.weddingDate ? daysBetween(now, wedding.weddingDate) : null;

  const section1 = [
    HEADINGS[0],
    ``,
    `- **Couple:** ${wedding.coupleNames}`,
    `- **Where:** ${wedding.city}, ${wedding.country} (${tz})`,
    `- **When:** ${targetLabel}${daysToGo != null ? ` — ${daysToGo} days to go` : ""}`,
    `- **Total budget:** ${usd(wedding.budgetCents)}`,
    `- **Split:** ${wedding.splitNumerator}/${wedding.splitDenominator} to ${settle.annette.name}`,
    ``,
    table(
      ["Event", "Date", "Envelope"],
      data.events.map((e) => [e.name, e.date ? day(e.date, tz) : "not set", usd(e.budgetCents)])
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
          usd(summary.totalCents),
          usd(summary.paidCents),
          usd(summary.committedCents),
          usd(summary.forecastCents),
          usd(summary.remainingCents),
          summary.status,
        ],
      ]
    ),
    ``,
    summary.unallocatedCents === 0
      ? `Envelopes account for the whole budget.`
      : summary.unallocatedCents > 0
        ? `${usd(summary.unallocatedCents)} of the budget is not allocated to any envelope.`
        : `Envelopes exceed the total budget by ${usd(-summary.unallocatedCents)}.`,
  ].join("\n");

  // ---- 3. By event
  const section3 = [
    HEADINGS[2],
    ``,
    table(
      ["Event", "Envelope", "Paid", "Committed", "Planned lines", "Forecast", "Status"],
      summary.envelopes.map((e) => [
        e.eventName,
        usd(e.budgetCents),
        usd(e.paidCents),
        usd(e.committedCents),
        usd(e.plannedCents),
        usd(e.forecastCents),
        e.status,
      ])
    ),
  ].join("\n");

  // ---- 4. Budget lines (only where lines exist)
  const section4 = [
    HEADINGS[3],
    ``,
    data.lines.length === 0
      ? `_No planned lines yet — envelopes only._`
      : table(
          ["Event", "Category", "Planned", "Actual", "Difference"],
          data.lines.map((l) => [
            l.eventName,
            l.categoryName,
            usd(l.plannedCents),
            usd(l.actualCents),
            usd(l.plannedCents - l.actualCents),
          ])
        ),
  ].join("\n");

  // ---- 5. Upcoming payments (next 90 days)
  const section5 = [
    HEADINGS[4],
    ``,
    table(
      ["Due", "Vendor", "Label", "Amount", "Status"],
      data.duePayments.map((p) => [
        day(p.dueDate, tz),
        p.vendor.name,
        p.label,
        usd(p.amountCents),
        p.dueDate < now ? "OVERDUE" : p.status,
      ])
    ),
  ].join("\n");

  // ---- 6. Vendors, by event
  const vendorsByEvent = new Map<string, typeof data.vendors>();
  for (const v of data.vendors) {
    const key = v.event?.name ?? "No event";
    if (!vendorsByEvent.has(key)) vendorsByEvent.set(key, []);
    vendorsByEvent.get(key)!.push(v);
  }

  const section6 = [
    HEADINGS[5],
    ``,
    data.vendors.length === 0
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
                  v.quotedCents != null ? usd(v.quotedCents) : "—",
                  usd(v.paidCents),
                  v.nextDue
                    ? `${day(v.nextDue.dueDate, tz)} ${v.nextDue.label} ${usd(v.nextDue.amountCents)}`
                    : "—",
                  [v.contactName, v.phone ?? v.whatsapp, v.email].filter(Boolean).join(" · ") || "—",
                  oneLine(v.notes),
                ])
              ),
            ].join("\n")
          )
          .join("\n\n"),
  ].join("\n");

  // ---- 7. Recent expenses (last 30 days, newest first)
  const section7 = [
    HEADINGS[6],
    ``,
    table(
      ["Date", "Description", "Event", "Amount", "Paid by"],
      data.recentExpenses.map((e) => [
        day(e.date, tz),
        e.description + (e.vendor ? ` (${e.vendor.name})` : ""),
        e.event.name,
        usd(e.amountCents) +
          (e.originalCurrency && e.originalCurrency !== "USD"
            ? ` (${e.originalCurrency} ${e.originalAmount ?? "?"})`
            : ""),
        e.funder.name,
      ])
    ),
  ].join("\n");

  // ---- 8. Who has fronted what
  const nameFor = (userId: string | null) =>
    userId && userId === settle.annette.userId ? settle.annette.name : settle.simi.name;

  const section8 = [
    HEADINGS[7],
    ``,
    table(
      ["Who", "Fronted", "Fair share", "Balance"],
      [
        [
          settle.annette.name,
          usd(settle.annette.frontedCents),
          usd(settle.annette.fairShareCents),
          usd(settle.annette.balanceCents),
        ],
        [
          settle.simi.name,
          usd(settle.simi.frontedCents),
          usd(settle.simi.fairShareCents),
          usd(settle.simi.balanceCents),
        ],
        ["Joint account", usd(settle.jointCents), "—", "—"],
        ["Family & other", usd(settle.familyCents), "—", "—"],
      ]
    ),
    ``,
    settle.owedCents > 0
      ? `**${nameFor(settle.owedFromUserId)} owes ${nameFor(settle.owedToUserId)} ${usd(settle.owedCents)}.**`
      : `**They are square.**`,
    ``,
    `Settlements recorded:`,
    settle.settlements.length === 0
      ? `_None yet._`
      : settle.settlements
          .map((s) => `- ${day(s.settledAt, tz)}: ${usd(s.amountCents)}${s.note ? ` — ${s.note}` : ""}`)
          .join("\n"),
  ].join("\n");

  // ---- 9. Tasks
  const openTasks = data.tasks.filter((t) => t.status === "OPEN");
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < now);
  const soon = openTasks.filter(
    (t) => t.dueDate && t.dueDate >= now && daysBetween(now, t.dueDate) <= 30
  );
  const milestones = data.tasks.filter((t) => t.milestone);

  const taskLine = (t: BriefTask) =>
    `- ${t.dueDate ? day(t.dueDate, tz) : "no date"} · ${t.title}${t.event ? ` · ${t.event.name}` : ""}${
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
    data.openTasksByEvent.length
      ? data.openTasksByEvent.map((r) => `- ${r.eventName}: ${r.count}`).join("\n")
      : `_None._`,
  ].join("\n");

  // ---- 10. Guests
  const section10 = [
    HEADINGS[9],
    ``,
    table(
      ["Event", "On the list", "Invited", "Yes", "No", "Maybe", "Not invited", "Heads (yes + plus-ones)"],
      Object.entries(data.guestCounts).map(([slug, c]) => [
        slug,
        c.total,
        c.INVITED ?? 0,
        c.YES ?? 0,
        c.NO ?? 0,
        c.MAYBE ?? 0,
        c.NOT_INVITED ?? 0,
        c.heads,
      ])
    ),
    ``,
    `**Households with nobody answered yet (${data.pendingHouseholds.length})**`,
    data.pendingHouseholds.length
      ? data.pendingHouseholds.map((h) => `- ${h}`).join("\n")
      : `_None._`,
  ].join("\n");

  // ---- 11. Decisions & notes
  const decisions = data.notes.filter((n) => n.kind === "DECISION");
  const pinned = data.notes.filter((n) => n.pinned && n.kind !== "DECISION" && n.kind !== "DIGEST");
  const others = data.notes
    .filter(
      (n) => !["DECISION", "QUESTION", "DIGEST"].includes(n.kind) && !n.pinned
    )
    .slice(0, 10);

  const noteLine = (n: BriefNote) => `- **${n.title ?? n.kind}** — ${n.body.replace(/\s+/g, " ")}`;

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

  // ---- 12. Open questions: the recorded ones, plus what the numbers raise
  const questions = data.notes.filter((n) => n.kind === "QUESTION");
  const generated: string[] = [];

  if (summary.unallocatedCents !== 0) {
    generated.push(
      summary.unallocatedCents > 0
        ? `${usd(summary.unallocatedCents)} of the budget is not in any envelope — where should it go?`
        : `Envelopes are ${usd(-summary.unallocatedCents)} over the total budget — which one comes down?`
    );
  }
  for (const e of summary.envelopes) {
    if (e.budgetCents > 0 && e.plannedCents === 0) {
      generated.push(`${e.eventName} has an envelope of ${usd(e.budgetCents)} but no planned lines.`);
    }
  }
  for (const v of data.vendors) {
    if (v.status === "BOOKED" && !v.nextDue && v.paidCents === 0) {
      generated.push(`${v.name} is booked but has no payment schedule.`);
    }
  }
  for (const e of data.events) {
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
    data.activity.length === 0
      ? `_Nothing yet._`
      : data.activity.map((a) => `- ${day(a.createdAt, tz)} — ${a.summary}`).join("\n"),
  ].join("\n");

  // ---- 15. Glossary
  const section15 = [
    HEADINGS[14],
    ``,
    `- **Ruracio** — the Kenyan bride-price negotiation and family ceremony, held before the wedding. It carries its own budget envelope, including gifts to the bride's family.`,
    `- **Envelope** — the budget allocated to one event. Envelopes should sum to the total budget.`,
    `- **Committed** — money agreed but not yet paid: open vendor instalments.`,
    `- **Fronted** — what one of them paid personally. Joint-account and family money is not fronted by either.`,
    `- **Settle-up** — squaring the personal spending between them at the split ratio, recorded as a settlement.`,
    `- **Inbox** — bank and CSV rows waiting for a human to confirm, edit or mark as not wedding spending. Nothing becomes an expense until confirmed.`,
  ].join("\n");

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
      STATE_OF_PLAY_PLACEHOLDER,
      section15,
      "",
    ].join("\n\n"),
    forModel: [section2, section3, section5, section9, section12].join("\n\n"),
  };
}

/** Drops in the model's paragraph, or removes section 14 entirely. */
export function withStateOfPlay(markdown: string, paragraph: string | null): string {
  return markdown.replace(
    `${STATE_OF_PLAY_PLACEHOLDER}\n\n`,
    paragraph ? `${HEADINGS[13]}\n\n${paragraph}\n\n` : ""
  );
}
