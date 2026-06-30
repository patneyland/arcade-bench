/**
 * validateSelfContained — confirm an HTML artifact is one self-contained file
 * with no external dependencies or network access.
 *
 * Flags:
 *   - external <script src="http..."> / protocol-relative //
 *   - external <link rel="stylesheet" href="http...">
 *   - <img src="http..."> (remote images)
 *   - fetch( / XMLHttpRequest / WebSocket / dynamic import() from a URL
 *   - @import url(http...) in CSS
 *
 * Inline content and data: URIs are fine and never flagged.
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

export function validateSelfContained(html: string): ValidationResult {
  const violations: string[] = [];

  // External <script src="...">
  const scriptSrcRe = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const m of html.matchAll(scriptSrcRe)) {
    const url = m[1] ?? "";
    if (isExternalUrl(url)) violations.push(`external <script src>: ${url}`);
  }

  // External stylesheet <link rel="stylesheet" href="...">
  const linkRe = /<link\b[^>]*>/gi;
  for (const m of html.matchAll(linkRe)) {
    const tag = m[0];
    if (/rel\s*=\s*["'][^"']*stylesheet[^"']*["']/i.test(tag)) {
      const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
      const url = hrefMatch?.[1] ?? "";
      if (isExternalUrl(url)) violations.push(`external stylesheet <link href>: ${url}`);
    }
  }

  // Remote <img src="http...">
  const imgRe = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const m of html.matchAll(imgRe)) {
    const url = m[1] ?? "";
    if (isExternalUrl(url)) violations.push(`remote <img src>: ${url}`);
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

  // CSS @import url(http...)
  const cssImportRe = /@import\s+(?:url\(\s*)?["']?([^"')\s]+)["']?\s*\)?/gi;
  for (const m of html.matchAll(cssImportRe)) {
    const url = m[1] ?? "";
    if (isExternalUrl(url)) violations.push(`@import external URL: ${url}`);
  }

  return { ok: violations.length === 0, violations };
}
