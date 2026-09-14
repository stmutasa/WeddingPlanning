# Wedding planner + expense tracker

Private, two-person, fully shared wedding planner and expense tracker for Annette and Simi. Nairobi, August 2027.

> **New here (human or AI)? Start with [CONTEXT.md](./CONTEXT.md)**, then [DESIGN.md](./DESIGN.md) (the build contract) and [PROMPTS.md](./PROMPTS.md) (every AI call).

| | |
|---|---|
| [CONTEXT.md](./CONTEXT.md) | Handoff: decisions, open items, gotchas |
| [DESIGN.md](./DESIGN.md) | Build contract: product, stack, schema, services, screens, AI engine, the Brief, phases |
| [PROMPTS.md](./PROMPTS.md) | AI contracts with schemas |
| [docs/lookbook/](./docs/lookbook/index.html) | Three visual directions and five names to choose from |

## Status

Phase 0 (planning) complete. Phase A (scaffold) not started. The app name and visual direction are pending Annette's pick from the lookbook.

## Stack (planned)

Next.js App Router + TypeScript · Tailwind v4 · Prisma on SQLite (Railway volume) · Auth.js Google (two-email allowlist) · OpenAI + Anthropic behind one facade with live model lists and a backup model · Plaid + CSV bank import · web-push · installable PWA · Railway.

## Running

Nothing to run yet. Phase A adds `npm install`, `npm run dev`, `npm run seed -- --demo`, `npm test`, `npm run smoke`.
