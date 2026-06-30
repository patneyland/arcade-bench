# arcade-bench, Plan

A community-voted arena that measures how well small, cost-efficient AI models can
recreate classic video games, starting at the dawn of gaming history and moving
forward in time.

> Status: planning. No code yet. This document is the design spec to build from.

---

## The thesis

Every frontier model can build Pong. That makes frontier models a boring test.

The question worth answering is about the efficiency frontier: when a new small,
cheap, fast model ships (Gemma 4 E4B, Phi-4-mini, Qwen3 4B, Mistral Small, and
whatever lands next), how well can *that* model recreate a real game from a single
prompt? arcade-bench is a fun, visual, public way to rank the most cost-effective
models on simpler build tasks, the kind of work people actually hand to a cheap
model in production.

Two things make it different from a normal coding benchmark:

1. **It is judged by people, not a script.** Humans play the recreations and vote.
   That captures "is this game actually fun and faithful," which automated checks miss.
2. **It walks through history.** The game list starts with the earliest games ever
   made and moves forward. Early games are simple, which keeps the first rounds easy
   to build, easy to judge, and honest about what a small model can do.

## Positioning (why it fits Patrick)

This sits next to cpa-bench as the second entry in a "bench" family: one serious
(AI doing accounting work), one fun (AI rebuilding game history). Both measure model
capability in the open. Together they say "I build AI evaluation systems, and I make
them approachable." On-brand for the AI and operations positioning, and far more
demoable than a notebook.

---

## How it works (the pipeline)

```
historical game spec  ->  generation harness  ->  playable artifact  ->  arena  ->  public vote  ->  ranking
   (one per game)         (one prompt per           (self-contained       (two builds      (pairwise,        (Elo /
                           model, fixed budget)       HTML file)            side by side)    authenticated)    Bradley-Terry)
```

1. **Game spec.** Each historical game gets one standardized brief: a short
   description of the original, the core rules, the controls, and the hard
   constraints (see Fairness). The same brief goes to every model.
2. **Generation.** A harness sends the brief to each model through a single provider
   (OpenRouter, one credential reaches every model and reports per-call cost, the same
   pattern used in cpa-bench and ai-trivia). One shot, fixed token budget, no human
   iteration. The point is raw capability per dollar, not how well a person can coax it.
3. **Artifact.** The required output is a single self-contained HTML file (inline JS
   and CSS, no build step, no external assets). That makes every entry instantly
   playable in a sandboxed iframe and keeps the playing field level.
4. **Arena.** The site shows a visitor two recreations of the same game, side by side,
   with the original game's description and a reference image or clip so they can judge
   fidelity. Model identities are hidden during the vote.
5. **Vote.** The visitor plays both and picks a winner (or "tie" / "both bad"). Votes
   are tied to an authenticated account to keep them honest.
6. **Ranking.** Pairwise votes feed an Elo or Bradley-Terry model, the same method
   LMArena (Chatbot Arena) uses for LLMs. The leaderboard ranks models overall, per
   game, and per cost tier.

## Scoring and voting

- **Pairwise, not star ratings.** Two builds, pick the better one. Pairwise comparison
  is what makes Elo work and is far more reliable than asking people for a 1 to 5 score.
- **What voters judge.** A short, fixed prompt: which recreation is more faithful to the
  original and more fun to play. Keep it to one question in v0 so the signal stays clean.
  Later, optional sub-votes (fidelity, playability, polish).
- **Ranking math.** Bradley-Terry (what LMArena moved to) or classic Elo. Both turn
  head-to-head wins into a single rating with confidence intervals. Show the interval so
  a model with five votes is not presented as equal to one with five hundred.
- **Cost and size axis.** Store each model's parameter size and the measured cost per
  generation. Headline views: "best overall," "best under 10B params," and "best rating
  per cent spent." That cost-per-quality framing is the whole point of the project.

## Authentication and abuse

Public voting only means something if one person cannot vote a thousand times. Patrick's
read is right: people probably need to log in. Recommendation:

- **Anonymous play, authenticated vote.** Anyone can play the recreations. Casting a vote
  requires a login. This keeps friction low while protecting the data.
- **Managed auth via Clerk (free tier).** Sign in with GitHub or Google through Clerk's
  hosted components. No passwords to manage, low friction, real identity behind each vote.
  Clerk's free tier covers early traffic comfortably (generous monthly active users), and
  its prebuilt `<SignIn>` / `<UserButton>` components plus middleware make the
  anonymous-play / authenticated-vote split trivial to enforce. The Clerk user id is the
  stable key stored on every vote.
- **Rate limits and dedup.** One vote per user per pairing per round, basic rate limiting,
  and store the user id with every vote so bad actors can be filtered after the fact.
- **It stays free.** No payment, no paywall. The login exists only to make the human
  annotation trustworthy.

---

## The historical roadmap (the game list)

The list is the backbone. Start simple, move forward in time, add one game per round.
Dates and creators below are the anchor facts for each round's spec.

**Phase 1, the origins (trivial to build, perfect for v0)**
- **OXO, 1952.** Noughts and crosses against the computer, written for the EDSAC at
  Cambridge by A. S. Douglas. Arguably the first graphical video game. A clean, tiny v0.
- **Tennis for Two, 1958.** William Higinbotham, an analog game on an oscilloscope.
  Often called the first game built purely for fun. Side-view tennis, gravity, a net.
- **Spacewar!, 1962.** Steve Russell and others on the PDP-1 at MIT. Two ships, a star
  with gravity, torpedoes. The first game to spread to multiple machines.

**Phase 2, the arcade dawn**
- **Pong, 1972.** Atari. The game most people wrongly think was first.
- **Breakout, 1976.** Atari.
- **Space Invaders, 1978.** Taito.
- **Asteroids, 1979.** Atari.

**Phase 3, the golden age**
- **Pac-Man, 1980.** Namco.
- **Donkey Kong, 1981.** Nintendo. (A jump in difficulty, a good stress test for small models.)
- and onward as the project earns an audience.

Each round = one game. The chronology gives the project a narrative ("we are up to 1980")
and a natural difficulty ramp that mirrors what small models can and cannot do yet.

## The contestants (models)

The roster is small and efficient models, not frontier flagships. The interesting moment
is a new tiny model launching and getting a score within a day. Example starting roster
(verify exact names and sizes at onboarding, the field moves fast):

- Gemma 4 E4B and Gemma 3 1B / 4B (Google, edge-class)
- Phi-4-mini and Phi-4 Reasoning (Microsoft)
- Qwen3 4B / 8B (Alibaba)
- Mistral Small / Ministral (Mistral)
- Llama small variants (Meta)

Rules of the roster:
- A model qualifies if it is small or cheap enough to be interesting (set a clear bar,
  for example under ~30B params or under some cost-per-million-tokens threshold).
- New models get added as they ship. The "time to first score" for a new model is a
  selling point.
- Optionally include one frontier model as a fixed reference ceiling so people can see
  how close the cheap models get.

---

## Architecture

A web app plus a small offline generation harness.

**Generation harness (offline, run by Patrick)**
- A Node or Python script that reads a game spec, calls each model via OpenRouter with
  the standardized prompt and a fixed token budget, and saves the returned HTML artifact
  plus the recorded cost and model metadata.
- Validates each artifact loads and renders (basic smoke check) before it enters the arena.
- Same single-credential, cost-logging pattern already used in cpa-bench and ai-trivia.

**Voting site (public)**
- Next.js on Vercel (Patrick's stack), Tailwind for UI.
- **Clerk** (free tier) for authentication, with GitHub and Google as the sign-in
  providers. Clerk middleware gates the vote action; play stays open to everyone.
- **Supabase** (hosted Postgres) as the database for models, games, artifacts, votes,
  users, and computed ratings. One Supabase project, shared by the harness and the site.
  Trust is separated by keys and Row Level Security, not by splitting databases:
  - **Harness (offline, trusted):** uses the Supabase `service_role` key. Bypasses RLS,
    writes `models` / `games` / `generations`. The key lives only on Patrick's machine,
    never in the deployed app.
  - **Public site (browser):** ships only the `anon` key
    (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). RLS policies allow public **read** of `games`,
    `generations`, and `ratings`, and **no writes** from the client. The `service_role`
    key is never exposed to the browser — that is the one hard boundary.
  - **Voting (write path):** goes through a **server-side Next.js route handler**, not a
    direct client write. The route verifies the Clerk session, enforces one-vote-per-
    pairing and rate limiting, then writes the `vote` server-side (service role or a
    tightly scoped policy). The browser never holds a key that can write a vote.
  - A `users` row is keyed by the Clerk user id (Clerk owns identity, Supabase owns the
    domain data and votes).
- Artifacts rendered in a **sandboxed iframe** (`sandbox` attribute, no same-origin, no
  network) so AI-generated JavaScript cannot touch the site, the account, or the network.
  This is the one real security requirement and it is non-negotiable.
- A leaderboard page (overall, per game, per cost tier) and an arena page (play two,
  vote one).

**Ranking**
- A scheduled job (or on-write recompute) that turns the vote table into Bradley-Terry or
  Elo ratings with confidence intervals.

### Data model (first cut)

- `models`: id, name, vendor, param_size, cost_per_generation, active
- `games`: id, title, year, creator, spec_markdown, reference_media_url, round_order
- `generations`: id, model_id, game_id, html_artifact_path, cost, tokens, created_at, status
- `votes`: id, user_id, game_id, generation_a, generation_b, winner, created_at
- `users`: id, clerk_user_id, provider (github/google, as reported by Clerk), handle, created_at
- `ratings`: model_id, game_id (nullable for overall), rating, interval, n_votes, updated_at

## Fairness and standardization

The benchmark is only meaningful if every model gets the same shot.

- **One prompt, one shot.** Identical brief, identical token budget, no human iteration,
  no retries on a bad output. A model that returns broken code earns the loss. That is
  signal, not noise.
- **Self-contained HTML only.** One file, inline everything, no external assets or network.
  Equalizes the format and makes sandboxing simple.
- **Same controls named in the spec.** So voters are not penalizing a model for inventing
  weird keys.
- **Reference shown to voters.** A description and an image or clip of the original, so
  "faithful" has a fixed target.
- **Non-running entries still compete.** If a model ships something that does not run, it
  goes into the arena anyway and loses. Hiding failures would inflate the cheap models.

---

## Build plan (phased)

**v0, the smallest real thing (prove the loop)**
- One game: OXO or Pong.
- Three to five small models, generated by hand with the harness.
- A single arena page (play two, vote one) and a basic leaderboard.
- Clerk auth (free tier) with one provider enabled (GitHub), Supabase for storage.
- Goal: a working vote-to-ranking loop, deployed, that Patrick can share for the first
  real votes.

**v1, the real benchmark**
- Phase 1 and 2 games (OXO through Space Invaders).
- Full roster of small models, cost and size stored and shown.
- Bradley-Terry ratings with confidence intervals, per game and per cost tier.
- Google sign-in enabled in Clerk alongside GitHub, rate limiting, vote dedup.
- A short "how it works" and "methodology" page (credibility, the cpa-bench lesson).

**v2, the living arena**
- The chronological campaign as a narrative ("now entering 1980").
- Fast onboarding for new models (time to first score in under a day).
- Optional public submission of a new model or a new game spec.
- Optional sub-votes (fidelity, playability, polish) and per-dimension leaderboards.

## Open questions to decide before building

1. **First game for v0:** OXO (simplest, truest to "the first game") or Pong (more fun to
   play and vote on)? Recommendation: build OXO to prove the loop, launch publicly on Pong.
2. **Generation: one-shot or a fixed agent loop?** One-shot is cleaner and cheaper and
   matches the "raw capability" thesis. Recommendation: one-shot for v0.
3. **Rating method:** plain Elo (simpler) or Bradley-Terry (what LMArena uses, better with
   sparse data)? Recommendation: start with Elo, move to Bradley-Terry when vote volume grows.
4. **Database host:** ~~Supabase, Neon, or Turso?~~ **Decided: Supabase** (hosted Postgres).
   **Auth:** **Decided: Clerk** free tier, GitHub + Google providers.
5. **Eligibility bar for "small and efficient":** a param-size cap, a cost cap, or curator's
   choice? This defines the roster and needs one clear rule.
6. **How often models regenerate:** once per model per game, or re-run when a model updates?
   Affects whether ratings drift over time.

## Risks

- **Low vote volume.** Ratings need votes. Mitigation: launch on a fun, familiar game
  (Pong), make a single vote take under a minute, share through Patrick's audience.
- **Sandbox safety.** Running model-written JS is the real risk. Mitigation: strict iframe
  sandbox, no same-origin, no network, reviewed before listing.
- **Gaming the vote.** Mitigation: auth, one vote per pairing, store user id, filter later.
- **Spec ambiguity.** A vague brief produces unfair, hard-to-judge builds. Mitigation: tight,
  identical specs with named controls and a shown reference.
- **Scope creep.** The matrix of games times models is huge. Mitigation: one game per round,
  ship v0 on a single game first.

## What a strong v0 demonstrates (portfolio value)

- A full human-feedback evaluation loop: generation, sandboxed serving, pairwise voting,
  and statistical ranking. That is the same machinery behind LMArena, built solo.
- Real product engineering: auth, a database, a deployed site, security thinking.
- A novel, genuinely fun idea that a non-technical visitor immediately gets and can use.
- A clean pairing with cpa-bench: two public benchmarks, one serious and one playful, both
  measuring AI capability in the open.

---

Built and maintained by Patrick Neyland. Company arm: Neyland Solutions
(https://neylandsolutions.com).
