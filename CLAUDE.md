# arcade-bench — architecture & build notes

A community-voted arena ranking cost-efficient AI models on how well they recreate
classic games. See `PLAN.md`, `PRD.md`, `design.md` for product + visual spec.

## CURRENT WORK: UX overhaul (`docs/ux-overhaul.md`)

`docs/ux-overhaul.md` is the working document — keep its checkboxes current.
**Next up: item 7, the playability-screening product pivot** (owner decision
2026-07-02): signed-out visitors play only certified-playable builds (the Arcade,
`/arcade`); signed-in users are testers who screen builds one at a time in the Test
Lab (`/test`, playable / not playable); certified = ≥85% playable votes
(`CERTIFIED_PLAYABLE_PCT`, no minimum count, zero votes ≠ certified). Head-to-head
A/B voting is PARKED (keep the code; `/arena` stays routable but out of the nav)
until additional judging criteria arrive. Contracts for the pivot are already in
`lib/types.ts`, `lib/constants.ts`, `prisma/schema.prisma` (`PlayabilityVote`), and
stubbed in `lib/data.ts`. Do NOT add in-game control hints or touch the locked
generation prompt (explicitly deferred by the owner, repeatedly).

## Stack
- **Next.js 15 (App Router) + React 19 + TypeScript**, Tailwind v3.
- **Prisma + Postgres (Supabase)**. Local dev runs a local Supabase stack via Docker
  (`npx supabase start`); production points `DATABASE_URL` at a hosted Supabase project.
  Same schema either way. Supabase Studio (local): http://127.0.0.1:54323.
- **Vitest** (+ jsdom, Testing Library) for the web app; the harness owns its own test run.
- **Auth**: Clerk everywhere (dev instance with pk_test keys locally, production instance
  in prod). Abstracted in `lib/auth.ts`; votes are gated server-side in the vote API.

## Shared contracts (do not break)
- `lib/types.ts` — view-model types, the backend↔frontend boundary.
- `lib/data.ts` — data-access functions the frontend reads through (backend implements).
- `lib/auth.ts` — session/grader abstraction.
- `lib/constants.ts` — locked prompt, Build A=blue / B=red, vendor colors, tiers.
- `prisma/schema.prisma` — the data model.

## Ownership (parallel build lanes)
- **Harness** (`harness/`) — standalone Node/TS package, its own `package.json`.
  OpenRouter call → extract HTML → validate self-contained → headless smoke test → store.
- **Backend** (`prisma/`, `lib/` except the stubs' types, `app/api/`, `data/`) —
  data-access impl, Elo/Bradley-Terry rating engine (`lib/rating/`), vote API, auth dev
  provider, model roster + `prisma/seed.ts`.
- **Frontend** (`app/` pages, `components/`, `tailwind.config.ts`, `app/globals.css`,
  `app/layout.tsx`) — design system + all pages + the sandboxed player.
- **Artifacts** (`public/artifacts/`) — sample playable game HTML builds for the seed.

## Artifact convention
Self-contained HTML lives at `public/artifacts/<game-slug>/<model-slug>.html`.
The seed references these paths in `Generation.artifactPath` (e.g.
`/artifacts/pong/gemini-flash-lite.html`). The sandboxed player loads that path into a
strict `sandbox` iframe (no same-origin, no network) — the one hard security rule.

## Getting started
```
npm install
npx supabase start   # local Supabase Postgres (Docker); prints the DB URL
npm run setup        # prisma generate + db push + seed
npm run dev          # http://localhost:3000
npm test             # web app tests (vote test uses an isolated PG schema; skips if no DB)
```
