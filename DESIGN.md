# Wedding Planner + Expense Tracker — Build Contract

**Design authority:** this document is the contract. Build agents implement exactly this; deviations only when something is technically impossible, and every deviation is noted in the phase report. Where this file and `PROMPTS.md` disagree on an AI contract, `PROMPTS.md` wins. Where this file and `CONTEXT.md` disagree on a decision, `CONTEXT.md` (newer) wins.

**Working name:** the product name is being chosen by Annette from the lookbook (`docs/lookbook/index.html`). Until then the repo, package and wordmark use the placeholder `APP_NAME` (env, default `Pamoja`). Nothing else may hardcode a name.

---

## 1. Product

A private, two-user, fully shared wedding planner and expense tracker for **Annette Mugambi** (iPhone) and **Simukayi "Simi" Mutasa** (Android). Wedding in **Nairobi, August 2027**, exact date not yet set. **Total budget $50,000 USD** (ring already bought, excluded). Everything is visible to both; there are no private items in v1 (the schema leaves room for a later `visibility` flag, see §3).

**Core loop:** Capture money (ten-second expense entry: type it, photograph it, or accept it from the bank feed) → See the truth (remaining budget by event, what is committed but unpaid, who has fronted what) → Plan ahead (vendor payment schedule, tasks on a timeline, guest counts) → Ask (an assistant that can read and write all of it) → Carry it elsewhere (a daily regenerated **Brief** that any external AI chat can be handed).

**Success criteria surfaced in-app:** remaining vs budget on the home screen, always current; "on track / at risk / over" per event from a deterministic forecast; the Brief never older than 24h.

### Events (seeded, editable)
| Slug | Name | Notes |
|---|---|---|
| `ruracio` | Ruracio | Kenyan bride-price negotiation and family ceremony; happens before the wedding |
| `wedding` | Wedding | Ceremony and reception, Nairobi |
| `honeymoon` | Honeymoon | |
| `party` | Joint bachelor / bachelorette | One combined party |
| `general` | General | Anything that spans events (stationery, rings excluded, planner fees). Cannot be deleted. |

Each event carries its own **budget envelope** (`budgetCents`). Envelopes must sum to ≤ the wedding total; the UI warns (does not block) when they don't add up.

### Money model
- **Currency:** USD only for storage and display. Receipts and quotes in KES (or anything else) are converted at entry: the expense stores `amountCents` (USD) plus `originalAmount`, `originalCurrency`, `fxRate` for the audit trail. Rate source: `open.er-api.com` (free, no key, cached 24h in `FxRate`), overridable per expense. Never do currency arithmetic in the model; the server converts.
- **Funders** (who paid): seeded `Annette` (user), `Simi` (user), `Joint` (shared account). Family contributors (e.g. "Mum & Dad Mugambi") are added as `FAMILY` funders. Every expense has exactly one funder.
- **Settle-up:** the app assumes the two of them split wedding costs 50/50 unless `Settings.splitRatio` says otherwise. Fronted = expenses paid by a `USER` funder. The Money screen shows "Simi has fronted $X more than Annette" (or the reverse) and a `Mark settled` action that records a `Settlement` row. `JOINT` and `FAMILY` money never enters settle-up.
- **Committed vs paid:** `Expense` rows are money that has left someone's hands. Future obligations live in `PaymentDue` (vendor instalments) and are "committed". Forecast per event = paid + committed + (planned budget lines not yet covered by either). Status thresholds: `ON_TRACK` (forecast ≤ 95% envelope), `AT_RISK` (95–105%), `OVER` (>105%).
- **Bank feed:** Plaid transactions land in a **Transactions inbox**, never directly in expenses. Each is AI-tagged (`isWedding`, suggested event/category/vendor, confidence) and a human confirms with one tap, edits, or ignores. Confirming creates an `Expense` linked back to the transaction. Manual and bank paths produce identical `Expense` rows.

---

## 2. Stack & environment decisions (final)

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (latest stable, App Router) + TypeScript strict**, `output: "standalone"` | Same as Kindred and DoneX; agents know it. Read `node_modules/next/dist/docs/` before writing routes: APIs drift. `params`/`searchParams` are Promises. |
| Styling | **Tailwind CSS v4** with `@theme` tokens in `app/globals.css` | Tokens come from the chosen lookbook direction (§5). Dark + light both required. |
| DB | **SQLite via Prisma** (`file:` URL). Dev `./prisma/dev.db`, prod `/data/app.db` on a Railway volume, one replica | Two users; zero ops. **No Prisma enums, no `Json` columns** on SQLite: string pseudo-enums + relational modelling. Uploads go to `/data/uploads/` (path stored in DB), never as blobs in SQLite. |
| Auth | **Auth.js v5** (`next-auth@beta`), Google provider, JWT session + PrismaAdapter, split `auth.config.ts` (edge) / `auth.ts` (full). Sign-in allowed only for `ALLOWED_EMAILS` (exactly the two) | Both have Google accounts. Google scopes requested at login: `openid email profile` only. `drive.file` is requested separately from Settings when Brief → Drive sync is enabled (§8). |
| AI | Provider-agnostic facade `lib/ai/` over **`openai`** (Responses API) and **`@anthropic-ai/sdk`** (Messages API). Primary + backup model chosen in Settings from a **live, cached model list** (§7). Default primary from `AI_MODEL` (OpenAI id Simi supplies), default backup `claude-opus-5` | Simi wants an OpenAI model on high reasoning as primary, with a populated dropdown and a backup. |
| Bank | **`plaid`** npm, Link token flow, `/transactions/sync` with cursor, webhook optional. `PLAID_ENV` sandbox → production | Simi asked for Plaid. See CONTEXT.md §4 for the limits. CSV import is the fallback path and ships in the same phase. |
| FX | `open.er-api.com/v6/latest/USD` fetched server-side, cached in `FxRate` per (base, quote, day) | KES quotes are inevitable for a Nairobi wedding; storage stays USD. |
| Push | `web-push` (VAPID). iOS needs the installed PWA (16.4+); Android Chrome works in-browser too | |
| Jobs | `node-cron` from `instrumentation.ts` (`register()`, guarded `NEXT_RUNTIME === "nodejs"`, singleton guard) | Single Railway service. |
| Validation | `zod` on every API body/query | |
| Dates | `date-fns` + `date-fns-tz`. Store UTC. Render in the **viewer's** timezone (`UserSettings.timezone`; Simi default `America/New_York`, Annette default `America/New_York` until she changes it; wedding events render in `Africa/Nairobi`) | Two people, possibly two zones. |
| Data fetching (client) | `swr` | DoneX pattern; optimistic updates on trivial mutations. |
| Mobile | **Installable PWA**: manifest, service worker, apple-touch-icon, `theme-color` from tokens | One codebase for iPhone and Android. |
| Tests | `vitest` for pure logic (`lib/money/*`, `lib/forecast.ts`, `lib/brief/*`, quick-parse); one `scripts/smoke.ts` for the service layer | Money math must be tested. Everything else is time-boxed. |
| Deploy | Railway, Dockerfile multi-stage `node:22-alpine`, volume at `/data`, healthcheck `/api/health` | As Kindred. |

**Project layout**
```
app/                 Next.js App Router
  (auth)/login       (app)/…screens   api/…routes   layout.tsx  globals.css  offline/
components/          ui/ (primitives) shell/ money/ plan/ guests/ vendors/ ask/ brief/ settings/ capture/
lib/
  ai/                client.ts (facade) openai.ts anthropic.ts models.ts prompts.ts tools.ts usage.ts
  services/          expenses.ts budget.ts vendors.ts payments.ts guests.ts tasks.ts notes.ts activity.ts
                     forecast.ts settle.ts transactions.ts plaid.ts fx.ts brief.ts digest.ts push.ts
  money/             cents.ts (all arithmetic in integer cents) format.ts split.ts
  jobs/scheduler.ts  db.ts  auth helpers  types.ts (const unions)  api.ts (client fetch helpers)
prisma/schema.prisma + migrations
public/manifest.webmanifest sw.js icons/
scripts/seed.ts generate-icons.ts generate-vapid.ts smoke.ts
docs/lookbook/       (this lookbook; static)
```

**Conventions (all code):** imports via `@/`; no `any`; every API handler starts with the session gate (`const session = await auth(); if (!session?.user) return 401`) except `/api/auth/*`, `/api/health`, `/api/brief.md` (token-gated, §8), `/api/plaid/webhook` (Plaid-verified); errors `{ error: string }` with a status; success is plain JSON, no envelope; route handlers `export const dynamic = "force-dynamic"`; money is **integer cents** everywhere (`amountCents`), never floats; all writes go through `lib/services/*` which also append an `Activity` row.

---

## 3. Data model — Prisma schema (copy verbatim, then `prisma migrate dev --name init`)

String pseudo-enums live in `lib/types.ts` as const unions: `FunderKind`, `EventSlug`, `ExpenseSource`, `VendorStatus`, `PaymentStatus`, `TxStatus`, `TaskStatus`, `TaskPriority`, `RsvpStatus`, `GuestSide`, `NoteKind`, `ChatRole`, `AiProvider`, `AiFeature`, `ForecastStatus`.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }

// ---------- Auth.js ----------
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  settings      UserSettings?
  pushSubs      PushSubscription[]
  funder        Funder?
  plaidItems    PlaidItem[]
  activities    Activity[]
  tasksAssigned Task[]     @relation("TaskAssignee")
  createdAt     DateTime  @default(now())
}
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

// ---------- Singletons ----------
model Wedding {                       // exactly one row, id "main"
  id            String   @id @default("main")
  coupleNames   String   @default("Annette & Simi")
  city          String   @default("Nairobi")
  country       String   @default("Kenya")
  eventTimezone String   @default("Africa/Nairobi")
  targetMonth   String   @default("2027-08")   // YYYY-MM, used until a date is set
  weddingDate   DateTime?                        // null until chosen
  budgetCents   Int      @default(5000000)      // $50,000
  currency      String   @default("USD")
  splitNumerator Int     @default(1)            // settle-up share for Annette; Simi = 1 - this
  splitDenominator Int   @default(2)
  updatedAt     DateTime @updatedAt
}
model AppSettings {                   // exactly one row, id "main"; shared by both users
  id               String @id @default("main")
  aiPrimaryProvider String @default("openai")     // openai | anthropic
  aiPrimaryModel   String  @default("")           // "" => env AI_MODEL
  aiBackupProvider String  @default("anthropic")
  aiBackupModel    String  @default("claude-opus-5")
  aiReasoning      String  @default("high")       // low | medium | high  (mapped per provider)
  aiEnabled        Boolean @default(true)
  assistantTone    String  @default("warm, direct, brief")
  briefToken       String?                        // random 32 hex; gates /api/brief.md?token=
  briefDriveFileId String?                        // Google Drive file id when Drive sync is on
  briefDriveOwnerUserId String?                   // whose Drive credentials are used
  digestDay        Int     @default(0)            // 0 = Sunday
  updatedAt        DateTime @updatedAt
}
model UserSettings {
  id          String  @id @default(cuid())
  userId      String  @unique
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  displayName String?                    // "Annette" / "Simi"
  hue         String  @default("pink")   // pink | blue | orange | violet | green | teal | red | amber
  timezone    String  @default("America/New_York")
  digestHour  Int     @default(8)
  pushEnabled Boolean @default(false)
  theme       String  @default("system") // system | light | dark
  updatedAt   DateTime @updatedAt
}

// ---------- Money ----------
model Event {
  id          String  @id @default(cuid())
  slug        String  @unique
  name        String
  date        DateTime?
  budgetCents Int     @default(0)
  color       String? // token name
  sortOrder   Int     @default(0)
  notes       String?
  locked      Boolean @default(false)  // general=true: cannot be deleted
  expenses    Expense[]
  budgetLines BudgetLine[]
  vendors     Vendor[]
  tasks       Task[]
  guestEvents GuestEvent[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
model Category {
  id        String @id @default(cuid())
  name      String @unique   // Venue, Catering, Attire, Photo & Video, Music & DJ, Decor & Flowers,
                             // Stationery, Beauty, Transport, Travel & Stay, Gifts & Favours, Fees & Legal, Ruracio gifts, Other
  icon      String?
  sortOrder Int    @default(0)
  expenses  Expense[]
  budgetLines BudgetLine[]
  vendors   Vendor[]
}
model BudgetLine {                    // optional planned detail inside an event envelope
  id           String @id @default(cuid())
  eventId      String
  event        Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  categoryId   String
  category     Category @relation(fields: [categoryId], references: [id])
  plannedCents Int
  note         String?
  source       String @default("USER")  // USER | AI
  @@unique([eventId, categoryId])
}
model Funder {
  id      String @id @default(cuid())
  name    String
  kind    String            // USER | JOINT | FAMILY | OTHER
  userId  String? @unique
  user    User?   @relation(fields: [userId], references: [id])
  archived Boolean @default(false)
  expenses Expense[]
  contributions Contribution[]
}
model Vendor {
  id           String  @id @default(cuid())
  name         String
  categoryId   String?
  category     Category? @relation(fields: [categoryId], references: [id])
  eventId      String?
  event        Event?   @relation(fields: [eventId], references: [id])
  status       String   @default("CONSIDERING") // CONSIDERING | QUOTED | BOOKED | PAID | DECLINED
  contactName  String?
  phone        String?
  whatsapp     String?
  email        String?
  website      String?
  instagram    String?
  address      String?
  quotedCents  Int?
  quotedOriginalAmount Float?
  quotedOriginalCurrency String?
  contractSummary String?   // AI summary of the contract/quote text
  notes        String?
  rating       Int?
  expenses     Expense[]
  payments     PaymentDue[]
  attachments  Attachment[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([status])
}
model PaymentDue {                    // committed future money
  id         String  @id @default(cuid())
  vendorId   String
  vendor     Vendor  @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  label      String              // "Deposit", "Balance", "Instalment 2 of 3"
  dueDate    DateTime
  amountCents Int
  status     String  @default("OPEN")   // OPEN | PAID | CANCELLED
  expenseId  String? @unique            // set when paid
  expense    Expense? @relation(fields: [expenseId], references: [id])
  reminderSentAt DateTime?
  createdAt  DateTime @default(now())
  @@index([status, dueDate])
}
model Expense {
  id           String  @id @default(cuid())
  description  String
  amountCents  Int                     // USD
  originalAmount   Float?
  originalCurrency String?             // ISO 4217
  fxRate       Float?                  // original -> USD
  date         DateTime
  eventId      String
  event        Event  @relation(fields: [eventId], references: [id])
  categoryId   String?
  category     Category? @relation(fields: [categoryId], references: [id])
  vendorId     String?
  vendor       Vendor?   @relation(fields: [vendorId], references: [id])
  funderId     String
  funder       Funder    @relation(fields: [funderId], references: [id])
  source       String    @default("MANUAL")  // MANUAL | QUICK_ADD | RECEIPT | BANK | CSV | ASSISTANT
  notes        String?
  createdById  String
  visibility   String    @default("SHARED")  // SHARED only in v1; reserved
  paymentDue   PaymentDue?
  transaction  Transaction?
  attachments  Attachment[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([eventId, date])
  @@index([funderId])
}
model Contribution {                  // money coming in from family; informational, does not change budgetCents
  id         String @id @default(cuid())
  funderId   String
  funder     Funder @relation(fields: [funderId], references: [id])
  amountCents Int
  date       DateTime
  note       String?
  createdAt  DateTime @default(now())
}
model Settlement {
  id          String @id @default(cuid())
  fromUserId  String
  toUserId    String
  amountCents Int
  note        String?
  settledAt   DateTime @default(now())
}
model Attachment {                    // receipts, quotes, contracts; bytes on the volume
  id         String @id @default(cuid())
  expenseId  String?
  expense    Expense? @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  vendorId   String?
  vendor     Vendor?  @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  kind       String   // RECEIPT | INVOICE | CONTRACT | OTHER
  path       String   // relative to UPLOAD_DIR
  mime       String
  bytes      Int
  extractedText String?   // AI transcription for search
  createdAt  DateTime @default(now())
}
model FxRate {
  id     String @id @default(cuid())
  day    String   // YYYY-MM-DD
  base   String   // USD
  quote  String   // KES
  rate   Float
  @@unique([day, base, quote])
}

// ---------- Bank ----------
model PlaidItem {
  id          String @id @default(cuid())
  userId      String
  user        User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemId      String @unique
  accessTokenEnc String          // AES-256-GCM with APP_ENCRYPTION_KEY
  institution String?
  cursor      String?
  lastSyncAt  DateTime?
  lastError   String?
  accounts    PlaidAccount[]
  createdAt   DateTime @default(now())
}
model PlaidAccount {
  id        String @id @default(cuid())
  itemId    String
  item      PlaidItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  accountId String @unique
  name      String
  mask      String?
  subtype   String?
  watched   Boolean @default(true)   // untick cards that are never wedding-related
  transactions Transaction[]
}
model Transaction {                   // inbox row; one per Plaid or CSV transaction
  id          String @id @default(cuid())
  accountId   String?
  account     PlaidAccount? @relation(fields: [accountId], references: [id], onDelete: SetNull)
  externalId  String @unique        // plaid transaction_id, or csv hash
  source      String                 // PLAID | CSV
  date        DateTime
  name        String
  merchant    String?
  amountCents Int                   // positive = money out
  currency    String @default("USD")
  pending     Boolean @default(false)
  status      String @default("NEW")  // NEW | LINKED | IGNORED
  aiIsWedding Boolean?
  aiEventId   String?
  aiCategoryId String?
  aiVendorId  String?
  aiConfidence Float?
  aiReason    String?
  expenseId   String? @unique
  expense     Expense? @relation(fields: [expenseId], references: [id])
  createdAt   DateTime @default(now())
  @@index([status, date])
}

// ---------- Plan ----------
model Task {
  id          String @id @default(cuid())
  title       String
  notes       String?
  dueDate     DateTime?
  eventId     String?
  event       Event? @relation(fields: [eventId], references: [id])
  assigneeId  String?
  assignee    User?  @relation("TaskAssignee", fields: [assigneeId], references: [id])
  status      String @default("OPEN")    // OPEN | DONE
  priority    String @default("P2")      // P1 | P2 | P3
  milestone   Boolean @default(false)    // shows on the timeline
  source      String @default("USER")    // USER | AI
  sortOrder   Int    @default(0)
  createdById String
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([status, dueDate])
}
model Note {
  id        String @id @default(cuid())
  kind      String @default("NOTE")   // NOTE | DECISION | IDEA | QUESTION
  title     String?
  body      String
  pinned    Boolean @default(false)
  createdById String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ---------- Guests ----------
model Guest {
  id        String @id @default(cuid())
  firstName String
  lastName  String?
  household String?      // grouping label, e.g. "Mugambi, Meru"
  side      String @default("BOTH")   // BRIDE | GROOM | BOTH
  email     String?
  phone     String?
  city      String?
  country   String?
  dietary   String?
  plusOnes  Int    @default(0)
  notes     String?
  events    GuestEvent[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
model GuestEvent {
  id      String @id @default(cuid())
  guestId String
  guest   Guest  @relation(fields: [guestId], references: [id], onDelete: Cascade)
  eventId String
  event   Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  rsvp    String @default("NOT_INVITED")  // NOT_INVITED | INVITED | YES | NO | MAYBE
  @@unique([guestId, eventId])
}

// ---------- Assistant, AI, brief, system ----------
model ChatThread {
  id        String @id @default(cuid())
  title     String?
  createdById String
  messages  ChatMessage[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
model ChatMessage {
  id        String @id @default(cuid())
  threadId  String
  thread    ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  role      String    // user | assistant | tool
  content   String    // text; tool calls serialized as JSON text in toolCalls
  toolCalls String?   // JSON string
  authorId  String?   // user id for user turns
  model     String?
  createdAt DateTime @default(now())
  @@index([threadId, createdAt])
}
model AiUsage {
  id        String @id @default(cuid())
  provider  String
  model     String
  feature   String    // QUICK_ADD | RECEIPT | TRIAGE | ASSISTANT | FORECAST | BUDGET_DRAFT | TIMELINE | DIGEST | BRIEF | CONTRACT
  inputTokens Int
  outputTokens Int
  cachedTokens Int @default(0)
  costMicros Int?    // USD micro-dollars, from a rate table; null if unpriced
  latencyMs Int?
  fellBack  Boolean @default(false)
  createdAt DateTime @default(now())
}
model ModelCache {                    // live model lists, refreshed hourly
  id        String @id @default(cuid())
  provider  String @unique
  json      String   // JSON string: [{id, displayName, createdAt}]
  fetchedAt DateTime
}
model BriefSnapshot {
  id        String @id @default(cuid())
  markdown  String
  words     Int
  generatedAt DateTime @default(now())
  trigger   String   // CRON | MANUAL
}
model Activity {
  id         String @id @default(cuid())
  userId     String?
  user       User?  @relation(fields: [userId], references: [id])
  action     String   // CREATED | UPDATED | DELETED | PAID | CONFIRMED | SETTLED | ...
  entityType String   // Expense | Vendor | PaymentDue | Task | Guest | Note | Event | Transaction | Settings
  entityId   String?
  summary    String   // "Annette added Ruracio venue hold, $800"
  createdAt  DateTime @default(now())
  @@index([createdAt])
}
model PushSubscription {
  id        String @id @default(cuid())
  userId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
}
```

---

## 4. Service layer contracts (Phase B)

All services live in `lib/services/`, take the acting `userId`, write an `Activity` row on every mutation, and are the only code that touches Prisma outside pure CRUD routes.

- `expenses.create(userId, input)` → validates event/funder exist; if `originalCurrency` ≠ USD and no `fxRate`, calls `fx.rate(day, cur)`; computes `amountCents`; if `paymentDueId` supplied, marks that `PaymentDue` PAID and links; returns expense with relations. `expenses.update/delete` mirror. `expenses.list(filters)`: event, category, vendor, funder, date range, `q`, source; returns rows + totals.
- `budget.summary()` → `{ totalCents, envelopes: [{event, budgetCents, paidCents, committedCents, plannedCents, forecastCents, status}], unallocatedCents, paidCents, committedCents, remainingCents }`. `budget.setEnvelopes(...)`, `budget.setLines(eventId, lines[])`.
- `forecast.compute(event)` (pure, tested): `forecastCents = paid + openPayments + max(0, sum(plannedLines) − paid − openPayments coveredByThoseLines)`. Status thresholds per §1. Also `forecast.burn()` → monthly spend history and months-to-go, used for the digest narrative.
- `settle.summary()` → `{ annetteFrontedCents, simiFrontedCents, ratio, owedFromUserId, owedToUserId, owedCents, settlements[] }`; `settle.record(userId, amountCents, note)`.
- `vendors.*` CRUD; `vendors.setStatus`; `payments.schedule(vendorId, items[])` replaces OPEN items; `payments.markPaid(paymentId, expenseInput)` (creates the expense in one transaction); `payments.upcoming(days)`.
- `transactions.sync(userId)` → for each `PlaidItem`, `/transactions/sync` with cursor, upsert `Transaction` rows for watched accounts (money-out only), then `transactions.triage(newIds)` (AI, batched 25 per call, `PROMPTS.md` §3). `transactions.confirm(userId, id, expenseInput)`, `transactions.ignore(id)`, `transactions.importCsv(userId, file, mapping)` (dedupe by hash of date+amount+name).
- `plaid.createLinkToken(userId)`, `plaid.exchange(userId, publicToken)`, `plaid.removeItem(userId, itemId)`. Access tokens encrypted at rest.
- `tasks.*` CRUD, `tasks.reorder`, `tasks.generateTimeline()` (`PROMPTS.md` §6; idempotent: skips titles that already exist).
- `guests.*` CRUD, `guests.counts()` per event × rsvp, `guests.importCsv`.
- `notes.*`, `activity.recent(n)`.
- `brief.generate(trigger)` → builds markdown deterministically from the DB (§8), asks the model for the "state of play" paragraph (`PROMPTS.md` §8), stores `BriefSnapshot`, prunes to the last 30, and if Drive sync is on, updates the Drive file. `brief.latest()`.
- `digest.weekly()` → Sunday per-user push + in-app card (`PROMPTS.md` §7).
- `push.send(userId, payload)`; prune 404/410.
- `ai.usage(window)` → totals and by-feature/by-model breakdown for Settings.

**Scheduler (`lib/jobs/scheduler.ts`):**
- every 6h: `transactions.sync` for all items (also on-demand from the inbox).
- daily 03:00 in `Wedding.eventTimezone`: `brief.generate("CRON")`; refresh `ModelCache` if older than 24h; refresh USD→KES rate.
- daily 09:00 per user timezone: payment reminders — push for any `PaymentDue` OPEN due within 7 days with `reminderSentAt` null (one push per user, dedupe by day).
- weekly `digestDay` at each user's `digestHour`: `digest.weekly()`.

**Smoke script `scripts/smoke.ts`** (against `file:./prisma/smoke.db`): migrate → seed → create expense in KES (fx mocked) → assert USD cents → schedule vendor payments → mark one paid → assert forecast + status → settle-up math → import CSV with a duplicate → assert dedupe → generate brief with AI disabled → assert markdown sections present → PASS/FAIL per step.

---

## 5. Design system — chosen from the lookbook

The lookbook (`docs/lookbook/index.html`, published as an artifact) now offers two directions after Annette's first round: **A Stationery, in colour** (Kindred bones; each event owns a colour: Ruracio marigold `#D9A21B`, Wedding bougainvillea `#B4306A`, Honeymoon lagoon `#2E8A87`, Joint party jacaranda `#7259B8`; primary accent bougainvillea; a four-colour ribbon on the top edge; stacked budget bar by event) and **B Kanga** (East African textile; indigo, marigold, kanga red on cotton; a proverb strip). Ledger is retired. Annette picks; Simi may add a note. **Phase C must not start until `CONTEXT.md` §2 records the pick.** Phases A and B proceed with the placeholder tokens below and ship no visual polish.

Whatever the pick, these rules hold:
- Both themes. `theme` per user (system/light/dark). Tokens defined once in `@theme`, never inline hex in components.
- Two **person hues** (`UserSettings.hue`) used only for attribution: "who paid", "who added", assignee chips. Never for anything else.
- **Event colours** (`Event.color`) are the only other categorical colour. They mark event chips, per-event bars and the stacked budget bar, and nothing else. Colour that is not a person, an event, or a semantic state is decoration and is not allowed.
- Semantic colours separate from the accent: `ok` (paid, on track), `warn` (at risk, due soon), `danger` (over, overdue). One meaning each, everywhere.
- Money: integer cents formatted `$43,580` (no cents unless < $100 or in a detail view); `tabular-nums` on every figure; original currency shown as a small secondary line ("KES 104,000 @ 130.0").
- Hit targets ≥ 44pt; one-thumb reach for the primary action on every screen; visible pressed and focus states; reduced-motion respected.
- Bottom tab bar on mobile (< 768px): **Home · Money · ＋ · Plan · Ask**. Desktop: left rail. `More` menu (avatar top-right): Guests, Vendors, Brief, Settings, theme toggle.
- **Placeholder tokens for Phases A–B** (neutral, replaced in C): bg `#F3F1EC`/`#17161A`, surface `#FFFFFF`/`#201F24`, ink `#201D1A`/`#EEEBE6`, ink-soft `#6A645C`/`#A29C93`, line 12% ink, accent `#3F5E4A`/`#9DC2A8`, ok `#2F7D4F`, warn `#B7791F`, danger `#B23A3A`; font system sans.

Direction token sheets (colours, type, radius, shadow rules) are in the lookbook's CSS under `.dir-a` and `.dir-b`; Phase C lifts the chosen one into `@theme` and writes the full component spec into this section before building.

---

## 6. Screens (Phase C)

Every screen: loading skeletons, designed empty states, toasts bottom-centre above the tab bar, optimistic updates where trivial.

**Login `/login`:** wordmark, one line ("Annette & Simi · Nairobi · August 2027"), `Continue with Google`. Non-allowlisted email → "This app is just for the two of them."

**Home `/`:**
1. Header: wordmark, "N months to August 2027 · Nairobi" (or the exact countdown once a date is set).
2. **Remaining** card: remaining of $50,000, % spent bar, committed shown as a hatched segment after paid. Tap → Money.
3. **By event**: one row per event with paid / committed / envelope mini-bar and status pill. Tap → Money filtered.
4. **Next payments** (14 days): vendor, label, amount, due; `Mark paid` opens the expense sheet prefilled.
5. **Inbox** chip when `Transaction.status = NEW` count > 0 → Money › Inbox.
6. **Recent activity** (8): "Annette added Ruracio venue hold, $800 · 2h".
7. Weekly digest card (dismissable) when a new digest exists.

**Capture ＋ (sheet, from every screen):** three tabs. *Type:* one text field ("paid florist 800 deposit ruracio"), parsed live via `PROMPTS.md` §1 with chips for amount/event/category/vendor/funder/date; `Save` creates. *Photo:* camera/file → `PROMPTS.md` §2 → prefilled form with the receipt thumbnail; original currency and rate editable; never saves without confirmation. *Form:* the full manual form. Funder defaults to the current user. After save: toast "Saved · Wedding · $1,200 · Simi".

**Money `/money`** (tabs): *Expenses* (list, filters, totals, search; row: description, event chip, amount, funder hue dot, date; tap → detail/edit with attachments), *Budget* (envelope editor per event with slider/number; optional lines per category; `Draft with AI` → `PROMPTS.md` §5 → review diff → apply), *Vendors* (cards with status pill, quoted, paid, next payment; detail: contacts with tap-to-call/WhatsApp, payment schedule editor, attachments, `Summarise contract` → §9), *Payments* (all OPEN by due date, overdue in `danger`), *Inbox* (transactions: AI guess row "Wedding? Likely · Catering · Vendor X · 87%", actions `Confirm` `Edit` `Not wedding`; `Connect bank` / `Import CSV` at top), *Settle up* (fronted totals, who owes whom, history, `Mark settled`).

**Plan `/plan`** (tabs): *Tasks* (Today/Overdue/Upcoming/Someday groups; row with assignee hue, event chip, due; quick add; `Generate timeline` → §6 review then apply), *Timeline* (vertical month strip from now to the wedding month with milestones and payment dues on it), *Notes* (NOTE/DECISION/IDEA/QUESTION filter chips; pinned first).

**Guests `/guests`:** list grouped by household; side and per-event RSVP chips; counts header ("Wedding: 142 invited · 61 yes · 12 no"); search; CSV import; add/edit sheet.

**Ask `/ask`:** shared chat threads (list + thread). Composer with mic (browser speech recognition, as DoneX). Assistant messages render tool calls as compact cards ("Added expense: Photographer balance $2,400 · Wedding"). Streaming text. Suggested prompts on empty thread: "What's due this month?", "Are we on track for the wedding?", "Add 15,000 KES to Ruracio gifts, Annette paid".

**Brief `/brief`:** the latest Brief rendered, with `Copy markdown`, `Download .md`, `Regenerate now`, the token URL with `Copy link` and `Rotate token`, and the Drive sync toggle. Explains in one paragraph how to use it with an external AI chat.

**Settings `/settings`:** Profile (name, hue, timezone, theme). **AI** card: primary model dropdown grouped by provider from `/api/ai/models` (shows "as of 2h ago"; `Refresh`), backup model dropdown, reasoning effort (low/medium/high), tone, enable toggle, usage tiles (calls, tokens, est. cost, by feature/model). **Bank** card: connected institutions, watched accounts toggles, `Connect bank` (Plaid Link), `Sync now`, last error. **Wedding** card: names, city, target month, exact date, total budget, split ratio. **Notifications** card: enable on this device, digest day/hour, payment reminders toggle; iOS install note. **Data** card: `Export JSON`, `Export expenses CSV`.

---

## 7. AI engine (Phase B) — see `PROMPTS.md` for every contract

`lib/ai/client.ts` exposes one facade and nothing else calls a provider SDK directly:

```ts
type Effort = "low" | "medium" | "high";
type Completion<T> = { data: T; text?: string; provider: AiProvider; model: string; usage: {...}; fellBack: boolean };
ai.json<T>(opts: { feature: AiFeature; system: string; user: Content[]; schema: JsonSchema; effort?: Effort; maxTokens?: number }): Promise<Completion<T>>
ai.text(opts: { feature; system; user; effort?; maxTokens? }): Promise<Completion<string>>
ai.chat(opts: { feature: "ASSISTANT"; system; messages; tools: ToolDef[]; onText?; effort? }): AsyncIterable<ChatEvent>  // drives the tool loop
ai.models(): Promise<{ openai: ModelInfo[]; anthropic: ModelInfo[]; fetchedAt }>
```

- **Model selection:** primary = `AppSettings.aiPrimaryModel || env AI_MODEL` on `aiPrimaryProvider`; backup = `aiBackupModel` on `aiBackupProvider`. Try primary; on 404/400-unknown-model/429-after-one-retry/5xx/timeout/refusal, try backup once and set `fellBack`. Both fail → typed `AiUnavailable` → routes return 502 `{ error }`, UI shows the non-AI path (manual form still works). AI disabled or no keys → `{ disabled: true }` and the UI hides AI affordances.
- **Model list:** `openai.models.list()` filtered to ids starting `gpt-`, `o` followed by a digit, or containing `chatgpt`; `anthropic.models.list()` all (it only returns chat models; use `display_name`, `max_input_tokens`, `capabilities` when present). Cache in `ModelCache` 1h; Settings shows both groups plus a free-text override field ("model id not in the list") because new ids appear before caches refresh.
- **OpenAI adapter (`openai.ts`):** Responses API. `reasoning: { effort }` mapped 1:1 from `aiReasoning`; structured output via `text.format = { type: "json_schema", strict: true, schema }`; tools via `tools: [{ type: "function", strict: true, ... }]`; images as `input_image` (base64 data URL); stream with `client.responses.stream`. Never send `temperature` to reasoning models.
- **Anthropic adapter (`anthropic.ts`):** Messages API on `@anthropic-ai/sdk`. Default backup model `claude-opus-5`. **Never send `temperature`/`top_p`/`top_k`; do not send `thinking` (adaptive by default on Opus 5)**; effort via `output_config.effort` (`low|medium|high`); structured output via `client.messages.parse` with `output_config.format` (`zodOutputFormat`); tools with `strict: true`; images as `{ type: "image", source: { type: "base64", media_type, data } }`; streaming via `client.messages.stream(...).finalMessage()`; **always check `stop_reason === "refusal"`** and treat it as a fallback trigger; parse tool `input` with `JSON.parse`, never string-match. Prompt caching: put the static system prompt + tool list first with `cache_control: { type: "ephemeral" }`; volatile context (today's date, budget state) goes in the first user turn.
- **Usage:** one `AiUsage` row per provider call, written before the response is interpreted. Cost from a rate table in `lib/ai/usage.ts` (Anthropic: Opus 5 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5 per MTok; OpenAI rows filled in by Simi when he confirms the model id; unpriced → `costMicros = null`, shown as "n/a").
- **Assistant tools** (`lib/ai/tools.ts`, every one wraps a service, every write returns a one-line human summary that the UI renders as a card): `get_budget_summary`, `list_expenses(filters)`, `add_expense`, `update_expense`, `list_vendors`, `add_vendor`, `schedule_payments`, `list_payments_due(days)`, `mark_payment_paid`, `list_tasks`, `add_task`, `complete_task`, `list_guests(counts)`, `add_guest`, `add_note`, `get_forecast`, `get_settle_up`, `search(q)`, `get_brief`. Destructive actions (delete anything, change the total budget, change split ratio) are **not** tools; the assistant tells the user where to do it.

---

## 8. The Brief — the daily document for external AI sessions

**Purpose (Simi's requirement):** a single, thorough, always-current document that he can paste or link into a fresh ChatGPT or Claude session so that session knows everything about the wedding without touching the app.

**Generation:** `brief.generate()` builds markdown **deterministically** from the DB (no model needed for the facts), then adds one model-written "State of play" paragraph (`PROMPTS.md` §8). Regenerated nightly by cron, on demand from `/brief`, and after any change to `Wedding` or `AppSettings`. Stored as `BriefSnapshot`; last 30 kept.

**Structure (exact headings, in order):**
```
# {APP_NAME} Brief — {coupleNames} — generated {ISO datetime} ({eventTimezone})
> How to use this: paste it into any AI chat, then ask your question. Everything below is
> the current truth from the app. Money is USD. "Committed" = agreed but unpaid.

## 1. The wedding            names, city, target month / date, days to go, events with dates
## 2. Budget at a glance     table: total · paid · committed · forecast · remaining · status
## 3. By event               table per event: envelope · paid · committed · planned lines · forecast · status
## 4. Budget lines           event × category planned vs actual (only where lines exist)
## 5. Upcoming payments      next 90 days: due date · vendor · label · amount · status
## 6. Vendors                by event: name · category · status · quoted · paid so far · next due · contact · one-line notes
## 7. Recent expenses        last 30 days, newest first: date · description · event · amount · paid by
## 8. Who has fronted what   fronted by Annette / Simi / joint / family; who owes whom; settlements
## 9. Tasks                  overdue · due in 30 days · milestones; assignee; then open count by event
## 10. Guests                counts per event × rsvp; households pending
## 11. Decisions & notes     DECISION notes (all), pinned notes, then last 10 other notes
## 12. Open questions        QUESTION notes; plus generated: unallocated budget, envelopes without lines, vendors BOOKED with no schedule, events without dates
## 13. Recent activity       last 25 activity lines
## 14. State of play         one paragraph from the model (omitted if AI disabled)
## 15. Glossary              Ruracio, envelope, committed, fronted, settle-up, inbox
```

**Access:** `/brief` (signed-in page) and `GET /api/brief.md` (signed in, or `?token=` matching `AppSettings.briefToken`; `text/markdown; charset=utf-8`; `Cache-Control: no-store`). The token link exists so an external AI that can fetch URLs can be pointed at it; `Rotate token` invalidates the old link. **Drive sync (flag `FEATURE_DRIVE_BRIEF`):** Settings › Brief › `Sync to Google Drive` requests `https://www.googleapis.com/auth/drive.file` via Auth.js re-consent for the clicking user; creates/updates one file `"{APP_NAME} Brief.md"`; stores file id. Failure sets a visible error and never blocks generation.

---

## 9. Auth, Plaid, PWA, deploy

**Auth.js:** as Kindred §9, scopes `openid email profile`; `signIn` callback allows only `ALLOWED_EMAILS` (csv, case-insensitive); on first sign-in create `UserSettings` (displayName from the email map `annettemugambi@gmail.com → Annette · pink`, `stmutasa@gmail.com → Simi · blue`) and the matching `Funder(kind USER)`.

**Plaid:** `plaid` npm, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`sandbox` | `production`), `PLAID_PRODUCTS=transactions`, `PLAID_COUNTRY_CODES=US`. Link flow: `POST /api/plaid/link-token` → client `react-plaid-link` (only extra dep allowed) → `POST /api/plaid/exchange` → store item + accounts. Sync via cron and `POST /api/plaid/sync`. `POST /api/plaid/webhook` (optional; verify JWT per Plaid docs; triggers sync). Access tokens encrypted with `APP_ENCRYPTION_KEY` (32 bytes base64). Removing an item calls `/item/remove`.

**PWA:** `public/manifest.webmanifest` (name from `APP_NAME`, `display: standalone`, theme/background from tokens, icons 192/512 + maskable + apple-touch 180 generated by `scripts/generate-icons.ts`), hand-rolled `public/sw.js` (precache `/offline` + icons; navigations network-first with offline fallback; static stale-while-revalidate; **never intercept `/api/`**; `push` → `showNotification`; `notificationclick` → focus/open `data.url`). Push subscribe flow in Settings; README documents the iOS Add-to-Home-Screen requirement.

**Deploy:** Dockerfile as Kindred §11 (`prisma migrate deploy && node server.js`; `prisma` in dependencies; `UPLOAD_DIR=/data/uploads` created at boot), `railway.toml` with healthcheck `/api/health`, volume at `/data`.

**`.env.example`**
```
APP_NAME=Pamoja
DATABASE_URL="file:./prisma/dev.db"          # Railway: file:/data/app.db
UPLOAD_DIR=./uploads                         # Railway: /data/uploads
AUTH_SECRET=
AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAILS=annettemugambi@gmail.com,stmutasa@gmail.com
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
AI_MODEL=                                    # OpenAI id Simi confirms; primary
AI_BACKUP_MODEL=claude-opus-5
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
APP_ENCRYPTION_KEY=                          # openssl rand -base64 32
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:stmutasa@gmail.com
FEATURE_DRIVE_BRIEF=false
FEATURE_GMAIL_TRIAGE=false                   # phase 2
```

**Seed (`scripts/seed.ts`):** the five events with envelopes (Ruracio $8,000 · Wedding $32,000 · Honeymoon $7,000 · Party $3,000 · General $0 → unallocated $0), 14 categories, funders (Annette, Simi, Joint), both users pre-created by email so Google login matches, `Wedding` and `AppSettings` singletons with a generated `briefToken`. `--demo` adds ~20 plausible expenses (some in KES), 6 vendors with schedules, 12 tasks, 30 guests, 3 decisions, 8 inbox transactions, one canned brief. `npm run seed` / `npm run seed -- --demo` / `--clear`.

---

## 10. Build phases and lanes

- **Phase 0 — Fable (done):** this contract, `PROMPTS.md`, lookbook, `CONTEXT.md`.
- **Phase A — Sonnet 5** (boilerplate/plumbing): scaffold per §2, schema §3 + migration, `lib/types.ts`, auth §9, all CRUD routes with zod + session gate, UI primitives (Button, Card, Chip, Sheet, Input, Select, Textarea, Toggle, Tabs, Toast, Skeleton, EmptyState, PageHeader, SectionLabel, Money, HueDot), app shell with tab bar + rail, placeholder screens, PWA files (no push UI yet), `lib/money/*` with vitest tests, scripts (seed, icons, vapid), Dockerfile, `railway.toml`, `.env.example`, README skeleton. Placeholder tokens from §5. **Exit:** `npm run build` green, `npm test` green, `migrate dev` + `seed --demo` succeed.
- **Phase B — Opus 5** (logic): §4 services, §7 AI engine incl. model list + fallback + usage, all `PROMPTS.md` contracts, Plaid + CSV + inbox triage, FX, forecast + settle-up, Brief §8 incl. token route (+ Drive behind flag), scheduler, push, digest, export, `scripts/smoke.ts`. **Exit:** build + tests green, `npm run smoke` passes, `curl /api/brief.md?token=…` returns all 15 headings.
- **Phase C — Opus 5** (UI): §6 screens against real APIs, styled per the chosen direction lifted into §5. **Blocked on Annette's pick.** **Exit:** build green; every screen usable at 390px and 1280px.
- **Phase D — Fable:** browser QA on phone and desktop widths, receipt-scan and quick-add accuracy pass against 20 real-looking inputs, fix, prod build, README final, report.

Model ids for the lanes are set by the operator running each phase; nothing in the repo names them.
