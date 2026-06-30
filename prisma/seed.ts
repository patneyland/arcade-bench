// Seed a compelling demo dataset for arcade-bench.
//
// Run with: npx tsx prisma/seed.ts  (or `npm run db:seed`).
//
// Idempotent: clears votes/ratings/generations and upserts models/games, so re-running
// reproduces a clean, deterministic dataset.
//
// PRICING (OpenRouter, researched 2026-06-29 — LIVE values from live web search):
//   gemini-flash-lite  $0.10 / $0.40  per 1M in/out
//   gpt-4-1-nano       $0.10 / $0.40
//   deepseek-v3        $0.20 / $0.80
//   qwen3-4b           $0.20 / $0.20
//   gemma-3-4b         $0.05 / $0.10
//   ministral-8b       $0.15 / $0.15
// costPerGen assumes ~800 input + ~4000 output tokens per generation:
//   costPerGen = (800 * in + 4000 * out) / 1e6   (dollars)

import { PrismaClient } from "@prisma/client";
import { LOCKED_PROMPT } from "../lib/constants";
import { recomputeAndStore } from "../lib/rating/recompute";

const prisma = new PrismaClient();

// --- deterministic PRNG so the seed is reproducible -------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260629);

const IN_TOKENS = 800;
const OUT_TOKENS = 4000;
function costPerGen(inPer1M: number, outPer1M: number): number {
  return (IN_TOKENS * inPer1M + OUT_TOKENS * outPer1M) / 1_000_000;
}

// --- model roster -----------------------------------------------------------
type CostTier = "featherweight" | "midweight" | "heavyweight";
interface ModelSeed {
  slug: string;
  name: string;
  vendor: string;
  paramSize: string | null;
  openrouterId: string;
  inPer1M: number;
  outPer1M: number;
  tier: CostTier;
}

const MODELS: ModelSeed[] = [
  {
    slug: "gemini-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    vendor: "Google",
    paramSize: null,
    openrouterId: "google/gemini-2.5-flash-lite",
    inPer1M: 0.1,
    outPer1M: 0.4,
    tier: "midweight",
  },
  {
    slug: "gpt-4-1-nano",
    name: "GPT-4.1 nano",
    vendor: "OpenAI",
    paramSize: null,
    openrouterId: "openai/gpt-4.1-nano",
    inPer1M: 0.1,
    outPer1M: 0.4,
    tier: "midweight",
  },
  {
    slug: "deepseek-v3",
    name: "DeepSeek V3",
    vendor: "DeepSeek",
    paramSize: "671B",
    openrouterId: "deepseek/deepseek-chat",
    inPer1M: 0.2,
    outPer1M: 0.8,
    tier: "heavyweight",
  },
  {
    slug: "qwen3-4b",
    name: "Qwen3 4B",
    vendor: "Alibaba",
    paramSize: "4B",
    openrouterId: "qwen/qwen3-4b",
    inPer1M: 0.2,
    outPer1M: 0.2,
    tier: "featherweight",
  },
  {
    slug: "gemma-3-4b",
    name: "Gemma 3 4B",
    vendor: "Google",
    paramSize: "4B",
    openrouterId: "google/gemma-3-4b-it",
    inPer1M: 0.05,
    outPer1M: 0.1,
    tier: "featherweight",
  },
  {
    slug: "ministral-8b",
    name: "Ministral 8B",
    vendor: "Mistral",
    paramSize: "8B",
    openrouterId: "mistralai/ministral-8b",
    inPer1M: 0.15,
    outPer1M: 0.15,
    tier: "featherweight",
  },
];

// --- game roster ------------------------------------------------------------
interface GameSeed {
  slug: string;
  title: string;
  year: number;
  creator: string;
  roundOrder: number;
  status: "live" | "now" | "upcoming";
}

const GAMES: GameSeed[] = [
  { slug: "pong", title: "Pong", year: 1972, creator: "Atari", roundOrder: 1, status: "live" },
  { slug: "snake", title: "Snake", year: 1976, creator: "Gremlin", roundOrder: 2, status: "live" },
  { slug: "breakout", title: "Breakout", year: 1976, creator: "Atari", roundOrder: 3, status: "now" },
  { slug: "space-invaders", title: "Space Invaders", year: 1978, creator: "Taito", roundOrder: 4, status: "upcoming" },
  { slug: "asteroids", title: "Asteroids", year: 1979, creator: "Atari", roundOrder: 5, status: "upcoming" },
];

// --- generations (which model built which game) -----------------------------
// EXACT artifact paths required by the artifacts agent.
const GENERATIONS: Record<string, string[]> = {
  pong: ["gemini-flash-lite", "gpt-4-1-nano", "qwen3-4b", "gemma-3-4b"],
  snake: ["gemini-flash-lite", "deepseek-v3", "ministral-8b"],
  breakout: ["deepseek-v3", "gpt-4-1-nano", "gemma-3-4b"],
};

// --- latent quality order (best -> worst) for synthesizing realistic votes --
const QUALITY: Record<string, number> = {
  "gemini-flash-lite": 6,
  "deepseek-v3": 5,
  "gpt-4-1-nano": 4,
  "ministral-8b": 3,
  "qwen3-4b": 2,
  "gemma-3-4b": 1,
};

const DEV_USERS = [
  "patrick",
  "ada",
  "grace",
  "linus",
  "margaret",
  "dennis",
  "alan",
  "katherine",
  "tim",
  "radia",
];

type Winner = "a" | "b" | "tie" | "both_bad";

async function main() {
  console.log("Seeding arcade-bench…");

  // 1) Clear vote-derived + generation data (idempotent re-seed). Order respects FKs.
  await prisma.vote.deleteMany({});
  await prisma.rating.deleteMany({});
  await prisma.generation.deleteMany({});

  // 2) Upsert models.
  for (const m of MODELS) {
    const cpg = costPerGen(m.inPer1M, m.outPer1M);
    await prisma.model.upsert({
      where: { slug: m.slug },
      update: {
        name: m.name,
        vendor: m.vendor,
        paramSize: m.paramSize,
        openrouterId: m.openrouterId,
        costPerGen: cpg,
        costPer1MInput: m.inPer1M,
        costPer1MOutput: m.outPer1M,
        tier: m.tier,
        active: true,
      },
      create: {
        slug: m.slug,
        name: m.name,
        vendor: m.vendor,
        paramSize: m.paramSize,
        openrouterId: m.openrouterId,
        costPerGen: cpg,
        costPer1MInput: m.inPer1M,
        costPer1MOutput: m.outPer1M,
        tier: m.tier,
        active: true,
      },
    });
  }

  // 3) Upsert games (locked prompt from constants).
  for (const g of GAMES) {
    await prisma.game.upsert({
      where: { slug: g.slug },
      update: {
        title: g.title,
        year: g.year,
        creator: g.creator,
        prompt: LOCKED_PROMPT(g.title),
        roundOrder: g.roundOrder,
        status: g.status,
      },
      create: {
        slug: g.slug,
        title: g.title,
        year: g.year,
        creator: g.creator,
        prompt: LOCKED_PROMPT(g.title),
        roundOrder: g.roundOrder,
        status: g.status,
      },
    });
  }

  // 4) Create generations. Map (gameSlug, modelSlug) -> generation id.
  const models = await prisma.model.findMany();
  const games = await prisma.game.findMany();
  const modelBySlug = new Map(models.map((m) => [m.slug, m]));
  const gameBySlug = new Map(games.map((g) => [g.slug, g]));

  // genId[gameSlug][modelSlug] = generation id
  const genId: Record<string, Record<string, string>> = {};

  for (const [gameSlug, modelSlugs] of Object.entries(GENERATIONS)) {
    const game = gameBySlug.get(gameSlug)!;
    genId[gameSlug] = {};
    for (const modelSlug of modelSlugs) {
      const model = modelBySlug.get(modelSlug)!;
      const cpg = model.costPerGen;
      // Realistic-ish token jitter around the assumed budget.
      const tokensIn = IN_TOKENS + Math.floor(rand() * 200 - 100);
      const tokensOut = OUT_TOKENS + Math.floor(rand() * 1200 - 600);
      const gen = await prisma.generation.create({
        data: {
          modelId: model.id,
          gameId: game.id,
          sampleIndex: 0,
          artifactPath: `/artifacts/${gameSlug}/${modelSlug}.html`,
          cost: Number(cpg.toFixed(6)),
          tokensIn,
          tokensOut,
          status: "ok", // all rendered (one rough build still counts as ok)
          published: true,
        },
      });
      genId[gameSlug][modelSlug] = gen.id;
    }
  }

  // 5) Create dev users.
  const users = [];
  for (const handle of DEV_USERS) {
    const user = await prisma.user.upsert({
      where: { authId: `dev_seed_${handle}` },
      update: { handle, provider: "dev" },
      create: { authId: `dev_seed_${handle}`, provider: "dev", handle },
    });
    users.push(user);
  }

  // 6) Synthesize ~120+ pairwise votes consistent with the latent quality order.
  //    For each game, repeatedly pick two distinct models, simulate a winner from their
  //    quality gap (logistic), inject ties + a few both_bad, and respect the unique
  //    (user, genA, genB) constraint by tracking which pairings each user has voted on.
  const voted = new Set<string>(); // `${userId}:${genAId}:${genBId}`
  let voteCount = 0;
  const VOTES_PER_GAME = 50; // across 3 games -> ~150 votes, comfortably over 120

  for (const [gameSlug, modelSlugs] of Object.entries(GENERATIONS)) {
    if (modelSlugs.length < 2) continue;
    const game = gameBySlug.get(gameSlug)!;

    let made = 0;
    let attempts = 0;
    const maxAttempts = VOTES_PER_GAME * 12;

    while (made < VOTES_PER_GAME && attempts < maxAttempts) {
      attempts++;
      // Pick two distinct models in this game.
      const i = Math.floor(rand() * modelSlugs.length);
      let j = Math.floor(rand() * (modelSlugs.length - 1));
      if (j >= i) j += 1;
      const slugA = modelSlugs[i];
      const slugB = modelSlugs[j];
      const genAId = genId[gameSlug][slugA];
      const genBId = genId[gameSlug][slugB];

      const user = users[Math.floor(rand() * users.length)];
      // The unique key is the ORDERED (user, genA, genB); the arena randomizes which
      // build is shown on side A, so (A,B) and (B,A) are distinct presentations a user
      // can each vote on once. We only dedupe identical ordered pairings.
      const key = `${user.id}:${genAId}:${genBId}`;
      if (voted.has(key)) continue;

      const winner = simulateWinner(slugA, slugB, rand);
      await prisma.vote.create({
        data: {
          userId: user.id,
          gameId: game.id,
          genAId,
          genBId,
          winner,
        },
      });
      voted.add(key);
      made++;
      voteCount++;
    }
    console.log(`  ${gameSlug}: ${made} votes`);
  }

  console.log(`Total votes: ${voteCount}`);

  // 7) Compute + persist ratings so the leaderboard has a sensible spread.
  const { overallRows, perGameRows } = await recomputeAndStore();
  console.log(`Ratings stored: ${overallRows} overall, ${perGameRows} per-game.`);

  // 8) Report the leaderboard so the seed self-verifies.
  const board = await prisma.rating.findMany({
    where: { gameId: null },
    orderBy: { rating: "desc" },
    include: { model: true },
  });
  console.log("\nOverall leaderboard:");
  for (const [idx, r] of board.entries()) {
    const cents = r.model.costPerGen * 100;
    const rpc = cents > 0 ? (r.rating / cents).toFixed(0) : "—";
    console.log(
      `  ${idx + 1}. ${r.model.name.padEnd(22)} ` +
        `${r.rating.toFixed(0)} ±${r.interval.toFixed(0)}  ` +
        `n=${String(r.nVotes).padStart(3)}  $${r.model.costPerGen.toFixed(5)}/gen  rating/¢=${rpc}`,
    );
  }
}

/** Simulate a pairwise winner from the two models' latent quality. */
function simulateWinner(
  slugA: string,
  slugB: string,
  r: () => number,
): Winner {
  // ~4% both_bad, ~10% tie; otherwise a quality-weighted win.
  const roll = r();
  if (roll < 0.04) return "both_bad";
  if (roll < 0.14) return "tie";

  const qa = QUALITY[slugA] ?? 0;
  const qb = QUALITY[slugB] ?? 0;
  // Logistic on the quality gap (scaled), with noise from the uniform draw.
  const pA = 1 / (1 + Math.exp(-(qa - qb) * 0.9));
  return r() < pA ? "a" : "b";
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
