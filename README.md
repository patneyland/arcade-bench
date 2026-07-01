# arcade-bench

**A community-voted arena that measures how well small, cost-efficient AI models can recreate classic arcade games.** Players vote, the leaderboard ranks the models, and the game list walks forward through video game history.

![Status](https://img.shields.io/badge/status-v0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

> Status: v0 built. A working play-and-vote arena — Next.js app, Clerk auth, Supabase Postgres, Bradley-Terry ratings, and real model generations for Pong, Snake, and Breakout. See [PRD.md](PRD.md) for the product thinking.

---

## The idea

Every frontier model can build Pong, so testing them is boring. The interesting question is the efficiency frontier: when a new small, cheap, fast model ships (think Gemma 4 E4B, Phi-4-mini, Qwen3 4B, Mistral Small), how well can *it* recreate a real game from a single prompt?

arcade-bench answers that with people, not a script. Each model is asked to build a classic game as a single self-contained HTML file. The public plays the results head to head and votes on which is better. Those votes become an Elo-style leaderboard of the most cost-effective models on simple build tasks.

It is, in short, a play-and-vote arena for AI rebuilding the history of games.

## How it works

```
game prompt  ->  generate per model (OpenRouter)  ->  playable HTML  ->  arena  ->  public vote  ->  ranking
```

1. Each model gets the same locked prompt for a game.
2. The output is a single self-contained HTML file, served in a sandboxed iframe so it is safe to play.
3. Visitors play two recreations of the same game side by side and vote on the better one.
4. Votes feed a rating (Elo, then Bradley-Terry) that ranks models overall, per game, and per cost tier.

## The prompt

One locked sentence per game, never tuned. Only the game name changes:

```
Create {game} as a single self-contained HTML file that runs in a browser.
```

This is a benchmark of models, not of prompting. The single-file rule is the permanent spine: it keeps every entry safe, instantly playable, and fair.

## Starting lineup

Five games, ordered to spread the small models out from easy to hard:

| # | Game | Year | What it tests |
|---|---|---|---|
| 1 | Pong | 1972 | The floor: real-time loop, paddle and ball collision, scoring |
| 2 | Snake | 1976 | Grid state, a growing body, self-collision |
| 3 | Breakout | 1976 | Mass collision against a brick field, angle reflection |
| 4 | Space Invaders | 1978 | Coordinated enemy formation, two-way projectiles, waves |
| 5 | Asteroids | 1979 | Vector physics, momentum, screen wrap, splitting asteroids |

The chronology keeps the "walking through history" narrative, and the rising difficulty is where each small model's ceiling shows up.

## Voting and accounts

Anyone can play, no account needed. Casting a vote requires a quick sign-in (GitHub or Google), only so the human grading can be tracked and trusted. It stays free. The login exists to keep the votes honest, nothing more.

## Running locally

```bash
npm install
npx supabase start   # local Supabase Postgres (Docker); prints the DB URL
cp .env.example .env # then add Clerk dev keys (pk_test_/sk_test_)
npm run setup        # prisma generate + db push + seed (with demo votes)
npm run dev          # http://localhost:3000
npm test             # web app tests; `npm test --prefix harness` for the harness
```

## Deploying (Vercel + Supabase + Clerk)

1. **Supabase**: create a hosted project. Grab both connection strings from
   Connect → ORMs (Prisma): the transaction-pooler URL (port 6543, add
   `?pgbouncer=true&connection_limit=1`) and the direct URL (port 5432).
2. **Clerk**: create a **production instance** for the deployed domain and enable
   GitHub (and Google) sign-in. Grab the `pk_live_` / `sk_live_` keys.
3. **Vercel**: import the repo, then set env vars: `DATABASE_URL` (pooler),
   `DIRECT_URL` (direct), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
   plus the four `NEXT_PUBLIC_CLERK_*_URL` vars from `.env.example`.
4. **Schema + data**: from your machine, point `.env` at production and run
   `npx prisma db push`, then seed without demo votes:
   `SEED_SYNTHETIC_VOTES=false npx tsx prisma/seed.ts`.
5. Deploy. The build runs `prisma generate && next build`; all data pages render
   dynamically, so no DB access happens at build time.

## More detail

See [PRD.md](PRD.md) for the full product breakdown: the user types, the seven components to build, the OpenRouter generation pipeline, and the voting flow.

## Author

Built and maintained by Patrick Neyland. Company arm: [Neyland Solutions](https://neylandsolutions.com).
