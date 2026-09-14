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

Phase 0 (planning) and Phase A (scaffold, schema, auth, CRUD routes, design system, PWA
shell) are done. Phase B (services, AI engine, Plaid, forecast, Brief generation, scheduler
jobs) is next.

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
| `npm test` | Vitest (`lib/money/*` unit tests) |
| `npm run seed` | Base seed: events, categories, funders, both users, singletons |
| `npm run seed -- --demo` | Base seed + demo expenses/vendors/tasks/guests/notes/inbox/brief |
| `npm run seed -- --clear` | Wipes all app data |
| `npm run icons` | Generates the four PWA icons from an inline SVG via `sharp` |
| `npm run vapid` | Prints a fresh VAPID key pair for web push |
| `npm run smoke` | Phase A stub (prints `smoke: phase B`); the real smoke test ships in Phase B |
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

Phase A implements these as direct Prisma CRUD with zod validation. The typed service
functions in `lib/services/*` (create/update/list/etc., matching the same shapes) currently
throw `NotImplemented` — Phase B moves the logic there without changing these routes'
request/response shapes.

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
| `/api/vendors?status=&eventId=` | GET | — | `Vendor[]` (with relations) |
| `/api/vendors` | POST | vendor fields (see `lib/services/vendors.ts`) | `Vendor` |
| `/api/vendors/[id]` | GET | — | `Vendor` (with payments, attachments) |
| `/api/vendors/[id]` | PATCH | partial | `Vendor` |
| `/api/vendors/[id]` | DELETE | — | `{ ok: true }` |
| `/api/vendors/[id]/payments` | GET | — | `PaymentDue[]` |
| `/api/vendors/[id]/payments` | POST | `{ label, dueDate, amountCents }` | `PaymentDue` |
| `/api/payments?status=&days=` | GET | — | `PaymentDue[]` (with `vendor`) |
| `/api/payments/[id]` | PATCH | `{ label?, dueDate?, amountCents?, status?: "OPEN"\|"CANCELLED" }` | `PaymentDue` |
| `/api/payments/[id]` | DELETE | — (fails if `PAID`) | `{ ok: true }` |
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
| `/api/settlements` | POST | `{ fromUserId, toUserId, amountCents, note? }` | `Settlement` |
| `/api/transactions?status=` | GET | — (default `NEW`, or `ALL`) | `Transaction[]` |
| `/api/transactions/[id]/confirm` | POST | `{ description, eventId, categoryId?, vendorId?, funderId, notes? }` | `Expense` (creates it, links the transaction) |
| `/api/transactions/[id]/ignore` | POST | — | `Transaction` |
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
| `/api/chat/threads` | GET | — | `ChatThread[]` |
| `/api/chat/threads` | POST | `{ title? }` | `ChatThread` |
| `/api/chat/threads/[id]/messages` | GET | — | `ChatMessage[]` |
| `/api/activity?n=` | GET | — | `Activity[]` (default 25, max 200) |
| `/api/export` | GET | — | JSON dump of the whole DB (secrets excluded) |
| `/api/ai/models` | GET | — | `{ openai: [], anthropic: [], fetchedAt: null }` (Phase A stub) |
| `/api/brief` | GET | — | latest `BriefSnapshot`, or 404 |
| `/api/brief.md?token=` | GET | — (signed in, or `?token=AppSettings.briefToken`) | `text/markdown` |
| `/api/dev-login` | POST | — (dev only) | `{ ok: true }` — signs in as `DEV_LOGIN_EMAIL` |
| `/api/auth/*` | GET/POST | Auth.js internal routes | — |

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
