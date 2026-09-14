import { db } from "@/lib/db";
import { formatUSD } from "@/lib/money/format";

/**
 * Read-only context assembly for the prompts in `PROMPTS.md`. This file
 * only reads — every write still goes through `lib/services/*` — which is
 * also what keeps it free of an import cycle with the services that call
 * the model.
 */

export interface BaseContext {
  appName: string;
  coupleNames: string;
  city: string;
  country: string;
  weddingDate: string;
  targetMonth: string;
  budgetLabel: string;
  today: string;
  timezone: string;
  viewerName: string;
  tone: string;
}

export function appName(): string {
  return process.env.APP_NAME?.trim() || "Harusi";
}

export async function base(viewerUserId?: string | null): Promise<BaseContext> {
  const [wedding, settings, viewer] = await Promise.all([
    db.wedding.findUnique({ where: { id: "main" } }),
    db.appSettings.findUnique({ where: { id: "main" } }),
    viewerUserId
      ? db.user.findUnique({ where: { id: viewerUserId }, include: { settings: true } })
      : Promise.resolve(null),
  ]);

  const timezone = viewer?.settings?.timezone ?? "America/New_York";

  return {
    appName: appName(),
    coupleNames: wedding?.coupleNames ?? "Annette & Simi",
    city: wedding?.city ?? "Nairobi",
    country: wedding?.country ?? "Kenya",
    weddingDate: wedding?.weddingDate ? wedding.weddingDate.toISOString().slice(0, 10) : "not set",
    targetMonth: wedding?.targetMonth ?? "2027-08",
    budgetLabel: formatUSD(wedding?.budgetCents ?? 0),
    today: new Date().toISOString().slice(0, 10),
    timezone,
    viewerName:
      viewer?.settings?.displayName ?? viewer?.name ?? (viewerUserId ? "one of them" : "the app"),
    tone: settings?.assistantTone ?? "warm, direct, brief",
  };
}

export interface CaptureContext {
  events: { slug: string; name: string }[];
  categories: string[];
  funders: { id: string; name: string; kind: string; isViewer: boolean }[];
  vendors: { id: string; name: string }[];
  usdToKes: number | null;
}

/** PROMPTS.md §1 context: events, categories, funders, recent vendors, FX. */
export async function capture(viewerUserId?: string | null): Promise<CaptureContext> {
  const [events, categories, funders, vendors, fxRow] = await Promise.all([
    db.event.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
    db.funder.findMany({ where: { archived: false }, select: { id: true, name: true, kind: true, userId: true } }),
    db.vendor.findMany({ orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, name: true } }),
    db.fxRate.findFirst({ where: { base: "USD", quote: "KES" }, orderBy: { day: "desc" } }),
  ]);

  return {
    events,
    categories: categories.map((c) => c.name),
    funders: funders.map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.kind,
      isViewer: Boolean(viewerUserId) && f.userId === viewerUserId,
    })),
    vendors,
    usdToKes: fxRow?.rate ?? null,
  };
}

export interface TriageContext {
  vendors: { id: string; name: string; category: string | null; eventSlug: string | null }[];
  categories: string[];
  events: { slug: string; name: string }[];
  recentExpenses: { description: string; vendor: string | null; eventSlug: string; category: string | null }[];
  notWeddingMerchants: string[];
}

/** PROMPTS.md §3 context. */
export async function triage(): Promise<TriageContext> {
  const [vendors, categories, events, expenses, ignored] = await Promise.all([
    db.vendor.findMany({ include: { category: true, event: true } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
    db.event.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    db.expense.findMany({
      orderBy: { date: "desc" },
      take: 40,
      include: { event: true, category: true, vendor: true },
    }),
    db.transaction.findMany({
      where: { status: "IGNORED" },
      orderBy: { date: "desc" },
      take: 200,
      select: { merchant: true, name: true },
    }),
  ]);

  return {
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category?.name ?? null,
      eventSlug: v.event?.slug ?? null,
    })),
    categories: categories.map((c) => c.name),
    events,
    recentExpenses: expenses.map((e) => ({
      description: e.description,
      vendor: e.vendor?.name ?? null,
      eventSlug: e.event.slug,
      category: e.category?.name ?? null,
    })),
    notWeddingMerchants: [
      ...new Set(ignored.map((t) => t.merchant ?? t.name).filter(Boolean)),
    ] as string[],
  };
}

export interface BudgetDraftContext {
  totalCents: number;
  envelopes: { slug: string; name: string; budgetCents: number; locked: boolean }[];
  lines: { eventSlug: string; categoryName: string; plannedCents: number }[];
  guestCounts: Record<string, number>;
  vendorQuotes: { name: string; category: string | null; quotedCents: number | null; paidCents: number }[];
  budgetDecisions: string[];
  categories: string[];
}

/** PROMPTS.md §5 context. */
export async function budgetDraft(): Promise<BudgetDraftContext> {
  const [wedding, events, lines, guestEvents, vendors, notes, categories] = await Promise.all([
    db.wedding.findUnique({ where: { id: "main" } }),
    db.event.findMany({ orderBy: { sortOrder: "asc" } }),
    db.budgetLine.findMany({ include: { event: true, category: true } }),
    db.guestEvent.findMany({ where: { rsvp: { in: ["INVITED", "YES", "MAYBE"] } }, include: { event: true } }),
    db.vendor.findMany({ include: { category: true, expenses: { select: { amountCents: true } } } }),
    db.note.findMany({ where: { kind: "DECISION" } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
  ]);

  const guestCounts: Record<string, number> = {};
  for (const ge of guestEvents) {
    guestCounts[ge.event.slug] = (guestCounts[ge.event.slug] ?? 0) + 1;
  }

  return {
    totalCents: wedding?.budgetCents ?? 0,
    envelopes: events.map((e) => ({
      slug: e.slug,
      name: e.name,
      budgetCents: e.budgetCents,
      locked: e.locked,
    })),
    lines: lines.map((l) => ({
      eventSlug: l.event.slug,
      categoryName: l.category.name,
      plannedCents: l.plannedCents,
    })),
    guestCounts,
    vendorQuotes: vendors.map((v) => ({
      name: v.name,
      category: v.category?.name ?? null,
      quotedCents: v.quotedCents,
      paidCents: v.expenses.reduce((t, e) => t + e.amountCents, 0),
    })),
    budgetDecisions: notes
      .filter((n) => /budget|cost|money|spend/i.test(`${n.title ?? ""} ${n.body}`))
      .map((n) => `${n.title ?? "Decision"}: ${n.body}`),
    categories: categories.map((c) => c.name),
  };
}

export interface TimelineContext {
  events: { slug: string; name: string; date: string | null }[];
  existingTasks: string[];
  vendors: { name: string; status: string }[];
}

/** PROMPTS.md §6 context. */
export async function timeline(): Promise<TimelineContext> {
  const [events, tasks, vendors] = await Promise.all([
    db.event.findMany({ orderBy: { sortOrder: "asc" } }),
    db.task.findMany({ select: { title: true } }),
    db.vendor.findMany({ select: { name: true, status: true } }),
  ]);

  return {
    events: events.map((e) => ({
      slug: e.slug,
      name: e.name,
      date: e.date ? e.date.toISOString().slice(0, 10) : null,
    })),
    existingTasks: tasks.map((t) => t.title),
    vendors,
  };
}
