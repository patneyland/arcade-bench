import { describe, it, expect } from "vitest";
import { computeElo, expectedScore, type PairOutcome } from "./elo";

describe("expectedScore", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 6);
  });
  it("favors the higher-rated player", () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
    expect(expectedScore(1000, 1200)).toBeLessThan(0.5);
  });
});

describe("computeElo", () => {
  it("ranks a model that always wins highest", () => {
    const outcomes: PairOutcome[] = Array.from({ length: 20 }, () => ({
      a: "winner",
      b: "loser",
      winner: "a" as const,
    }));
    const { ratings } = computeElo(outcomes, ["winner", "loser"]);
    expect(ratings.winner).toBeGreaterThan(ratings.loser);
    expect(ratings.winner).toBeGreaterThan(1000);
    expect(ratings.loser).toBeLessThan(1000);
  });

  it("keeps symmetric data near-equal", () => {
    const outcomes: PairOutcome[] = [];
    for (let i = 0; i < 10; i++) {
      outcomes.push({ a: "x", b: "y", winner: "a" });
      outcomes.push({ a: "x", b: "y", winner: "b" });
    }
    const { ratings } = computeElo(outcomes, ["x", "y"]);
    expect(Math.abs(ratings.x - ratings.y)).toBeLessThan(30);
  });

  it("treats a tie as a half point to both (no change at equal ratings)", () => {
    const { ratings } = computeElo([{ a: "x", b: "y", winner: "tie" }], ["x", "y"]);
    expect(ratings.x).toBeCloseTo(1000, 6);
    expect(ratings.y).toBeCloseTo(1000, 6);
  });

  it("ignores both_bad for rating but still seeds models", () => {
    const { ratings, counts } = computeElo(
      [{ a: "x", b: "y", winner: "both_bad" }],
      ["x", "y"],
    );
    expect(ratings.x).toBe(1000);
    expect(ratings.y).toBe(1000);
    expect(counts.x).toBe(0);
    expect(counts.y).toBe(0);
  });

  it("respects the K-factor (bigger K = bigger swing)", () => {
    const o: PairOutcome[] = [{ a: "x", b: "y", winner: "a" }];
    const small = computeElo(o, ["x", "y"], { k: 8 }).ratings.x;
    const big = computeElo(o, ["x", "y"], { k: 64 }).ratings.x;
    expect(big - 1000).toBeGreaterThan(small - 1000);
  });
});
