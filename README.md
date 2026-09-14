# Harusi

Private, two-person, fully shared wedding planner and expense tracker for Annette and Simi.
Nairobi, August 2027.

> **New here (human or AI)? Start with [CONTEXT.md](./CONTEXT.md)**, then [DESIGN.md](./DESIGN.md)
> (the build contract) and [PROMPTS.md](./PROMPTS.md) (every AI call).

| | |
|---|---|
| [CONTEXT.md](./CONTEXT.md) | Handoff: decisions, open items, gotchas |
| [DESIGN.md](./DESIGN.md) | Build contract: product, stack, schema, services, screens, AI engine, the Brief, phases |
| [PROMPTS.md](./PROMPTS.md) | AI contracts with schemas |
| [docs/lookbook/](./docs/lookbook/index.html) | The lookbook Annette chose from |

## Status

Phase 0 (planning), Phase A (scaffold, schema, auth, CRUD routes, design system, PWA shell)
and Phase B (service layer, AI engine, Plaid + CSV import, forecast and settle-up, the
Brief, scheduler jobs, push and digest, export, smoke test) are done. Phase C (the screens)
is next.

## Stack

Next.js (App Router, TypeScript strict, `output: "standalone"`) · Tailwind CSS v4 · Prisma
6 on SQLite · Auth.js v5 (Google, two-email allowlist) · OpenAI + Anthropic behind one
facade (Phase B) · Plaid + CSV bank import (Phase B) · `web-push` · installable PWA ·
Railway.

## Setup

```bash
npm install
cp .env.example .env         # fill in at least AUTH_SECRET, GOOGLE_CLIENT_ID/SECRET
npx prisma migrate dev       # creates prisma/dev.db
npm run seed -- --demo       # base data + ~20 expenses, vendors, tasks, guests
npm run icons                # generates public/icons/*.png
npm run dev
```

Sign in at `http://localhost:3000/login` with a Google account listed in `ALLOWED_EMAILS`.
For local development without setting up Google OAuth, set `DEV_LOGIN_EMAIL` (see below)
and use the "Dev sign-in" button on the login page — it only appears when
`NODE_ENV !== "production"`.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (`output: standalone`) |
| `npm run start` | Runs the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest: money math, the forecast thresholds, FX conversion, settle-up netting and the Brief's deterministic sections |
| `npm run seed` | Base seed: events, categories, funders, both users, singletons |
| `npm run seed -- --demo` | Base seed + demo expenses/vendors/tasks/guests/notes/inbox/brief |
| `npm run seed -- --clear` | Wipes all app data |
| `npm run icons` | Generates the four PWA icons from an inline SVG via `sharp` |
| `npm run vapid` | Prints a fresh VAPID key pair for web push |
| `npm run smoke` | Full service-layer smoke test. Run it against a throwaway database: `DATABASE_URL=file:./prisma/smoke.db npm run smoke` |
| `postinstall` | `prisma generate` (runs automatically after `npm install`) |

## Environment

See [`.env.example`](./.env.example) for the full list with comments. Notable ones:

- `APP_NAME` — the wordmark everywhere in the app; never hardcode "Harusi" in code.
- `DATABASE_URL` — SQLite file path (`file:./prisma/dev.db` locally, `file:/data/app.db`
  on Railway's volume).
- `UPLOAD_DIR` — where expense/vendor attachments are written (`./uploads` locally,
  `/data/uploads` on Railway).
- `ALLOWED_EMAILS` — comma-separated, case-insensitive; only these two Google accounts can
  sign in.
- `AI_MODEL` / `AI_MODEL_MATCH` / `AI_BACKUP_MODEL` — model selection for Phase B's AI
  facade; see DESIGN.md §7.
- `APP_ENCRYPTION_KEY` — 32 bytes base64 (`openssl rand -base64 32`), used to encrypt Plaid
  access tokens at rest (Phase B).
- `DEV_LOGIN_EMAIL` — dev-only convenience sign-in (see Setup above). Never active when
  `NODE_ENV=production`.

## Design system

Tokens live in `app/globals.css` under `@theme` (Tailwind v4). Light values are on bare
`:root`; dark values are set both under `[data-theme="dark"]` (an explicit per-user choice,
`UserSettings.theme`) and under a `prefers-color-scheme: dark` guard for the "system"
default. Components reference the generated utilities (`bg-bg`, `text-ink`, `border-line`,
`bg-ev-wedding/12`, …) — never inline hex. See DESIGN.md §5 for the full "Kanga" spec.

UI primitives are in `components/ui/` (barrel: `components/ui/index.ts`); shell chrome
(top bar, bottom tab bar, desktop side rail, the capture sheet) is in `components/shell/`
and `components/capture/`.

## API catalog

Every route below sits behind the session gate (`requireUser()`) except where noted, and
every mutation appends an `Activity` row via `lib/activity.ts`. Errors are always
`{ "error": string }` with a non-2xx status; success is plain JSON (no envelope).

Every handler calls `lib/services/*`; nothing touches Prisma directly any more. Service
errors carry their own status: `404` not found, `409` conflict (a paid instalment cannot be
edited), `502` when FX or both AI providers are unreachable, `503` when Plaid or web push
is not configured on the server.

AI routes answer `{ "disabled": true, "reason": "…" }` with a 200 when the assistant is
switched off in Settings or no provider key is set, and `502 { "error": … }` when both the
primary and the backup model failed. The manual path always works without them.

| Route | Method | Body | Response |
|---|---|---|---|
| `/api/health` | GET | — (no auth) | `{ status, time }` |
| `/api/wedding` | GET | — | `Wedding` |
| `/api/wedding` | PATCH | partial `Wedding` fields | `Wedding` |
| `/api/settings/app` | GET | — | `AppSettings` |
| `/api/settings/app` | PATCH | partial `AppSettings` fields | `AppSettings` |
| `/api/settings/me` | GET | — | `UserSettings` |
| `/api/settings/me` | PATCH | partial `UserSettings` fields | `UserSettings` |
| `/api/events` | GET | — | `Event[]` |
| `/api/events` | POST | `{ slug, name, date?, budgetCents?, color?, sortOrder?, notes? }` | `Event` |
| `/api/events/[id]` | GET | — | `Event` |
| `/api/events/[id]` | PATCH | partial | `Event` |
| `/api/events/[id]` | DELETE | — (fails if `locked`) | `{ ok: true }` |
| `/api/categories` | GET | — | `Category[]` |
| `/api/categories` | POST | `{ name, icon?, sortOrder? }` | `Category` |
| `/api/categories/[id]` | PATCH | partial | `Category` |
| `/api/categories/[id]` | DELETE | — | `{ ok: true }` |
| `/api/budget-lines?eventId=` | GET | — | `BudgetLine[]` (with `category`, `event`) |
| `/api/budget-lines` | POST | `{ eventId, categoryId, plannedCents, note?, source? }` | `BudgetLine` |
| `/api/budget-lines/[id]` | PATCH | `{ plannedCents?, note? }` | `BudgetLine` |
| `/api/budget-lines/[id]` | DELETE | — | `{ ok: true }` |
| `/api/funders?includeArchived=` | GET | — | `Funder[]` |
| `/api/funders` | POST | `{ name, kind }` (not `USER`) | `Funder` |
| `/api/funders/[id]` | PATCH | `{ name?, archived? }` | `Funder` |
| `/api/vendors?status=&eventId=&withMoney=1` | GET | — | `Vendor[]` (with relations; `withMoney=1` adds `paidCents` and `nextDue`) |
| `/api/vendors` | POST | vendor fields (see `lib/services/vendors.ts`) | `Vendor` |
| `/api/vendors/[id]` | GET | — | `Vendor` (with payments, attachments) |
| `/api/vendors/[id]` | PATCH | partial | `Vendor` |
| `/api/vendors/[id]` | DELETE | — | `{ ok: true }` |
| `/api/vendors/[id]/payments` | GET | — | `PaymentDue[]` |
| `/api/vendors/[id]/payments` | POST | `{ label, dueDate, amountCents }` | `PaymentDue` (appends one) |
| `/api/vendors/[id]/payments` | PUT | `{ items: [{ label, dueDate, amountCents }] }` | `PaymentDue[]` — replaces the whole OPEN set |
| `/api/payments?status=&days=` | GET | — | `PaymentDue[]` (with `vendor`) |
| `/api/payments/[id]` | PATCH | `{ label?, dueDate?, amountCents?, status?: "OPEN"\|"CANCELLED" }` | `PaymentDue` |
| `/api/payments/[id]` | DELETE | — (fails if `PAID`) | `{ ok: true }` |
| `/api/payments/[id]` | POST | `{}` or partial expense fields | `{ payment, expense }` — marks PAID and records the expense in one transaction |
| `/api/budget/summary` | GET | — | `{ totalCents, envelopes[], unallocatedCents, paidCents, committedCents, plannedCents, forecastCents, remainingCents, status }` |
| `/api/budget/envelopes` | PUT | `{ envelopes: [{ eventId, budgetCents }] }` | `{ events, summary }` |
| `/api/budget/lines` | PUT | `{ eventId, lines: [{ categoryId, plannedCents, note?, source? }] }` | `{ ok, summary }` — replaces the event's lines |
| `/api/forecast` | GET | — | `{ status, forecastCents, totalCents, envelopes[], burn: { history[], monthsToGo, averageMonthlyCents } }` |
| `/api/settle` | GET | — | `{ annette, simi, jointCents, familyCents, ratio, owedFromUserId, owedToUserId, owedCents, settlements[] }` |
| `/api/expenses?eventId=&categoryId=&vendorId=&funderId=&source=&q=&from=&to=` | GET | — | `{ expenses[], totalCents, count }` |
| `/api/expenses` | POST | `{ description, amountCents \| (originalAmount + fxRate), originalCurrency?, date, eventId, categoryId?, vendorId?, funderId, source?, notes?, paymentDueId? }` | `Expense` |
| `/api/expenses/[id]` | GET | — | `Expense` (with relations, attachments) |
| `/api/expenses/[id]` | PATCH | partial | `Expense` |
| `/api/expenses/[id]` | DELETE | — | `{ ok: true }` |
| `/api/expenses/[id]/attachments` | POST | multipart: `file`, `kind?` | `Attachment` |
| `/api/attachments/[id]` | GET | — | file bytes (`Content-Type` from the stored mime) |
| `/api/contributions?funderId=` | GET | — | `Contribution[]` |
| `/api/contributions` | POST | `{ funderId, amountCents, date, note? }` | `Contribution` |
| `/api/contributions/[id]` | DELETE | — | `{ ok: true }` |
| `/api/settlements` | GET | — | `Settlement[]` |
| `/api/settlements` | POST | `{ amountCents, note?, fromUserId?, toUserId? }` (direction defaults to whoever owes) | `Settlement` |
| `/api/transactions?status=` | GET | — (default `NEW`, or `ALL`) | `Transaction[]` |
| `/api/transactions/[id]/confirm` | POST | `{ description, eventId, categoryId?, vendorId?, funderId, notes? }` | `Expense` (creates it, links the transaction) |
| `/api/transactions/[id]/ignore` | POST | — | `Transaction` |
| `/api/transactions/import-csv` | POST | multipart: `file`, plus `dateColumn`/`nameColumn`/`amountColumn` (and optional `merchantColumn`, `currencyColumn`, `amountSign`), or a JSON `mapping` field | `{ imported, duplicates, skipped, newIds }`. With no mapping: `400 { error, headers[], needs[] }` so the UI can ask which column is which |
| `/api/plaid` | GET | — | `{ configured, environment, items[] }` (access tokens never leave the server) |
| `/api/plaid/link-token` | POST | — | `{ linkToken, expiration, environment }` · `503` when Plaid is unconfigured |
| `/api/plaid/exchange` | POST | `{ publicToken }` | `{ itemId, institution, accounts }` |
| `/api/plaid/sync` | POST | — | `{ newCount, updatedCount, items, errors[] }` — syncs every item, then AI-triages the new rows |
| `/api/plaid/items/[id]` | DELETE | — | `{ ok: true }` — calls Plaid `/item/remove` first |
| `/api/plaid/accounts/[id]` | PATCH | `{ watched }` | `PlaidAccount` |
| `/api/plaid/webhook` | POST | Plaid's payload (no session; verified by the `plaid-verification` JWT) | `{ ok, … }` |
| `/api/tasks?status=&eventId=` | GET | — | `Task[]` |
| `/api/tasks` | POST | `{ title, notes?, dueDate?, eventId?, assigneeId?, priority?, milestone? }` | `Task` |
| `/api/tasks/[id]` | GET | — | `Task` |
| `/api/tasks/[id]` | PATCH | partial + `{ status? }` | `Task` |
| `/api/tasks/[id]` | DELETE | — | `{ ok: true }` |
| `/api/tasks/reorder` | POST | `{ ids: string[] }` | `{ ok: true }` |
| `/api/notes?kind=` | GET | — | `Note[]` |
| `/api/notes` | POST | `{ kind?, title?, body, pinned? }` | `Note` |
| `/api/notes/[id]` | PATCH | partial | `Note` |
| `/api/notes/[id]` | DELETE | — | `{ ok: true }` |
| `/api/guests?q=` | GET | — | `Guest[]` (with `events`) |
| `/api/guests` | POST | guest fields (see `lib/services/guests.ts`) | `Guest` |
| `/api/guests/[id]` | GET | — | `Guest` |
| `/api/guests/[id]` | PATCH | partial | `Guest` |
| `/api/guests/[id]` | DELETE | — | `{ ok: true }` |
| `/api/guests/[id]/events` | PATCH | `{ eventId, rsvp }` | `GuestEvent` (upserted) |
| `/api/guests/counts` | GET | — | `{ counts: { [slug]: { total, heads, YES, NO, … } }, pendingHouseholds[] }` |
| `/api/guests/import-csv` | POST | multipart: `file` (columns matched by common aliases) | `{ imported, skipped }` |
| `/api/chat/threads` | GET | — | `ChatThread[]` |
| `/api/chat/threads` | POST | `{ title? }` | `ChatThread` |
| `/api/chat/threads/[id]/messages` | GET | — | `ChatMessage[]` |
| `/api/activity?n=` | GET | — | `Activity[]` (default 25, max 200) |
| `/api/export` | GET | — | JSON dump of the whole DB (secrets excluded) |
| `/api/export/expenses.csv` | GET | — | `text/csv` — every expense, cents and dollars both |
| `/api/push/vapid` | GET | — | `{ publicKey, configured }` |
| `/api/push/subscribe` | POST | `{ endpoint, keys: { p256dh, auth } }` | `{ ok, id }` · `503` without VAPID keys |
| `/api/push/unsubscribe` | DELETE | `{ endpoint }` | `{ ok: true }` |
| `/api/ai/models?refresh=1` | GET | — | `{ openai[], anthropic[], fetchedAt, errors, primary, backup, resolvedFrom, problem, enabled }` — cached an hour |
| `/api/ai/usage?window=24h\|7d\|30d\|90d\|all` | GET | — | `{ window, since, totals, byFeature[], byModel[], fellBackCalls, unpricedCalls }` (`costMicros` null = unpriced) |
| `/api/ai/quick-add` | POST | `{ text }` | `{ draft, resolved, provider, model, fellBack }` (PROMPTS.md §1) |
| `/api/ai/receipt` | POST | multipart: `file` (image or PDF) **or** `attachmentId` | `{ draft, resolved, provider, model, fellBack }` (§2) |
| `/api/ai/triage` | POST | `{ ids?: string[], limit? }` | `{ triaged, results[] }` (§3, batched 25 per call) |
| `/api/ai/chat` | POST | `{ message, threadId? }` | SSE `text/event-stream` — see below (§4) |
| `/api/ai/budget-draft` | POST | — | `{ envelopes[], lines[], assumptions[], warnings[], proposedTotalCents, currentTotalCents, … }` (§5) |
| `/api/ai/timeline` | POST | `{ apply?: boolean }` | `{ drafted[], created[], createdCount, skipped, applied, … }` (§6, idempotent) |
| `/api/ai/contract` | POST | `{ attachmentId, save? }` | `{ summary, totalAmount, currency, schedule[], cancellationTerms, redFlags[], questionsToAsk[], … }` (§9) |
| `/api/brief` | GET | — | latest `BriefSnapshot` + `{ token, drive }`, or 404 |
| `/api/brief/regenerate` | POST | — | `BriefSnapshot` (201) |
| `/api/brief/rotate-token` | POST | — | `{ token }` — invalidates the old `.md` link |
| `/api/brief/drive` | GET/POST | `{ enabled }` | Drive sync state · `503` unless `FEATURE_DRIVE_BRIEF=true` |
| `/api/brief.md?token=` | GET | — (signed in, or `?token=AppSettings.briefToken`) | `text/markdown` |
| `/api/dev-login` | POST | — (dev only) | `{ ok: true }` — signs in as `DEV_LOGIN_EMAIL` |
| `/api/auth/*` | GET/POST | Auth.js internal routes | — |

### `/api/ai/chat` streaming format

The response is Server-Sent Events (`text/event-stream`, `no-store`), one JSON object per
event. Both turns are persisted as they happen, so a dropped connection never loses the
conversation.

```
event: start      data: { "threadId": "…" }
event: text       data: { "delta": "…" }                       (many)
event: tool_call  data: { "id", "name", "input", "result" }     (one per call, after it ran)
event: done       data: { "threadId", "messageId", "text", "toolCalls":[…],
                          "provider", "model", "fellBack" }
event: error      data: { "error": "…" }
```

`tool_call.result` is the one-line human summary the tool returned ("Added expense:
Photographer balance $2,400 · Wedding"), which is what the UI renders as a card. When the
assistant is switched off or has no key the route answers a plain JSON
`{ "disabled": true, "reason": … }` with no stream at all.

## AI engine

`lib/ai/client.ts` is the only facade; `lib/ai/openai.ts` (Responses API) and
`lib/ai/anthropic.ts` (Messages API) are the only files that touch a provider SDK.

- **Model choice.** Primary = `AppSettings.aiPrimaryModel`, which is resolved at boot in
  this order: a model picked by hand in Settings, then `AI_MODEL`, then the newest OpenAI
  model whose id contains `AI_MODEL_MATCH` (default `astra`). `/api/ai/models` returns the
  resolved id, where it came from, and a `problem` string to show as a banner when nothing
  matched.
- **Fallback.** Primary → backup once, on 404, a 400 naming an unknown model, 429 after one
  retry, any 5xx, a timeout, a rejected key, or a refusal (`stop_reason === "refusal"`).
  Both failing gives a typed `AiUnavailable` and a 502; the manual path never depends on a
  model.
- **Metering.** One `AiUsage` row per provider call, written before the response is read.
  Cost comes from the rate table in `lib/ai/usage.ts`; a model with no rate on file records
  `costMicros: null`, which Settings shows as "n/a".
- **Prompts.** Every contract in `PROMPTS.md` lives in `lib/ai/prompts.ts` as a function of
  typed context with a zod schema for its output. Nothing else calls a model.

## Scheduled jobs

`lib/jobs/scheduler.ts` starts from `instrumentation.ts`, guarded to the Node runtime and to
one registration. Each job is wrapped so one failure never stops the loop.

| When | Job |
|---|---|
| every 6h | `transactions.sync()` for every connected Plaid item, then AI triage |
| 03:00 in `Wedding.eventTimezone` | `brief.generate("CRON")`, refresh the model cache if over a day old, refresh USD→KES |
| 09:00 in each user's timezone | payment reminders: one push per user for OPEN dues inside 7 days with no `reminderSentAt` |
| `digestDay` at each user's `digestHour` | `digest.weekly()` — one model call, a `DIGEST` note, one push each |

The three timezone-sensitive jobs hang off one hourly tick that asks, per zone, whether it
is that hour there — node-cron can only pin a schedule to a single timezone, and reminders
and the digest follow each *user's* zone.

## Deploy (Railway)

1. Create a Railway service from this repo; it picks up the `Dockerfile` automatically
   (`railway.toml` also points at it explicitly).
2. Attach a volume at `/data` (SQLite file + uploads live there).
3. Set the environment variables from `.env.example` in the Railway dashboard —
   `DATABASE_URL=file:/data/app.db`, `UPLOAD_DIR=/data/uploads`, `AUTH_URL` to the deployed
   URL, real `AUTH_SECRET`/`APP_ENCRYPTION_KEY` values, Google OAuth credentials, and
   provider API keys once Phase B needs them.
4. Deploy. The container runs `prisma migrate deploy && node server.js`; Railway's
   healthcheck hits `/api/health`.
5. Run `npm run seed` (or `-- --demo`) once against the deployed `DATABASE_URL` if you want
   seed data in production — otherwise the app starts empty apart from the Prisma migration.

## iOS install note

Push notifications only work from the **installed** PWA on iOS (16.4+), not from Safari in
a regular tab. Annette should open the deployed URL in Safari, tap Share → **Add to Home
Screen**, and launch the app from that icon before enabling notifications in Settings.
Android/Chrome supports push from a regular browser tab too, but installing still gives the
full-screen app experience.
