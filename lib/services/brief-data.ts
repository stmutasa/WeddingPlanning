import type { ForecastStatus, RsvpStatus } from "@/lib/types";

/**
 * The shape the Brief is rendered from (DESIGN.md §8). It is deliberately
 * narrow and structural rather than a set of Prisma payload types: the
 * collector hands it real rows, and the unit tests hand it a seeded
 * in-memory dataset, and the renderer cannot tell the difference.
 */

export interface BriefWedding {
  coupleNames: string;
  city: string;
  country: string;
  eventTimezone: string;
  targetMonth: string;
  weddingDate: Date | null;
  budgetCents: number;
  splitNumerator: number;
  splitDenominator: number;
}

export interface BriefEvent {
  name: string;
  slug: string;
  date: Date | null;
  budgetCents: number;
}

export interface BriefEnvelope {
  eventSlug: string;
  eventName: string;
  budgetCents: number;
  paidCents: number;
  committedCents: number;
  plannedCents: number;
  forecastCents: number;
  status: ForecastStatus;
}

export interface BriefBudgetSummary {
  totalCents: number;
  envelopes: BriefEnvelope[];
  unallocatedCents: number;
  paidCents: number;
  committedCents: number;
  forecastCents: number;
  remainingCents: number;
  status: ForecastStatus;
}

export interface BriefLine {
  eventName: string;
  categoryName: string;
  plannedCents: number;
  actualCents: number;
}

export interface BriefPayment {
  dueDate: Date;
  label: string;
  amountCents: number;
  status: string;
  vendor: { name: string };
}

export interface BriefVendor {
  name: string;
  status: string;
  quotedCents: number | null;
  paidCents: number;
  notes: string | null;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  category: { name: string } | null;
  event: { name: string } | null;
  nextDue: { label: string; dueDate: Date; amountCents: number } | null;
}

export interface BriefExpense {
  date: Date;
  description: string;
  amountCents: number;
  originalAmount: number | null;
  originalCurrency: string | null;
  event: { name: string };
  funder: { name: string };
  vendor: { name: string } | null;
}

export interface BriefPerson {
  userId: string | null;
  name: string;
  frontedCents: number;
  fairShareCents: number;
  balanceCents: number;
}

export interface BriefSettle {
  annette: BriefPerson;
  simi: BriefPerson;
  jointCents: number;
  familyCents: number;
  owedFromUserId: string | null;
  owedToUserId: string | null;
  owedCents: number;
  settlements: { settledAt: Date; amountCents: number; note: string | null }[];
}

export interface BriefTask {
  title: string;
  status: string;
  dueDate: Date | null;
  milestone: boolean;
  event: { name: string } | null;
  assignee: { name: string | null; settings: { displayName: string | null } | null } | null;
}

export interface BriefNote {
  kind: string;
  title: string | null;
  body: string;
  pinned: boolean;
}

export interface BriefActivity {
  createdAt: Date;
  summary: string;
}

export type BriefGuestCounts = Record<
  string,
  Partial<Record<RsvpStatus, number>> & { total: number; heads: number }
>;

export interface BriefData {
  now: Date;
  appName: string;
  wedding: BriefWedding;
  events: BriefEvent[];
  summary: BriefBudgetSummary;
  lines: BriefLine[];
  duePayments: BriefPayment[];
  vendors: BriefVendor[];
  recentExpenses: BriefExpense[];
  settle: BriefSettle;
  tasks: BriefTask[];
  openTasksByEvent: { eventName: string; count: number }[];
  guestCounts: BriefGuestCounts;
  pendingHouseholds: string[];
  notes: BriefNote[];
  activity: BriefActivity[];
}
