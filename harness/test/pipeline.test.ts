import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runGeneration } from "../src/pipeline.js";
import { storeArtifact, readManifest } from "../src/store.js";
import type { GameEntry, ModelEntry } from "../src/types.js";
import type { CallModelResult } from "../src/openrouter.js";
import { CLEAN_DOC, NO_HTML, THROWING_HTML } from "./fixtures.js";

const GAME: GameEntry = { slug: "pong", name: "Pong", year: 1972, creator: "Atari" };
const MODEL: ModelEntry = {
  slug: "gemini-flash-lite",
  name: "Gemini 2.5 Flash-Lite",
  vendor: "Google",
  openrouterId: "google/gemini-2.5-flash-lite",
};

let tmpDir: string;
let artifactsDir: string;
let manifestPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arcade-pipeline-"));
  artifactsDir = path.join(tmpDir, "public", "artifacts");
  manifestPath = path.join(tmpDir, "out", "manifest.json");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/** Build a canned callModel that returns a fixed text. */
function cannedCall(text: string, overrides: Partial<CallModelResult> = {}) {
  return async (): Promise<CallModelResult> => ({
    text,
    tokensIn: 10,
    tokensOut: 500,
    costUsd: 0.0003,
    ...overrides,
  });
}

/** A storeArtifact bound to the temp dirs. */
function tempStore() {
  return (params: Parameters<typeof storeArtifact>[0]) =>
    storeArtifact({ ...params, artifactsDir, manifestPath });
}

describe("runGeneration", () => {
  it("status=ok for a clean, smoke-passing build, and writes the artifact + manifest", async () => {
    const records = await runGeneration({
      game: GAME,
      model: MODEL,
      samples: 1,
      deps: {
        callModel: cannedCall(CLEAN_DOC),
        smokeTest: async () => ({ ok: true }),
        storeArtifact: tempStore(),
      },
    });

    expect(records).toHaveLength(1);
    expect(records[0]!.status).toBe("ok");
    expect(records[0]!.artifactPath).toBe("/artifacts/pong/gemini-flash-lite.html");
    expect(records[0]!.cost).toBeCloseTo(0.0003, 8);

    // File was written.
    const written = await fs.readFile(
      path.join(artifactsDir, "pong", "gemini-flash-lite.html"),
      "utf8",
    );
    expect(written).toContain("<!doctype html>");

    // Manifest contains the record.
    const manifest = await readManifest(manifestPath);
    expect(manifest).toHaveLength(1);
    expect(manifest[0]!.status).toBe("ok");
  });

  it("status=no-html-found when the response has no HTML (still stored as a record)", async () => {
    const records = await runGeneration({
      game: GAME,
      model: MODEL,
      samples: 1,
      deps: {
        callModel: cannedCall(NO_HTML),
        smokeTest: async () => ({ ok: true }), // should not be consulted
        storeArtifact: tempStore(),
      },
    });

    expect(records[0]!.status).toBe("no-html-found");
    expect(records[0]!.artifactPath).toBeNull();

    // No file written, but a manifest record exists (competes and loses).
    const manifest = await readManifest(manifestPath);
    expect(manifest).toHaveLength(1);
    expect(manifest[0]!.status).toBe("no-html-found");
    expect(manifest[0]!.artifactPath).toBeNull();
    await expect(
      fs.access(path.join(artifactsDir, "pong", "gemini-flash-lite.html")),
    ).rejects.toBeTruthy();
  });

  it("status=broken when the smoke test fails", async () => {
    const records = await runGeneration({
      game: GAME,
      model: MODEL,
      samples: 1,
      deps: {
        callModel: cannedCall(THROWING_HTML),
        smokeTest: async () => ({ ok: false, error: "boom on start" }),
        storeArtifact: tempStore(),
      },
    });

    expect(records[0]!.status).toBe("broken");
    // Broken builds are still stored so they compete and lose.
    expect(records[0]!.artifactPath).toBe("/artifacts/pong/gemini-flash-lite.html");
    const manifest = await readManifest(manifestPath);
    expect(manifest[0]!.status).toBe("broken");
  });

  it("status=no-html-found when the model call throws (batch must not abort)", async () => {
    const logs: string[] = [];
    const records = await runGeneration({
      game: GAME,
      model: MODEL,
      samples: 1,
      onLog: (m) => logs.push(m),
      deps: {
        callModel: async () => {
          throw new Error("404 No endpoints found for some/model");
        },
        smokeTest: async () => ({ ok: true }), // should not be consulted
        storeArtifact: tempStore(),
      },
    });

    // The failure is recorded (competes and loses), not thrown.
    expect(records).toHaveLength(1);
    expect(records[0]!.status).toBe("no-html-found");
    expect(records[0]!.artifactPath).toBeNull();
    expect(records[0]!.cost).toBe(0);
    expect(logs.some((l) => l.includes("call failed") && l.includes("404"))).toBe(true);

    const manifest = await readManifest(manifestPath);
    expect(manifest[0]!.status).toBe("no-html-found");
  });

  it("runs N samples and calls store for each", async () => {
    let storeCalls = 0;
    const records = await runGeneration({
      game: GAME,
      model: MODEL,
      samples: 3,
      deps: {
        callModel: cannedCall(CLEAN_DOC),
        smokeTest: async () => ({ ok: true }),
        storeArtifact: async (p) => {
          storeCalls++;
          return storeArtifact({ ...p, artifactsDir, manifestPath });
        },
      },
    });
    expect(records).toHaveLength(3);
    expect(storeCalls).toBe(3);
    expect(records.map((r) => r.sampleIndex)).toEqual([0, 1, 2]);
  });

  it("logs validation violations but still smoke-tests and stores", async () => {
    const externalHtml =
      `<!doctype html><html><head>` +
      `<script src="https://cdn.example.com/x.js"></script></head>` +
      `<body></body></html>`;
    const logs: string[] = [];
    const records = await runGeneration({
      game: GAME,
      model: MODEL,
      samples: 1,
      onLog: (m) => logs.push(m),
      deps: {
        callModel: cannedCall(externalHtml),
        smokeTest: async () => ({ ok: true }),
        storeArtifact: tempStore(),
      },
    });
    expect(records[0]!.status).toBe("ok");
    expect(logs.some((l) => l.includes("validation violations"))).toBe(true);
  });

  it("passes the LOCKED prompt (game name) and model id to callModel", async () => {
    let seenPrompt = "";
    let seenId = "";
    await runGeneration({
      game: GAME,
      model: MODEL,
      samples: 1,
      deps: {
        callModel: async (args) => {
          seenPrompt = args.prompt;
          seenId = args.openrouterId;
          return { text: CLEAN_DOC, tokensIn: 1, tokensOut: 1, costUsd: 0 };
        },
        smokeTest: async () => ({ ok: true }),
        storeArtifact: tempStore(),
      },
    });
    expect(seenPrompt).toBe(
      "Create Pong as a single self-contained HTML file that runs in a browser.",
    );
    expect(seenId).toBe("google/gemini-2.5-flash-lite");
  });
});
