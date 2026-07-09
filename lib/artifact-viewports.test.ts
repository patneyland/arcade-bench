import { describe, it, expect } from "vitest";
import measured from "@/data/artifact-viewports.json";
import { artifactViewport, DEFAULT_ARTIFACT_VIEWPORT } from "./artifact-viewports";

describe("artifactViewport", () => {
  it("falls back to the 820×700 default for unmeasured or missing paths", () => {
    expect(artifactViewport("/artifacts/nope/never-measured.html")).toEqual(
      DEFAULT_ARTIFACT_VIEWPORT,
    );
    expect(artifactViewport(null)).toEqual(DEFAULT_ARTIFACT_VIEWPORT);
    expect(artifactViewport(undefined)).toEqual(DEFAULT_ARTIFACT_VIEWPORT);
  });

  it("returns the measured size for a recorded artifact", () => {
    const entries = Object.entries(measured as Record<string, { width: number; height: number }>);
    expect(entries.length).toBeGreaterThan(0);
    const [path, box] = entries[0];
    expect(artifactViewport(path)).toEqual(box);
  });

  // Data sanity for the checked-in measurement sweep: every entry must be a
  // positive finite box no smaller than the default in either dimension (the
  // sweep only ever grows the default viewport, never shrinks it).
  it("every measured entry is a sane viewport box", () => {
    for (const [path, box] of Object.entries(
      measured as Record<string, { width: number; height: number }>,
    )) {
      expect(path, path).toMatch(/^\/artifacts\/[^/]+\/[^/]+\.html$/);
      expect(Number.isFinite(box.width), path).toBe(true);
      expect(Number.isFinite(box.height), path).toBe(true);
      expect(box.width, path).toBeGreaterThanOrEqual(DEFAULT_ARTIFACT_VIEWPORT.width);
      expect(box.height, path).toBeGreaterThanOrEqual(DEFAULT_ARTIFACT_VIEWPORT.height);
    }
  });
});
