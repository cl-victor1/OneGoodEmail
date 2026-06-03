# OneGoodEmail

Upload a resume + paste a job description → get one good, human-sounding outreach email.

## Architecture

```
Next.js (App Router, deploy on Vercel)
├── Frontend (app/page.tsx + components/)
│     • Upload resume + paste JD (+ optional style sample)
│     • Draft display + inline edit + copy
│
├── API route (app/api/generate/route.ts, Node runtime)
│     • Resume parsing — lib/resume-parser.ts (unpdf for PDF, mammoth for DOCX)
│     • LLM prompt chain — lib/pipeline.ts
│         ① Extract structured resume info      (prompts.extractResumePrompt)
│         ② Parse JD key requirements           (prompts.parseJobPrompt)   ┐ run in parallel with ①
│         ③ Match + draft email                 (prompts.draftEmailPrompt)
│         ④ AI-flavor self-check & rewrite       (prompts.deAiPrompt)
│     • Returns the finished email + pipeline insight
│
└── API route (app/api/find-recipient/route.ts, Node runtime)
      • Company name OR url → founder's email — lib/recipient-finder.ts
          ①+② Resolve domain + founder via Anthropic web_search   (prompts.findDomainAndFounderPrompt)
              (a pasted URL skips the domain search — domain parsed in JS)
          ③  Verify / discover the address via Hunter             (lib/hunter.ts)
          ④  Tier by confidence: verified / likely / guess — never errors
      • Returns a RecipientResult (email, confidence, founder, sources, note)
```

### Key files

| Path | Responsibility |
|------|----------------|
| `app/page.tsx` | Landing page shell |
| `components/EmailGenerator.tsx` | Upload/paste form, calls the API |
| `components/RecipientFinder.tsx` | Company → founder email lookup UI + confidence badge |
| `components/ResultEditor.tsx` | Editable draft + copy (incl. `To:` line) + pipeline insight |
| `app/api/generate/route.ts` | Multipart entry point; parses file, runs pipeline |
| `app/api/find-recipient/route.ts` | Company/url → founder email lookup |
| `lib/resume-parser.ts` | PDF/DOCX/TXT → plain text |
| `lib/llm.ts` | Anthropic client + JSON-completion helpers (incl. web_search variants) |
| `lib/prompts.ts` | The prompt-chain step builders |
| `lib/pipeline.ts` | Orchestrates the resume → email chain |
| `lib/recipient-finder.ts` | Orchestrates the company → founder-email lookup |
| `lib/hunter.ts` | Hunter Email Finder wrapper |
| `types/index.ts` | Shared types across UI + server |

## Model

Uses **Claude Sonnet 4.6** (`claude-sonnet-4-6`) for every chain step. Override with `ANTHROPIC_MODEL`.

## Setup

```bash
pnpm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY (required) + HUNTER_API_KEY (optional)
pnpm dev
```

`HUNTER_API_KEY` is optional: without it the recipient lookup still resolves the
founder and domain, but skips verification and returns a suggested
`firstname@domain` address instead of a Hunter-verified one.

Open http://localhost:3000.
