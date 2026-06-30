/**
 * smokeTest — headless render check. Loads the HTML in a chromium page via
 * `page.setContent`, watches for uncaught page errors during the first ~1.5s,
 * and reports ok if it renders without throwing on start.
 *
 * Playwright is used by default but the page is injectable so unit tests can
 * pass a mock and never require a downloaded browser. If the browser is not
 * installed, this returns a clear { ok:false, error } rather than crashing the run.
 */

/** Minimal page surface we depend on. */
export interface SmokePage {
  on(event: "pageerror", handler: (err: Error) => void): void;
  setContent(html: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
}

/** A page factory: opens a fresh page, runs the callback, and always cleans up. */
export type PageProvider = <T>(fn: (page: SmokePage) => Promise<T>) => Promise<T>;

export interface SmokeResult {
  ok: boolean;
  error?: string;
}

/** How long to watch for start-up errors. */
const WATCH_MS = 1500;

/** Run the smoke logic against a given page. Exported for direct unit testing. */
export async function smokeTestWithPage(html: string, page: SmokePage): Promise<SmokeResult> {
  const errors: string[] = [];
  page.on("pageerror", (err: Error) => {
    errors.push(err?.message ?? String(err));
  });

  try {
    await page.setContent(html, { waitUntil: "load", timeout: WATCH_MS * 4 });
  } catch (err) {
    return { ok: false, error: `setContent failed: ${(err as Error).message}` };
  }

  await page.waitForTimeout(WATCH_MS);

  if (errors.length > 0) {
    return { ok: false, error: errors[0] };
  }
  return { ok: true };
}

/** Default Playwright-backed page provider. Lazy-imported and guarded so a
 *  missing browser yields a catchable error instead of crashing. */
async function defaultPageProvider<T>(fn: (page: SmokePage) => Promise<T>): Promise<T> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    return await fn(page as unknown as SmokePage);
  } finally {
    await browser.close();
  }
}

export interface SmokeTestOptions {
  /** Inject a page provider (for tests). Defaults to real Playwright chromium. */
  pageProvider?: PageProvider;
}

export async function smokeTest(
  html: string,
  options: SmokeTestOptions = {},
): Promise<SmokeResult> {
  const provider = options.pageProvider ?? defaultPageProvider;
  try {
    return await provider((page) => smokeTestWithPage(html, page));
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    // Common case: browser binary not installed.
    if (
      /Executable doesn't exist|playwright install|browserType\.launch|ENOENT/i.test(message)
    ) {
      return {
        ok: false,
        error:
          "Playwright chromium browser is not installed. Run `npx playwright install chromium`. " +
          `(${message})`,
      };
    }
    return { ok: false, error: message };
  }
}
