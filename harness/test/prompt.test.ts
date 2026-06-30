import { describe, it, expect } from "vitest";
import { LOCKED_PROMPT, buildPrompt } from "../src/prompt.js";

describe("LOCKED_PROMPT", () => {
  it("matches the locked wording with the game name interpolated", () => {
    expect(LOCKED_PROMPT("Pong")).toBe(
      "Create Pong as a single self-contained HTML file that runs in a browser.",
    );
  });

  it("only the game name changes", () => {
    expect(LOCKED_PROMPT("Asteroids")).toBe(
      "Create Asteroids as a single self-contained HTML file that runs in a browser.",
    );
  });

  it("buildPrompt is an alias of LOCKED_PROMPT", () => {
    expect(buildPrompt("Snake")).toBe(LOCKED_PROMPT("Snake"));
  });
});
