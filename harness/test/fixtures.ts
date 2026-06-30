/** Shared fixtures for harness tests. */

export const CLEAN_DOC = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Pong</title>
<style>body{margin:0;background:#000}</style>
</head>
<body>
<canvas id="c" width="640" height="480"></canvas>
<script>
const c = document.getElementById("c");
const ctx = c.getContext("2d");
ctx.fillStyle = "#fff";
ctx.fillRect(10, 10, 20, 20);
</script>
</body>
</html>`;

export const FENCED_HTML = "```html\n" + CLEAN_DOC + "\n```";

export const PLAIN_FENCED = "```\n" + CLEAN_DOC + "\n```";

export const PROSE_BEFORE_AND_AFTER =
  "Sure! Here is a simple Pong game for you:\n\n" +
  CLEAN_DOC +
  "\n\nLet me know if you'd like any changes!";

export const APOLOGY_THEN_CODE =
  "I'm sorry for the confusion earlier. Here's the corrected version:\n\n" +
  "```html\n" +
  CLEAN_DOC +
  "\n```";

export const NO_HTML =
  "I'm sorry, but I can't create that game. Could you clarify what you mean?";

export const UPPERCASE_DOCTYPE = CLEAN_DOC.replace("<!doctype html>", "<!DOCTYPE HTML>");

export const HTML_NO_DOCTYPE = `<html><head><title>Snake</title></head>
<body><div id="game">snake</div><script>console.log("ok")</script></body></html>`;

/** A response with a non-HTML fenced block first, then the HTML one. */
export const MULTIPLE_FENCES =
  "First, some pseudocode:\n\n" +
  "```js\nfunction tick(){ /* ... */ }\n```\n\n" +
  "And here is the full game:\n\n" +
  "```html\n" +
  CLEAN_DOC +
  "\n```";

/** HTML that throws on start (for smoke tests / broken status). */
export const THROWING_HTML = `<!doctype html><html><body>
<script>throw new Error("boom on start");</script>
</body></html>`;

/** A self-contained doc with inline data: URI and inline styles (should pass validation). */
export const SELF_CONTAINED_WITH_DATA_URI = `<!doctype html><html><head>
<style>body{background:#111}</style></head>
<body>
<img src="data:image/png;base64,iVBORw0KGgoAAAANS=" alt="sprite">
<div style="color:red">hi</div>
<script>const x = 1;</script>
</body></html>`;
