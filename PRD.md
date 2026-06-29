# arcade-bench, PRD (high level)

A community-voted arena where small, cost-efficient AI models recreate classic
arcade games as single self-contained HTML files, and the public plays and votes
on which recreations are best. See PLAN.md for the design rationale.

> Scope of this doc: the high-level product. What gets built, who uses it, and the
> main flows. Not a technical spec.

---

## 1. Goal and non-goals

**Goal.** Stand up a public website that ranks small AI models by how well they
recreate classic games, scored by real human votes, walking forward through game
history.

**Non-goals (for now).**
- Not a prompting benchmark. One locked prompt per game, no tuning.
- Not a frontier-model benchmark. The roster is small, cheap, efficient models.
- Not a general game host. Only the benchmark's own AI-generated recreations.

## 2. Users

- **Player (anonymous).** Anyone, no sign-in. Plays the recreations, browses the
  leaderboard. Free, zero friction.
- **Grader (signed in).** Same as a player, plus can vote. Sign-in exists only so
  votes can be tracked and trusted. Lightweight OAuth.
- **Admin (Patrick).** Adds games and models, runs generations, reviews artifacts,
  publishes them to the arena.

## 3. Core experiences

1. **Play.** Pick a game, pick a recreation (or get a random one), play it in the
   browser. No account needed.
2. **Grade (the arena).** See two recreations of the same game side by side with the
   original described for reference. Play both, vote the better one. Sign-in required
   to cast the vote, not to look.
3. **Leaderboard.** See which models rank highest: overall, per game, and per cost or
   size tier. Show vote counts and confidence so thin data reads as thin.
4. **Admin.** Behind a login: onboard a model, trigger a generation run, review what
   came back, and publish or reject each artifact.

## 4. What needs to be built

Seven pieces. The generation orchestrator and the sandboxed player are the two that
carry the most risk.

### A. Web frontend
The public site. Pages: Home / Arena (vote), Play / Browse, Leaderboard, About and
Methodology, Sign-in. Built on Patrick's stack (Next.js, Tailwind, Vercel).

### B. Authentication (optional)
OAuth sign-in (GitHub or Google) via Auth.js. Anonymous users can do everything
except vote. Voting requires a session. The only purpose is trustworthy human
annotation, so the bar is low: no passwords, no profiles, just an identity behind a vote.

### C. Generation orchestrator (the OpenRouter harness)
The offline engine that turns a model into a playable artifact. This is the part the
user called out, and it is more than a single API call. For each game and each model:

1. **Call.** Send the locked prompt (`Create {game} as a single self-contained HTML
   file that runs in a browser.`) to the model through OpenRouter, with a fixed token
   budget. Generate N samples per model per game.
2. **Extract.** Pull the HTML out of the raw model response. Models wrap output in
   markdown fences, add prose, or apologize first. The extractor strips that and
   isolates the document (`<!doctype html>` ... `</html>`).
3. **Validate.** Confirm it is one self-contained file: no external script or asset
   URLs, no network calls. Flag or reject anything that reaches outside the file.
4. **Smoke test.** Load the file in a headless browser and confirm it renders without
   throwing on start. A build that crashes immediately is marked broken, not dropped.
5. **Store.** Save the HTML artifact plus metadata: model, game, sample index, cost,
   tokens, timestamp, and status (ok / no-html-found / broken).

Runs as a batch job that Patrick kicks off, not something users trigger. Same single
OpenRouter credential reaches every model and reports per-call cost, the pattern
already used in cpa-bench and ai-trivia.

### D. Artifact store and sandboxed player
Where the generated HTML lives and how it is served safely. Every artifact runs inside
a **strict sandboxed iframe**: no same-origin access, no network. This is the one hard
security requirement, because the site is running code written by AI models. The player
component takes an artifact and renders it for play.

### E. Database
One store for: models, games, generations (artifacts), votes, users, and computed
ratings. Modest size, any of Postgres (Supabase or Neon) or SQLite (Turso) works.

### F. Voting and rating engine
Records each pairwise vote (game, the two artifacts, winner, user) and turns the vote
history into a ranking. Start with Elo, move to Bradley-Terry as volume grows. Produces
the numbers the leaderboard reads, with confidence intervals.

### G. Admin and curation surface
A thin internal tool for Patrick: add a game (title, year, the locked prompt), add a
model to the roster, launch a generation run, review returned artifacts (play them,
see status and cost), and publish or reject each one before it enters the arena.

## 5. Main flows

**Generation flow (admin, offline).**
pick game + models -> orchestrator calls OpenRouter (N samples each) -> extract HTML
-> validate self-contained -> smoke test -> store artifacts + cost + status -> admin
reviews -> publish to arena.

**Voting flow (public).**
visitor opens the arena -> served two published artifacts of the same game (identities
hidden) -> plays both -> to vote, signs in if not already -> picks a winner -> vote
recorded -> rating engine updates -> leaderboard reflects it.

## 6. Out of scope for v1

- Public submission of new games or models by visitors.
- Sub-dimension voting (separate fidelity / playability / polish scores).
- Fixed asset packs for sprite-heavy games (a far-future option, see PLAN.md).
- Real-time or multiplayer anything.
- A native mobile app (the site should work on mobile, but no app).

## 7. Success metrics

- Games live and models scored (coverage).
- Total votes collected, and votes per model (rating confidence).
- Signed-in graders and repeat graders (is the annotation real).
- Time to first score for a newly released small model (the headline feature).

## 8. Open questions

- First game to launch publicly (Pong is the safe, fun pick).
- N samples per model per game (3 to 5 is the working assumption).
- Database host and Elo vs Bradley-Terry timing (both can start simple).
- How a build that returns prose-only or non-HTML is shown: hidden, or listed as an
  automatic loss. Current lean is "it competes and loses."

---

Built and maintained by Patrick Neyland. Company arm: Neyland Solutions
(https://neylandsolutions.com).
