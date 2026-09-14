import { createHash } from "node:crypto";
import type { Expense, Prisma, Transaction } from "@prisma/client";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { ai, AiDisabled, AiUnavailable } from "@/lib/ai/client";
import * as aiContext from "@/lib/ai/context";
import * as prompts from "@/lib/ai/prompts";
import { log, money } from "./actor";
import { Conflict, NotFound, PlaidNotConfigured, ServiceError } from "./errors";
import * as plaid from "./plaid";

export interface TriageResult {
  id: string;
  isWedding: boolean;
  eventSlug: string | null;
  categoryName: string | null;
  vendorId: string | null;
  confidence: number;
  reason: string;
}

export interface ConfirmInput {
  description: string;
  eventId: string;
  categoryId?: string | null;
  vendorId?: string | null;
  funderId: string;
  notes?: string | null;
}

export interface CsvMapping {
  dateColumn: string;
  nameColumn: string;
  amountColumn: string;
  merchantColumn?: string | null;
  currencyColumn?: string | null;
  /** Bank exports vary: some sign money out negative, some positive. */
  amountSign?: "negative-is-spend" | "positive-is-spend";
}

const RELATIONS = {
  account: { include: { item: true } },
} satisfies Prisma.TransactionInclude;

export type TransactionRow = Prisma.TransactionGetPayload<{ include: typeof RELATIONS }>;

/** `date|amount|name`, hashed — the dedupe key for CSV rows (DESIGN.md §4). */
export function csvHash(day: string, amountCents: number, name: string): string {
  return createHash("sha256")
    .update(`${day}|${amountCents}|${name.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

export async function list(filters: { status?: string } = {}): Promise<TransactionRow[]> {
  const status = filters.status ?? "NEW";
  return db.transaction.findMany({
    where: status === "ALL" ? {} : { status },
    include: RELATIONS,
    orderBy: { date: "desc" },
  });
}

/**
 * DESIGN.md §4: for each `PlaidItem`, `/transactions/sync` with the cursor,
 * upserting rows for watched accounts, money-out only. New rows are then
 * triaged by the model in batches of 25.
 */
export async function sync(userId: string | null): Promise<{
  newCount: number;
  updatedCount: number;
  items: number;
  errors: string[];
}> {
  if (!plaid.isConfigured()) throw new PlaidNotConfigured();

  const items = await db.plaidItem.findMany({ include: { accounts: true } });
  const errors: string[] = [];
  const newIds: string[] = [];
  let updatedCount = 0;

  for (const item of items) {
    let synced;
    try {
      synced = await plaid.syncItem(item.id);
    } catch (err) {
      errors.push(`${item.institution ?? item.itemId}: ${err instanceof Error ? err.message : "failed"}`);
      continue;
    }

    const watched = new Map(
      item.accounts.filter((a) => a.watched).map((a) => [a.accountId, a.id])
    );

    for (const tx of [...synced.added, ...synced.modified]) {
      const accountRowId = watched.get(tx.account_id);
      if (!accountRowId) continue;
      // Plaid signs money out positive already.
      if (tx.amount <= 0) continue;

      const amountCents = Math.round(tx.amount * 100);
      const existing = await db.transaction.findUnique({ where: { externalId: tx.transaction_id } });

      if (existing) {
        await db.transaction.update({
          where: { id: existing.id },
          data: {
            date: new Date(`${tx.date}T12:00:00.000Z`),
            name: tx.name,
            merchant: tx.merchant_name ?? null,
            amountCents,
            currency: tx.iso_currency_code ?? "USD",
            pending: tx.pending,
          },
        });
        updatedCount++;
        continue;
      }

      const created = await db.transaction.create({
        data: {
          accountId: accountRowId,
          externalId: tx.transaction_id,
          source: "PLAID",
          date: new Date(`${tx.date}T12:00:00.000Z`),
          name: tx.name,
          merchant: tx.merchant_name ?? null,
          amountCents,
          currency: tx.iso_currency_code ?? "USD",
          pending: tx.pending,
        },
      });
      newIds.push(created.id);
    }

    for (const removed of synced.removedIds) {
      await db.transaction.deleteMany({ where: { externalId: removed, status: "NEW" } });
    }
  }

  if (newIds.length > 0) {
    await triage(newIds);
    await log({
      userId,
      action: "CREATED",
      entityType: "Transaction",
      summary: `bank sync brought in ${newIds.length} new ${newIds.length === 1 ? "transaction" : "transactions"}`,
    });
  }

  return { newCount: newIds.length, updatedCount, items: items.length, errors };
}

/** PROMPTS.md §3, batched 25 rows per call. Never throws: triage is advisory. */
export async function triage(newIds: string[]): Promise<TriageResult[]> {
  if (newIds.length === 0) return [];

  const rows = await db.transaction.findMany({ where: { id: { in: newIds } } });
  if (rows.length === 0) return [];

  const [base, ctx, events, categories] = await Promise.all([
    aiContext.base(null),
    aiContext.triage(),
    db.event.findMany(),
    db.category.findMany(),
  ]);

  const eventBySlug = new Map(events.map((e) => [e.slug, e.id]));
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const out: TriageResult[] = [];

  for (let i = 0; i < rows.length; i += 25) {
    const batch = rows.slice(i, i + 25);
    const prompt = prompts.triage(
      base,
      ctx,
      batch.map((t) => ({
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        name: t.name,
        merchant: t.merchant,
        amount: t.amountCents / 100,
        currency: t.currency,
      }))
    );

    try {
      const completion = await ai.json<prompts.TriageDraft>({
        feature: "TRIAGE",
        system: prompt.system,
        user: prompt.user,
        schema: prompts.jsonSchema(prompts.triageSchema),
        schemaName: "triage",
        effort: "low",
        maxTokens: 4000,
      });

      const parsed = prompts.triageSchema.safeParse(completion.data);
      if (!parsed.success) continue;

      for (const r of parsed.data.results) {
        if (!batch.some((t) => t.id === r.id)) continue;
        await db.transaction.update({
          where: { id: r.id },
          data: {
            aiIsWedding: r.isWedding,
            aiEventId: r.eventSlug ? (eventBySlug.get(r.eventSlug) ?? null) : null,
            aiCategoryId: r.categoryName
              ? (categoryByName.get(r.categoryName.toLowerCase()) ?? null)
              : null,
            aiVendorId: r.vendorId,
            aiConfidence: r.confidence,
            aiReason: r.reason,
          },
        });
        out.push(r);
      }
    } catch (err) {
      if (err instanceof AiDisabled) return out;
      if (err instanceof AiUnavailable) {
        console.warn("[transactions] triage unavailable:", err.detail ?? err.message);
        return out;
      }
      throw err;
    }
  }

  return out;
}

/**
 * Confirming makes an `Expense` identical in shape to a manually entered
 * one, and links it back (DESIGN.md §1).
 */
export async function confirm(userId: string, id: string, input: ConfirmInput): Promise<Expense> {
  const transaction = await db.transaction.findUnique({ where: { id } });
  if (!transaction) throw new NotFound("Transaction");
  if (transaction.status === "LINKED") throw new Conflict("That transaction is already confirmed");

  const [event, funder] = await Promise.all([
    db.event.findUnique({ where: { id: input.eventId } }),
    db.funder.findUnique({ where: { id: input.funderId } }),
  ]);
  if (!event) throw new NotFound("Event");
  if (!funder) throw new NotFound("Funder");

  const expense = await db.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        description: input.description,
        amountCents: transaction.amountCents,
        date: transaction.date,
        eventId: input.eventId,
        categoryId: input.categoryId ?? null,
        vendorId: input.vendorId ?? null,
        funderId: input.funderId,
        source: transaction.source === "CSV" ? "CSV" : "BANK",
        notes: input.notes ?? null,
        createdById: userId,
      },
    });
    await tx.transaction.update({
      where: { id },
      data: { status: "LINKED", expenseId: created.id },
    });
    return created;
  });

  await log({
    userId,
    action: "CONFIRMED",
    entityType: "Transaction",
    entityId: id,
    summary: `confirmed ${expense.description}, ${money(expense.amountCents)} from the bank feed`,
  });

  return expense;
}

export async function ignore(userId: string, id: string): Promise<Transaction> {
  const transaction = await db.transaction.findUnique({ where: { id } });
  if (!transaction) throw new NotFound("Transaction");
  if (transaction.status === "LINKED") throw new Conflict("That transaction is already an expense");

  const updated = await db.transaction.update({ where: { id }, data: { status: "IGNORED" } });

  await log({
    userId,
    action: "IGNORED",
    entityType: "Transaction",
    entityId: id,
    summary: `marked ${transaction.merchant ?? transaction.name} as not wedding spending`,
  });

  return updated;
}

/**
 * CSV import with the column mapping the UI collected. Dedupe is a hash of
 * date + amount + name (DESIGN.md §4), which also catches a file imported
 * twice with different row order.
 */
export async function importCsv(
  userId: string,
  file: Blob,
  mapping: CsvMapping
): Promise<{ imported: number; duplicates: number; skipped: number; newIds: string[] }> {
  const rows = parseCsv(await file.text());
  if (rows.length === 0) throw new ServiceError("That CSV has no data rows");

  const sign = mapping.amountSign ?? "negative-is-spend";
  let imported = 0;
  let duplicates = 0;
  let skipped = 0;
  const newIds: string[] = [];

  for (const row of rows) {
    const rawDate = row[mapping.dateColumn]?.trim();
    const rawName = row[mapping.nameColumn]?.trim();
    const rawAmount = row[mapping.amountColumn]?.trim();
    if (!rawDate || !rawName || !rawAmount) {
      skipped++;
      continue;
    }

    const parsedDate = parseDate(rawDate);
    const parsedAmount = parseAmount(rawAmount);
    if (!parsedDate || parsedAmount == null) {
      skipped++;
      continue;
    }

    // Normalise to "money out is positive", which is how the inbox reads.
    const outCents =
      sign === "negative-is-spend" ? -Math.round(parsedAmount * 100) : Math.round(parsedAmount * 100);
    if (outCents <= 0) {
      skipped++;
      continue;
    }

    const day = parsedDate.toISOString().slice(0, 10);
    const externalId = `csv:${csvHash(day, outCents, rawName)}`;

    const existing = await db.transaction.findUnique({ where: { externalId } });
    if (existing) {
      duplicates++;
      continue;
    }

    const created = await db.transaction.create({
      data: {
        externalId,
        source: "CSV",
        date: parsedDate,
        name: rawName,
        merchant: mapping.merchantColumn ? (row[mapping.merchantColumn]?.trim() || null) : null,
        amountCents: outCents,
        currency: mapping.currencyColumn
          ? (row[mapping.currencyColumn]?.trim().toUpperCase() || "USD")
          : "USD",
      },
    });
    newIds.push(created.id);
    imported++;
  }

  if (imported > 0) {
    await log({
      userId,
      action: "CREATED",
      entityType: "Transaction",
      summary: `imported ${imported} bank ${imported === 1 ? "row" : "rows"} from a CSV${duplicates ? ` (${duplicates} already there)` : ""}`,
    });
    await triage(newIds);
  }

  return { imported, duplicates, skipped, newIds };
}

function parseDate(raw: string): Date | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`);

  // US-style M/D/YYYY and D/M/YYYY are ambiguous; bank exports in this
  // app's countries are month-first, and a day above 12 disambiguates.
  const slash = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    const [, a, b, y] = slash;
    let month = Number(a);
    let dayOfMonth = Number(b);
    if (month > 12) [month, dayOfMonth] = [dayOfMonth, month];
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const d = new Date(
      `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}T12:00:00.000Z`
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,()-]/g, "").trim();
  if (!cleaned) return null;
  // (1,234.56) is accounting notation for a negative.
  const negated = /^\(.*\)$/.test(cleaned);
  const digits = cleaned.replace(/[()]/g, "").replace(/,/g, "");
  const value = Number.parseFloat(digits);
  if (Number.isNaN(value)) return null;
  return negated ? -Math.abs(value) : value;
}

export async function newCount(): Promise<number> {
  return db.transaction.count({ where: { status: "NEW" } });
}
