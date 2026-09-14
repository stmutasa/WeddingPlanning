/**
 * The JSON shapes the API routes hand back, as the browser sees them:
 * identical to the Prisma rows and service results except that every
 * `DateTime` has already been serialised to an ISO string. Screens import
 * from here rather than from `@prisma/client`, which would drag server-only
 * types (and their `Date`s) into client components.
 */
import type {
  AiEffort,
  AiProvider,
  AttachmentKind,
  EventSlug,
  ExpenseSource,
  ForecastStatus,
  FunderKind,
  GuestSide,
  Hue,
  NoteKind,
  PaymentStatus,
  RsvpStatus,
  TaskPriority,
  TaskStatus,
  Theme,
  TxStatus,
  VendorStatus,
} from "./types";

export interface WeddingDto {
  id: string;
  coupleNames: string;
  city: string;
  country: string;
  eventTimezone: string;
  targetMonth: string;
  weddingDate: string | null;
  budgetCents: number;
  currency: string;
  splitNumerator: number;
  splitDenominator: number;
}

export interface AppSettingsDto {
  id: string;
  aiPrimaryProvider: AiProvider;
  aiPrimaryModel: string;
  aiPrimaryResolvedFrom: string;
  aiBackupProvider: AiProvider;
  aiBackupModel: string;
  aiReasoning: AiEffort;
  aiEnabled: boolean;
  assistantTone: string;
  briefToken: string | null;
  digestDay: number;
}

export interface UserSettingsDto {
  id: string;
  userId: string;
  displayName: string | null;
  hue: Hue;
  timezone: string;
  digestHour: number;
  pushEnabled: boolean;
  theme: Theme;
}

export interface PersonDto {
  userId: string;
  funderId: string | null;
  name: string;
  email: string;
  hue: Hue;
}

export interface EventDto {
  id: string;
  slug: string;
  name: string;
  date: string | null;
  budgetCents: number;
  color: string | null;
  sortOrder: number;
  notes: string | null;
  locked: boolean;
}

export interface CategoryDto {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
}

export interface FunderDto {
  id: string;
  name: string;
  kind: FunderKind;
  userId: string | null;
  archived: boolean;
}

export interface AttachmentDto {
  id: string;
  expenseId: string | null;
  vendorId: string | null;
  kind: AttachmentKind;
  path: string;
  mime: string;
  bytes: number;
  extractedText: string | null;
  createdAt: string;
}

export interface ExpenseDto {
  id: string;
  description: string;
  amountCents: number;
  originalAmount: number | null;
  originalCurrency: string | null;
  fxRate: number | null;
  date: string;
  eventId: string;
  event: EventDto;
  categoryId: string | null;
  category: CategoryDto | null;
  vendorId: string | null;
  vendor: VendorDto | null;
  funderId: string;
  funder: FunderDto;
  source: ExpenseSource;
  notes: string | null;
  createdById: string;
  attachments?: AttachmentDto[];
  createdAt: string;
}

export interface ExpenseListDto {
  expenses: ExpenseDto[];
  totalCents: number;
  count: number;
}

export interface VendorDto {
  id: string;
  name: string;
  categoryId: string | null;
  category?: CategoryDto | null;
  eventId: string | null;
  event?: EventDto | null;
  status: VendorStatus;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  address: string | null;
  quotedCents: number | null;
  quotedOriginalAmount: number | null;
  quotedOriginalCurrency: string | null;
  contractSummary: string | null;
  notes: string | null;
  rating: number | null;
}

export interface VendorWithMoneyDto extends VendorDto {
  paidCents: number;
  nextDue: { label: string; dueDate: string; amountCents: number } | null;
}

export interface VendorDetailDto extends VendorDto {
  payments: PaymentDueDto[];
  attachments: AttachmentDto[];
  expenses: { id: string; description: string; amountCents: number; date: string }[];
}

export interface PaymentDueDto {
  id: string;
  vendorId: string;
  vendor?: VendorDto;
  label: string;
  dueDate: string;
  amountCents: number;
  status: PaymentStatus;
  expenseId: string | null;
}

export interface BudgetEnvelopeDto {
  eventId: string;
  eventSlug: string;
  eventName: string;
  budgetCents: number;
  paidCents: number;
  committedCents: number;
  plannedCents: number;
  forecastCents: number;
  status: ForecastStatus;
  percentOfBudget: number;
}

export interface BudgetSummaryDto {
  totalCents: number;
  envelopes: BudgetEnvelopeDto[];
  unallocatedCents: number;
  paidCents: number;
  committedCents: number;
  plannedCents: number;
  forecastCents: number;
  remainingCents: number;
  status: ForecastStatus;
}

export interface BudgetLineDto {
  id: string;
  eventId: string;
  categoryId: string;
  category?: CategoryDto;
  plannedCents: number;
  note: string | null;
  source: string;
}

export interface SettlePersonDto {
  userId: string | null;
  funderId: string | null;
  name: string;
  frontedCents: number;
  netFrontedCents: number;
  fairShareCents: number;
  balanceCents: number;
}

export interface SettlementDto {
  id: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  note: string | null;
  settledAt: string;
}

export interface SettleSummaryDto {
  annette: SettlePersonDto;
  simi: SettlePersonDto;
  annetteFrontedCents: number;
  simiFrontedCents: number;
  jointCents: number;
  familyCents: number;
  ratio: { numerator: number; denominator: number };
  owedFromUserId: string | null;
  owedToUserId: string | null;
  owedCents: number;
  settlements: SettlementDto[];
}

export interface TransactionDto {
  id: string;
  accountId: string | null;
  account?: {
    id: string;
    name: string;
    mask: string | null;
    item?: { institution: string | null };
  } | null;
  externalId: string;
  source: string;
  date: string;
  name: string;
  merchant: string | null;
  amountCents: number;
  currency: string;
  pending: boolean;
  status: TxStatus;
  aiIsWedding: boolean | null;
  aiEventId: string | null;
  aiCategoryId: string | null;
  aiVendorId: string | null;
  aiConfidence: number | null;
  aiReason: string | null;
  expenseId: string | null;
}

export interface TaskDto {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  eventId: string | null;
  event: EventDto | null;
  assigneeId: string | null;
  assignee: { id: string; name: string | null } | null;
  status: TaskStatus;
  priority: TaskPriority;
  milestone: boolean;
  source: string;
  sortOrder: number;
  completedAt: string | null;
}

export interface NoteDto {
  id: string;
  kind: NoteKind;
  title: string | null;
  body: string;
  pinned: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuestEventDto {
  id: string;
  guestId: string;
  eventId: string;
  event?: EventDto;
  rsvp: RsvpStatus;
}

export interface GuestDto {
  id: string;
  firstName: string;
  lastName: string | null;
  household: string | null;
  side: GuestSide;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  dietary: string | null;
  plusOnes: number;
  notes: string | null;
  events: GuestEventDto[];
}

export type GuestCountsDto = Record<
  string,
  Partial<Record<RsvpStatus, number>> & { total: number; heads: number }
>;

export interface ActivityDto {
  id: string;
  userId: string | null;
  user?: {
    id: string;
    name: string | null;
    settings?: { displayName: string | null; hue: Hue } | null;
  } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export interface DigestDto {
  headline: string;
  body: string[];
  push: string;
  generatedAt: string;
  fromModel: boolean;
}

export interface BriefDto {
  id: string;
  markdown: string;
  words: number;
  generatedAt: string;
  trigger: string;
  token: string;
  drive: {
    /** The FEATURE_DRIVE_BRIEF flag: without it the toggle is not offered. */
    enabled: boolean;
    fileId: string | null;
    ownerUserId: string | null;
    hasScope: boolean;
    lastError: string | null;
  };
}

export interface ChatThreadDto {
  id: string;
  title: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDto {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls: string | null;
  authorId: string | null;
  model: string | null;
  createdAt: string;
}

export interface ModelInfoDto {
  id: string;
  displayName?: string | null;
  createdAt?: string | null;
}

export interface AiModelsDto {
  openai: ModelInfoDto[];
  anthropic: ModelInfoDto[];
  fetchedAt: string | null;
  errors: { openai?: string | null; anthropic?: string | null } | Record<string, string | null>;
  primary: { provider: AiProvider; model: string } | null;
  backup: { provider: AiProvider; model: string } | null;
  resolvedFrom: string;
  problem: string | null;
  enabled: boolean;
}

export interface UsageRowDto {
  /** The feature name or the model id, depending on the breakdown. */
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  /** null wherever a model has no rate on file — shown as "n/a". */
  costMicros: number | null;
}

export interface AiUsageDto {
  window: string;
  since: string;
  totals: UsageRowDto;
  byFeature: UsageRowDto[];
  byModel: UsageRowDto[];
  fellBackCalls: number;
  unpricedCalls: number;
}

export interface PlaidStateDto {
  configured: boolean;
  environment: string;
  items: {
    id: string;
    itemId: string;
    institution: string | null;
    lastSyncAt: string | null;
    lastError: string | null;
    accounts: {
      id: string;
      accountId: string;
      name: string;
      mask: string | null;
      subtype: string | null;
      watched: boolean;
    }[];
  }[];
}

/** The capture sheet's AI helpers answer either a draft or `{ disabled }`. */
export type MaybeDisabled<T> = T | { disabled: true; reason?: string };

export function isDisabled<T extends object>(
  value: MaybeDisabled<T>,
): value is { disabled: true; reason?: string } {
  return Boolean((value as { disabled?: boolean }).disabled);
}

export interface QuickAddResolved {
  eventId: string | null;
  eventName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  funderId: string | null;
  funderName: string | null;
  date: string;
  amountCents: number | null;
  fxRate: number | null;
  originalAmount: number | null;
  originalCurrency: string;
}

export interface QuickAddDto {
  draft: {
    amount: number | null;
    originalCurrency: string;
    description: string;
    eventSlug: EventSlug | string | null;
    categoryName: string | null;
    vendorId: string | null;
    vendorNameNew: string | null;
    funderName: string | null;
    date: string | null;
    isDeposit: boolean;
    confidence: number;
  };
  resolved: QuickAddResolved;
  provider: AiProvider;
  model: string;
  fellBack: boolean;
}

export interface ReceiptDto {
  draft: {
    kind: string;
    merchant: string | null;
    total: number | null;
    currency: string | null;
    date: string | null;
    lineItems: { description: string; amount: number | null }[];
    paidAmount: number | null;
    schedule: { label: string; dueDate: string | null; amount: number | null }[];
    suggestedEventSlug: string | null;
    suggestedCategoryName: string | null;
    vendorMatchId: string | null;
    transcript: string;
    confidence: number;
  };
  resolved: QuickAddResolved & { offersSchedule: boolean };
  provider: AiProvider;
  model: string;
  fellBack: boolean;
}

export interface BudgetDraftDto {
  envelopes: {
    eventSlug: string;
    eventId: string | null;
    eventName: string;
    budgetCents: number;
    currentCents: number;
    deltaCents: number;
    rationale: string;
  }[];
  lines: {
    eventSlug: string;
    eventId: string | null;
    categoryName: string;
    categoryId: string | null;
    plannedCents: number;
    rationale: string;
  }[];
  assumptions: string[];
  warnings: string[];
  proposedTotalCents: number;
  currentTotalCents: number;
  provider: AiProvider;
  model: string;
  fellBack: boolean;
}

export interface TimelineDraftDto {
  drafted: {
    title: string;
    eventSlug: string | null;
    dueDate: string;
    priority: TaskPriority;
    milestone: boolean;
    notes: string | null;
    suggestedAssignee: string | null;
  }[];
  created: TaskDto[];
  createdCount: number;
  skipped: number;
  applied: boolean;
  provider: AiProvider;
  model: string;
  fellBack: boolean;
}

export interface ContractSummaryDto {
  summary: string;
  totalAmount: number | null;
  currency: string | null;
  schedule: { label: string; dueDate: string | null; amount: number | null }[];
  cancellationTerms: string | null;
  redFlags: string[];
  questionsToAsk: string[];
  attachmentId: string;
  vendorId: string | null;
  vendorName: string | null;
  saved: boolean;
  provider: AiProvider;
  model: string;
  fellBack: boolean;
}

export interface CsvImportDto {
  imported: number;
  duplicates: number;
  skipped: number;
  newIds: string[];
}

/** Event slugs the design system has a colour for; anything else reads as General. */
export const KNOWN_EVENT_SLUGS: EventSlug[] = [
  "ruracio",
  "wedding",
  "honeymoon",
  "party",
  "general",
];
