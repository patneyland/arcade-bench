import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { storeArtifact, readManifest } from "../src/store.js";
import { CLEAN_DOC } from "./fixtures.js";

let tmpDir: string;
let artifactsDir: string;
let manifestPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arcade-store-"));
  artifactsDir = path.join(tmpDir, "public", "artifacts");
  manifestPath = path.join(tmpDir, "out", "manifest.json");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("storeArtifact", () => {
  it("writes the HTML to <game>/<model>.html and returns a public web path", async () => {
    const rec = await storeArtifact({
      modelSlug: "gemini-flash-lite",
      gameSlug: "pong",
      sampleIndex: 0,
      html: CLEAN_DOC,
      cost: 0.0003,
      tokensIn: 10,
      tokensOut: 500,
      status: "ok",
      artifactsDir,
      manifestPath,
    });

    expect(rec.artifactPath).toBe("/artifacts/pong/gemini-flash-lite.html");
    expect(rec.status).toBe("ok");

    const onDisk = await fs.readFile(
      path.join(artifactsDir, "pong", "gemini-flash-lite.html"),
      "utf8",
    );
    expect(onDisk).toBe(CLEAN_DOC);
  });

  it("uses forward slashes in the public path regardless of OS", async () => {
    const rec = await storeArtifact({
      modelSlug: "qwen3-4b",
      gameSlug: "space-invaders",
      sampleIndex: 1,
      html: CLEAN_DOC,
      cost: 0,
      tokensIn: 0,
      tokensOut: 0,
      status: "ok",
      artifactsDir,
      manifestPath,
    });
    expect(rec.artifactPath).toBe("/artifacts/space-invaders/qwen3-4b.html");
    expect(rec.artifactPath).not.toContain("\\");
  });

  it("writes no file but records null artifactPath for no-html-found", async () => {
    const rec = await storeArtifact({
      modelSlug: "ministral-8b",
      gameSlug: "asteroids",
      sampleIndex: 0,
      html: null,
      cost: 0.0001,
      tokensIn: 5,
      tokensOut: 2,
      status: "no-html-found",
      artifactsDir,
      manifestPath,
    });
    expect(rec.artifactPath).toBeNull();
    await expect(fs.access(path.join(artifactsDir, "asteroids"))).rejects.toBeTruthy();
  });

  it("appends to the manifest across multiple calls", async () => {
    await storeArtifact({
      modelSlug: "a",
      gameSlug: "pong",
      sampleIndex: 0,
      html: CLEAN_DOC,
      cost: 0,
      tokensIn: 0,
      tokensOut: 0,
      status: "ok",
      artifactsDir,
      manifestPath,
    });
    await storeArtifact({
      modelSlug: "b",
      gameSlug: "pong",
      sampleIndex: 0,
      html: null,
      cost: 0,
      tokensIn: 0,
      tokensOut: 0,
      status: "no-html-found",
      artifactsDir,
      manifestPath,
    });

    const manifest = await readManifest(manifestPath);
    expect(manifest).toHaveLength(2);
    expect(manifest.map((r) => r.modelSlug)).toEqual(["a", "b"]);
  });

  it("readManifest returns [] when the manifest does not exist", async () => {
    const manifest = await readManifest(path.join(tmpDir, "nope", "manifest.json"));
    expect(manifest).toEqual([]);
  });
});
