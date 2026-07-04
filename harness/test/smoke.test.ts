import { describe, it, expect } from "vitest";
import { smokeTest, smokeTestWithPage, type SmokePage } from "../src/smoke.js";
import { CLEAN_DOC } from "./fixtures.js";

/** A configurable mock page implementing the SmokePage surface. */
function makeMockPage(opts: {
  errorMessage?: string;
  throwOnSetContent?: string;
} = {}): SmokePage {
  let errorHandler: ((err: Error) => void) | null = null;
  return {
    on(_event, handler) {
      errorHandler = handler;
    },
    async setContent(_html, _options) {
      if (opts.throwOnSetContent) throw new Error(opts.throwOnSetContent);
      // Simulate the page emitting a pageerror during load.
      if (opts.errorMessage && errorHandler) errorHandler(new Error(opts.errorMessage));
    },
    async waitForTimeout(_ms) {
      // resolve immediately in tests
    },
  };
}

describe("smokeTestWithPage", () => {
  it("returns ok for a page that renders clean", async () => {
    const page = makeMockPage();
    const res = await smokeTestWithPage(CLEAN_DOC, page);
    expect(res.ok).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it("returns not-ok when the page throws a pageerror", async () => {
    const page = makeMockPage({ errorMessage: "ReferenceError: foo is not defined" });
    const res = await smokeTestWithPage(CLEAN_DOC, page);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("ReferenceError");
  });

  it("returns not-ok when setContent throws", async () => {
    const page = makeMockPage({ throwOnSetContent: "navigation timeout" });
    const res = await smokeTestWithPage(CLEAN_DOC, page);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("setContent failed");
  });
});

describe("smokeTest (with injected provider)", () => {
  it("renders clean via an injected page provider", async () => {
    const res = await smokeTest(CLEAN_DOC, {
      pageProvider: (fn) => fn(makeMockPage()),
    });
    expect(res.ok).toBe(true);
  });

  it("propagates a page error via an injected provider", async () => {
    const res = await smokeTest(CLEAN_DOC, {
      pageProvider: (fn) => fn(makeMockPage({ errorMessage: "boom on start" })),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("boom");
  });

  it("returns a graceful result when the browser is missing", async () => {
    const res = await smokeTest(CLEAN_DOC, {
      pageProvider: () => {
        throw new Error("Executable doesn't exist at /path/chromium");
      },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("playwright install");
  });

  it("returns a graceful result for any unexpected provider failure", async () => {
    const res = await smokeTest(CLEAN_DOC, {
      pageProvider: () => {
        throw new Error("some other failure");
      },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("some other failure");
  });
});
