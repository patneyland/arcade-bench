// Bradley-Terry MLE — the primary rating method (per design.md / PLAN.md).
//
// Pure functions, no DB imports. Given pairwise outcomes between models, we fit a
// latent strength per model by maximizing the Bradley-Terry log-likelihood with the
// classic minorization-maximization (MM) iteration (Hunter 2004). The fitted strengths
// are mapped onto a ~1000-centered display scale (same logistic 400-scale as Elo so the
// two methods are comparable), and each model gets an approximate confidence half-width
// that shrinks ~1/sqrt(n) with its comparison count.
//
// Outcome handling:
//   - "a" / "b": a full win to that side.
//   - "tie": counts as a half-win to BOTH sides.
//   - "both_bad": ignored for fitting (no quality signal).

import { DEFAULT_RATING } from "../constants";
import type { VoteWinner } from "../constants";
import type { PairOutcome } from "./elo";

export type { PairOutcome };

export interface BradleyTerryOptions {
  /** Max MM iterations. */
  maxIterations?: number;
  /** Convergence tolerance on the max relative change of strengths. */
  tolerance?: number;
  /** Display scale center (defaults to DEFAULT_RATING = 1000). */
  center?: number;
  /** Logistic scale factor (400 matches Elo). */
  scale?: number;
  /** Base half-width (at one comparison) for the confidence interval, in rating points. */
  intervalBase?: number;
}

export interface BradleyTerryModelResult {
  rating: number; // display rating, ~center-anchored
  interval: number; // +/- confidence half-width (points)
  nVotes: number; // rating-affecting comparisons this model took part in
  strength: number; // raw BT strength (normalized so geometric mean ~ 1)
}

export interface BradleyTerryResult {
  /** modelId -> result */
  models: Record<string, BradleyTerryModelResult>;
}

interface Aggregate {
  // wins[i][j] = total "win weight" of i over j (ties contribute 0.5 each way)
  wins: Map<string, Map<string, number>>;
  // total comparisons each model participated in (rating-affecting only)
  counts: Map<string, number>;
  ids: Set<string>;
}

function add(map: Map<string, Map<string, number>>, i: string, j: string, w: number) {
  let row = map.get(i);
  if (!row) {
    row = new Map();
    map.set(i, row);
  }
  row.set(j, (row.get(j) ?? 0) + w);
}

/** Aggregate raw outcomes into pairwise win weights, ignoring both_bad. */
function aggregate(outcomes: PairOutcome[], models: string[]): Aggregate {
  const wins = new Map<string, Map<string, number>>();
  const counts = new Map<string, number>();
  const ids = new Set<string>(models);

  const bump = (id: string, n: number) => counts.set(id, (counts.get(id) ?? 0) + n);

  for (const o of outcomes) {
    if (o.winner === "both_bad") continue; // no signal
    ids.add(o.a);
    ids.add(o.b);
    bump(o.a, 1);
    bump(o.b, 1);

    if (o.winner === "a") {
      add(wins, o.a, o.b, 1);
    } else if (o.winner === "b") {
      add(wins, o.b, o.a, 1);
    } else if (o.winner === "tie") {
      add(wins, o.a, o.b, 0.5);
      add(wins, o.b, o.a, 0.5);
    }
  }

  for (const id of ids) if (!counts.has(id)) counts.set(id, 0);
  return { wins, counts, ids };
}

/**
 * Fit Bradley-Terry strengths via MM, then map to display ratings + intervals.
 *
 * `models` ensures every known model appears even with zero comparisons (it lands at
 * the center rating with a wide interval).
 */
export function computeBradleyTerry(
  outcomes: PairOutcome[],
  models: string[] = [],
  options: BradleyTerryOptions = {},
): BradleyTerryResult {
  const maxIterations = options.maxIterations ?? 500;
  const tolerance = options.tolerance ?? 1e-9;
  const center = options.center ?? DEFAULT_RATING;
  const scale = options.scale ?? 400;
  const intervalBase = options.intervalBase ?? 400;

  const { wins, counts, ids } = aggregate(outcomes, models);
  const idList = [...ids];
  const n = idList.length;

  // Result scaffold (handles trivial / empty cases gracefully).
  const result: BradleyTerryResult = { models: {} };
  if (n === 0) return result;

  // Smoothing: a tiny symmetric pseudo-count between every ordered pair keeps the MM
  // iteration well-defined for models that always win or always lose (otherwise their
  // strength diverges to 0 or infinity). It nudges strengths toward the center, which is
  // exactly the desired "thin data reads as thin" behavior.
  const ALPHA = 0.5;

  // total[i] = sum over j of (wins[i][j] + wins[j][i]) of game counts between i and j,
  // including smoothing. Precompute the comparison matrix.
  // pairTotal[i][j] = w_ij + w_ji + 2*ALPHA  (total decisive weight between i and j)
  const winOf = (i: string, j: string) => wins.get(i)?.get(j) ?? 0;

  // Build the set of opponents each model actually faced (plus smoothing applies to all).
  // For efficiency with a small roster we just iterate all pairs.
  let strength: Record<string, number> = {};
  for (const id of idList) strength[id] = 1;

  const winsTotal: Record<string, number> = {};
  for (const i of idList) {
    let w = 0;
    for (const j of idList) {
      if (i === j) continue;
      w += winOf(i, j) + ALPHA; // smoothing pseudo-win
    }
    winsTotal[i] = w;
  }

  // MM iteration: p_i <- W_i / sum_{j != i} (n_ij / (p_i + p_j))
  // where W_i is total wins of i, n_ij total games between i and j.
  for (let iter = 0; iter < maxIterations; iter++) {
    const next: Record<string, number> = {};
    let maxRel = 0;

    for (const i of idList) {
      let denom = 0;
      for (const j of idList) {
        if (i === j) continue;
        const nij = winOf(i, j) + winOf(j, i) + 2 * ALPHA;
        denom += nij / (strength[i] + strength[j]);
      }
      const updated = denom > 0 ? winsTotal[i] / denom : strength[i];
      next[i] = updated;
    }

    // Normalize to geometric mean 1 for identifiability/stability.
    let logSum = 0;
    for (const i of idList) logSum += Math.log(next[i]);
    const geoMean = Math.exp(logSum / n);
    for (const i of idList) next[i] /= geoMean;

    for (const i of idList) {
      const rel = Math.abs(next[i] - strength[i]) / (strength[i] || 1);
      if (rel > maxRel) maxRel = rel;
    }
    strength = next;
    if (maxRel < tolerance) break;
  }

  // Map strength -> display rating. BT win prob between i,j is p_i/(p_i+p_j), which
  // equals the logistic of (theta_i - theta_j) where theta = ln(p). Using a 400-scale
  // logistic (theta * scale / ln(10)) puts ratings on the same footing as Elo.
  const thetas: Record<string, number> = {};
  for (const i of idList) thetas[i] = Math.log(strength[i]);
  // Center thetas at 0 (geo-mean normalization already does this up to float error).
  let meanTheta = 0;
  for (const i of idList) meanTheta += thetas[i];
  meanTheta /= n;

  const k = scale / Math.LN10;
  for (const i of idList) {
    const rating = center + (thetas[i] - meanTheta) * k;
    const nv = counts.get(i) ?? 0;
    // Interval shrinks ~1/sqrt(n); +1 keeps a zero-vote model finite (but wide).
    const interval = intervalBase / Math.sqrt(nv + 1);
    result.models[i] = {
      rating,
      interval,
      nVotes: nv,
      strength: strength[i],
    };
  }

  return result;
}
