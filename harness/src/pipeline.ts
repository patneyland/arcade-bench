/**
 * runGeneration — orchestrate call -> extract -> validate -> smoke -> store for a
 * single game/model pair across N samples.
 *
 * Status rules (per PRD: non-running entries still compete, never hidden):
 *   - no HTML extracted          -> status "no-html-found", artifactPath null
 *   - smoke test fails / throws  -> status "broken"
 *   - otherwise                  -> status "ok"
 *
 * Validation violations are surfaced (logged via onLog) but do not by themselves
 * change status — a self-contained-but-broken build is "broken", and an entry
 * that reaches outside the file is still stored so it can compete and lose. The
 * smoke test is the gate that decides ok vs broken.
 *
 * Every dependency (model call, smoke test, store) is injectable so the whole
 * pipeline is unit-testable with canned responses and a temp filesystem.
 */
import { LOCKED_PROMPT } from "./prompt.js";
import { callModel as defaultCallModel } from "./openrouter.js";
import { extractHtml as defaultExtractHtml } from "./extract.js";
import { validateSelfContained as defaultValidate } from "./validate.js";
import { smokeTest as defaultSmokeTest } from "./smoke.js";
import { storeArtifact as defaultStoreArtifact } from "./store.js";
import type { ArtifactRecord, GameEntry, GenerationStatus, ModelEntry } from "./types.js";

export interface RunGenerationParams {
  game: GameEntry;
  model: ModelEntry;
  samples: number;
  maxTokens?: number;
  /** Injectable dependencies (default to the real implementations). */
  deps?: Partial<PipelineDeps>;
  /** Optional log sink for progress / violations. */
  onLog?: (message: string) => void;
}

export interface PipelineDeps {
  callModel: typeof defaultCallModel;
  extractHtml: typeof defaultExtractHtml;
  validateSelfContained: typeof defaultValidate;
  smokeTest: typeof defaultSmokeTest;
  storeArtifact: typeof defaultStoreArtifact;
}

const DEFAULT_MAX_TOKENS = 8000;

export async function runGeneration(params: RunGenerationParams): Promise<ArtifactRecord[]> {
  const { game, model, samples } = params;
  const maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;
  const log = params.onLog ?? (() => {});

  const deps: PipelineDeps = {
    callModel: params.deps?.callModel ?? defaultCallModel,
    extractHtml: params.deps?.extractHtml ?? defaultExtractHtml,
    validateSelfContained: params.deps?.validateSelfContained ?? defaultValidate,
    smokeTest: params.deps?.smokeTest ?? defaultSmokeTest,
    storeArtifact: params.deps?.storeArtifact ?? defaultStoreArtifact,
  };

  const prompt = LOCKED_PROMPT(game.name);
  const records: ArtifactRecord[] = [];

  for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
    log(`[${model.slug}/${game.slug}] sample ${sampleIndex}: calling model`);

    const call = await deps.callModel({
      openrouterId: model.openrouterId,
      prompt,
      maxTokens,
      promptPriceUsd: model.promptPriceUsd,
      completionPriceUsd: model.completionPriceUsd,
    });

    const html = deps.extractHtml(call.text);

    let status: GenerationStatus;
    if (html === null) {
      status = "no-html-found";
      log(`[${model.slug}/${game.slug}] sample ${sampleIndex}: no HTML found`);
    } else {
      const validation = deps.validateSelfContained(html);
      if (!validation.ok) {
        log(
          `[${model.slug}/${game.slug}] sample ${sampleIndex}: ` +
            `validation violations: ${validation.violations.join("; ")}`,
        );
      }

      const smoke = await deps.smokeTest(html);
      if (smoke.ok) {
        status = "ok";
      } else {
        status = "broken";
        log(`[${model.slug}/${game.slug}] sample ${sampleIndex}: broken — ${smoke.error}`);
      }
    }

    const record = await deps.storeArtifact({
      modelSlug: model.slug,
      gameSlug: game.slug,
      sampleIndex,
      html,
      cost: call.costUsd,
      tokensIn: call.tokensIn,
      tokensOut: call.tokensOut,
      status,
    });

    records.push(record);
    log(`[${model.slug}/${game.slug}] sample ${sampleIndex}: stored status=${status}`);
  }

  return records;
}
