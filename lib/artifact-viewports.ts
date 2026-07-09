// Per-artifact natural content sizes, measured offline by the harness sweep
// (`npm run measure:viewports` → harness/src/measure.ts → data/artifact-viewports.json).
//
// Why this exists: the SandboxedPlayer scales a fixed-size virtual viewport to
// fit its frame (docs/ux-overhaul.md §1). The strict sandbox makes the frame's
// document unmeasurable at runtime (opaque origin), so a build taller or wider
// than the viewport would scroll inside its frame — measuring at harness time
// and shipping the sizes as data is the only sandbox-safe fix. Anything
// unmeasured falls back to the historical 820×700 default.

import type { ArtifactViewport } from "./types";
import measured from "@/data/artifact-viewports.json";

export const DEFAULT_ARTIFACT_VIEWPORT: ArtifactViewport = { width: 820, height: 700 };

/** The measured natural size for an artifact path, or the 820×700 default. */
export function artifactViewport(
  artifactPath: string | null | undefined,
): ArtifactViewport {
  if (!artifactPath) return DEFAULT_ARTIFACT_VIEWPORT;
  const v = (measured as Record<string, ArtifactViewport | undefined>)[artifactPath];
  if (
    !v ||
    !Number.isFinite(v.width) ||
    !Number.isFinite(v.height) ||
    v.width <= 0 ||
    v.height <= 0
  ) {
    return DEFAULT_ARTIFACT_VIEWPORT;
  }
  return { width: v.width, height: v.height };
}
