// Canonical model + game roster — the single source of truth shared by
// prisma/seed.ts (full reseed, dev only) and scripts/sync-roster.ts (additive
// production sync). Extracted from seed.ts so the sync script can import the
// roster WITHOUT triggering the seed's top-level main() (which clears votes).
//
// Models + pricing are real (live OpenRouter research: cheap roster 2026-06-29,
// frontier additions 2026-07-03).

export type CostTier = "featherweight" | "midweight" | "heavyweight";

export interface ModelSeed {
  slug: string;
  name: string;
  vendor: string;
  paramSize: string | null;
  openrouterId: string;
  inPer1M: number;
  outPer1M: number;
  tier: CostTier;
}

export const MODELS: ModelSeed[] = [
  { slug: "gemini-flash-lite", name: "Gemini 2.5 Flash-Lite", vendor: "Google", paramSize: null, openrouterId: "google/gemini-2.5-flash-lite", inPer1M: 0.1, outPer1M: 0.4, tier: "midweight" },
  { slug: "gpt-4-1-nano", name: "GPT-4.1 nano", vendor: "OpenAI", paramSize: null, openrouterId: "openai/gpt-4.1-nano", inPer1M: 0.1, outPer1M: 0.4, tier: "midweight" },
  { slug: "deepseek-v3", name: "DeepSeek V3", vendor: "DeepSeek", paramSize: "671B", openrouterId: "deepseek/deepseek-chat", inPer1M: 0.2, outPer1M: 0.8, tier: "heavyweight" },
  { slug: "qwen3-8b", name: "Qwen3 8B", vendor: "Alibaba", paramSize: "8B", openrouterId: "qwen/qwen3-8b", inPer1M: 0.05, outPer1M: 0.4, tier: "featherweight" },
  { slug: "gemma-3-4b", name: "Gemma 3 4B", vendor: "Google", paramSize: "4B", openrouterId: "google/gemma-3-4b-it", inPer1M: 0.05, outPer1M: 0.1, tier: "featherweight" },
  { slug: "ministral-8b", name: "Ministral 8B", vendor: "Mistral", paramSize: "8B", openrouterId: "mistralai/ministral-8b-2512", inPer1M: 0.15, outPer1M: 0.15, tier: "featherweight" },
  // Frontier reference models (closed-weight): same locked prompt, one sample —
  // the "what does the best money buy" yardstick for the cheap roster.
  { slug: "claude-opus-4-8", name: "Claude Opus 4.8", vendor: "Anthropic", paramSize: null, openrouterId: "anthropic/claude-opus-4.8", inPer1M: 5, outPer1M: 25, tier: "heavyweight" },
  { slug: "gpt-5-5", name: "GPT-5.5", vendor: "OpenAI", paramSize: null, openrouterId: "openai/gpt-5.5", inPer1M: 5, outPer1M: 30, tier: "heavyweight" },
  { slug: "gemini-3-1-pro", name: "Gemini 3.1 Pro", vendor: "Google", paramSize: null, openrouterId: "google/gemini-3.1-pro-preview", inPer1M: 2, outPer1M: 12, tier: "heavyweight" },
];

export interface GameSeed {
  slug: string;
  title: string;
  year: number;
  creator: string;
  roundOrder: number;
  status: "live" | "now" | "upcoming";
}

export const GAMES: GameSeed[] = [
  { slug: "pong", title: "Pong", year: 1972, creator: "Atari", roundOrder: 1, status: "live" },
  { slug: "snake", title: "Snake", year: 1976, creator: "Gremlin", roundOrder: 2, status: "live" },
  { slug: "breakout", title: "Breakout", year: 1976, creator: "Atari", roundOrder: 3, status: "now" },
  { slug: "space-invaders", title: "Space Invaders", year: 1978, creator: "Taito", roundOrder: 4, status: "upcoming" },
  { slug: "asteroids", title: "Asteroids", year: 1979, creator: "Atari", roundOrder: 5, status: "upcoming" },
];

/** Modeled tokens for a typical generation (used for costPerGen estimates). */
export const IN_TOKENS = 800;
export const OUT_TOKENS = 4000;

export function costPerGen(inPer1M: number, outPer1M: number): number {
  return (IN_TOKENS * inPer1M + OUT_TOKENS * outPer1M) / 1_000_000;
}
