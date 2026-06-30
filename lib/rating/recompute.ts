// Recompute + persist ratings. This is the "scheduled / on-write recompute" from PLAN.
//
// Reads votes + models + generations from Prisma, computes overall and per-game ratings
// with the pure engine in ./index, and upserts Rating rows (overall = gameId null, plus
// one row per (model, game)). Called after each successful vote (lib/data.recordVote)
// and runnable as a standalone job.
//
// nVotes shown on the leaderboard counts EVERY recorded vote a model took part in,
// including `tie` and `both_bad` — even though both_bad carries no rating signal. So a
// model's displayed nVotes can exceed the rating-affecting count used internally by the
// BT fit. (Thin data still reads as thin via the wide interval.)

import { prisma } from "../db";
import { computeRatings, type RatingVote } from "./index";

export interface RecomputeResult {
  overallRows: number;
  perGameRows: number;
}

/** Load all the data the engine needs, fit, and persist. */
export async function recomputeAndStore(): Promise<RecomputeResult> {
  const [models, generations, votes] = await Promise.all([
    prisma.model.findMany({ select: { id: true } }),
    prisma.generation.findMany({ select: { id: true, modelId: true } }),
    prisma.vote.findMany({
      select: { gameId: true, genAId: true, genBId: true, winner: true },
    }),
  ]);

  const modelIds = models.map((m) => m.id);
  const genToModel = new Map(generations.map((g) => [g.id, g.modelId]));

  // Translate votes (generation-level) into model-level rating votes.
  const ratingVotes: RatingVote[] = [];
  // Track displayed nVotes (every recorded vote, including both_bad/tie) per model,
  // overall and per game.
  const overallVoteCount = new Map<string, number>();
  const perGameVoteCount = new Map<string, Map<string, number>>();

  const bumpOverall = (modelId: string) =>
    overallVoteCount.set(modelId, (overallVoteCount.get(modelId) ?? 0) + 1);
  const bumpGame = (gameId: string, modelId: string) => {
    let m = perGameVoteCount.get(gameId);
    if (!m) {
      m = new Map();
      perGameVoteCount.set(gameId, m);
    }
    m.set(modelId, (m.get(modelId) ?? 0) + 1);
  };

  for (const v of votes) {
    const modelA = genToModel.get(v.genAId);
    const modelB = genToModel.get(v.genBId);
    if (!modelA || !modelB) continue; // orphaned generation reference

    ratingVotes.push({
      gameId: v.gameId,
      modelA,
      modelB,
      winner: v.winner as RatingVote["winner"],
    });

    // Displayed counts: every vote counts for both sides.
    bumpOverall(modelA);
    bumpOverall(modelB);
    bumpGame(v.gameId, modelA);
    bumpGame(v.gameId, modelB);
  }

  const { overall, perGame } = computeRatings(ratingVotes, modelIds);

  // Build the full upsert set. Overall rows have gameId = null.
  type Row = {
    modelId: string;
    gameId: string | null;
    rating: number;
    interval: number;
    nVotes: number;
  };
  const rows: Row[] = [];

  for (const r of overall) {
    rows.push({
      modelId: r.modelId,
      gameId: null,
      rating: r.rating,
      interval: r.interval,
      nVotes: overallVoteCount.get(r.modelId) ?? 0,
    });
  }

  let perGameRows = 0;
  for (const [gameId, ratings] of Object.entries(perGame)) {
    const counts = perGameVoteCount.get(gameId);
    for (const r of ratings) {
      rows.push({
        modelId: r.modelId,
        gameId,
        rating: r.rating,
        interval: r.interval,
        nVotes: counts?.get(r.modelId) ?? 0,
      });
      perGameRows++;
    }
  }

  // Replace the whole Rating table in one transaction. A full delete + recreate is the
  // simplest correct "recompute" and sidesteps Prisma's awkward upsert semantics for a
  // compound unique key whose `gameId` half is nullable (NULL never matches in SQLite).
  // The recompute is authoritative over every Rating row, so clearing first is safe.
  await prisma.$transaction([
    prisma.rating.deleteMany({}),
    prisma.rating.createMany({
      data: rows.map((row) => ({
        modelId: row.modelId,
        gameId: row.gameId,
        rating: row.rating,
        interval: row.interval,
        nVotes: row.nVotes,
        updatedAt: new Date(),
      })),
    }),
  ]);

  return { overallRows: overall.length, perGameRows };
}
