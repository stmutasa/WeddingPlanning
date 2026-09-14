# Context handoff

**Read this first if you are an AI assistant picking up this project.** Last updated 2026-09-14.

## 1. What this is

A private, two-user, fully shared wedding planner and expense tracker for **Annette Mugambi** (`annettemugambi@gmail.com`, iPhone) and **Simukayi "Simi" Mutasa** (`stmutasa@gmail.com`, GitHub `stmutasa`, Android). They got engaged in September 2026. Wedding in **Nairobi, August 2027**, exact date to be set. Budget **$50,000 USD** after the ring. Four events plus General: Ruracio (Kenyan bride-price negotiation), Wedding, Honeymoon, joint bachelor/bachelorette party.

Lineage: Simi's earlier apps. **Kindred** (Next.js + Prisma/SQLite + Auth.js Google + Anthropic + PWA on Railway; "editorial warmth" design), **DoneX** (Next.js + SQLite; dark/light, person hues, shared "Ours" list, AI chat and voice), **Juli-a** (Expo native; "Bloom" design; PROMPTS.md-style AI contracts). This app is Kindred's architecture with DoneX's two-person and theme ideas.

| File | What it holds |
|---|---|
| `DESIGN.md` | The build contract: product, stack, schema, services, screens, AI engine, the Brief, phases |
| `PROMPTS.md` | Every AI call, with schemas |
| `docs/lookbook/index.html` | The lookbook Annette chose from (published as a Claude artifact); direction B is the reference render |
| `README.md` | Setup and API reference (kept current by each phase) |

## 2. Decisions (newest wins over DESIGN.md)

| Date | Decision | By |
|---|---|---|
| 2026-09-14 | PWA, not native. One codebase for iPhone + Android. | Simi (default accepted) |
| 2026-09-14 | Google sign-in, allowlist of the two emails. | Simi |
| 2026-09-14 | USD storage/display only; original currency kept on each expense. | Simi (USD) + Fable (audit fields) |
| 2026-09-14 | Funders: Annette, Simi, Joint, plus family contributors; 50/50 settle-up. | default accepted |
| 2026-09-14 | Scope v1: expenses, budget, vendors + payment schedules, tasks/timeline, guests + RSVP, assistant, Brief. Seating and registry out. | default accepted |
| 2026-09-14 | AI: OpenAI primary "ChatGPT Astra 6" on high reasoning, reaffirmed by Simi without an API id. The app resolves the id at runtime from the live model list by matching `astra` (`AI_MODEL_MATCH`), with `claude-opus-5` as backup and a live dropdown for both providers. | Simi |
| 2026-09-14 | No private items in v1; `visibility` column reserved. | Simi |
| 2026-09-14 | Plaid for bank import, with CSV import alongside. | Simi (Plaid) + Fable (CSV) |
| 2026-09-14 | **Name: Harusi. Direction: Kanga.** (Round one: five names rejected, narrowed to Stationery vs Kanga. Round two: Stationery rebuilt in colour, ten new names; she chose Kanga and Harusi.) Full Kanga spec in DESIGN.md §5. | Annette |
| 2026-09-14 | Simi's timezone: New York. | Simi |
| 2026-09-14 | Build started: Phase A → B → C → D in sequence. | Simi |
| 2026-09-14 | Phase A done. Deviations accepted: Prisma pinned to 6.x (7 removes `datasource.url` and needs driver adapters; revisit later); Next 16 renamed `middleware.ts` to `proxy.ts`; zod 4; icon script uses a generic bold sans, not Syne. | Fable |
| 2026-09-14 | The Brief: nightly regenerated markdown for external AI sessions, with token URL and optional Drive sync. | Simi |
| 2026-09-14 | Railway + SQLite on a volume. | default accepted |
| 2026-09-14 | Lanes: Fable plans and QAs, Opus 5 writes logic and screens, Sonnet 5 writes plumbing. | Simi |

**Name:** Harusi (`APP_NAME=Harusi`). Rejected along the way: Pamoja, Troth, Tandem, Plus One, Aisle, Rudo, Wendo, Wawili, Sherehe, Ndoa, Jacaranda, Marigold, Confetti, Twine.

## 3. Open items

1. **Exact OpenAI model id.** Resolved at runtime by matching `astra` against the live list. If the real id does not contain "astra", set `AI_MODEL` explicitly or pick it in Settings.
2. **Proverb wording** in DESIGN.md §5.5: Annette to confirm.
3. **Plaid production access.** Sandbox works immediately; production requires Plaid's application review and a paid plan after the free allowance. Kenyan payments (M-Pesa, wire) will not appear via Plaid; use receipt scan or CSV for those.
4. Google OAuth consent screen: publish to Production (unverified is fine for two test users) so refresh tokens do not expire weekly; only matters once Drive sync is on.

## 4. Known limits and gotchas

- iOS push works only from the installed Home Screen app (iOS 16.4+). Annette must Add to Home Screen.
- SQLite: no Prisma enums, no Json columns. One Railway replica.
- Plaid: US/CA/EU institutions only. Transactions arrive with 1–3 days lag; pending rows update in place.
- FX: `open.er-api.com` is free and unauthenticated; cache daily; allow manual override.
- Next.js drifts: read `node_modules/next/dist/docs/` before writing routes.
- Nothing in code, comments or docs may name the AI model used to write it (commit trailers excepted).

## 5. Where the lookbook lives

Published artifact: https://claude.ai/code/artifact/0b1370c9-a7b8-487e-bc03-a82807bf46db (private to Simi until shared from the page's share menu). The same HTML is committed at `docs/lookbook/index.html` and can be opened locally. Picks save to the artifact's database under `picks/annette` and `picks/simi`.
