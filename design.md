# arcade-bench — Design System

> The visual source of truth for the build. Direction: **Pixel Pop**.
> This spec stands alone; the exploratory HTML mockups it was derived from have been removed.
> When code and this document disagree, this document wins until it is deliberately updated.

---

## 1. Design principle

**Retro as seasoning, not the meal.** arcade-bench is a calm, confident, modern
product UI with 8-bit accents applied in a few deliberate places. Most of the page
is generous whitespace, clean cards, and fully readable type. The pixel character
lives only in: the wordmark, big display headings, a small icon set, and the
tactile hard-shadow buttons.

Three rules that keep it from tipping into kitsch:

1. **The pixel display font never touches body copy.** Headings and the wordmark only.
2. **Bright is controlled.** A cream canvas and near-black ink do the heavy lifting;
   the arcade colors are highlights, never wallpaper.
3. **Every control feels physical.** Chunky 2px ink borders + a crisp hard offset
   shadow (no blur). Pressing slides the element into its shadow.

The product is bright, friendly, and immediately gettable by a non-technical visitor
— without ever looking toylike.

---

## 2. Color tokens

Light-first. Cream canvas, near-black ink, two arcade primaries plus a coin-gold
accent as seasoning, and a reserved pair of semantic state colors.

### Core surfaces & ink

| Token | Hex | Role |
|---|---|---|
| `cream` | `#FBF7EF` | Page canvas (the default background) |
| `cream-2` | `#F3ECDD` | Canvas shade — section labels, table headers, arena chrome |
| `surface` | `#FFFFFF` | Cards, panels, the game frames' chrome |
| `ink` | `#1B1A22` | Primary text **and** all chunky borders |
| `ink-soft` | `#57545F` | Muted/secondary text, captions |
| `line` | `#E6DFCF` | Hairline dividers on cream |

### Arcade primaries (seasoning)

| Token | Hex | Role |
|---|---|---|
| `blue` | `#2D6CFF` | Primary action color. **Build A identity.** |
| `blue-deep` | `#1A4FCC` | Blue hover/pressed |
| `red` | `#FF4D4D` | **Build B identity**, accents |
| `yellow` (coin gold) | `#FFC700` | Secondary buttons, #1 winner, "now playing" |
| `gold-1 / gold-2` | `#FFD64A` / `#FFB200` | Winner crown gradient, coin shading |
| `grape` | `#7B5CFF` | Tertiary accent (param chips, Meta vendor) |

### Semantic states (reserved — do not use decoratively)

| Token | Hex | Role |
|---|---|---|
| `win` | `#18B26B` | Success, win, the cost-efficiency number |
| `danger` | `#E23B3B` | "Both bad" vote, destructive/error |

### Build identity (load-bearing convention)

**Build A is always `blue`. Build B is always `red`.** This pairing is consistent
across the arena frames, the vote buttons, and anywhere a build is referenced. It is
how a voter keeps the two sides straight — treat it as a fixed rule, not a style choice.

### Vendor dot colors

Each model carries its vendor's brand color as a small square dot in its badge:

| Vendor | Hex |
|---|---|
| Google | `#4285F4` |
| Microsoft | `#00A4EF` |
| Alibaba | `#FF6A00` |
| Mistral | `#FF4D4D` |
| Meta | `#7B5CFF` |

---

## 3. Typography

Four families, each with one job. Load via Google Fonts (or self-host equivalently).

| Family | Weights | Used for |
|---|---|---|
| **Press Start 2P** | 400 | Display only: wordmark, hero/big headings, build labels. **Never body.** |
| **Space Grotesk** | 400–700 | Section titles, card headers, button labels, table emphasis |
| **Inter** | 400–700 | Body copy, UI text, long-form reading |
| **JetBrains Mono** | 400/500/700 | All numerals — ratings, confidence intervals, cost, params, codes, table data |

> Body stack in CSS: `'Inter','Space Grotesk',system-ui,sans-serif`.
> The mono carries every number so columns line up and data reads as data.

### Scale (from the mockup)

| Role | Family | Size / weight | Notes |
|---|---|---|---|
| Display / hero `h1` | Press Start 2P | `clamp(26px, 4.6vw, 46px)`, line-height 1.25 | Color spans allowed (blue/red words) |
| Section title `h2` | Space Grotesk 700 | 24–30px, letter-spacing −0.01em | |
| Body | Inter 400 | 16–17px, line-height 1.55 | max-width ~60ch |
| Lede | Inter 400 | 19px, `ink-soft` | Hero subhead |
| Caption | Inter | 13px, `ink-soft` | |
| Numerals | JetBrains Mono 700 | contextual | e.g. `1412 ±38 · $0.003 · 4B` |
| Section label (eyebrow) | JetBrains Mono | 11px, uppercase, letter-spacing 0.16em | Pill on `cream-2` |

---

## 4. Shape, spacing, elevation

| Token | Value | Notes |
|---|---|---|
| `radius` | `14px` | Cards, arena, leaderboard |
| Button radius | `12px` | |
| Chip radius | `999px` (pill) / `9px` (square badge) | |
| Border (chunky) | `2px solid ink` | The signature — on every card, button, chip, frame |
| `shadow` | `4px 4px 0 ink` | Hard offset, **no blur** — big elements (arena, board) |
| `shadow-sm` | `3px 3px 0 ink` | Buttons, swatches, chips |
| Press state | `transform: translate(3px,3px); box-shadow: 0 0 0` | Element slides into its shadow |
| Container | `max-width: 1120px`, `padding: 0 24px` | |
| Section rhythm | `padding: 54px 0`, dashed `line` divider between sections | |

**Texture:** a barely-there 32px pixel grid on the canvas
(`linear-gradient` hairlines at ~2.5% ink opacity). Subtle enough to feel like
graph paper, never a focal point.

---

## 5. Buttons

Shared anatomy: inline-flex, 2px `ink` border, 12px radius, `shadow-sm`, Space Grotesk
600. `:active` slides 3px into the shadow. Icon + label gap 9px.

| Variant | Fill | Text | Use |
|---|---|---|---|
| **Primary** | `blue` (hover `blue-deep`) | white | Main action: Enter the Arena, Sign in |
| **Secondary** | `yellow` | `ink` | Adjacent action: See the leaderboard |
| **Ghost / Outline** | transparent, no shadow | `ink` | Tertiary: How it works |
| **Disabled** | `cream-2`, `#CDC6B5` border, grey shadow | `#A6A0AE` | No press animation |

### Vote buttons (the arena's primary controls)

| Button | Fill | Text | Behavior |
|---|---|---|---|
| **← A is better** | `blue` | white | Spans left half |
| **B is better →** | `red` | white | Spans right half |
| **Tie** | `surface` | `ink` | Centered, secondary row |
| **Both bad** | `surface`, `danger` border + `danger` shadow | `danger` | Centered, secondary row |

Layout: A and B side by side (1fr 1fr) on top; Tie and Both bad centered below.
The big A/B buttons get extra padding (~15px) so they read as the primary act.

---

## 6. Icons

Eight inline SVG icons drawn on a **16-unit square grid** so they read as genuine
8-bit rather than generic line icons. Built from `<rect>` blocks, `image-rendering: pixelated`.
Used sparingly — nav, votes, state, sign-in.

`play` · `trophy` · `vote` (checkmark) · `info` · `github` · `google` · `controller` · `history`

Rules:
- Keep them on the 16×16 grid; new icons must match the block weight of the set.
- Color from palette tokens (the brand icons — GitHub mono, Google 4-color — are the
  exceptions and use their real brand colors).
- The joystick wordmark mark is the canonical logo glyph (red ball-top, blue base,
  coin-gold button).

---

## 7. Badges & chips

Compact metadata that travels with every model.

| Element | Style | Example |
|---|---|---|
| **Vendor badge** | `surface`, 2px ink border, 9px radius, colored square dot | ● Google |
| **Param chip** | pill, `grape` fill, white text, JetBrains Mono 700 | `4B params` |
| **Cost chip** | pill, white fill, mono | `$0.003 / gen` |
| **Cost tier** | square tag, 2px ink border, tinted by weight | see below |

Cost tiers (the cost-per-quality framing, made visual):

| Tier | Background | Text |
|---|---|---|
| Featherweight | `#E8F6EE` | `#0E7A45` |
| Midweight | `#FFF3D6` | `#9A6B00` |
| Heavyweight | `#FBE3E3` | `#B12B2B` |

---

## 8. Key components

### Nav

Sticky, `cream` at 86% opacity with `backdrop-filter: blur(8px)`, 2px `ink` bottom
border. Left: joystick glyph + `arcade-bench` wordmark (Press Start 2P, the `-` is
blue). Center: Arena · Leaderboard · History · How it works (active link is `ink`
600-weight). Right: a coin chip showing the user's vote count, then a primary
**Sign in** button.

### The Arena (hero component)

A single bordered card (`shadow`, 14px radius), three stacked regions:

1. **Head** (`cream-2`): pixel reference thumbnail of the original game · game name
   (Space Grotesk 700) · `year · maker · Round X of N` (mono) · a "Reference shown"
   tag pushed right.
2. **Body**: two equal frames split by a 2px `ink` divider. Each frame has a label
   row — **BUILD A** (blue) / **BUILD B** (red) in Press Start 2P, plus a dashed
   "model hidden until you vote" tag. Below it, the game canvas: 4:3, dark
   (`#0B0B12`), 2px ink border, `image-rendering: pixelated`. **In production this
   canvas is the sandboxed `<iframe>`** (`sandbox` attr, no same-origin, no network —
   the non-negotiable security requirement from the PRD).
3. **Vote bar** (`cream-2`): the four vote controls per §5.

Responsive: under 760px the two frames stack (divider becomes a bottom border).

### Leaderboard

Bordered card, full-width table. Header row: `cream-2`, mono uppercase 11px labels,
2px ink bottom border. Numeric columns right-aligned. Columns:

`#` · `Model` · `Vendor` (badge) · `Rating` (mono 700 + `±CI` in `ink-soft`) ·
`Params` (mono) · `Cost / gen` (mono) · `Rating / ¢` (the headline efficiency number, in `win` green).

The **#1 row** gets the winner treatment: a coin-gold gradient wash
(`rgba(255,199,0,.16)` → `.04`), gold bottom border, and a `★ 1` crown chip
(gold gradient, ink border) in the rank cell. Row hover: `cream`.

> Rating method: Bradley-Terry with confidence intervals (Elo acceptable for v0).
> Always show the interval so a 5-vote model never reads as equal to a 500-vote one.

### History timeline

Horizontal, scrollable strip; one node per game in chronological order along a
4px track. Each node = a square dot on the line + a small card (`year` in mono,
game name in Space Grotesk 700, a status tag). Three states:

| State | Dot | Card | Tag |
|---|---|---|---|
| **Live** | `win` green | full | `Live` (green) |
| **Now** | `yellow` + glow ring | full | `▶ Now` (gold) |
| **Upcoming** | white, dashed border | dashed, ~62% opacity | `Upcoming` (muted) |

This is the "walking through history" narrative made literal — 1952 → present.

---

## 9. Implementation mapping (Next.js + Tailwind)

- **Tokens → `tailwind.config`**: register the palette under semantic names
  (`cream`, `ink`, `blue`, `red`, `yellow`, `win`, `danger`, `grape`, …), the four
  font families, the `radius`/border scale, and the two hard shadows as custom
  `boxShadow` (`shadow-hard`, `shadow-hard-sm`).
- **Fonts**: `next/font` for Inter, Space Grotesk, JetBrains Mono; Press Start 2P
  loaded the same way but applied via a `.font-display` utility used only on headings.
- **Press interaction**: a shared `btn` component class encapsulating the
  border + hard shadow + `active:translate` press. All buttons extend it.
- **Build identity**: expose `A = blue`, `B = red` as constants so the arena, vote
  buttons, and any build reference stay locked together.
- **Iframe**: the arena game canvas is the only place untrusted model HTML renders —
  always `sandbox` with no `allow-same-origin` and no network. Style the iframe
  container exactly as the `.game-canvas` (4:3, dark, 2px ink border).
- **Dark mode**: out of scope for v0. The identity is light-first; revisit later.

---

## 10. Accessibility notes

- Press Start 2P is low-legibility at small sizes — the "never body copy" rule is
  also an a11y rule. Keep it ≥ display sizes.
- Don't rely on the blue/red build identity alone; always pair it with the **BUILD A
  / BUILD B** text label (already in the design).
- Maintain AA contrast: `ink` on `cream`/`surface` passes comfortably; white on
  `blue`/`red`/`win` passes; avoid `ink-soft` for anything smaller than caption size
  on cream.
- Vote and nav controls are real buttons/links with visible focus — preserve a
  visible focus ring (a 2px offset ink or blue outline fits the chunky language).

---

Built & maintained by Patrick Neyland · [Neyland Solutions](https://neylandsolutions.com).
