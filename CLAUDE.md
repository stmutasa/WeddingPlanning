# Agent rules for this repo

- Read `CONTEXT.md`, then `DESIGN.md`, then `PROMPTS.md` before writing code. `DESIGN.md` is the contract; `CONTEXT.md` §2 overrides it where newer.
- Money is integer cents in USD everywhere. Never floats, never arithmetic in the model.
- SQLite via Prisma: no enums, no Json columns. String unions live in `lib/types.ts`.
- All writes go through `lib/services/*` and append an `Activity` row.
- Provider SDKs are called only from `lib/ai/openai.ts` and `lib/ai/anthropic.ts`. Everything else uses the `lib/ai/client.ts` facade.
- Never send `temperature`/`top_p`/`top_k` or a `thinking` parameter to Anthropic models; always check `stop_reason === "refusal"`. Never send `temperature` to OpenAI reasoning models.
- Read `node_modules/next/dist/docs/` before writing routes; `params` and `searchParams` are Promises.
- Both themes, always. Tokens only in `app/globals.css` `@theme`; no inline hex in components.
- Nothing in the code, comments or docs names the AI model that wrote it. The required commit trailer is the one exception.
- The app name comes from `APP_NAME`; never hardcode it.
- Design is Kanga (DESIGN.md §5). Colour has four jobs only: primary, person, event, semantic. Event chips filled, semantic pills outlined, person chips round.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
