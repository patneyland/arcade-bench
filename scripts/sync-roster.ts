// Additive roster + generation sync — the production-safe counterpart to
// prisma/seed.ts.
//
// Run with: npx tsx scripts/sync-roster.ts
//
// What it does:
//   1. UPSERTS every model in prisma/roster.ts (MODELS) and every game (GAMES,
//      with the locked prompt from lib/constants).
//   2. Reads harness/out/manifest.json and CREATES any Generation row that does
//      not already exist for (model, game, sampleIndex). Existing generations
//      are left untouched (skipped), matching the manifest's first-record-wins
//      convention from the seed.
//
// What it NEVER does: delete or update ANY existing source-of-truth row. No
// votes, playability votes, users, or existing generations are modified — this
// is safe to run against a live database with real votes (it is the script used
// to promote new builds to production). The one derived table it DOES rebuild is
// Rating (step 4): the leaderboard only lists models that have Rating rows, so
// after adding models we recompute ratings from the (untouched) votes — new
// models land at the default rating with 0 votes. Environment-agnostic:
// PrismaClient reads DATABASE_URL / DIRECT_URL from the environment (or .env)
// exactly like the app.

import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCKED_PROMPT } from "../lib/constants";
import { recomputeAndStore } from "../lib/rating/recompute";
import { GAMES, MODELS, costPerGen } from "../prisma/roster";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, "..", "harness", "out", "manifest.json");

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

async function readManifest(): Promise<ManifestRecord[]> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ManifestRecord[]) : [];
  } catch {
    return [];
  }
}

async function main() {
  console.log("sync-roster: additive upsert of models/games + missing generations.");

  // 1) Upsert models (never delete — no roster pruning here, unlike the seed).
  for (const m of MODELS) {
    const data = {
      name: m.name,
      vendor: m.vendor,
      paramSize: m.paramSize,
      openrouterId: m.openrouterId,
      costPerGen: costPerGen(m.inPer1M, m.outPer1M),
      costPer1MInput: m.inPer1M,
      costPer1MOutput: m.outPer1M,
      tier: m.tier,
      active: true,
    };
    await prisma.model.upsert({ where: { slug: m.slug }, update: data, create: { slug: m.slug, ...data } });
  }
  console.log(`  models upserted: ${MODELS.length}`);

  // 2) Upsert games (locked prompt from constants — never tuned).
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
  console.log(`  games upserted: ${GAMES.length}`);

  // 3) Create generations missing from the DB. First manifest record per
  //    (game, model, sampleIndex) wins, mirroring the seed's dedupe.
  const records = await readManifest();
  if (records.length === 0) {
    console.log("  no harness manifest found — no generations to sync.");
  }

  const models = await prisma.model.findMany();
  const games = await prisma.game.findMany();
  const modelBySlug = new Map(models.map((m) => [m.slug, m]));
  const gameBySlug = new Map(games.map((g) => [g.slug, g]));

  let created = 0;
  let skippedExisting = 0;
  let skippedUnknown = 0;
  const seen = new Set<string>();
  const createdKeys: string[] = [];

  for (const r of records) {
    const model = modelBySlug.get(r.modelSlug);
    const game = gameBySlug.get(r.gameSlug);
    if (!model || !game) {
      skippedUnknown++;
      continue;
    }
    const key = `${r.gameSlug}:${r.modelSlug}:${r.sampleIndex}`;
    if (seen.has(key)) continue; // duplicate manifest entry — first record wins
    seen.add(key);

    const existing = await prisma.generation.findFirst({
      where: { modelId: model.id, gameId: game.id, sampleIndex: r.sampleIndex },
      select: { id: true },
    });
    if (existing) {
      skippedExisting++;
      continue;
    }

    // Published when the run produced an HTML file (ok or broken both wrote HTML;
    // no-html-found cannot be played) — same rule as the seed.
    const playable = r.artifactPath != null && r.status !== "no-html-found";
    await prisma.generation.create({
      data: {
        modelId: model.id,
        gameId: game.id,
        sampleIndex: r.sampleIndex,
        artifactPath: r.artifactPath ?? "",
        cost: Number(r.cost.toFixed(6)),
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        status: r.status,
        published: playable,
      },
    });
    created++;
    createdKeys.push(`${key} status=${r.status} published=${playable}`);
  }

  console.log(`  generations created: ${created}`);
  for (const k of createdKeys) console.log(`    + ${k}`);
  console.log(`  generations skipped (already exist): ${skippedExisting}`);
  if (skippedUnknown > 0) {
    console.log(`  manifest records skipped (unknown model/game slug): ${skippedUnknown}`);
  }

  const totalGens = await prisma.generation.count();
  console.log(`  total generations in DB: ${totalGens}`);

  // 4) Rebuild the derived Rating table so newly-added models appear on the
  //    leaderboard (they get the default rating; votes are read, never written).
  const recompute = await recomputeAndStore();
  console.log(
    `  ratings recomputed: overall=${recompute.overallRows} perGame=${recompute.perGameRows}`,
  );
  console.log("sync-roster: done. Votes and existing generations untouched.");
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
