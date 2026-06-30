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
