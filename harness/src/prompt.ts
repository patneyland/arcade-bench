/**
 * The LOCKED prompt for arcade-bench generation.
 *
 * This mirrors `lib/constants.ts` LOCKED_PROMPT exactly. Only the game name
 * changes — the prompt is NEVER tuned. This is a benchmark of models, not of
 * prompting. Do not edit the wording here without changing it in lib/constants.ts.
 */
export const LOCKED_PROMPT = (game: string): string =>
  `Create ${game} as a single self-contained HTML file that runs in a browser.`;

/** Convenience alias matching the spec's "locked-prompt builder" wording. */
export const buildPrompt = LOCKED_PROMPT;
