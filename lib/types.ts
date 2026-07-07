// Shared view-model types — the contract between the backend data layer (lib/data.ts)
// and the frontend (app/, components/). Agents must not change these signatures
// without coordinating; they are the integration boundary.

import type { VoteWinner, CostTier, GameStatus, GenerationStatus } from "./constants";

export type { VoteWinner, CostTier, GameStatus, GenerationStatus };

export interface VendorBadge {
  vendor: string;
  color: string; // hex from VENDOR_COLORS
}

/** A model as shown in the leaderboard / badges. */
export interface ModelView {
  id: string;
  slug: string;
  name: string;
  vendor: string;
  paramSize: string | null;
  costPerGen: number;
  tier: CostTier | null;
}

/** One leaderboard row. `ratingPerCent` is the headline efficiency number. */
export interface LeaderboardRow {
  rank: number;
  model: ModelView;
  rating: number;
  interval: number; // +/- CI half-width
  nVotes: number;
  ratingPerCent: number | null; // rating per cent of cost; null if cost is 0
  // Playability screening stats (docs/ux-overhaul.md §7). Optional so pre-pivot
  // call sites keep compiling; render "—" when absent.
  playablePct?: number | null; // share of playability votes marked playable, 0–100
  certifiedBuilds?: number; // builds at/above CERTIFIED_PLAYABLE_PCT
  totalBuilds?: number; // published builds screened or awaiting screening
}

/** One side of an arena pairing — identity hidden until the vote is cast. */
export interface ArenaBuild {
  generationId: string;
  artifactPath: string;
  status: GenerationStatus;
  // Revealed only after voting (kept out of the initial payload in production):
  model?: ModelView;
}

export interface GameView {
  id: string;
  slug: string;
  title: string;
  year: number;
  creator: string;
  roundOrder: number;
  status: GameStatus;
  referenceMediaUrl: string | null;
  specMarkdown: string | null;
  // The exact locked prompt sent to every model for this game (Game.prompt).
  // Optional so hand-built fixtures keep compiling; the data layer always sets it.
  prompt?: string;
}

/** Everything the Arena page needs to render one match. */
export interface ArenaPairing {
  game: GameView;
  roundOf: number; // total number of games (for "Round X of N")
  a: ArenaBuild;
  b: ArenaBuild;
}

/** A node in the History timeline. */
export interface TimelineEntry {
  game: GameView;
  state: GameStatus;
}

export interface LeaderboardQuery {
  gameSlug?: string; // omit for overall
  tier?: CostTier;
}

export interface RecordVoteInput {
  gameId: string;
  genAId: string;
  genBId: string;
  winner: VoteWinner;
}

export interface RecordVoteResult {
  ok: boolean;
  error?: "unauthenticated" | "duplicate" | "invalid" | "rate_limited";
  // Identities revealed after a successful vote:
  reveal?: { a: ModelView; b: ModelView };
}

export interface SessionUser {
  id: string;
  handle: string | null;
  provider: string | null;
  voteCount: number;
}

// ---------------------------------------------------------------------------
// Playability screening (product pivot 2026-07-02 — docs/ux-overhaul.md §7).
// Signed-out visitors play only certified builds (the Arcade); signed-in users
// screen unvetted builds one at a time (the Test Lab).
// ---------------------------------------------------------------------------

/** A certified-playable build in the public Arcade. Identity is SHOWN here —
 *  arcade visitors don't vote, so there's nothing to bias. */
export interface ArcadeEntry {
  generationId: string;
  artifactPath: string;
  game: GameView;
  model: ModelView;
  playablePct: number; // 0–100
  votes: number;
  // Tokens the model spent writing this exact build (Generation.tokensOut) —
  // shown on the arcade thumbnail's coin gate next to the param count.
  tokensOut: number;
}

/** One build in the signed-in testing queue — model hidden until the vote. */
export interface TestCandidate {
  generationId: string;
  artifactPath: string;
  game: GameView;
  votes: number; // playability votes cast so far (by anyone)
}

export interface RecordPlayabilityInput {
  generationId: string;
  playable: boolean;
}

export interface RecordPlayabilityResult {
  ok: boolean;
  error?: "unauthenticated" | "duplicate" | "invalid" | "rate_limited";
  // Revealed after a successful playability vote:
  reveal?: {
    model: ModelView;
    playablePct: number; // including this vote
    votes: number;
    certified: boolean;
  };
}
