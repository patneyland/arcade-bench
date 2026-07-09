/**
 * validateSelfContained — confirm an HTML artifact is one self-contained file
 * with no external dependencies or network access.
 *
 * Flags:
 *   - ANY <script src="..."> that is not a data:/blob: URI (remote AND relative files)
 *   - ANY <link rel="stylesheet" href="..."> that is not a data:/blob: URI
 *   - <img src="..."> pointing at a remote URL or a relative file
 *   - fetch( / XMLHttpRequest / WebSocket / dynamic import() from a URL
 *   - @import in CSS pointing at a remote URL or a relative file
 *
 * Inline content, data:/blob: URIs, and fragment-only (#...) references are
 * fine and never flagged. A self-contained artifact has no business referencing
 * any external file — even a relative one like "style.css" (it won't exist next
 * to the artifact and produces a blank page).
 */

export interface ValidationResult {
  ok: boolean;
  violations: string[];
}

/** True if a URL string points outside the file (http(s):// or protocol-relative //). */
function isExternalUrl(url: string): boolean {
  const u = url.trim();
  return /^https?:\/\//i.test(u) || /^\/\//.test(u);
}

/**
 * True if a URL string references a file at all — remote OR relative/absolute
 * path. Only self-contained references are exempt: data: URIs, blob: URIs,
 * fragment-only refs (#id), and empty strings.
 */
function isFileReference(url: string): boolean {
  const u = url.trim();
  if (u === "") return false;
  if (/^(data|blob):/i.test(u)) return false;
  if (u.startsWith("#")) return false;
  return true;
}

export function validateSelfContained(html: string): ValidationResult {
  const violations: string[] = [];

  // <script src="..."> — any file reference (remote or relative) is a violation
  const scriptSrcRe = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const m of html.matchAll(scriptSrcRe)) {
    const url = m[1] ?? "";
    if (isFileReference(url)) violations.push(`external <script src>: ${url}`);
  }

  // <link rel="stylesheet" href="..."> — any file reference is a violation
  const linkRe = /<link\b[^>]*>/gi;
  for (const m of html.matchAll(linkRe)) {
    const tag = m[0];
    if (/rel\s*=\s*["'][^"']*stylesheet[^"']*["']/i.test(tag)) {
      const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
      const url = hrefMatch?.[1] ?? "";
      if (isFileReference(url)) violations.push(`external stylesheet <link href>: ${url}`);
    }
  }

  // <img src="..."> — remote URLs and relative file references are violations
  // (data:/blob: URIs and fragment-only refs stay valid)
  const imgRe = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const m of html.matchAll(imgRe)) {
    const url = m[1] ?? "";
    if (isExternalUrl(url)) {
      violations.push(`remote <img src>: ${url}`);
    } else if (isFileReference(url)) {
      violations.push(`relative <img src>: ${url}`);
    }
  }

  // fetch(...) network calls
  if (/\bfetch\s*\(/.test(html)) {
    violations.push("network call: fetch(");
  }

  // XMLHttpRequest
  if (/\bXMLHttpRequest\b/.test(html)) {
    violations.push("network call: XMLHttpRequest");
  }

  // WebSocket
  if (/\bWebSocket\b/.test(html)) {
    violations.push("network call: WebSocket");
  }

  // Dynamic import() from a URL string, e.g. import("https://...") or import('//...')
  const dynImportRe = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gi;
  for (const m of html.matchAll(dynImportRe)) {
    const url = m[1] ?? "";
    if (isExternalUrl(url)) violations.push(`dynamic import from URL: ${url}`);
  }

  // CSS @import — remote URLs and relative file references are violations
  const cssImportRe = /@import\s+(?:url\(\s*)?["']?([^"')\s]+)["']?\s*\)?/gi;
  for (const m of html.matchAll(cssImportRe)) {
    const url = m[1] ?? "";
    if (isExternalUrl(url)) {
      violations.push(`@import external URL: ${url}`);
    } else if (isFileReference(url)) {
      violations.push(`@import relative file: ${url}`);
    }
  }

  return { ok: violations.length === 0, violations };
}
