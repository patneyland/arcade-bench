import { describe, it, expect } from "vitest";
import {
  DEFAULT_VIEWPORT,
  fitScale,
  measureArtifactWithPage,
  pickBestBox,
  stableBoxAt,
  type MeasurePage,
  type ViewportBox,
} from "../src/measure.js";

/**
 * Fake page whose reported content size is a function of the current viewport —
 * enough to model both fixed-size pages and responsive ones (glm's side panel
 * that stacks below the canvas at narrow widths).
 */
function fakePage(contentAt: (viewport: ViewportBox) => ViewportBox): MeasurePage {
  let viewport: ViewportBox = { ...DEFAULT_VIEWPORT };
  return {
    async setViewportSize(size) {
      viewport = { ...size };
    },
    async setContent() {},
    async waitForTimeout() {},
    async evaluate<T>(): Promise<T> {
      return contentAt(viewport) as T;
    },
  };
}

describe("pickBestBox", () => {
  it("keeps the first (default-width) box on ties", () => {
    const a = { width: 820, height: 803 };
    const b = { width: 1024, height: 803 };
    expect(pickBestBox([a, b])).toBe(a);
  });

  it("prefers the box that displays largest in the reference stage", () => {
    const tall = { width: 820, height: 1500 }; // stacked responsive layout
    const wide = { width: 1024, height: 811 }; // side-by-side layout
    expect(fitScale(wide)).toBeGreaterThan(fitScale(tall));
    expect(pickBestBox([tall, wide])).toBe(wide);
  });
});

describe("stableBoxAt", () => {
  it("keeps the starting box when the content fits", async () => {
    const page = fakePage(() => ({ width: 600, height: 660 }));
    expect(await stableBoxAt(page, "<html/>", 820)).toEqual(DEFAULT_VIEWPORT);
  });

  it("grows the viewport until the content stops overflowing (plus slack)", async () => {
    // Fixed-size page taller than the default viewport; the grown dimension
    // gets 16px of slack for post-load layout shifts.
    const page = fakePage(() => ({ width: 600, height: 836 }));
    expect(await stableBoxAt(page, "<html/>", 820)).toEqual({ width: 820, height: 852 });
  });

  it("caps runaway growth at the max dimension", async () => {
    // Pathological page that always reports more content than the viewport.
    const page = fakePage((v) => ({ width: v.width, height: v.height + 500 }));
    const box = await stableBoxAt(page, "<html/>", 820);
    expect(box.height).toBe(1600);
  });
});

describe("measureArtifactWithPage", () => {
  it("returns the default for a build that fits", async () => {
    const page = fakePage(() => ({ width: 520, height: 560 }));
    expect(await measureArtifactWithPage("<html/>", page)).toEqual(DEFAULT_VIEWPORT);
  });

  it("picks a wider candidate when the narrow layout stacks tall (responsive builds)", async () => {
    // Below 920px the side panel stacks under the canvas (very tall); at or
    // above it the layout is side-by-side and fits in 1024×811.
    const page = fakePage((v) =>
      v.width < 920 ? { width: v.width, height: 1500 } : { width: 1024, height: 811 },
    );
    expect(await measureArtifactWithPage("<html/>", page)).toEqual({
      width: 1024,
      height: 827, // 811 + 16px slack
    });
  });

  it("keeps the default width for a merely-tall fixed-size build", async () => {
    const page = fakePage(() => ({ width: 600, height: 836 }));
    expect(await measureArtifactWithPage("<html/>", page)).toEqual({
      width: 820,
      height: 852, // 836 + 16px slack
    });
  });
});
