/** Shared types for the generation harness. */

/** Generation outcome status — mirrors lib/constants.ts GENERATION_STATUSES. */
export type GenerationStatus = "ok" | "no-html-found" | "broken";

/** A model entry in the roster. */
export interface ModelEntry {
  slug: string;
  name: string;
  vendor: string;
  openrouterId: string;
  /** Optional per-token prices (USD per token) used to compute cost when the
   *  OpenRouter response does not report usage cost directly. */
  promptPriceUsd?: number;
  completionPriceUsd?: number;
}

/** A game entry in the canonical list. */
export interface GameEntry {
  slug: string;
  name: string;
  year: number;
  creator: string;
}

/** The metadata record produced for each generation attempt. */
export interface ArtifactRecord {
  modelSlug: string;
  gameSlug: string;
  sampleIndex: number;
  /** Public web path, e.g. /artifacts/pong/gemini-flash-lite.html (null if no HTML). */
  artifactPath: string | null;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  status: GenerationStatus;
}
