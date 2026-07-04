// Seed the arcade-bench dataset.
//
// Run with: npx tsx prisma/seed.ts  (or `npm run db:seed`).
//
// REAL vs SYNTHESIZED:
//   - Models + pricing: real (live OpenRouter research, 2026-06-29).
//   - Generations (artifact paths, cost, tokens, status): REAL when a harness run has
//     produced harness/out/manifest.json — that file is ingested here, so a model that
//     emitted broken or no HTML is recorded honestly and competes/loses per the PRD.
//     Falls back to placeholder metadata when no manifest exists (e.g. a fresh clone).
//   - Votes: SYNTHESIZED. Pairwise votes need human graders (that is the whole point of
//     the arena), so until real votes arrive the seed simulates a plausible spread from a
//     latent quality prior (down-weighting broken builds) purely so the leaderboard and
//     rating engine have data to display.
//
// Idempotent: clears votes/ratings/generations and upserts models/games.

import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CERTIFIED_PLAYABLE_PCT, LOCKED_PROMPT } from "../lib/constants";
import { recomputeAndStore } from "../lib/rating/recompute";
import { GAMES, IN_TOKENS, MODELS, OUT_TOKENS, costPerGen } from "./roster";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, "..", "harness", "out", "manifest.json");

// --- deterministic PRNG so the synthesized votes are reproducible -----------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260630);

// Model + game roster: shared with scripts/sync-roster.ts via ./roster (single
// source of truth; costPerGen/IN_TOKENS/OUT_TOKENS live there too).

// --- FALLBACK generations (used only when no harness manifest is present) ----
const FALLBACK_GENERATIONS: Record<string, string[]> = {
  pong: ["gemini-flash-lite", "gpt-4-1-nano", "qwen3-8b", "gemma-3-4b"],
  snake: ["gemini-flash-lite", "deepseek-v3", "ministral-8b"],
  breakout: ["deepseek-v3", "gpt-4-1-nano", "gemma-3-4b"],
};

// --- latent quality prior (best -> worst) for synthesizing realistic votes ---
const QUALITY: Record<string, number> = {
  "gemini-flash-lite": 6,
  "deepseek-v3": 5,
  "gpt-4-1-nano": 4,
  "ministral-8b": 3,
  "qwen3-8b": 2,
  "gemma-3-4b": 1,
};

const DEV_USERS = ["patrick", "ada", "grace", "linus", "margaret", "dennis", "alan", "katherine", "tim", "radia"];

// --- playability screening seed (docs/ux-overhaul.md §7) ---------------------
// SYNTHESIZED tester verdicts so the dev Arcade isn't empty and the Test Lab
// queue has a realistic mix: certified builds, reported-unplayable builds
// (including the two KNOWN-BROKEN artifacts: breakout/gemma-3-4b renders a
// blank page, snake/qwen3-8b draws black-on-black), and unscreened builds
// (zero votes) left for testers. Keyed "gameSlug/modelSlug"; votes are cast by
// distinct dev users (unique (userId, generationId)).
const PLAYABILITY_SEED: Record<string, { playable: number; unplayable: number }> = {
  // Certified (playable% ≥ 85):
  "pong/gemini-flash-lite": { playable: 5, unplayable: 0 }, // 100%
  "pong/gpt-4-1-nano": { playable: 4, unplayable: 0 }, // 100%
  "pong/deepseek-v3": { playable: 6, unplayable: 1 }, // 85.7% — just clears the bar
  "snake/gemini-flash-lite": { playable: 4, unplayable: 0 }, // 100%
  "snake/gpt-4-1-nano": { playable: 3, unplayable: 0 }, // 100%
  "breakout/gpt-4-1-nano": { playable: 4, unplayable: 0 }, // 100%
  "breakout/qwen3-8b": { playable: 3, unplayable: 0 }, // 100%
  // Reported unplayable (below the bar — visible on the leaderboard, not in the Arcade):
  "breakout/gemma-3-4b": { playable: 0, unplayable: 3 }, // KNOWN-BROKEN: blank page
  "snake/qwen3-8b": { playable: 0, unplayable: 4 }, // KNOWN-BROKEN: black-on-black
  "pong/gemma-3-4b": { playable: 0, unplayable: 2 }, // harness status "broken"
  "snake/deepseek-v3": { playable: 3, unplayable: 1 }, // 75% — mixed, below the bar
  // Everything else (pong/qwen3-8b, pong/ministral-8b, snake/gemma-3-4b,
  // snake/ministral-8b, breakout/gemini-flash-lite, breakout/deepseek-v3,
  // breakout/ministral-8b) is left UNSCREENED so the Test Lab has work.
};

type Winner = "a" | "b" | "tie" | "both_bad";
type GenStatus = "ok" | "no-html-found" | "broken";

interface ManifestRecord {
  modelSlug: string;
  gameSlug: string;
  sampleIndex: number;
  artifactPath: string | null;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  status: GenStatus;
}

interface GenSpec {
  gameSlug: string;
  modelSlug: string;
  artifactPath: string;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  status: GenStatus;
  published: boolean;
}

/** Build the generation specs from the harness manifest, or fall back to placeholders. */
async function loadGenSpecs(): Promise<{ specs: GenSpec[]; source: "manifest" | "fallback" }> {
  let records: ManifestRecord[] = [];
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) records = parsed as ManifestRecord[];
  } catch {
    // no manifest — fall through to fallback
  }

  const knownGames = new Set(GAMES.map((g) => g.slug));
  const knownModels = new Set(MODELS.map((m) => m.slug));

  if (records.length > 0) {
    // Keep the first sample per (game, model). A build is published when it produced a
    // playable file (status ok or broken — both wrote HTML); no-html-found cannot be played.
    const seen = new Set<string>();
    const specs: GenSpec[] = [];
    for (const r of records) {
      if (!knownGames.has(r.gameSlug) || !knownModels.has(r.modelSlug)) continue;
      const key = `${r.gameSlug}:${r.modelSlug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const playable = r.artifactPath != null && r.status !== "no-html-found";
      specs.push({
        gameSlug: r.gameSlug,
        modelSlug: r.modelSlug,
        artifactPath: r.artifactPath ?? "",
        cost: r.cost,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        status: r.status,
        published: playable,
      });
    }
    return { specs, source: "manifest" };
  }

  // Fallback: placeholder metadata from the model's modeled cost.
  const modelBySlug = new Map(MODELS.map((m) => [m.slug, m]));
  const specs: GenSpec[] = [];
  for (const [gameSlug, modelSlugs] of Object.entries(FALLBACK_GENERATIONS)) {
    for (const modelSlug of modelSlugs) {
      const m = modelBySlug.get(modelSlug)!;
      const tokensIn = IN_TOKENS + Math.floor(rand() * 200 - 100);
      const tokensOut = OUT_TOKENS + Math.floor(rand() * 1200 - 600);
      specs.push({
        gameSlug,
        modelSlug,
        artifactPath: `/artifacts/${gameSlug}/${modelSlug}.html`,
        cost: Number(costPerGen(m.inPer1M, m.outPer1M).toFixed(6)),
        tokensIn,
        tokensOut,
        status: "ok",
        published: true,
      });
    }
  }
  return { specs, source: "fallback" };
}

// Synthetic votes/dev users are OPT-IN demo data only (owner decision 2026-07-02:
// no fake votes — the arcade and leaderboard reflect real people or stay empty).
// Set SEED_SYNTHETIC_VOTES=1 explicitly if you want demo votes in a throwaway DB.
const SYNTHESIZE_VOTES =
  process.env.SEED_SYNTHETIC_VOTES === "true" || process.env.SEED_SYNTHETIC_VOTES === "1";

async function main() {
  console.log("Seeding arcade-bench…");

  // Safety: re-seeding wipes ALL votes (pairwise + playability). If real (non-dev)
  // graders have voted, this is production data loss — refuse unless explicitly forced.
  const realVotes =
    (await prisma.vote.count({
      where: { user: { NOT: { provider: "dev" } } },
    })) +
    (await prisma.playabilityVote.count({
      where: { user: { NOT: { provider: "dev" } } },
    }));
  if (realVotes > 0 && process.env.FORCE_RESEED !== "1") {
    console.error(
      `Refusing to seed: ${realVotes} real vote(s) exist and re-seeding deletes them all.\n` +
        `Set FORCE_RESEED=1 to override.`,
    );
    process.exit(1);
  }

  // 1) Clear vote-derived + generation data (idempotent re-seed). Order respects FKs.
  await prisma.playabilityVote.deleteMany({});
  await prisma.vote.deleteMany({});
  await prisma.rating.deleteMany({});
  await prisma.generation.deleteMany({});

  // 2) Upsert models.
  for (const m of MODELS) {
    const cpg = costPerGen(m.inPer1M, m.outPer1M);
    const data = {
      name: m.name,
      vendor: m.vendor,
      paramSize: m.paramSize,
      openrouterId: m.openrouterId,
      costPerGen: cpg,
      costPer1MInput: m.inPer1M,
      costPer1MOutput: m.outPer1M,
      tier: m.tier,
      active: true,
    };
    await prisma.model.upsert({ where: { slug: m.slug }, update: data, create: { slug: m.slug, ...data } });
  }
  // Prune any models no longer in the roster (e.g. a renamed slug), so the leaderboard
  // never shows a ghost row. Cascades clean up their generations/votes/ratings.
  const rosterSlugs = MODELS.map((m) => m.slug);
  const pruned = await prisma.model.deleteMany({ where: { slug: { notIn: rosterSlugs } } });
  if (pruned.count > 0) console.log(`Pruned ${pruned.count} stale model(s) not in the roster.`);

  // 3) Upsert games (locked prompt from constants).
  for (const g of GAMES) {
    const data = {
      title: g.title,
      year: g.year,
      creator: g.creator,
      prompt: LOCKED_PROMPT(g.title),
      roundOrder: g.roundOrder,
      status: g.status,
    };
    await prisma.game.upsert({ where: { slug: g.slug }, update: data, create: { slug: g.slug, ...data } });
  }

  // 4) Create generations from the harness manifest (real) or fallback (placeholder).
  const { specs, source } = await loadGenSpecs();
  console.log(`Generations source: ${source} (${specs.length} generations).`);

  const models = await prisma.model.findMany();
  const games = await prisma.game.findMany();
  const modelBySlug = new Map(models.map((m) => [m.slug, m]));
  const gameBySlug = new Map(games.map((g) => [g.slug, g]));

  // genId[gameSlug][modelSlug] = generation id; and per-game list of PUBLISHED model slugs.
  const genId: Record<string, Record<string, string>> = {};
  const genStatus: Record<string, Record<string, GenStatus>> = {};
  const publishedByGame: Record<string, string[]> = {};

  for (const s of specs) {
    const model = modelBySlug.get(s.modelSlug);
    const game = gameBySlug.get(s.gameSlug);
    if (!model || !game) continue;
    const gen = await prisma.generation.create({
      data: {
        modelId: model.id,
        gameId: game.id,
        sampleIndex: 0,
        artifactPath: s.artifactPath,
        cost: Number(s.cost.toFixed(6)),
        tokensIn: s.tokensIn,
        tokensOut: s.tokensOut,
        status: s.status,
        published: s.published,
      },
    });
    (genId[s.gameSlug] ??= {})[s.modelSlug] = gen.id;
    (genStatus[s.gameSlug] ??= {})[s.modelSlug] = s.status;
    if (s.published) (publishedByGame[s.gameSlug] ??= []).push(s.modelSlug);
  }

  // Report what landed per game.
  for (const g of GAMES) {
    const pub = publishedByGame[g.slug]?.length ?? 0;
    const total = Object.keys(genId[g.slug] ?? {}).length;
    if (total > 0) console.log(`  ${g.slug}: ${pub}/${total} published (playable) builds`);
  }

  // 5) Create dev users (only when synthesizing votes).
  const users = [];
  if (SYNTHESIZE_VOTES) {
    for (const handle of DEV_USERS) {
      const user = await prisma.user.upsert({
        where: { authId: `dev_seed_${handle}` },
        update: { handle, provider: "dev" },
        create: { authId: `dev_seed_${handle}`, provider: "dev", handle },
      });
      users.push(user);
    }
  } else {
    // Production seed: remove any dev users (and their votes, via cascade) so the
    // arena launches clean with only real graders.
    const removed = await prisma.user.deleteMany({ where: { provider: "dev" } });
    if (removed.count > 0) console.log(`Removed ${removed.count} dev user(s).`);
    console.log("SEED_SYNTHETIC_VOTES=false — skipping synthesized votes.");
  }

  // 6) Synthesize pairwise votes over the PUBLISHED builds of each game.
  const voted = new Set<string>();
  let voteCount = 0;
  const VOTES_PER_GAME = 50;

  for (const [gameSlug, modelSlugs] of SYNTHESIZE_VOTES ? Object.entries(publishedByGame) : []) {
    if (modelSlugs.length < 2) continue;
    const game = gameBySlug.get(gameSlug)!;
    let made = 0;
    let attempts = 0;
    const maxAttempts = VOTES_PER_GAME * 12;

    while (made < VOTES_PER_GAME && attempts < maxAttempts) {
      attempts++;
      const i = Math.floor(rand() * modelSlugs.length);
      let j = Math.floor(rand() * (modelSlugs.length - 1));
      if (j >= i) j += 1;
      const slugA = modelSlugs[i];
      const slugB = modelSlugs[j];
      const genAId = genId[gameSlug][slugA];
      const genBId = genId[gameSlug][slugB];

      const user = users[Math.floor(rand() * users.length)];
      const key = `${user.id}:${genAId}:${genBId}`;
      if (voted.has(key)) continue;

      const winner = simulateWinner(slugA, slugB, genStatus[gameSlug][slugA], genStatus[gameSlug][slugB], rand);
      await prisma.vote.create({ data: { userId: user.id, gameId: game.id, genAId, genBId, winner } });
      voted.add(key);
      made++;
      voteCount++;
    }
    console.log(`  ${gameSlug}: ${made} synthesized votes`);
  }

  console.log(`Total synthesized votes: ${voteCount}`);

  // 6b) Synthesize playability verdicts (docs/ux-overhaul.md §7) over PUBLISHED builds.
  // Each verdict comes from a distinct dev user (unique (userId, generationId)).
  if (SYNTHESIZE_VOTES) {
    let pvoteCount = 0;
    const tally = { certified: 0, unplayable: 0, unscreened: 0 };
    const screened = new Map<string, { playable: number; total: number }>();

    for (const [key, plan] of Object.entries(PLAYABILITY_SEED)) {
      const [gameSlug, modelSlug] = key.split("/");
      const generationId = genId[gameSlug]?.[modelSlug];
      if (!generationId) continue; // build not present (e.g. fallback specs)
      if (!publishedByGame[gameSlug]?.includes(modelSlug)) continue; // never screen unpublished
      const total = plan.playable + plan.unplayable;
      if (total > users.length) throw new Error(`PLAYABILITY_SEED ${key}: needs ${total} users, have ${users.length}`);
      for (let i = 0; i < total; i++) {
        await prisma.playabilityVote.create({
          data: { userId: users[i].id, generationId, playable: i < plan.playable },
        });
        pvoteCount++;
      }
      screened.set(key, { playable: plan.playable, total });
    }

    // Report the arcade state so the seed self-verifies (published builds only —
    // unpublished ones never reach the Arcade or the Test Lab queue).
    console.log(`\nPlayability screening (certified ≥ ${CERTIFIED_PLAYABLE_PCT}%):`);
    for (const [gameSlug, modelSlugs] of Object.entries(publishedByGame)) {
      for (const modelSlug of modelSlugs) {
        const key = `${gameSlug}/${modelSlug}`;
        const s = screened.get(key);
        if (!s || s.total === 0) {
          tally.unscreened++;
          continue;
        }
        const pct = (s.playable / s.total) * 100;
        const certified = pct >= CERTIFIED_PLAYABLE_PCT;
        if (certified) tally.certified++;
        else tally.unplayable++;
        console.log(
          `  ${key.padEnd(28)} ${s.playable}/${s.total} playable (${pct.toFixed(0)}%) ${certified ? "CERTIFIED" : "reported unplayable"}`,
        );
      }
    }
    console.log(
      `Playability votes: ${pvoteCount} — ${tally.certified} certified, ${tally.unplayable} reported unplayable, ${tally.unscreened} unscreened.`,
    );
  }

  // 7) Compute + persist ratings.
  const { overallRows, perGameRows } = await recomputeAndStore();
  console.log(`Ratings stored: ${overallRows} overall, ${perGameRows} per-game.`);

  // 8) Report the leaderboard so the seed self-verifies.
  const board = await prisma.rating.findMany({ where: { gameId: null }, orderBy: { rating: "desc" }, include: { model: true } });
  console.log("\nOverall leaderboard:");
  for (const [idx, r] of board.entries()) {
    const cents = r.model.costPerGen * 100;
    const rpc = cents > 0 ? (r.rating / cents).toFixed(0) : "—";
    console.log(
      `  ${idx + 1}. ${r.model.name.padEnd(22)} ${r.rating.toFixed(0)} ±${r.interval.toFixed(0)}  n=${String(r.nVotes).padStart(3)}  $${r.model.costPerGen.toFixed(5)}/gen  rating/¢=${rpc}`,
    );
  }
}

/** Simulate a pairwise winner from latent quality, penalizing broken builds. */
function simulateWinner(slugA: string, slugB: string, statusA: GenStatus, statusB: GenStatus, r: () => number): Winner {
  const roll = r();
  if (roll < 0.04) return "both_bad";
  if (roll < 0.14) return "tie";

  // Broken builds play worse than their nominal quality.
  const penalty = (s: GenStatus) => (s === "broken" ? 3 : 0);
  const qa = (QUALITY[slugA] ?? 0) - penalty(statusA);
  const qb = (QUALITY[slugB] ?? 0) - penalty(statusB);
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
