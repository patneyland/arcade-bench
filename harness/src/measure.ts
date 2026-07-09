/**
 * measureArtifacts — sweep public/artifacts and record each build's natural
 * content size in data/artifact-viewports.json.
 *
 * Why: the SandboxedPlayer renders every artifact into a fixed virtual viewport
 * and scales it to fit its frame (docs/ux-overhaul.md §1). The original 820×700
 * was sized to the then-worst artifact (808×688); taller builds (frogger) now
 * overflow it and scroll inside the iframe. The parent can never measure the
 * frame at runtime (strict sandbox, opaque origin), so natural sizes are
 * measured here, at harness time, and shipped as data the app reads.
 *
 * Algorithm per artifact: load at the 820×700 default with the network blocked
 * (mirroring the app sandbox) and read the document's scroll size. If it fits,
 * the default stands. If it overflows, grow the viewport to the scroll size
 * until stable (responsive pages re-measure after each change), at each of a
 * few candidate widths — wide layouts often beat the stacked layout a narrow
 * viewport forces — and keep the box that displays largest in the play window.
 *
 * Deterministic and idempotent: re-running overwrites the whole file. Run it
 * (`npm run measure:viewports` at the repo root) after every harness batch.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ARTIFACTS_DIR = path.join(REPO_ROOT, "public", "artifacts");
const OUTPUT_PATH = path.join(REPO_ROOT, "data", "artifact-viewports.json");

/** Minimal page surface we depend on (injectable for unit tests). */
export interface MeasurePage {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  setContent(html: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
}

export type MeasurePageProvider = <T>(fn: (page: MeasurePage) => Promise<T>) => Promise<T>;

export interface ViewportBox {
  width: number;
  height: number;
}

/** Mirrors the app-side default in lib/artifact-viewports.ts. */
export const DEFAULT_VIEWPORT: ViewportBox = { width: 820, height: 700 };

/** Candidate widths tried when content overflows the default box. */
const CANDIDATE_WIDTHS = [DEFAULT_VIEWPORT.width, 1024, 1280];
/** Hard cap — a page that keeps growing past this is pathological; clamp it. */
const MAX_DIM = 1600;
/** Let load-time layout/JS settle before reading scroll sizes. */
const SETTLE_MS = 400;
const MAX_GROW_STEPS = 4;
/** Slack added when a dimension has to grow, so builds whose layout shifts a few
 *  px after load (late font fallback, second-frame JS) still fit at runtime. */
const GROW_PAD = 16;
/** Reference stage (≈ the arcade play window on a common desktop) used to pick
 *  the friendliest bounding box among candidates. */
const REF_STAGE: ViewportBox = { width: 860, height: 594 };

/** How large the box renders when scaled to fit the reference stage. */
export function fitScale(box: ViewportBox, stage: ViewportBox = REF_STAGE): number {
  return Math.min(stage.width / box.width, stage.height / box.height);
}

/**
 * Pick the box that displays largest in the reference stage. Earlier candidates
 * win ties (within 2%) so the 820-wide default is preferred when widening
 * doesn't genuinely help.
 */
export function pickBestBox(boxes: ViewportBox[]): ViewportBox {
  let best = boxes[0];
  for (const box of boxes.slice(1)) {
    if (fitScale(box) > fitScale(best) * 1.02) best = box;
  }
  return best;
}

async function contentSize(page: MeasurePage): Promise<ViewportBox> {
  const read = () =>
    page.evaluate(() => {
      const d = document.documentElement;
      const b = document.body;
      return {
        width: Math.max(d ? d.scrollWidth : 0, b ? b.scrollWidth : 0),
        height: Math.max(d ? d.scrollHeight : 0, b ? b.scrollHeight : 0),
      };
    });
  try {
    return await read();
  } catch {
    // Some builds navigate mid-run (restart via location) and destroy the
    // execution context under our read — settle and try once more.
    await page.waitForTimeout(SETTLE_MS);
    return read();
  }
}

/**
 * Grow the viewport from a starting width until the content stops overflowing
 * (or the cap/step limit is hit). Content is re-loaded after every viewport
 * change so load-time JS lays out for the size it will actually get.
 */
export async function stableBoxAt(
  page: MeasurePage,
  html: string,
  startWidth: number,
): Promise<ViewportBox> {
  let box: ViewportBox = { width: startWidth, height: DEFAULT_VIEWPORT.height };
  for (let step = 0; step <= MAX_GROW_STEPS; step++) {
    await page.setViewportSize(box);
    await page.setContent(html, { waitUntil: "load", timeout: 8000 });
    await page.waitForTimeout(SETTLE_MS);
    const content = await contentSize(page);
    // Stable once the content fits; any overflowing dimension grows to the
    // content size plus slack (see GROW_PAD).
    if (content.width <= box.width && content.height <= box.height) return box;
    box = {
      width:
        content.width > box.width
          ? Math.min(MAX_DIM, Math.ceil(content.width) + GROW_PAD)
          : box.width,
      height:
        content.height > box.height
          ? Math.min(MAX_DIM, Math.ceil(content.height) + GROW_PAD)
          : box.height,
    };
  }
  return box;
}

/** Measure one artifact's viewport. Exported for direct unit testing. */
export async function measureArtifactWithPage(
  html: string,
  page: MeasurePage,
): Promise<ViewportBox> {
  const atDefault = await stableBoxAt(page, html, DEFAULT_VIEWPORT.width);
  if (
    atDefault.width === DEFAULT_VIEWPORT.width &&
    atDefault.height === DEFAULT_VIEWPORT.height
  ) {
    return DEFAULT_VIEWPORT;
  }
  const boxes = [atDefault];
  for (const width of CANDIDATE_WIDTHS.slice(1)) {
    boxes.push(await stableBoxAt(page, html, width));
  }
  return pickBestBox(boxes);
}

/** Real Playwright provider: one browser, network blocked like the app sandbox. */
async function defaultPageProvider<T>(fn: (page: MeasurePage) => Promise<T>): Promise<T> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    // The app's sandbox blocks all network — measure under the same conditions
    // (also keeps remote-font stragglers from slowing the sweep).
    await page.route("**/*", (route) => route.abort());
    return await fn(page as unknown as MeasurePage);
  } finally {
    await browser.close();
  }
}

export interface MeasureRunResult {
  /** artifactPath (e.g. /artifacts/frogger/glm-5-2.html) -> measured box. */
  viewports: Record<string, ViewportBox>;
  errors: string[];
}

/** Sweep every artifact under public/artifacts. */
export async function measureAllArtifacts(
  provider: MeasurePageProvider = defaultPageProvider,
  onLog: (message: string) => void = () => {},
): Promise<MeasureRunResult> {
  const games = await fs.readdir(ARTIFACTS_DIR, { withFileTypes: true });
  const files: string[] = [];
  for (const game of games) {
    if (!game.isDirectory()) continue;
    const entries = await fs.readdir(path.join(ARTIFACTS_DIR, game.name));
    for (const entry of entries) {
      if (entry.endsWith(".html")) files.push(`${game.name}/${entry}`);
    }
  }
  files.sort();

  const viewports: Record<string, ViewportBox> = {};
  const errors: string[] = [];

  await provider(async (page) => {
    for (const rel of files) {
      const artifactPath = `/artifacts/${rel}`;
      try {
        const html = await fs.readFile(path.join(ARTIFACTS_DIR, rel), "utf8");
        const box = await measureArtifactWithPage(html, page);
        viewports[artifactPath] = box;
        const isDefault =
          box.width === DEFAULT_VIEWPORT.width && box.height === DEFAULT_VIEWPORT.height;
        onLog(`${artifactPath}: ${box.width}×${box.height}${isDefault ? " (default)" : ""}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${artifactPath}: ${message}`);
        viewports[artifactPath] = DEFAULT_VIEWPORT;
        onLog(`${artifactPath}: measurement failed (${message}) — default recorded`);
      }
    }
  });

  return { viewports, errors };
}

export async function main(): Promise<void> {
  const { viewports, errors } = await measureAllArtifacts(undefined, (msg) =>
    console.log(msg),
  );
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(viewports, null, 2)}\n`, "utf8");
  console.log(`\nwrote ${Object.keys(viewports).length} entries to ${OUTPUT_PATH}`);
  if (errors.length > 0) {
    console.warn(`${errors.length} artifact(s) failed to measure (default recorded):`);
    for (const e of errors) console.warn(`  ${e}`);
  }
}

// Only run when invoked directly (tsx src/measure.ts), never on import during tests.
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
