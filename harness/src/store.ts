/**
 * storeArtifact — write the HTML artifact to the repo's public artifact tree and
 * append a metadata record to the harness manifest.
 *
 * Artifact path on disk (resolved relative to the repo root, i.e. one level up
 * from harness/):  public/artifacts/<game-slug>/<model-slug>.html
 * Public web path stored in the record:  /artifacts/<game-slug>/<model-slug>.html
 *
 * The manifest lives at harness/out/manifest.json and is appended to (created if
 * absent). A no-html-found record has a null artifactPath and writes no file.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ArtifactRecord, GenerationStatus } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** harness/ root (src/ -> ..). */
export const HARNESS_ROOT = path.resolve(__dirname, "..");
/** repo root (harness/ -> ..). */
export const REPO_ROOT = path.resolve(HARNESS_ROOT, "..");

export interface StoreArtifactParams {
  modelSlug: string;
  gameSlug: string;
  sampleIndex: number;
  /** The extracted HTML, or null when no HTML was found. */
  html: string | null;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  status: GenerationStatus;
  /** Override the public artifacts dir (for tests). Defaults to <repo>/public/artifacts. */
  artifactsDir?: string;
  /** Override the manifest path (for tests). Defaults to <harness>/out/manifest.json. */
  manifestPath?: string;
}

function defaultArtifactsDir(): string {
  return path.join(REPO_ROOT, "public", "artifacts");
}

function defaultManifestPath(): string {
  return path.join(HARNESS_ROOT, "out", "manifest.json");
}

/** Read the existing manifest array, tolerating a missing or empty file. */
export async function readManifest(manifestPath: string): Promise<ArtifactRecord[]> {
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ArtifactRecord[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function storeArtifact(params: StoreArtifactParams): Promise<ArtifactRecord> {
  const {
    modelSlug,
    gameSlug,
    sampleIndex,
    html,
    cost,
    tokensIn,
    tokensOut,
    status,
  } = params;

  const artifactsDir = params.artifactsDir ?? defaultArtifactsDir();
  const manifestPath = params.manifestPath ?? defaultManifestPath();

  let artifactPath: string | null = null;

  // Only write a file when we actually have HTML to write.
  if (html !== null && html.length > 0) {
    const gameDir = path.join(artifactsDir, gameSlug);
    await fs.mkdir(gameDir, { recursive: true });
    const fileName = `${modelSlug}.html`;
    const diskPath = path.join(gameDir, fileName);
    await fs.writeFile(diskPath, html, "utf8");
    // Public web path uses forward slashes regardless of OS.
    artifactPath = `/artifacts/${gameSlug}/${fileName}`;
  }

  const record: ArtifactRecord = {
    modelSlug,
    gameSlug,
    sampleIndex,
    artifactPath,
    cost,
    tokensIn,
    tokensOut,
    status,
  };

  // Append to the manifest.
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  const manifest = await readManifest(manifestPath);
  manifest.push(record);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return record;
}
