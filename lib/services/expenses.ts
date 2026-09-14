import type { Expense } from "@prisma/client";
import { NotImplemented } from "./errors";

export interface ExpenseInput {
  description: string;
  amountCents?: number;
  originalAmount?: number;
  originalCurrency?: string;
  fxRate?: number;
  date: Date;
  eventId: string;
  categoryId?: string | null;
  vendorId?: string | null;
  funderId: string;
  notes?: string | null;
  paymentDueId?: string | null;
}

export interface ExpenseFilters {
  eventId?: string;
  categoryId?: string;
  vendorId?: string;
  funderId?: string;
  q?: string;
  from?: Date;
  to?: Date;
  source?: string;
}

/**
 * DESIGN.md §4: validates event/funder, resolves fx.rate() when needed,
 * computes amountCents, links a PaymentDue when paymentDueId is supplied,
 * and appends an Activity row. app/api/expenses currently does a simplified
 * version of this directly; Phase B moves that logic here.
 */
export async function create(_userId: string, _input: ExpenseInput): Promise<Expense> {
  throw new NotImplemented("expenses.create");
}

export async function update(
  _userId: string,
  _id: string,
  _input: Partial<ExpenseInput>
): Promise<Expense> {
  throw new NotImplemented("expenses.update");
}

export async function remove(_userId: string, _id: string): Promise<void> {
  throw new NotImplemented("expenses.delete");
}

export async function list(
  _filters: ExpenseFilters
): Promise<{ expenses: Expense[]; totalCents: number }> {
  throw new NotImplemented("expenses.list");
}
