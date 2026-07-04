// Rating engine entry point — pure, no DB imports.
//
// `computeRatings` is the single function the recompute layer calls. It takes a list of
// votes (each referencing two generations and a winner) plus the model + generation maps
// needed to translate a generation -> its model, and returns per-model ratings overall
// and per game. Bradley-Terry is the primary method (Elo is exported as the simpler
// fallback from ./elo).

import { computeBradleyTerry } from "./bradley-terry";
import type { PairOutcome } from "./elo";
import type { VoteWinner } from "../constants";

export { computeElo } from "./elo";
export type { PairOutcome, EloResult } from "./elo";
export { computeBradleyTerry } from "./bradley-terry";
export type { BradleyTerryResult } from "./bradley-terry";

/** A vote, reduced to what the rating math needs. */
export interface RatingVote {
  gameId: string;
  /** model id on side A (generation A's model) */
  modelA: string;
  /** model id on side B (generation B's model) */
  modelB: string;
  winner: VoteWinner;
}

/** Per-model rating output. */
export interface ModelRating {
  modelId: string;
  rating: number;
  interval: number;
  nVotes: number;
}

export interface ComputeRatingsResult {
  /** Overall ratings across every game. */
  overall: ModelRating[];
  /** Per-game ratings, keyed by gameId. */
  perGame: Record<string, ModelRating[]>;
}

function toOutcomes(votes: RatingVote[]): PairOutcome[] {
  return votes
    .filter((v) => v.modelA !== v.modelB) // a self-pairing carries no signal
    .map((v) => ({ a: v.modelA, b: v.modelB, winner: v.winner }));
}

function fit(votes: RatingVote[], models: string[]): ModelRating[] {
  const bt = computeBradleyTerry(toOutcomes(votes), models);
  return models
    .map((id) => {
      const r = bt.models[id];
      return {
        modelId: id,
        rating: r ? r.rating : 1000,
        interval: r ? r.interval : 400,
        nVotes: r ? r.nVotes : 0,
      };
    })
    .sort((x, y) => y.rating - x.rating);
}

/**
 * Compute overall + per-game ratings.
 *
 * @param votes  all votes (both_bad still passed through; the BT layer ignores it for
 *               fitting but it is counted in nVotes by the recompute layer if desired).
 * @param models the full set of model ids to score (so thin/zero-vote models still appear).
 */
export function computeRatings(
  votes: RatingVote[],
  models: string[],
): ComputeRatingsResult {
  const overall = fit(votes, models);

  // Group votes by game; only score models that actually appear in that game.
  const byGame = new Map<string, RatingVote[]>();
  for (const v of votes) {
    const list = byGame.get(v.gameId);
    if (list) list.push(v);
    else byGame.set(v.gameId, [v]);
  }

  const perGame: Record<string, ModelRating[]> = {};
  for (const [gameId, gameVotes] of byGame) {
    const gameModels = new Set<string>();
    for (const v of gameVotes) {
      gameModels.add(v.modelA);
      gameModels.add(v.modelB);
    }
    perGame[gameId] = fit(gameVotes, [...gameModels]);
  }

  return { overall, perGame };
}
