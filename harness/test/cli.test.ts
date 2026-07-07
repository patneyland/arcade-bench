import { describe, it, expect } from "vitest";
import { parseArgs, loadConfig } from "../src/cli.js";

describe("parseArgs", () => {
  it("parses game, model, and samples", () => {
    const args = parseArgs(["--game", "pong", "--model", "qwen3-4b", "--samples", "5"]);
    expect(args.game).toBe("pong");
    expect(args.model).toBe("qwen3-4b");
    expect(args.samples).toBe(5);
  });

  it("defaults samples to 3 and flags to false", () => {
    const args = parseArgs([]);
    expect(args.samples).toBe(3);
    expect(args.all).toBe(false);
    expect(args.list).toBe(false);
  });

  it("parses --all and --list flags", () => {
    const args = parseArgs(["--all", "--list"]);
    expect(args.all).toBe(true);
    expect(args.list).toBe(true);
  });

  it("ignores a non-positive samples value", () => {
    const args = parseArgs(["--samples", "0"]);
    expect(args.samples).toBe(3);
  });

  it("parses --max-tokens", () => {
    const args = parseArgs(["--max-tokens", "24000"]);
    expect(args.maxTokens).toBe(24000);
  });

  it("leaves maxTokens undefined by default and ignores invalid values", () => {
    expect(parseArgs([]).maxTokens).toBeUndefined();
    expect(parseArgs(["--max-tokens", "0"]).maxTokens).toBeUndefined();
    expect(parseArgs(["--max-tokens", "nope"]).maxTokens).toBeUndefined();
  });
});

describe("loadConfig (canonical manifest)", () => {
  it("loads the 9 canonical games with exact slugs", async () => {
    const { games } = await loadConfig();
    expect(games.map((g) => g.slug)).toEqual([
      "pong",
      "snake",
      "breakout",
      "space-invaders",
      "asteroids",
      "pac-man",
      "missile-command",
      "frogger",
      "tetris",
    ]);
    const pong = games.find((g) => g.slug === "pong");
    expect(pong).toMatchObject({ name: "Pong", year: 1972, creator: "Atari" });
  });

  it("loads the 10 canonical models with exact slugs and openrouter ids", async () => {
    const { models } = await loadConfig();
    expect(models.map((m) => m.slug)).toEqual([
      "gemini-flash-lite",
      "gpt-4-1-nano",
      "deepseek-v3",
      "qwen3-8b",
      "gemma-3-4b",
      "ministral-8b",
      "claude-opus-4-8",
      "gpt-5-5",
      "gemini-3-1-pro",
      "glm-5-2",
    ]);
    const byId = Object.fromEntries(models.map((m) => [m.slug, m.openrouterId]));
    expect(byId["gemini-flash-lite"]).toBe("google/gemini-2.5-flash-lite");
    expect(byId["gpt-4-1-nano"]).toBe("openai/gpt-4.1-nano");
    expect(byId["deepseek-v3"]).toBe("deepseek/deepseek-chat");
    expect(byId["qwen3-8b"]).toBe("qwen/qwen3-8b");
    expect(byId["gemma-3-4b"]).toBe("google/gemma-3-4b-it");
    expect(byId["ministral-8b"]).toBe("mistralai/ministral-8b-2512");
    expect(byId["claude-opus-4-8"]).toBe("anthropic/claude-opus-4.8");
    expect(byId["gpt-5-5"]).toBe("openai/gpt-5.5");
    expect(byId["gemini-3-1-pro"]).toBe("google/gemini-3.1-pro-preview");
    expect(byId["glm-5-2"]).toBe("z-ai/glm-5.2");
  });
});
