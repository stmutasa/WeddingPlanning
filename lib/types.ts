// String pseudo-enums for the SQLite/Prisma schema (no native Prisma enums on SQLite).
// Every const union named in DESIGN.md §3, plus a few small helper unions used
// by routes/services that aren't stored as a column type themselves.

export const FUNDER_KINDS = ["USER", "JOINT", "FAMILY", "OTHER"] as const;
export type FunderKind = (typeof FUNDER_KINDS)[number];

export const EVENT_SLUGS = [
  "ruracio",
  "wedding",
  "honeymoon",
  "party",
  "general",
] as const;
export type EventSlug = (typeof EVENT_SLUGS)[number];

export const EXPENSE_SOURCES = [
  "MANUAL",
  "QUICK_ADD",
  "RECEIPT",
  "BANK",
  "CSV",
  "ASSISTANT",
] as const;
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

export const VENDOR_STATUSES = [
  "CONSIDERING",
  "QUOTED",
  "BOOKED",
  "PAID",
  "DECLINED",
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const PAYMENT_STATUSES = ["OPEN", "PAID", "CANCELLED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const TX_STATUSES = ["NEW", "LINKED", "IGNORED"] as const;
export type TxStatus = (typeof TX_STATUSES)[number];

export const TASK_STATUSES = ["OPEN", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["P1", "P2", "P3"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const RSVP_STATUSES = [
  "NOT_INVITED",
  "INVITED",
  "YES",
  "NO",
  "MAYBE",
] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const GUEST_SIDES = ["BRIDE", "GROOM", "BOTH"] as const;
export type GuestSide = (typeof GUEST_SIDES)[number];

export const NOTE_KINDS = ["NOTE", "DECISION", "IDEA", "QUESTION"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const CHAT_ROLES = ["user", "assistant", "tool"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export const AI_PROVIDERS = ["openai", "anthropic"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_FEATURES = [
  "QUICK_ADD",
  "RECEIPT",
  "TRIAGE",
  "ASSISTANT",
  "FORECAST",
  "BUDGET_DRAFT",
  "TIMELINE",
  "DIGEST",
  "BRIEF",
  "CONTRACT",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const FORECAST_STATUSES = ["ON_TRACK", "AT_RISK", "OVER"] as const;
export type ForecastStatus = (typeof FORECAST_STATUSES)[number];

// ---- Supporting unions (not individually named in §3 but needed for typed
// access to other string columns / request bodies) ----

export const AI_EFFORTS = ["low", "medium", "high"] as const;
export type AiEffort = (typeof AI_EFFORTS)[number];

export const AI_RESOLVED_FROM = ["", "env", "match", "user"] as const;
export type AiResolvedFrom = (typeof AI_RESOLVED_FROM)[number];

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const HUES = [
  "pink",
  "blue",
  "orange",
  "violet",
  "green",
  "teal",
  "red",
  "amber",
] as const;
export type Hue = (typeof HUES)[number];

export const BUDGET_LINE_SOURCES = ["USER", "AI"] as const;
export type BudgetLineSource = (typeof BUDGET_LINE_SOURCES)[number];

export const TASK_SOURCES = ["USER", "AI"] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export const TRANSACTION_SOURCES = ["PLAID", "CSV"] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const ATTACHMENT_KINDS = [
  "RECEIPT",
  "INVOICE",
  "CONTRACT",
  "OTHER",
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const VISIBILITIES = ["SHARED"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const ACTIVITY_ACTIONS = [
  "CREATED",
  "UPDATED",
  "DELETED",
  "PAID",
  "CONFIRMED",
  "IGNORED",
  "SETTLED",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ENTITY_TYPES = [
  "Expense",
  "Vendor",
  "PaymentDue",
  "Task",
  "Guest",
  "Note",
  "Event",
  "Transaction",
  "Settings",
  "BudgetLine",
  "Funder",
  "Contribution",
  "Settlement",
  "Wedding",
  "ChatThread",
  "Category",
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const BRIEF_TRIGGERS = ["CRON", "MANUAL"] as const;
export type BriefTrigger = (typeof BRIEF_TRIGGERS)[number];
