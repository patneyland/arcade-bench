/**
 * arcade-bench generation CLI.
 *
 * Reads the roster + game list from harness/config, runs the pipeline for a
 * chosen game/model (or all of them), and prints a summary table.
 *
 * Usage:
 *   npm run generate -- --game pong --model gemini-flash-lite --samples 3
 *   npm run generate -- --game pong               # all models for pong
 *   npm run generate -- --model qwen3-4b          # one model, all games
 *   npm run generate -- --all --samples 1         # everything
 *   npm run generate -- --list                    # show roster + games, no calls
 *
 * Requires OPENROUTER_API_KEY in the environment for real calls. This module
 * never makes a network call on import — the work happens in main(), which is
 * only invoked when run directly (not during `npm test`).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGeneration } from "./pipeline.js";
import type { ArtifactRecord, GameEntry, ModelEntry } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, "..", "config");

export interface CliArgs {
  game?: string;
  model?: string;
  samples: number;
  all: boolean;
  list: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { samples: 3, all: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--game":
        args.game = argv[++i];
        break;
      case "--model":
        args.model = argv[++i];
        break;
      case "--samples": {
        const n = Number(argv[++i]);
        if (Number.isFinite(n) && n > 0) args.samples = Math.floor(n);
        break;
      }
      case "--all":
        args.all = true;
        break;
      case "--list":
        args.list = true;
        break;
      default:
        // ignore unknown args
        break;
    }
  }
  return args;
}

export async function loadConfig(): Promise<{ games: GameEntry[]; models: ModelEntry[] }> {
  const [gamesRaw, rosterRaw] = await Promise.all([
    fs.readFile(path.join(CONFIG_DIR, "games.json"), "utf8"),
    fs.readFile(path.join(CONFIG_DIR, "roster.json"), "utf8"),
  ]);
  return {
    games: JSON.parse(gamesRaw) as GameEntry[],
    models: JSON.parse(rosterRaw) as ModelEntry[],
  };
}

function selectGames(all: GameEntry[], slug?: string): GameEntry[] {
  if (!slug) return all;
  const found = all.filter((g) => g.slug === slug);
  if (found.length === 0) throw new Error(`Unknown game slug: ${slug}`);
  return found;
}

function selectModels(all: ModelEntry[], slug?: string): ModelEntry[] {
  if (!slug) return all;
  const found = all.filter((m) => m.slug === slug);
  if (found.length === 0) throw new Error(`Unknown model slug: ${slug}`);
  return found;
}

function printSummary(records: ArtifactRecord[]): void {
  const header = ["model", "game", "#", "status", "cost", "in", "out"];
  const rows = records.map((r) => [
    r.modelSlug,
    r.gameSlug,
    String(r.sampleIndex),
    r.status,
    `$${r.cost.toFixed(5)}`,
    String(r.tokensIn),
    String(r.tokensOut),
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => (row[i] ?? "").length)),
  );
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i] ?? 0)).join("  ");
  console.log(fmt(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(fmt(row));

  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
  console.log("");
  console.log(
    `totals: ${records.length} samples, ` +
      `ok=${counts.ok ?? 0} no-html-found=${counts["no-html-found"] ?? 0} broken=${counts.broken ?? 0}, ` +
      `cost=$${totalCost.toFixed(5)}`,
  );
}

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const { games, models } = await loadConfig();

  if (args.list) {
    console.log("Games:");
    for (const g of games) console.log(`  ${g.slug}  (${g.name}, ${g.year}, ${g.creator})`);
    console.log("Models:");
    for (const m of models) console.log(`  ${m.slug}  (${m.name}, ${m.vendor}, ${m.openrouterId})`);
    return;
  }

  if (!args.all && !args.game && !args.model) {
    console.log(
      "Specify --game and/or --model, or --all. Use --list to see options.\n" +
        "Example: npm run generate -- --game pong --model gemini-flash-lite --samples 3",
    );
    return;
  }

  const selectedGames = selectGames(games, args.game);
  const selectedModels = selectModels(models, args.model);

  const all: ArtifactRecord[] = [];
  for (const game of selectedGames) {
    for (const model of selectedModels) {
      console.log(`\n=== ${model.name} -> ${game.name} (${args.samples} samples) ===`);
      const records = await runGeneration({
        game,
        model,
        samples: args.samples,
        onLog: (msg) => console.log(msg),
      });
      all.push(...records);
    }
  }

  console.log("");
  printSummary(all);
}

// Only run when invoked directly (tsx src/cli.ts), never on import during tests.
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
