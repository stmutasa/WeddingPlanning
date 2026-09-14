import { z } from "zod";
import { db } from "@/lib/db";
import { formatUSD } from "@/lib/money/format";
import * as budget from "@/lib/services/budget";
import * as expenses from "@/lib/services/expenses";
import * as guests from "@/lib/services/guests";
import * as notes from "@/lib/services/notes";
import * as payments from "@/lib/services/payments";
import * as settle from "@/lib/services/settle";
import * as tasks from "@/lib/services/tasks";
import * as vendors from "@/lib/services/vendors";
import { jsonSchema } from "./prompts";
import type { AiToolDef } from "./protocol";

/**
 * DESIGN.md §7 assistant tools. Every one wraps a service, every write
 * returns a one-line human summary the UI renders as a card, and there are
 * no destructive tools: delete, the total budget and the split ratio are
 * not reachable from here — the assistant is told to point at Settings.
 */

export type AssistantTool = AiToolDef & { run: (input: unknown) => Promise<string> };

function date(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function eventIdBySlug(slug: string | null): Promise<string | null> {
  if (!slug) return null;
  const event = await db.event.findUnique({ where: { slug } });
  return event?.id ?? null;
}

async function categoryIdByName(name: string | null): Promise<string | null> {
  if (!name) return null;
  const all = await db.category.findMany();
  const match = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return match?.id ?? null;
}

async function funderIdByName(name: string | null, userId: string): Promise<string | null> {
  const all = await db.funder.findMany({ where: { archived: false } });
  if (name) {
    const match = all.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (match) return match.id;
  }
  return all.find((f) => f.userId === userId)?.id ?? all.find((f) => f.kind === "JOINT")?.id ?? null;
}

const noArgs = z.object({});

/** Builds the tool list bound to the person asking. */
export function assistantTools(userId: string): AssistantTool[] {
  const tools: AssistantTool[] = [
    {
      name: "get_budget_summary",
      description:
        "Totals for the whole wedding and each event: envelope, paid, committed, planned, forecast and status.",
      parameters: jsonSchema(noArgs),
      async run() {
        const s = await budget.summary();
        const lines = s.envelopes.map(
          (e) =>
            `${e.eventName}: ${formatUSD(e.paidCents)} paid + ${formatUSD(e.committedCents)} committed of ${formatUSD(e.budgetCents)} — forecast ${formatUSD(e.forecastCents)} (${e.status})`
        );
        return [
          `Budget ${formatUSD(s.totalCents)}: ${formatUSD(s.paidCents)} paid, ${formatUSD(s.committedCents)} committed, ${formatUSD(s.remainingCents)} remaining (${s.status}).`,
          ...lines,
        ].join("\n");
      },
    },

    {
      name: "list_expenses",
      description:
        "List expenses, most recent first. All filters are optional; pass null to skip one.",
      parameters: jsonSchema(
        z.object({
          eventSlug: z.string().nullable(),
          categoryName: z.string().nullable(),
          vendorName: z.string().nullable(),
          from: z.string().nullable(),
          to: z.string().nullable(),
          q: z.string().nullable(),
          limit: z.number().nullable(),
        })
      ),
      async run(raw) {
        const input = raw as {
          eventSlug?: string | null;
          categoryName?: string | null;
          vendorName?: string | null;
          from?: string | null;
          to?: string | null;
          q?: string | null;
          limit?: number | null;
        };
        const vendor = input.vendorName
          ? (await vendors.list({ q: input.vendorName }))[0]
          : null;
        const result = await expenses.list({
          eventId: (await eventIdBySlug(input.eventSlug ?? null)) ?? undefined,
          categoryId: (await categoryIdByName(input.categoryName ?? null)) ?? undefined,
          vendorId: vendor?.id,
          q: input.q ?? undefined,
          from: input.from ? date(input.from) : undefined,
          to: input.to ? date(input.to) : undefined,
        });
        const take = Math.min(input.limit ?? 20, 50);
        const rows = result.expenses.slice(0, take);
        if (rows.length === 0) return "No expenses match that.";
        return [
          `${result.count} expenses, ${formatUSD(result.totalCents)} in total. Showing ${rows.length}:`,
          ...rows.map(
            (e) =>
              `${day(e.date)} · ${e.description} · ${e.event.name} · ${formatUSD(e.amountCents)} · ${e.funder.name}`
          ),
        ].join("\n");
      },
    },

    {
      name: "add_expense",
      description:
        "Record money that has already been spent. Amounts are in the currency given (default USD); the app converts to USD.",
      parameters: jsonSchema(
        z.object({
          description: z.string(),
          amount: z.number(),
          currency: z.string().nullable(),
          eventSlug: z.string(),
          categoryName: z.string().nullable(),
          vendorName: z.string().nullable(),
          funderName: z.string().nullable(),
          date: z.string().nullable(),
          notes: z.string().nullable(),
        })
      ),
      async run(raw) {
        const input = raw as {
          description: string;
          amount: number;
          currency?: string | null;
          eventSlug: string;
          categoryName?: string | null;
          vendorName?: string | null;
          funderName?: string | null;
          date?: string | null;
          notes?: string | null;
        };
        const eventId = await eventIdBySlug(input.eventSlug);
        if (!eventId) return `There is no event called "${input.eventSlug}".`;
        const funderId = await funderIdByName(input.funderName ?? null, userId);
        if (!funderId) return "No funder is set up to attribute that to.";

        const vendor = input.vendorName ? (await vendors.list({ q: input.vendorName }))[0] : null;
        const currency = (input.currency ?? "USD").toUpperCase();

        const expense = await expenses.create(userId, {
          description: input.description,
          ...(currency === "USD"
            ? { amountCents: Math.round(input.amount * 100) }
            : { originalAmount: input.amount, originalCurrency: currency }),
          date: date(input.date),
          eventId,
          categoryId: await categoryIdByName(input.categoryName ?? null),
          vendorId: vendor?.id ?? null,
          funderId,
          source: "ASSISTANT",
          notes: input.notes ?? null,
        });

        return `Added expense: ${expense.description} ${formatUSD(expense.amountCents)} · ${expense.event.name} · ${expense.funder.name}`;
      },
    },

    {
      name: "update_expense",
      description: "Change an existing expense. Find its id with list_expenses first.",
      parameters: jsonSchema(
        z.object({
          id: z.string(),
          description: z.string().nullable(),
          amount: z.number().nullable(),
          currency: z.string().nullable(),
          eventSlug: z.string().nullable(),
          categoryName: z.string().nullable(),
          date: z.string().nullable(),
          notes: z.string().nullable(),
        })
      ),
      async run(raw) {
        const input = raw as {
          id: string;
          description?: string | null;
          amount?: number | null;
          currency?: string | null;
          eventSlug?: string | null;
          categoryName?: string | null;
          date?: string | null;
          notes?: string | null;
        };
        const currency = input.currency?.toUpperCase() ?? null;
        const expense = await expenses.update(userId, input.id, {
          ...(input.description ? { description: input.description } : {}),
          ...(input.amount != null
            ? currency && currency !== "USD"
              ? { originalAmount: input.amount, originalCurrency: currency }
              : { amountCents: Math.round(input.amount * 100) }
            : {}),
          ...(input.eventSlug ? { eventId: (await eventIdBySlug(input.eventSlug)) ?? undefined } : {}),
          ...(input.categoryName
            ? { categoryId: await categoryIdByName(input.categoryName) }
            : {}),
          ...(input.date ? { date: date(input.date) } : {}),
          ...(input.notes !== undefined && input.notes !== null ? { notes: input.notes } : {}),
        });
        return `Updated expense: ${expense.description} ${formatUSD(expense.amountCents)} · ${expense.event.name}`;
      },
    },

    {
      name: "list_vendors",
      description: "List vendors with status, quote, what has been paid and the next payment due.",
      parameters: jsonSchema(z.object({ status: z.string().nullable(), eventSlug: z.string().nullable() })),
      async run(raw) {
        const input = raw as { status?: string | null; eventSlug?: string | null };
        const all = await vendors.withMoney();
        const eventId = await eventIdBySlug(input.eventSlug ?? null);
        const rows = all.filter(
          (v) =>
            (!input.status || v.status === input.status.toUpperCase()) &&
            (!eventId || v.eventId === eventId)
        );
        if (rows.length === 0) return "No vendors match that.";
        return rows
          .map(
            (v) =>
              `${v.name} [${v.status}]${v.event ? ` · ${v.event.name}` : ""} · quoted ${v.quotedCents != null ? formatUSD(v.quotedCents) : "—"} · paid ${formatUSD(v.paidCents)}${v.nextDue ? ` · next ${v.nextDue.label} ${formatUSD(v.nextDue.amountCents)} on ${day(v.nextDue.dueDate)}` : ""}`
          )
          .join("\n");
      },
    },

    {
      name: "add_vendor",
      description: "Add a vendor the couple is considering, quoting or has booked.",
      parameters: jsonSchema(
        z.object({
          name: z.string(),
          categoryName: z.string().nullable(),
          eventSlug: z.string().nullable(),
          status: z.enum(["CONSIDERING", "QUOTED", "BOOKED", "PAID", "DECLINED"]).nullable(),
          quotedAmount: z.number().nullable(),
          phone: z.string().nullable(),
          email: z.string().nullable(),
          notes: z.string().nullable(),
        })
      ),
      async run(raw) {
        const input = raw as {
          name: string;
          categoryName?: string | null;
          eventSlug?: string | null;
          status?: "CONSIDERING" | "QUOTED" | "BOOKED" | "PAID" | "DECLINED" | null;
          quotedAmount?: number | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
        };
        const vendor = await vendors.create(userId, {
          name: input.name,
          categoryId: await categoryIdByName(input.categoryName ?? null),
          eventId: await eventIdBySlug(input.eventSlug ?? null),
          status: input.status ?? "CONSIDERING",
          quotedCents: input.quotedAmount != null ? Math.round(input.quotedAmount * 100) : null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          notes: input.notes ?? null,
        });
        return `Added vendor: ${vendor.name} [${vendor.status}]${vendor.event ? ` · ${vendor.event.name}` : ""}`;
      },
    },

    {
      name: "schedule_payments",
      description:
        "Replace a vendor's open payment schedule with these instalments. Amounts in USD.",
      parameters: jsonSchema(
        z.object({
          vendorName: z.string(),
          items: z.array(
            z.object({ label: z.string(), dueDate: z.string(), amount: z.number() })
          ),
        })
      ),
      async run(raw) {
        const input = raw as {
          vendorName: string;
          items: { label: string; dueDate: string; amount: number }[];
        };
        const vendor = (await vendors.list({ q: input.vendorName }))[0];
        if (!vendor) return `There is no vendor called "${input.vendorName}".`;
        const created = await payments.schedule(
          userId,
          vendor.id,
          input.items.map((i) => ({
            label: i.label,
            dueDate: date(i.dueDate),
            amountCents: Math.round(i.amount * 100),
          }))
        );
        return `Scheduled ${created.length} payments for ${vendor.name}: ${created
          .map((p) => `${p.label} ${formatUSD(p.amountCents)} on ${day(p.dueDate)}`)
          .join(", ")}`;
      },
    },

    {
      name: "list_payments_due",
      description: "Open payments due within the next N days, soonest first. Overdue rows included.",
      parameters: jsonSchema(z.object({ days: z.number() })),
      async run(raw) {
        const { days } = raw as { days: number };
        const rows = await payments.upcoming(days || 30);
        if (rows.length === 0) return `Nothing is due in the next ${days || 30} days.`;
        return rows
          .map(
            (p) =>
              `${day(p.dueDate)} · ${p.vendor.name} · ${p.label} · ${formatUSD(p.amountCents)}${p.dueDate < new Date() ? " (overdue)" : ""}`
          )
          .join("\n");
      },
    },

    {
      name: "mark_payment_paid",
      description:
        "Mark a scheduled payment paid, which records the matching expense. Identify it by vendor and label.",
      parameters: jsonSchema(
        z.object({
          vendorName: z.string(),
          label: z.string(),
          amount: z.number().nullable(),
          funderName: z.string().nullable(),
          date: z.string().nullable(),
        })
      ),
      async run(raw) {
        const input = raw as {
          vendorName: string;
          label: string;
          amount?: number | null;
          funderName?: string | null;
          date?: string | null;
        };
        const vendor = (await vendors.list({ q: input.vendorName }))[0];
        if (!vendor) return `There is no vendor called "${input.vendorName}".`;
        const open = await db.paymentDue.findFirst({
          where: { vendorId: vendor.id, status: "OPEN", label: { contains: input.label } },
          orderBy: { dueDate: "asc" },
        });
        if (!open) return `${vendor.name} has no open payment called "${input.label}".`;

        const { expense } = await payments.markPaid(open.id, userId, {
          ...(input.amount != null ? { amountCents: Math.round(input.amount * 100) } : {}),
          ...(input.funderName
            ? { funderId: (await funderIdByName(input.funderName, userId)) ?? undefined }
            : {}),
          ...(input.date ? { date: date(input.date) } : {}),
          source: "ASSISTANT",
        });
        return `Marked paid: ${vendor.name} ${open.label} ${formatUSD(expense.amountCents)}`;
      },
    },

    {
      name: "list_tasks",
      description: "List tasks. Filter by status (OPEN or DONE) and event.",
      parameters: jsonSchema(
        z.object({ status: z.string().nullable(), eventSlug: z.string().nullable() })
      ),
      async run(raw) {
        const input = raw as { status?: string | null; eventSlug?: string | null };
        const rows = await tasks.list({
          status: input.status?.toUpperCase(),
          eventId: (await eventIdBySlug(input.eventSlug ?? null)) ?? undefined,
        });
        if (rows.length === 0) return "No tasks match that.";
        return rows
          .slice(0, 40)
          .map(
            (t) =>
              `${t.status === "DONE" ? "✓" : "·"} ${t.title}${t.dueDate ? ` — due ${day(t.dueDate)}` : ""}${t.event ? ` · ${t.event.name}` : ""}${t.assignee?.name ? ` · ${t.assignee.name}` : ""}`
          )
          .join("\n");
      },
    },

    {
      name: "add_task",
      description: "Add a task to the plan.",
      parameters: jsonSchema(
        z.object({
          title: z.string(),
          dueDate: z.string().nullable(),
          eventSlug: z.string().nullable(),
          priority: z.enum(["P1", "P2", "P3"]).nullable(),
          milestone: z.boolean().nullable(),
          notes: z.string().nullable(),
        })
      ),
      async run(raw) {
        const input = raw as {
          title: string;
          dueDate?: string | null;
          eventSlug?: string | null;
          priority?: "P1" | "P2" | "P3" | null;
          milestone?: boolean | null;
          notes?: string | null;
        };
        const task = await tasks.create(userId, {
          title: input.title,
          dueDate: input.dueDate ? date(input.dueDate) : null,
          eventId: await eventIdBySlug(input.eventSlug ?? null),
          priority: input.priority ?? "P2",
          milestone: input.milestone ?? false,
          notes: input.notes ?? null,
          source: "AI",
        });
        return `Added task: ${task.title}${task.dueDate ? ` — due ${day(task.dueDate)}` : ""}`;
      },
    },

    {
      name: "complete_task",
      description: "Mark a task done. Match it by title.",
      parameters: jsonSchema(z.object({ title: z.string() })),
      async run(raw) {
        const { title } = raw as { title: string };
        const match = await db.task.findFirst({
          where: { status: "OPEN", title: { contains: title } },
          orderBy: { dueDate: "asc" },
        });
        if (!match) return `No open task matches "${title}".`;
        const task = await tasks.update(userId, match.id, { status: "DONE" });
        return `Completed: ${task.title}`;
      },
    },

    {
      name: "list_guests",
      description: "Guest counts per event and RSVP, or the guest list itself.",
      parameters: jsonSchema(z.object({ counts: z.boolean(), q: z.string().nullable() })),
      async run(raw) {
        const input = raw as { counts: boolean; q?: string | null };
        if (input.counts !== false) {
          const counts = await guests.counts();
          const rows = Object.entries(counts).map(
            ([slug, c]) =>
              `${slug}: ${c.total} on the list — ${c.YES ?? 0} yes, ${c.NO ?? 0} no, ${c.MAYBE ?? 0} maybe, ${c.INVITED ?? 0} invited, ${c.NOT_INVITED ?? 0} not invited (${c.heads} heads)`
          );
          return rows.join("\n") || "No guests yet.";
        }
        const rows = await guests.list({ q: input.q ?? undefined });
        if (rows.length === 0) return "No guests match that.";
        return rows
          .slice(0, 40)
          .map((g) => `${[g.firstName, g.lastName].filter(Boolean).join(" ")}${g.household ? ` · ${g.household}` : ""}`)
          .join("\n");
      },
    },

    {
      name: "add_guest",
      description: "Add a guest to the list.",
      parameters: jsonSchema(
        z.object({
          firstName: z.string(),
          lastName: z.string().nullable(),
          household: z.string().nullable(),
          side: z.enum(["BRIDE", "GROOM", "BOTH"]).nullable(),
          plusOnes: z.number().nullable(),
        })
      ),
      async run(raw) {
        const input = raw as {
          firstName: string;
          lastName?: string | null;
          household?: string | null;
          side?: "BRIDE" | "GROOM" | "BOTH" | null;
          plusOnes?: number | null;
        };
        const guest = await guests.create(userId, {
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          household: input.household ?? null,
          side: input.side ?? "BOTH",
          plusOnes: input.plusOnes ?? 0,
        });
        return `Added guest: ${[guest.firstName, guest.lastName].filter(Boolean).join(" ")}${guest.household ? ` · ${guest.household}` : ""}`;
      },
    },

    {
      name: "add_note",
      description:
        "Write a note. Use DECISION for something they have settled, QUESTION for something still open.",
      parameters: jsonSchema(
        z.object({
          kind: z.enum(["NOTE", "DECISION", "IDEA", "QUESTION"]),
          title: z.string().nullable(),
          body: z.string(),
        })
      ),
      async run(raw) {
        const input = raw as {
          kind: "NOTE" | "DECISION" | "IDEA" | "QUESTION";
          title?: string | null;
          body: string;
        };
        const note = await notes.create(userId, {
          kind: input.kind,
          title: input.title ?? null,
          body: input.body,
        });
        return `Noted (${note.kind.toLowerCase()}): ${note.title ?? note.body.slice(0, 60)}`;
      },
    },

    {
      name: "get_forecast",
      description:
        "Forecast per event: paid plus committed plus the uncovered plan, and whether that is on track, at risk or over.",
      parameters: jsonSchema(noArgs),
      async run() {
        const s = await budget.summary();
        return [
          `Whole wedding: forecast ${formatUSD(s.forecastCents)} of ${formatUSD(s.totalCents)} — ${s.status}.`,
          ...s.envelopes.map(
            (e) =>
              `${e.eventName}: forecast ${formatUSD(e.forecastCents)} of ${formatUSD(e.budgetCents)} (${e.percentOfBudget}%) — ${e.status}`
          ),
        ].join("\n");
      },
    },

    {
      name: "get_settle_up",
      description: "Who has fronted what, and who owes whom.",
      parameters: jsonSchema(noArgs),
      async run() {
        const s = await settle.summary();
        const owed =
          s.owedCents > 0 && s.owedFromUserId
            ? `${s.owedFromUserId === s.annette.userId ? s.annette.name : s.simi.name} owes ${s.owedToUserId === s.annette.userId ? s.annette.name : s.simi.name} ${formatUSD(s.owedCents)}.`
            : "They are square.";
        return [
          `${s.annette.name} has fronted ${formatUSD(s.annette.frontedCents)}, ${s.simi.name} ${formatUSD(s.simi.frontedCents)}. Joint ${formatUSD(s.jointCents)}, family ${formatUSD(s.familyCents)}.`,
          owed,
        ].join(" ");
      },
    },

    {
      name: "search",
      description: "Search expenses, vendors, tasks, notes and guests by text.",
      parameters: jsonSchema(z.object({ q: z.string() })),
      async run(raw) {
        const { q } = raw as { q: string };
        const [ex, ve, ta, no, gu] = await Promise.all([
          expenses.list({ q }),
          vendors.list({ q }),
          db.task.findMany({ where: { title: { contains: q } }, take: 10 }),
          db.note.findMany({
            where: { OR: [{ title: { contains: q } }, { body: { contains: q } }] },
            take: 10,
          }),
          guests.list({ q }),
        ]);
        const out: string[] = [];
        if (ex.expenses.length)
          out.push(
            `Expenses: ${ex.expenses.slice(0, 5).map((e) => `${e.description} ${formatUSD(e.amountCents)}`).join("; ")}`
          );
        if (ve.length) out.push(`Vendors: ${ve.slice(0, 5).map((v) => v.name).join("; ")}`);
        if (ta.length) out.push(`Tasks: ${ta.map((t) => t.title).join("; ")}`);
        if (no.length) out.push(`Notes: ${no.map((n) => n.title ?? n.body.slice(0, 40)).join("; ")}`);
        if (gu.length)
          out.push(
            `Guests: ${gu.slice(0, 5).map((g) => [g.firstName, g.lastName].filter(Boolean).join(" ")).join("; ")}`
          );
        return out.join("\n") || `Nothing matches "${q}".`;
      },
    },

    {
      name: "get_brief",
      description:
        "The latest generated Brief — the whole current state of the wedding as one document.",
      parameters: jsonSchema(noArgs),
      async run() {
        const latest = await db.briefSnapshot.findFirst({ orderBy: { generatedAt: "desc" } });
        if (!latest) return "No Brief has been generated yet.";
        return latest.markdown.slice(0, 12_000);
      },
    },
  ];

  return tools;
}
