import { describe, it, expect } from "vitest";
import { validateSelfContained } from "../src/validate.js";
import { CLEAN_DOC, SELF_CONTAINED_WITH_DATA_URI } from "./fixtures.js";

describe("validateSelfContained", () => {
  it("passes a clean self-contained document", () => {
    const res = validateSelfContained(CLEAN_DOC);
    expect(res.ok).toBe(true);
    expect(res.violations).toEqual([]);
  });

  it("passes inline styles and data: URIs", () => {
    const res = validateSelfContained(SELF_CONTAINED_WITH_DATA_URI);
    expect(res.ok).toBe(true);
    expect(res.violations).toEqual([]);
  });

  it("flags an external <script src>", () => {
    const html = `<html><head><script src="https://cdn.example.com/lib.js"></script></head></html>`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("external <script src>"))).toBe(true);
  });

  it("flags a protocol-relative <script src>", () => {
    const html = `<script src="//cdn.example.com/a.js"></script>`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("external <script src>"))).toBe(true);
  });

  it("allows an inline (no src) script", () => {
    const html = `<script>console.log("ok")</script>`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(true);
  });

  it("flags an external stylesheet <link>", () => {
    const html = `<link rel="stylesheet" href="https://fonts.example.com/x.css">`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("external stylesheet"))).toBe(true);
  });

  it("flags a remote <img src http...>", () => {
    const html = `<img src="http://example.com/sprite.png">`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("remote <img src>"))).toBe(true);
  });

  it("flags fetch(", () => {
    const html = `<script>fetch("/data").then(r=>r.json())</script>`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("fetch("))).toBe(true);
  });

  it("flags XMLHttpRequest", () => {
    const html = `<script>const x = new XMLHttpRequest();</script>`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("XMLHttpRequest"))).toBe(true);
  });

  it("flags WebSocket", () => {
    const html = `<script>const s = new WebSocket("wss://x");</script>`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("WebSocket"))).toBe(true);
  });

  it("flags dynamic import() from a URL", () => {
    const html = `<script type="module">import("https://esm.sh/three")</script>`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("dynamic import from URL"))).toBe(true);
  });

  it("flags @import url(http...) in CSS", () => {
    const html = `<style>@import url("https://fonts.googleapis.com/css?x");</style>`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("@import external URL"))).toBe(true);
  });

  it("collects multiple violations at once", () => {
    const html =
      `<link rel="stylesheet" href="https://a.com/x.css">` +
      `<script src="https://a.com/y.js"></script>` +
      `<script>fetch("/z")</script>`;
    const res = validateSelfContained(html);
    expect(res.ok).toBe(false);
    expect(res.violations.length).toBeGreaterThanOrEqual(3);
  });
});
