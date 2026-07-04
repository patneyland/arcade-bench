import { describe, it, expect } from "vitest";
import { extractHtml } from "../src/extract.js";
import {
  CLEAN_DOC,
  FENCED_HTML,
  PLAIN_FENCED,
  PROSE_BEFORE_AND_AFTER,
  APOLOGY_THEN_CODE,
  NO_HTML,
  UPPERCASE_DOCTYPE,
  HTML_NO_DOCTYPE,
  MULTIPLE_FENCES,
} from "./fixtures.js";

describe("extractHtml", () => {
  it("returns a clean document unchanged (trimmed)", () => {
    const out = extractHtml(CLEAN_DOC);
    expect(out).not.toBeNull();
    expect(out).toContain("<!doctype html>");
    expect(out!.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("extracts from an ```html fenced block", () => {
    const out = extractHtml(FENCED_HTML);
    expect(out).toBe(CLEAN_DOC);
  });

  it("extracts from a plain ``` fenced block", () => {
    const out = extractHtml(PLAIN_FENCED);
    expect(out).toBe(CLEAN_DOC);
  });

  it("strips prose before and after the document", () => {
    const out = extractHtml(PROSE_BEFORE_AND_AFTER);
    expect(out).not.toBeNull();
    expect(out!.startsWith("<!doctype html>")).toBe(true);
    expect(out!.trimEnd().endsWith("</html>")).toBe(true);
    expect(out).not.toContain("Let me know");
    expect(out).not.toContain("Sure!");
  });

  it("handles an apology followed by a fenced code block", () => {
    const out = extractHtml(APOLOGY_THEN_CODE);
    expect(out).toBe(CLEAN_DOC);
    expect(out).not.toContain("I'm sorry");
  });

  it("returns null when there is no HTML", () => {
    expect(extractHtml(NO_HTML)).toBeNull();
  });

  it("returns null on empty / whitespace input", () => {
    expect(extractHtml("")).toBeNull();
    expect(extractHtml("   \n  ")).toBeNull();
  });

  it("handles an uppercase <!DOCTYPE HTML>", () => {
    const out = extractHtml(UPPERCASE_DOCTYPE);
    expect(out).not.toBeNull();
    expect(out!.toLowerCase()).toContain("<!doctype html>");
    expect(out!.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("handles HTML with no doctype (starts at <html>)", () => {
    const out = extractHtml(HTML_NO_DOCTYPE);
    expect(out).not.toBeNull();
    expect(out!.startsWith("<html>")).toBe(true);
    expect(out!.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("picks the HTML block when multiple fences are present", () => {
    const out = extractHtml(MULTIPLE_FENCES);
    expect(out).toBe(CLEAN_DOC);
    expect(out).not.toContain("pseudocode");
    expect(out).not.toContain("function tick");
  });

  it("excludes trailing prose after </html> when not fenced", () => {
    const raw = CLEAN_DOC + "\n\nHope you enjoy the game!";
    const out = extractHtml(raw);
    expect(out).not.toBeNull();
    expect(out).not.toContain("Hope you enjoy");
    expect(out!.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("uses the last </html> so nested mentions don't truncate early", () => {
    const raw =
      "<!doctype html><html><body><p>the tag &lt;/html&gt; appears in text</p>" +
      "<script>var s='</html>';</script></body></html>";
    const out = extractHtml(raw);
    expect(out).not.toBeNull();
    // Must include the real final </html> and the script content.
    expect(out!.trimEnd().endsWith("</html>")).toBe(true);
    expect(out).toContain("var s=");
  });
});
