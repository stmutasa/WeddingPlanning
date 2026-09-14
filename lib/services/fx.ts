import { db } from "@/lib/db";
import { fxToCents } from "@/lib/money/cents";
import { FxUnavailable } from "./errors";

/**
 * DESIGN.md §2: `open.er-api.com/v6/latest/USD`, free and unauthenticated,
 * cached in `FxRate` per (base, quote, day).
 *
 * Storage convention: `FxRate.rate` is the API's own direction, USD → quote
 * ("1 USD = 129.4 KES"). `rate()` returns the direction `Expense.fxRate`
 * uses, quote → USD ("1 KES = 0.00773 USD"), so the two never get mixed up.
 */

const ENDPOINT = "https://open.er-api.com/v6/latest/USD";

interface ErApiResponse {
  result?: string;
  "error-type"?: string;
  rates?: Record<string, number>;
}

type Fetcher = (base: string) => Promise<Record<string, number>>;

async function defaultFetcher(base: string): Promise<Record<string, number>> {
  const res = await fetch(base === "USD" ? ENDPOINT : `https://open.er-api.com/v6/latest/${base}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as ErApiResponse;
  if (body.result !== "success" || !body.rates) {
    throw new Error(body["error-type"] ?? "unexpected response");
  }
  return body.rates;
}

let fetcher: Fetcher = defaultFetcher;

/**
 * Test/smoke seam: `scripts/smoke.ts` runs with FX mocked so it never
 * touches the network (DESIGN.md §4).
 */
export function setFxFetcher(next: Fetcher | null): void {
  fetcher = next ?? defaultFetcher;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Turns the API's direction (1 USD = N quote) into the one stored on
 * `Expense.fxRate` (1 quote = N USD). Pure, so the conversion can be tested
 * without a database or the network.
 */
export function toExpenseRate(usdToQuoteRate: number): number {
  return 1 / usdToQuoteRate;
}

/**
 * An original-currency amount to USD cents, given the API-direction rate.
 * Rounds half-to-even like every other conversion in the app, so a long run
 * of KES receipts does not drift upward.
 */
export function convertToCents(originalAmount: number, usdToQuoteRate: number): number {
  return fxToCents(originalAmount, toExpenseRate(usdToQuoteRate));
}

/** "1 unit of `quote` = N USD" — the direction stored on `Expense.fxRate`. */
export async function rate(day: string, quote: string): Promise<number> {
  return toExpenseRate(await usdToQuote(day, quote));
}

/** "1 USD = N units of `quote`" — the direction the API and the UI quote in. */
export async function usdToQuote(day: string, quote: string): Promise<number> {
  const upper = quote.toUpperCase();
  if (upper === "USD") return 1;

  const cached = await db.fxRate.findUnique({
    where: { day_base_quote: { day, base: "USD", quote: upper } },
  });
  if (cached) return cached.rate;

  let rates: Record<string, number>;
  try {
    rates = await fetcher("USD");
  } catch (err) {
    const stale = await db.fxRate.findFirst({
      where: { base: "USD", quote: upper },
      orderBy: { day: "desc" },
    });
    if (stale) return stale.rate;
    throw new FxUnavailable(upper, err instanceof Error ? err.message : undefined);
  }

  const value = rates[upper];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new FxUnavailable(upper, "currency not quoted");
  }

  // Cache every currency this one call bought us, not only the one asked
  // about. `skipDuplicates` is not available on SQLite, so a concurrent
  // writer that got there first just makes this a no-op.
  const rows = Object.entries(rates)
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v > 0)
    .map(([q, v]) => ({ day, base: "USD", quote: q, rate: v }));
  try {
    await db.fxRate.createMany({ data: rows });
  } catch {
    // Already cached by another request this millisecond — fine.
  }

  return value;
}

/** Warms today's cache; called by the nightly job. Never throws. */
export async function refreshDaily(quote = "KES"): Promise<number | null> {
  try {
    return await usdToQuote(today(), quote);
  } catch {
    return null;
  }
}
