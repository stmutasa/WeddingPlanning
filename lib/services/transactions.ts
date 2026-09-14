import type { Expense, Transaction } from "@prisma/client";
import { NotImplemented } from "./errors";

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
  currencyColumn?: string;
}

/** For each PlaidItem: /transactions/sync with cursor, upsert watched-account rows. */
export async function sync(_userId: string): Promise<{ newCount: number }> {
  throw new NotImplemented("transactions.sync");
}

/** AI triage in batches of 25 (PROMPTS.md §3). */
export async function triage(_newIds: string[]): Promise<TriageResult[]> {
  throw new NotImplemented("transactions.triage");
}

/** app/api/transactions/[id]/confirm currently does a simplified version directly. */
export async function confirm(
  _userId: string,
  _id: string,
  _input: ConfirmInput
): Promise<Expense> {
  throw new NotImplemented("transactions.confirm");
}

export async function ignore(_id: string): Promise<Transaction> {
  throw new NotImplemented("transactions.ignore");
}

/** Dedupes by hash of date+amount+name. */
export async function importCsv(
  _userId: string,
  _file: Blob,
  _mapping: CsvMapping
): Promise<{ imported: number; duplicates: number }> {
  throw new NotImplemented("transactions.importCsv");
}
