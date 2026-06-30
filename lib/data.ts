// Data-access layer — the single boundary the frontend reads through.
//
// CONTRACT: these function signatures are stable (see lib/types.ts). The frontend reads
// through them in server components; the API routes call recordVote. Implemented against
// Prisma (SQLite in dev, Postgres/Supabase in prod — same schema).

import { prisma } from "./db";
import { getSessionUser } from "./auth";
import { rateLimit } from "./rate-limit";
import { recomputeAndStore } from "./rating/recompute";
import { VENDOR_COLORS, VOTE_WINNERS } from "./constants";
import type { CostTier, GameStatus, GenerationStatus } from "./constants";
import type {
  ArenaBuild,
  ArenaPairing,
  GameView,
  LeaderboardQuery,
  LeaderboardRow,
  ModelView,
  RecordVoteInput,
  RecordVoteResult,
  TimelineEntry,
} from "./types";

// ---------------------------------------------------------------------------
// Rate limit config for votes (per design / PLAN: a light limit).
// ---------------------------------------------------------------------------
const VOTE_RATE_LIMIT = { limit: 30, windowMs: 60_000 }; // ~30 votes / min / user

// ---------------------------------------------------------------------------
// Mappers — Prisma row -> view model.
// ---------------------------------------------------------------------------
type ModelRow = {
  id: string;
  slug: string;
  name: string;
  vendor: string;
  paramSize: string | null;
  costPerGen: number;
  tier: string | null;
};

function toModelView(m: ModelRow): ModelView {
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    vendor: m.vendor,
    paramSize: m.paramSize,
    costPerGen: m.costPerGen,
    tier: (m.tier as CostTier | null) ?? null,
  };
}

type GameRow = {
  id: string;
  slug: string;
  title: string;
  year: number;
  creator: string;
  roundOrder: number;
  status: string;
  referenceMediaUrl: string | null;
  specMarkdown: string | null;
};

function toGameView(g: GameRow): GameView {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    year: g.year,
    creator: g.creator,
    roundOrder: g.roundOrder,
    status: g.status as GameStatus,
    referenceMediaUrl: g.referenceMediaUrl,
    specMarkdown: g.specMarkdown,
  };
}

const GAME_SELECT = {
  id: true,
  slug: true,
  title: true,
  year: true,
  creator: true,
  roundOrder: true,
  status: true,
  referenceMediaUrl: true,
  specMarkdown: true,
} as const;

const MODEL_SELECT = {
  id: true,
  slug: true,
  name: true,
  vendor: true,
  paramSize: true,
  costPerGen: true,
  tier: true,
} as const;

/** Vendor badge color helper (exposed for the frontend if needed). */
export function vendorColor(vendor: string): string {
  return VENDOR_COLORS[vendor] ?? "#1B1A22";
}

// ---------------------------------------------------------------------------
// Arena pairing
// ---------------------------------------------------------------------------

/**
 * Pick a pairing for the arena: two DISTINCT published builds of the same game, with
 * model identities OMITTED from the returned ArenaBuild (hidden until the vote).
 *
 * Game choice: the requested slug if given, else the game with status "now", else the
 * first "live" game by round order, else the first game overall.
 */
export async function getArenaPairing(
  gameSlug?: string,
): Promise<ArenaPairing | null> {
  const totalGames = await prisma.game.count();
  if (totalGames === 0) return null;

  // Resolve the game.
  let game: GameRow | null = null;
  if (gameSlug) {
    game = await prisma.game.findUnique({
      where: { slug: gameSlug },
      select: GAME_SELECT,
    });
  }
  if (!game) {
    game =
      (await prisma.game.findFirst({
        where: { status: "now" },
        orderBy: { roundOrder: "asc" },
        select: GAME_SELECT,
      })) ??
      (await prisma.game.findFirst({
        where: { status: "live" },
        orderBy: { roundOrder: "asc" },
        select: GAME_SELECT,
      })) ??
      (await prisma.game.findFirst({
        orderBy: { roundOrder: "asc" },
        select: GAME_SELECT,
      }));
  }
  if (!game) return null;

  // Published generations of that game.
  const gens = await prisma.generation.findMany({
    where: { gameId: game.id, published: true },
    select: { id: true, artifactPath: true, status: true },
  });
  if (gens.length < 2) return null;

  // Pick two distinct at random.
  const [first, second] = pickTwo(gens.length);
  const ga = gens[first];
  const gb = gens[second];

  const a: ArenaBuild = {
    generationId: ga.id,
    artifactPath: ga.artifactPath,
    status: ga.status as GenerationStatus,
    // model intentionally omitted — revealed only after a successful vote.
  };
  const b: ArenaBuild = {
    generationId: gb.id,
    artifactPath: gb.artifactPath,
    status: gb.status as GenerationStatus,
  };

  return { game: toGameView(game), roundOf: totalGames, a, b };
}

/** Two distinct random indices in [0, n). */
function pickTwo(n: number): [number, number] {
  const i = Math.floor(Math.random() * n);
  let j = Math.floor(Math.random() * (n - 1));
  if (j >= i) j += 1;
  return [i, j];
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/**
 * Leaderboard rows, ranked by rating desc. Reads Rating rows (overall = gameId null,
 * or per game when gameSlug given), joins Model, computes the rating-per-cent efficiency
 * number, assigns rank, and filters by tier if provided.
 */
export async function getLeaderboard(
  query: LeaderboardQuery = {},
): Promise<LeaderboardRow[]> {
  let gameId: string | null = null;
  if (query.gameSlug) {
    const g = await prisma.game.findUnique({
      where: { slug: query.gameSlug },
      select: { id: true },
    });
    if (!g) return [];
    gameId = g.id;
  }

  const ratings = await prisma.rating.findMany({
    where: { gameId },
    orderBy: { rating: "desc" },
    select: {
      rating: true,
      interval: true,
      nVotes: true,
      model: { select: MODEL_SELECT },
    },
  });

  const rows: LeaderboardRow[] = [];
  for (const r of ratings) {
    const model = toModelView(r.model);
    if (query.tier && model.tier !== query.tier) continue;

    // ratingPerCent: rating per cent of cost. costPerGen is in dollars; *100 -> cents.
    const cents = model.costPerGen * 100;
    const ratingPerCent = cents > 0 ? r.rating / cents : null;

    rows.push({
      rank: 0, // assigned after filtering so ranks are contiguous
      model,
      rating: r.rating,
      interval: r.interval,
      nVotes: r.nVotes,
      ratingPerCent,
    });
  }

  rows.forEach((row, i) => {
    row.rank = i + 1;
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Games / history
// ---------------------------------------------------------------------------

/** All games by round order, with their status, for the History timeline. */
export async function getHistoryTimeline(): Promise<TimelineEntry[]> {
  const games = await prisma.game.findMany({
    orderBy: { roundOrder: "asc" },
    select: GAME_SELECT,
  });
  return games.map((g) => {
    const view = toGameView(g);
    return { game: view, state: view.status };
  });
}

/** All games (for Play/Browse and nav). */
export async function getGames(): Promise<GameView[]> {
  const games = await prisma.game.findMany({
    orderBy: { roundOrder: "asc" },
    select: GAME_SELECT,
  });
  return games.map(toGameView);
}

// ---------------------------------------------------------------------------
// Vote recording (full server-side enforcement)
// ---------------------------------------------------------------------------

/**
 * Record a vote with full enforcement:
 *  - requires a grader session (else "unauthenticated")
 *  - validates winner and that both generations belong to the game (else "invalid")
 *  - enforces one-vote-per-pairing via the unique constraint (else "duplicate")
 *  - applies a light per-user rate limit (else "rate_limited")
 * On success: creates the Vote, triggers recomputeAndStore(), and reveals the two
 * model identities.
 */
export async function recordVote(
  input: RecordVoteInput,
): Promise<RecordVoteResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // Validate winner.
  if (!VOTE_WINNERS.includes(input.winner)) {
    return { ok: false, error: "invalid" };
  }
  // Distinct generations.
  if (!input.genAId || !input.genBId || input.genAId === input.genBId) {
    return { ok: false, error: "invalid" };
  }

  // Both generations must exist, be published, and belong to the named game.
  const gens = await prisma.generation.findMany({
    where: { id: { in: [input.genAId, input.genBId] } },
    select: { id: true, gameId: true, published: true, model: { select: MODEL_SELECT } },
  });
  if (gens.length !== 2) return { ok: false, error: "invalid" };
  const genA = gens.find((g) => g.id === input.genAId);
  const genB = gens.find((g) => g.id === input.genBId);
  if (!genA || !genB) return { ok: false, error: "invalid" };
  if (
    genA.gameId !== input.gameId ||
    genB.gameId !== input.gameId ||
    !genA.published ||
    !genB.published
  ) {
    return { ok: false, error: "invalid" };
  }

  // Light rate limit (per user).
  if (!rateLimit(`vote:${user.id}`, VOTE_RATE_LIMIT)) {
    return { ok: false, error: "rate_limited" };
  }

  // Create the vote; the unique (userId, genAId, genBId) constraint enforces dedup.
  try {
    await prisma.vote.create({
      data: {
        userId: user.id,
        gameId: input.gameId,
        genAId: input.genAId,
        genBId: input.genBId,
        winner: input.winner,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { ok: false, error: "duplicate" };
    }
    throw err;
  }

  // Recompute ratings on write (await so the leaderboard is fresh on next read).
  await recomputeAndStore();

  return {
    ok: true,
    reveal: {
      a: toModelView(genA.model),
      b: toModelView(genB.model),
    },
  };
}

/** Prisma P2002 = unique constraint violation. */
function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
