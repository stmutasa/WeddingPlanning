import type { Expense, PaymentDue } from "@prisma/client";
import type { ExpenseInput } from "./expenses";
import { NotImplemented } from "./errors";

export interface ScheduleItem {
  label: string;
  dueDate: Date;
  amountCents: number;
}

/** Replaces the vendor's whole OPEN payment set atomically (DESIGN.md §4). */
export async function schedule(
  _vendorId: string,
  _items: ScheduleItem[]
): Promise<PaymentDue[]> {
  throw new NotImplemented("payments.schedule");
}

/** Creates the expense and marks the payment PAID in one transaction. */
export async function markPaid(
  _paymentId: string,
  _userId: string,
  _expenseInput: Omit<ExpenseInput, "paymentDueId">
): Promise<{ payment: PaymentDue; expense: Expense }> {
  throw new NotImplemented("payments.markPaid");
}

export async function upcoming(_days: number): Promise<PaymentDue[]> {
  throw new NotImplemented("payments.upcoming");
}
