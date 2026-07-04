// Classic Elo rating — the simpler fallback method (per design.md / PLAN.md).
//
// Pure functions, no DB imports. A pairwise outcome between two models updates both
// ratings symmetrically. `both_bad` carries no rating signal (it is skipped here),
// but the caller still counts it as a recorded vote elsewhere.

import { DEFAULT_RATING } from "../constants";
import type { VoteWinner } from "../constants";

export const DEFAULT_K = 24;

/** One pairwise comparison between two model ids. */
export interface PairOutcome {
  a: string; // model id on side A
  b: string; // model id on side B
  winner: VoteWinner; // "a" | "b" | "tie" | "both_bad"
}

export interface EloOptions {
  k?: number;
  initialRating?: number;
}

export interface EloResult {
  /** modelId -> rating */
  ratings: Record<string, number>;
  /** modelId -> number of rating-affecting comparisons (excludes both_bad) */
  counts: Record<string, number>;
}

/** Expected score for A given the two ratings (logistic, 400-scale). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Map a winner to A's actual score in [0,1]. Returns null for no-signal outcomes. */
function actualScoreForA(winner: VoteWinner): number | null {
  switch (winner) {
    case "a":
      return 1;
    case "b":
      return 0;
    case "tie":
      return 0.5; // half-point draw to both
    case "both_bad":
      return null; // no rating signal
    default:
      return null;
  }
}

/**
 * Run sequential Elo updates over a list of pairwise outcomes.
 * `models` seeds every known model at the initial rating (so a model with zero
 * rating-affecting votes still appears, at the default rating).
 */
export function computeElo(
  outcomes: PairOutcome[],
  models: string[] = [],
  options: EloOptions = {},
): EloResult {
  const k = options.k ?? DEFAULT_K;
  const initial = options.initialRating ?? DEFAULT_RATING;

  const ratings: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const ensure = (id: string) => {
    if (ratings[id] === undefined) {
      ratings[id] = initial;
      counts[id] = 0;
    }
  };

  for (const id of models) ensure(id);

  for (const o of outcomes) {
    ensure(o.a);
    ensure(o.b);
    const scoreA = actualScoreForA(o.winner);
    if (scoreA === null) continue; // both_bad: skip for rating

    const expA = expectedScore(ratings[o.a], ratings[o.b]);
    const expB = 1 - expA;
    const scoreB = 1 - scoreA;

    ratings[o.a] += k * (scoreA - expA);
    ratings[o.b] += k * (scoreB - expB);
    counts[o.a] += 1;
    counts[o.b] += 1;
  }

  return { ratings, counts };
}
