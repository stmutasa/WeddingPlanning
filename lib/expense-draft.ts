/**
 * The shape every expense form in the app edits — the capture sheet's three
 * tabs, the expense detail sheet, and "Mark paid". Amounts are held as the
 * text the person typed and converted to integer cents exactly once, on the
 * way out (CLAUDE.md: money is integer cents, never floats in the model).
 */
import { dollarsToCents } from "./api";

export interface ExpenseDraft {
  description: string;
  /** Amount as typed, in `currency`. */
  amount: string;
  currency: string;
  /** "1 unit of `currency` = this many USD"; blank means "ask the server". */
  fxRate: string;
  date: string;
  eventId: string;
  categoryId: string;
  vendorId: string;
  funderId: string;
  notes: string;
}

export function emptyDraft(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return {
    description: "",
    amount: "",
    currency: "USD",
    fxRate: "",
    date: new Date().toISOString().slice(0, 10),
    eventId: "",
    categoryId: "",
    vendorId: "",
    funderId: "",
    notes: "",
    ...overrides,
  };
}

export interface ExpenseBody {
  description: string;
  amountCents?: number;
  originalAmount?: number;
  originalCurrency?: string;
  fxRate?: number;
  date: string;
  eventId: string;
  categoryId: string | null;
  vendorId: string | null;
  funderId: string;
  notes: string | null;
  source?: string;
  paymentDueId?: string;
}

/** What the draft is worth in USD cents right now, for the preview line. */
export function previewCents(draft: ExpenseDraft): number | null {
  const amount = Number(draft.amount.replace(/[$,\s]/g, ""));
  if (!draft.amount.trim() || Number.isNaN(amount)) return null;
  if (draft.currency.toUpperCase() === "USD") return dollarsToCents(draft.amount);
  const rate = Number(draft.fxRate);
  if (!draft.fxRate.trim() || Number.isNaN(rate) || rate <= 0) return null;
  return Math.round(amount * rate * 100);
}

export function draftProblem(draft: ExpenseDraft): string | null {
  if (!draft.description.trim()) return "Give it a description";
  if (!draft.eventId) return "Choose an event";
  if (!draft.funderId) return "Choose who paid";
  const amount = Number(draft.amount.replace(/[$,\s]/g, ""));
  if (!draft.amount.trim() || Number.isNaN(amount) || amount <= 0) return "Enter an amount";
  return null;
}

export function toBody(draft: ExpenseDraft, source?: string): ExpenseBody {
  const currency = (draft.currency || "USD").toUpperCase();
  const amount = Number(draft.amount.replace(/[$,\s]/g, ""));
  const rate = Number(draft.fxRate);

  const body: ExpenseBody = {
    description: draft.description.trim(),
    date: draft.date,
    eventId: draft.eventId,
    categoryId: draft.categoryId || null,
    vendorId: draft.vendorId || null,
    funderId: draft.funderId,
    notes: draft.notes.trim() ? draft.notes.trim() : null,
  };

  if (currency === "USD") {
    body.amountCents = dollarsToCents(draft.amount);
  } else {
    body.originalAmount = amount;
    body.originalCurrency = currency;
    // No rate given: the server converts with today's cached rate.
    if (draft.fxRate.trim() && !Number.isNaN(rate) && rate > 0) body.fxRate = rate;
  }

  if (source) body.source = source;
  return body;
}

export const CURRENCIES = ["USD", "KES", "EUR", "GBP", "ZAR", "AED", "TZS", "UGX"] as const;
