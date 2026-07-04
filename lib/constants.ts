// Load-bearing conventions from design.md. Keep these as the single source of truth.

/** The locked prompt. Only {game} changes — never tuned. This is a benchmark of
 *  models, not of prompting. */
export const LOCKED_PROMPT = (game: string) =>
  `Create ${game} as a single self-contained HTML file that runs in a browser.`;

/** Build identity is fixed: A is always blue, B is always red (design.md §2). */
export const BUILD_A = { key: "a", label: "BUILD A", color: "blue" } as const;
export const BUILD_B = { key: "b", label: "BUILD B", color: "red" } as const;

/** Vote outcomes. */
export const VOTE_WINNERS = ["a", "b", "tie", "both_bad"] as const;
export type VoteWinner = (typeof VOTE_WINNERS)[number];

/** Vendor brand-dot colors (design.md §2). */
export const VENDOR_COLORS: Record<string, string> = {
  Anthropic: "#D97757",
  Google: "#4285F4",
  Microsoft: "#00A4EF",
  Alibaba: "#FF6A00",
  Mistral: "#FF4D4D",
  Meta: "#7B5CFF",
  OpenAI: "#10A37F",
  DeepSeek: "#4D6BFE",
  xAI: "#1B1A22",
};

/** Cost tiers (design.md §7) — the cost-per-quality framing made visual. */
export const COST_TIERS = ["featherweight", "midweight", "heavyweight"] as const;
export type CostTier = (typeof COST_TIERS)[number];

/** Game round status. */
export const GAME_STATUSES = ["live", "now", "upcoming"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

/** Generation outcome status. */
export const GENERATION_STATUSES = ["ok", "no-html-found", "broken"] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

/** Default starting rating for the Elo / Bradley-Terry engine. */
export const DEFAULT_RATING = 1000;

/** Playability certification (product pivot 2026-07-02, docs/ux-overhaul.md §7):
 *  a build is certified once ≥85% of its playability votes say "playable".
 *  Threshold only — no minimum vote count (owner decision), but zero votes is
 *  never certified (an unscreened build stays out of the public Arcade). */
export const CERTIFIED_PLAYABLE_PCT = 85;
