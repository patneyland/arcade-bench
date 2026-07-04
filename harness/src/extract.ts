/**
 * extractHtml — pull a single self-contained HTML document out of a raw model
 * response. Pure and heavily tested.
 *
 * Handles:
 *   - clean HTML (just the document)
 *   - HTML wrapped in ```html ... ``` (or plain ``` ... ```) markdown fences
 *   - HTML with prose / apologies before and/or after
 *   - multiple fenced blocks (prefers the one containing HTML)
 *   - uppercase / lowercase <!DOCTYPE html>
 *   - responses with no HTML at all -> returns null
 */

/** Find the HTML document inside a string, from <!doctype html> or <html ...> to </html>. */
function isolateDocument(input: string): string | null {
  // Prefer a doctype start if present (case-insensitive), else an <html ...> tag.
  const doctypeMatch = /<!doctype\s+html/i.exec(input);
  const htmlOpenMatch = /<html[\s>]/i.exec(input);

  let startIndex: number | null = null;
  if (doctypeMatch && htmlOpenMatch) {
    startIndex = Math.min(doctypeMatch.index, htmlOpenMatch.index);
  } else if (doctypeMatch) {
    startIndex = doctypeMatch.index;
  } else if (htmlOpenMatch) {
    startIndex = htmlOpenMatch.index;
  }

  if (startIndex === null) return null;

  // Find the LAST closing </html> so trailing prose is excluded.
  const closeRegex = /<\/html\s*>/gi;
  let lastClose: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = closeRegex.exec(input)) !== null) {
    if (m.index >= startIndex) lastClose = m;
  }

  if (!lastClose) {
    // No closing tag — return from start to end, trimmed. Some models omit it.
    return input.slice(startIndex).trim();
  }

  const endIndex = lastClose.index + lastClose[0].length;
  return input.slice(startIndex, endIndex).trim();
}

/** Extract every fenced code block body from markdown. Returns blocks in order,
 *  each annotated with its info string (e.g. "html"). */
function extractFencedBlocks(input: string): Array<{ lang: string; body: string }> {
  const blocks: Array<{ lang: string; body: string }> = [];
  // ``` optionally followed by a language, newline, body, then closing ```
  const fenceRegex = /```([^\n`]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRegex.exec(input)) !== null) {
    blocks.push({ lang: (m[1] ?? "").trim().toLowerCase(), body: m[2] ?? "" });
  }
  return blocks;
}

export function extractHtml(raw: string): string | null {
  if (!raw || raw.trim().length === 0) return null;

  // 1. Try fenced code blocks first. Prefer an html-tagged block, then any block
  //    that actually contains an HTML document.
  const blocks = extractFencedBlocks(raw);
  if (blocks.length > 0) {
    const htmlTagged = blocks.find((b) => b.lang === "html" || b.lang === "htm");
    if (htmlTagged) {
      const doc = isolateDocument(htmlTagged.body);
      if (doc) return doc;
    }
    for (const block of blocks) {
      const doc = isolateDocument(block.body);
      if (doc) return doc;
    }
  }

  // 2. No usable fenced block — isolate the document from the raw text.
  return isolateDocument(raw);
}
