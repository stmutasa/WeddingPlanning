# AI Contracts

Every model call the app makes is specified here. Implement from this file; do not invent new calls. All calls go through the `lib/ai/client.ts` facade (DESIGN.md §7): primary model (OpenAI, Simi's choice, reasoning effort from settings) with the Anthropic backup. Every call logs an `AiUsage` row. Every JSON call uses strict structured output (`additionalProperties: false`, all fields required; use `null` for absent values). Every call has a non-AI fallback in the UI; the app never blocks on a model.

**Shared system preamble** (prepend to every system prompt, stable text first for caching):
```
You are the assistant inside a private wedding planner used by exactly two people, Annette and Simi.
Wedding: Nairobi, Kenya, August 2027 (exact date: {weddingDate or "not set"}). Total budget: {budget} USD.
Events: Ruracio (Kenyan bride-price negotiation and family ceremony, before the wedding), Wedding, Honeymoon,
Joint bachelor/bachelorette party, General. All money is stored in USD; quotes and receipts may be in KES.
Today is {today} ({viewer timezone}). The person talking to you is {viewerName}.
Tone: {assistantTone}. Be specific. Never invent amounts, dates or vendors. If something is not in the
context you were given, say so. You are not a lawyer or accountant; flag when a question needs one.
```
Volatile values (dates, budget state) go **after** the cached prefix.

---

## 1. Quick add — natural language to expense draft (`QUICK_ADD`)

**Trigger:** capture sheet "Type" tab, debounced 400ms on input ≥ 3 words, and on submit. Effort `low`. `maxTokens` 600.

**Context:** events (slug, name), categories, funders (name, kind, which is the viewer), vendors (name, id) — top 50 by recency, today's date, viewer name, USD→KES rate today.

**Input:** the raw text, e.g. `paid florist 800 deposit ruracio`, `annette sent 15k kes to the ruracio venue yesterday`, `2,400 photographer balance from joint`.

**Output schema:**
```
{
  amount: number | null,            // in originalCurrency
  originalCurrency: string,         // "USD" default; "KES" if k/ksh/kes/shillings or a Kenyan vendor is implied
  description: string,              // short, title case, no amount
  eventSlug: string | null,
  categoryName: string | null,
  vendorId: string | null,          // only an existing vendor
  vendorNameNew: string | null,     // a vendor name that does not exist yet
  funderName: string | null,        // existing funder name; default the viewer when "I/me/my"
  date: string | null,              // YYYY-MM-DD; "yesterday"/"last friday" resolved from today
  isDeposit: boolean,
  confidence: number                // 0..1
}
```
**Rules:** "15k" means 15,000. Amounts with "kes/ksh/sh" are KES. Words like deposit/balance/instalment set `isDeposit` or go into description. Never guess an event when none is implied; leave null and the UI asks. The UI applies FX and shows chips; nothing is saved until the user taps Save.

## 2. Receipt / invoice scan — image to expense draft (`RECEIPT`)

**Trigger:** capture "Photo" tab or vendor › add attachment › "Read it". Image downscaled to 1600px JPEG client-side, EXIF orientation baked in. Effort `medium`. `maxTokens` 1500. PDF invoices accepted as PDF (Anthropic: `document` block; OpenAI: `input_file`).

**Output schema:**
```
{
  kind: "RECEIPT" | "INVOICE" | "QUOTE" | "CONTRACT" | "OTHER",
  merchant: string | null,
  total: number | null, currency: string | null,         // as printed
  date: string | null,                                    // YYYY-MM-DD as printed
  lineItems: [{ description: string, amount: number | null }],   // max 15
  paidAmount: number | null,                              // if the document shows a partial payment
  schedule: [{ label: string, dueDate: string | null, amount: number | null }],  // instalments if an invoice/quote states them
  suggestedEventSlug: string | null, suggestedCategoryName: string | null,
  vendorMatchId: string | null,                           // existing vendor by name similarity
  transcript: string,                                     // full plain-text transcription for search
  confidence: number
}
```
**Rules:** never create anything; the form is prefilled and the user confirms. M-Pesa confirmation screenshots are common: treat "Confirmed. KshX sent to Y on D" as a receipt with merchant Y, currency KES. If `kind` is QUOTE/INVOICE with a schedule, the UI offers "Create vendor + payment schedule" in addition to the expense.

## 3. Transaction triage — bank rows to wedding guesses (`TRIAGE`)

**Trigger:** after each sync/CSV import, in batches of 25 NEW rows. Effort `low`. `maxTokens` 4000.

**Context:** vendors (name, category, event), categories, events, the last 40 confirmed expenses (description, merchant, event, category) as examples, a list of merchants previously marked "not wedding" (last 200).

**Input:** `[{ id, date, name, merchant, amount, currency }]`.

**Output schema:** `{ results: [{ id, isWedding: boolean, eventSlug: string | null, categoryName: string | null, vendorId: string | null, confidence: number, reason: string }] }` — `reason` ≤ 12 words, shown in the inbox row.

**Rules:** groceries, fuel, salaries, subscriptions are not wedding unless a vendor matches. Airlines/hotels in the honeymoon window or Nairobi travel → Honeymoon or Travel & Stay at low confidence. Confidence < 0.5 renders as "Unsure" and defaults the Confirm button to Edit.

## 4. Assistant chat with tools (`ASSISTANT`)

**Trigger:** Ask screen. Effort from settings (default high). Streaming. Tool loop max 8 rounds per turn.

**System:** preamble + the current `budget.summary()` (compact), `payments.upcoming(30)`, open task count, guest counts, last 10 activity lines, and the tool descriptions. Threads are shared: tell it both people can read the thread.

**Tools:** the list in DESIGN.md §7. Writes must echo a one-line confirmation in the tool result which the UI renders as a card; the assistant then says at most one sentence about it. Always confirm amounts and event before writing when the user's message was ambiguous. Never delete; never change the total budget or split ratio (say where to do it in Settings). When asked "are we on track", call `get_forecast` and answer with numbers, not adjectives.

**Refusal/fallback:** on backup fallback mid-thread, keep the same tool results and continue; do not restart the turn.

## 5. Budget draft — envelopes and lines (`BUDGET_DRAFT`)

**Trigger:** Money › Budget › "Draft with AI". Effort `high`. `maxTokens` 4000. One-shot; output is shown as a diff against current envelopes and lines and applied only on confirm.

**Context:** total budget, current envelopes and lines, guest counts per event (if any), city, month, existing vendor quotes (paid + quoted amounts), any DECISION notes mentioning budget.

**Output schema:**
```
{ envelopes: [{ eventSlug, budgetCents, rationale }],
  lines: [{ eventSlug, categoryName, plannedCents, rationale }],
  assumptions: string[], warnings: string[] }
```
**Rules:** envelopes must sum exactly to the total. Respect any envelope the user has marked locked (passed in context). Ruracio includes gifts to the bride's family and the family ceremony; do not treat it as a small line. Nairobi price levels, not US ones; state the assumption. Keep at most 8 lines per event.

## 6. Timeline draft — tasks from the date (`TIMELINE`)

**Trigger:** Plan › "Generate timeline". Effort `medium`. `maxTokens` 4000. Idempotent: skip titles that already exist (case-insensitive).

**Context:** target month/date, events and their dates, existing tasks, vendors and statuses, today.

**Output schema:** `{ tasks: [{ title, eventSlug: string | null, dueDate: "YYYY-MM-DD", priority: "P1"|"P2"|"P3", milestone: boolean, notes: string | null, suggestedAssignee: "annette"|"simi"|null }] }` — 25 to 45 tasks.

**Rules:** a Kenyan wedding sequence: Ruracio dates and family meetings first, then venue and civil paperwork (Kenyan marriage notice and licence timelines; the app is not a legal source, note it), vendors by lead time (venue, photographer, caterer early; beauty, transport late), guest list and invitations, attire, honeymoon bookings, the joint party, final payments in the last month. Dates before today are not allowed. Dues cluster on Mondays where flexible.

## 7. Weekly digest (`DIGEST`)

**Trigger:** cron, `digestDay` at each user's `digestHour`. One call for both users; per-user push text differs only in the greeting. Effort `low`. `maxTokens` 500.

**Context:** budget summary, this week's expenses and total, payments due in 14 days, overdue tasks, inbox NEW count, forecast status per event, last week's digest text.

**Output schema:** `{ headline: string, body: string[] , push: string }` — headline ≤ 12 words; body 3–5 short lines with numbers; push ≤ 120 chars.

**Rules:** numbers over adjectives. If nothing changed, say so in one line. No exclamation marks.

## 8. Brief "State of play" paragraph (`BRIEF`)

**Trigger:** `brief.generate()`. Effort `medium`. `maxTokens` 700. Input: sections 2, 3, 5, 9 and 12 of the deterministic Brief (DESIGN.md §8).

**Output:** plain text, one paragraph of 120–180 words: where the money stands, the two or three most consequential upcoming items, and the single biggest open risk. No headings, no lists. If AI is disabled the section is omitted entirely.

## 9. Contract / quote summary (`CONTRACT`)

**Trigger:** vendor › attachment › "Summarise". Effort `medium`. `maxTokens` 1200. Input: the attachment (image/PDF) or its `extractedText`.

**Output schema:** `{ summary: string, totalAmount: number | null, currency: string | null, schedule: [{ label, dueDate, amount }], cancellationTerms: string | null, redFlags: string[], questionsToAsk: string[] }`.

**Rules:** quote the document, do not interpret law; every red flag cites the clause text. The UI offers "Apply schedule" to write `PaymentDue` rows after review.

## 10. Phase 2, flag-gated — Gmail vendor triage (`GMAIL_TRIAGE`)

Not built in v1. When `FEATURE_GMAIL_TRIAGE=true`: for threads from known vendor emails, extract invoices, due dates and status changes into inbox suggestions. Requires the restricted `gmail.readonly` scope; see Kindred's notes on consent-screen mode before enabling.

---

## Evaluation set (Phase D)

`docs/eval/quick-add.jsonl` and `docs/eval/receipts/` hold 20 quick-add inputs with expected fields and 10 receipt images (synthetic; M-Pesa screenshot, KES invoice with instalments, US card receipt, handwritten note). Phase D runs them through the facade on both providers and reports field accuracy; anything under 90% on amount/currency/date is fixed before release.
