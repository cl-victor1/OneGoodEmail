# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev      # dev server (Next.js + Turbopack) on http://localhost:3000
pnpm build    # production build (also the only TypeScript type-check — no separate tsc step)
pnpm start    # serve the production build
pnpm lint     # next lint
```

There is no test suite. `pnpm build` is the type-check. Use `npx tsc --noEmit` for a type-check that doesn't kill the dev server.

## Setup

`cp .env.example .env.local` then set `ANTHROPIC_API_KEY` (required). `HUNTER_API_KEY` is optional — without it recipient lookups still resolve the founder/domain but skip verification and fall back to a suggested `firstname@domain` address.

## Architecture

Stateless Next.js App Router app (deploy on Vercel). No database — every lookup is a single 1:1 request. Two independent feature flows, each a Node-runtime API route backed by a `lib/` orchestrator:

**Email drafting** — `components/EmailGenerator.tsx` → `app/api/generate/route.ts` → `lib/pipeline.ts`. A 4-step LLM chain: ① extract résumé + ② parse JD (run concurrently via `Promise.all`) → ③ draft email → ④ "de-AI" rewrite. Résumé files are parsed to text first in `lib/resume-parser.ts` (unpdf for PDF, mammoth for DOCX).

**Recipient lookup** — `components/RecipientFinder.tsx` → `app/api/find-recipient/route.ts` → `lib/recipient-finder.ts`. One Anthropic `web_search` call resolves domain + founder (+ any published email). If the search already surfaced a published email, it's trusted and returned — Hunter (`lib/hunter.ts`) is a **fallback only**, called to conserve its quota. Results are tiered `verified` / `likely` / `guess` and **never throw**; a miss degrades to a `firstname@domain` suggestion with guidance.

`lib/prompts.ts` holds every prompt-chain step builder (returns `{system, user, schema}`). `lib/llm.ts` is the shared Anthropic client. `types/index.ts` holds types shared across UI and server. Path alias `@/*` maps to repo root.

### Conventions that aren't obvious

- **Two models, set independently** (`lib/llm.ts`): email writing defaults to Sonnet 4.6 (`ANTHROPIC_WRITING_MODEL`); recipient finding defaults to Opus 4.8 (`ANTHROPIC_RECIPIENT_MODEL`) for stronger research reasoning.
- **Structured outputs + truncation resilience** (`runStructured` in `lib/llm.ts`): we call `messages.create` and parse JSON ourselves rather than `messages.parse`, because `.parse` throws on truncated JSON before we can inspect `stop_reason`. On a `max_tokens` stop, the budget doubles toward `OUTPUT_TOKEN_CAP` (8192) and retries. With `web_search`, narration + tool calls + final JSON share one token budget, so that step truncates more easily — that's why the retry exists. System prompts are cached (`cache_control: ephemeral`).
- **No dash punctuation in emails**: `stripDashes` in `lib/pipeline.ts` is a hard guarantee applied after the model returns — it converts em/en dashes etc. to comma breaks but **keeps ordinary hyphens** in compound words. Don't remove it even though step ④ also instructs the model to avoid dashes.
- **`usedHunter` flag** distinguishes a lookup that actually consumed quota (returned an address) from one that ran but found nothing — drives the "via Hunter" chip in the UI. Keep it accurate when editing `recipient-finder.ts`.
- API routes pin `export const runtime = "nodejs"` (unpdf/mammoth and web_search need it) with `maxDuration` set. `next.config.ts` lists unpdf/mammoth in `serverExternalPackages`.
