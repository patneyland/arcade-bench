# UX Overhaul — audit findings & work queue

> Produced 2026-07-02 from a 7-agent visual inspection of the running app (screenshots
> taken and reviewed at real viewports, all pages, desktop + tablet + phone).
> Key evidence images live in [`docs/ux-audit/`](./ux-audit/). This file is the working
> document for the overhaul: tackle the roadmap items in order, check them off, and keep
> the findings below as the source of truth for *why* each item exists.

## Status

- [x] **Phase 1 shipped (unreleased, on `build/v0-arena`)** — INSERT COIN start gate,
  keyboard-focus indicator, per-frame Restart, step strip (play A → play B → vote),
  vote nudge + judging caption, mobile sticky vote bar. Note: the mobile sticky bar
  **backfired** (see Mobile findings) and gets reworked in item 2.
- [x] **1. Arena rebuild** — shipped 2026-07-02: one-cabinet session flow
  (coin → play A → play B → verdict → reveal → next round), 820×700
  virtual-viewport scaling, intro block deleted, slim mobile CTA row.
- [ ] 2. Mobile triage — PARTIAL. Done: sticky vote monster replaced by the flow's
  slim CTA row; nav page links below 768px; leaderboard mobile columns
  (#/Model/Rating-¢); about locked-prompt wrap. Remaining: coarse-pointer
  "best played on desktop" framing; tap-target audit of the new overlay Restart
  chip; verify the new marquee's meta line at 390px.
- [x] 3. Home page restructure — shipped 2026-07-02: playable teaser in the fold,
  vote-CTA bridge instead of the duplicate arena, slimmed sections (~1650px page).
- [x] 4. Leaderboard credibility pass — shipped 2026-07-02: efficiency-column
  spotlight + ⚡ BEST /¢ chip, cents formatting, labeled composable filters,
  play-a-round banner, params folded into model cell, mobile column set.
- [x] 5. History page — shipped 2026-07-02: clickable Live/Now nodes, 1952/present
  track anchors, expanded cards on /history, honest copy, mobile auto-center.
  (Reference thumbnails / champion-per-game deferred: data not in TimelineEntry.)
- [ ] 6. Pipeline/data fixes (broken artifacts reaching voters)
- [x] **7. PRODUCT PIVOT: playability screening** — shipped 2026-07-02: Arcade
  (/arcade, certified builds only), Test Lab (/test, signed-in screening),
  PlayabilityVote + API routes + seed, leaderboard Playable column; /arena parked
  out of the nav. 105 tests + build green; visually verified on the local stack.

> Post-ship note: all of the above verified by tests + `next build` only — Docker
> was down, so no live visual pass yet. First session with the local stack up:
> visually verify the new arena flow, home teaser fold, and 390px states before
> starting item 2's remainder.

---

## The critical finding (read this first)

**At the current frame size (~500×375 on a 1440px screen), 14 of 18 artifacts lose
content — and voters are penalizing the viewport, not the model.** Fixed 800×600
canvases show only their top-left quadrant (Pong's right paddle is literally
off-screen: `ux-audit/canvas-500-pong-gpt-4-1-nano.png`); centered 600px boards lose
both edges (HUD reads "ré: 20"/"Liv": `ux-audit/sbs-breakout-ministral-496.png` vs the
same build fully legible at 1000px: `ux-audit/sbs-breakout-ministral-1000.png`); all
six Snake builds get their square boards or score lines cut by the landscape 4:3 box.
This noise flows directly into the Elo ratings the site exists to produce.

At 900×675 every sizing failure disappears. Worst native page size in the corpus is
808×688, so a virtual viewport of **~820×700** fits everything.

**Fix (sandbox-safe):** render each iframe at a fixed `820×700` and shrink it with a
CSS transform on the iframe *element* (`transform: scale(min(frameW/820, frameH/700));
transform-origin: 0 0`, centered in a wrapper). Pointer coordinates remap through
transforms automatically; keyboard focus is unaffected; no access to the frame's DOM
is needed. Frame aspect can move from 4:3 to 7:6 to match.

Two artifacts are broken at ANY size and currently reach voters (see item 6):
- `breakout/gemma-3-4b.html` — blank white page; 234 bytes referencing external
  `style.css`/`script.js` (not self-contained — the harness validator should flag it):
  `ux-audit/canvas-500-breakout-gemma-3-4b.png`
- `snake/qwen3-8b.html` — draws black-on-black; invisible even when playing.

---

## Roadmap

### 1. Arena rebuild — the "one cabinet" session flow (NEXT UP)

> Owner direction (2026-07-02): drop the side-by-side "pinning one against the
> other" framing entirely. Design for a ten-minute session: **one game on screen at
> a time, simpler UI, the vote as a step in a flow rather than a sidebar.**

The arena becomes a sequential round loop — an arcade run, not a comparison table:

**Round state machine (client, per pairing):**
`coin → play A → play B → verdict → reveal → next round`

1. **Coin screen** — slim marquee header (game title · year · round · "models hidden
   until you vote") + ONE big frame with the INSERT COIN gate. No intro text — the
   /arena intro block (eyebrow + H1 + paragraph) is deleted; the cabinet is the page.
   Drop the black REF thumb + "REFERENCE SHOWN" tag.
2. **Play A** — Build A fills the stage (blue chrome). Below the frame, ONE primary
   CTA: "NEXT: PLAY BUILD B →" (red). Secondary: ↻ restart. Focus handling as today.
3. **Play B** — same stage, red chrome. Primary CTA becomes "CAST YOUR VOTE →".
   Secondary: "↩ replay Build A" (free flipping; CTA stays on vote once both played).
4. **Verdict** — its own step, not a sidebar: the stage yields to four big buttons
   (A better / B better / Tie / Both bad) + the one judging line. Small "go back and
   replay" link. Signed-out voters get the existing retry-after-auth flow, with a
   real primary sign-in button.
5. **Reveal** — the payoff: both model cards (name, vendor, params, cost/gen), the
   voter's pick highlighted, then "NEXT ROUND →". A small client-side session tally
   ("2 rounds judged this session") gives the ten-minute visit a sense of a run.

Mechanics:
- Both iframes stay MOUNTED across the round; the off-stage one is hidden (browser
  rAF throttling on hidden iframes conveniently pauses most games). Unmount on next
  round only.
- **Virtual-viewport scaling** (the rating-integrity fix): SandboxedPlayer renders
  the iframe at a fixed 820×700 and scales it with a CSS transform on the iframe
  element (ResizeObserver on the wrapper; scale = min(w/820, h/700)). Frame box
  moves to 7:6; cap height ~62vh so stage + CTA always share the viewport. Let the
  stage outgrow the 1120px text container on large screens.
- One-frame-at-a-time IS the mobile layout — no separate sticky vote bar. Replace
  the 291px sticky monster with a slim sticky row (~64px) holding only the current
  step's primary CTA under 760px.
- A = blue / B = red stays load-bearing: pills, stage chrome, verdict buttons.
- Move Restart/focus hint into overlay chips on the canvas corner (kills the
  layout-shift row).
- Theater/expand mode: deferred — the focused stage largely removes the need;
  revisit after the flow ships.
- Instruction de-dup: the flow itself is the narrative; keep one judging line
  (verdict step) and one anonymity note (marquee).

### 2. Mobile triage

- **Sticky vote bar**: 291px tall = 34.5% of a 390×844 viewport, pinned from scroll 0,
  paints OVER the game being judged (`ux-audit/resp-arena-390-coin.png`), and shows
  vote buttons before any game on first paint. Collapse the stuck state to one slim
  row (~64–72px: "A better | B better | ⋯" with Tie/Both-bad behind overflow), and/or
  don't stick until the user has scrolled past Build A.
- **Nav below 768px has NO page links** (wordmark + Sign in only; `hidden md:flex`
  with no hamburger). Four short links fit as a second pill row, or add a hamburger.
- **Leaderboard table at 390 hides every numeric column** including Rating/¢ — the
  column the intro calls "the headline" (`ux-audit/resp-lb-390-full.png`). Mobile
  column set (#, Model, Rating/¢) with row-expand for the rest; at minimum pin
  #/Model and add a right-edge fade + swipe hint. Same defect in the home preview.
- **Touch users are invited to play keyboard games.** Page-level framing only (no
  in-game control hints — owner has explicitly deferred anything prompt/artifact-side):
  detect coarse pointer, adjust overlay/step copy to "best played on desktop — you can
  still compare and vote."
- Card-header meta wraps to rubble at 390 ("1976 / · / Atari / · / Round / 3 of / 5"
  in a 70px column) — stack title and meta as full-width rows at small widths.
- Restart tap target is 94×23px — bump to ≥40px tall. Tie/Both-bad are 40px (bump to 44).
- About page: the locked prompt clips mid-sentence at 390 with hidden scroll — let it
  wrap (`whitespace-pre-wrap`).
- Tablet (768) is clean everywhere — don't disturb it.

### 3. Home page restructure (funnel: land → play → vote)

Findings: the 1440×900 fold is 100% typography — the product is invisible (games start
at y≈962, `ux-audit/home-fold.png`); the right half of the hero is empty cream
(~600×450px); the page embeds a complete duplicate arena whose enabled vote buttons
hit a sign-in wall; the leaderboard preview is titled "Most cost-effective models" but
sorted by raw Rating; four sections repeat one identical template.

Target structure (~1600–1800px total, down from 2746):
1. Hero + live arena teaser in one band that fits the fold — copy left (2-line
   headline, one-sentence lede, ONE primary CTA), the two INSERT COIN frames right or
   directly below, playable in place (playing is zero-auth and is the hook).
2. "Ready to judge?" bridge (~120px): one wide blue/red split CTA into /arena instead
   of the duplicate vote bar. Play here, vote there.
3. Leaderboard preview sorted consistently with its title (~450px).
4. History strip slimmed to a single-row banner (~200px).

### 4. Leaderboard credibility pass

- The intro says "the headline column is Rating/¢" but the table ranks and crowns raw
  Rating — the best-efficiency model (13728, rendered in win-green) sits LAST. Either
  a sort toggle (Rating ↔ Rating/¢), an efficiency-crown marker on the best Rating/¢
  row, or retitle. The green column needs a winner.
- `$0.000` cost cell reads as broken data → sub-cent formatting (`$0.0004` or `0.04¢`,
  which also unifies units with Rating/¢).
- Filter chips: two unlabeled look-alike rows, "Overall" un-highlights when a game is
  picked, tier names are undefined jargon. Prefix rows with tiny mono labels
  ("COST TIER" / "GAME"), keep state visible, put price ranges in the chips.
- Dead end: add a slim banner under the table — "These intervals shrink one vote at a
  time → Play a round" with the primary button.
- Lesser: Params column is half em-dashes (fold into model cell as the grape chip);
  suppress the ★1 crown when a filter yields <2 rows; overlapping-CI rows could show
  a subtle "≈ tied" marker.

### 5. History page: doors, not dots

- **Nothing is clickable** — cards styled like pressable buttons do nothing. Now-node
  → arena ("Play this round →"); Live nodes → per-game results/leaderboard filters.
- Headline says "1952 → present"; the strip visibly runs 1972–1979. Anchor both ends:
  a ghost origin marker ("1952 · the dawn") and a terminus ("→ present · more rounds
  coming") so 5 games read as chapter one, not all-there-is.
- Give nodes a payoff the home strip can't have: reference thumbnails, vote counts,
  and the winning model per conquered game ("Champion: …"). Era bands/decade ticks
  make small N look intentional.
- Mobile: auto-scroll the Now node into view; add right-edge fade.
- Lesser: legend copy should explain Live vs Now in one clause; the Now glow ring is
  nearly invisible — strengthen or animate.

### 6. Pipeline/data fixes (backend/harness, whenever)

- Regenerate or exclude `breakout/gemma-3-4b` (blank; non-self-contained) and
  `snake/qwen3-8b` (black-on-black). Per PRD, broken entries may still compete — but
  they should carry status `broken`, not render as playable mystery boxes.
- Harness validator should hard-flag `<link rel="stylesheet">` / `<script src>`
  (external refs) — this one escaped.
- Observed: `getArenaPairing` only ever serves the "now" game, so pong/snake pairings
  are currently unreachable in the arena. Confirm intended (single active round) or fix.
- Invalid leaderboard query params (e.g. `?tier=budget`) silently fall back to
  Overall — harmless, note only.

---

### 7. PRODUCT PIVOT: playability screening (owner decision 2026-07-02)

> Owner direction: the first judgment is **"is this build playable or not?"** —
> additional criteria come later. Signed-out visitors play ONLY certified-playable
> games; signing in makes you a **tester** who screens unvetted builds. Head-to-head
> A/B voting is PARKED (code kept, `/arena` out of the nav) until later criteria.

**Rules**
- One playability vote per user per generation (`PlayabilityVote`, unique
  (userId, generationId)); server-enforced auth/duplicate/rate-limit like `recordVote`.
- Certified = `playable votes / total votes ≥ 85%` (`CERTIFIED_PLAYABLE_PCT`), no
  minimum vote count, but zero votes ≠ certified.
- Builds below the bar surface as "reported unplayable" — visible, not hidden
  (they shame the model on the leaderboard via playability stats).

**The two journeys**
- **Arcade (`/arcade`, signed-out default)**: browse and play certified builds,
  model identity SHOWN (no vote to bias), grouped by game. This is the free product:
  a working arcade of AI-built classics.
- **Test Lab (`/test`, signed-in)**: the one-cabinet flow reused for a single build —
  coin → play → verdict (PLAYABLE / NOT PLAYABLE) → reveal (model + updated % +
  certified state) → next candidate (fewest-votes-first, never one you've voted on).
- Home funnels by auth state: play the arcade / become a tester.

**Contracts (already in place)**: `ArcadeEntry`, `TestCandidate`,
`RecordPlayabilityInput/Result` in `lib/types.ts`; `CERTIFIED_PLAYABLE_PCT` in
`lib/constants.ts`; `PlayabilityVote` in `prisma/schema.prisma`; stub
`getArcade` / `getNextTestCandidate` / `recordPlayabilityVote` in `lib/data.ts`
(backend lane replaces bodies). API routes: `GET /api/playability/next` →
`TestCandidate | null`, `POST /api/playability/vote` → `RecordPlayabilityResult`.
`LeaderboardRow` gains optional `playablePct` / `certifiedBuilds` / `totalBuilds`.

## What to KEEP (praised across every report)

- The **INSERT COIN overlay** — the most arcade-feeling moment in the app; surface it
  higher (home fold), never remove it.
- **A = blue / B = red** identity carried through labels, rings, and vote buttons —
  in the rebuild it gains a third anchor (tabs).
- The **vote button design** (directional ← A / B →, demoted Tie/Both-bad row).
- The **Pixel Pop craft**: chunky ink borders, hard offset shadows, cream + pixel-grid
  texture, mono numerals; leaderboard #1 gold treatment; history's three-state visual
  language; the about page's locked-prompt-in-a-box and its closing CTA pair.
- Zero-friction **playing** (no auth to insert a coin) — only voting gates.
- The step strip's live checkmarks (concept survives as tab checkmarks).
- Arena page compactness on mobile (~2.2 screens/session) — don't inflate it.

## Method note

Seven parallel agents each took and visually reviewed real screenshots of the running
app (dev server, seeded DB) at 1440×900, 1920×1080, 1280×800, 768×1024, and 390×844,
including interaction states (coin gates clicked, games running, vote attempted while
signed out, filters toggled). All 18 artifacts were additionally captured standalone
at the iframe's exact content size (496×371) and at 900×675 for comparison. Full
screenshot set (111 files) was produced in a session scratchpad; the 12 cited
evidence images are preserved in `docs/ux-audit/`.
