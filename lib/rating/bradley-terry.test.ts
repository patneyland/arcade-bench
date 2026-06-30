import { describe, it, expect } from "vitest";
import { computeBradleyTerry, type PairOutcome } from "./bradley-terry";

function repeat(a: string, b: string, winner: PairOutcome["winner"], n: number) {
  return Array.from({ length: n }, () => ({ a, b, winner }));
}

describe("computeBradleyTerry", () => {
  it("ranks an always-winning model highest", () => {
    const outcomes = repeat("winner", "loser", "a", 30);
    const { models } = computeBradleyTerry(outcomes, ["winner", "loser"]);
    expect(models.winner.rating).toBeGreaterThan(models.loser.rating);
  });

  it("produces a sensible total order from a transitive chain", () => {
    // best > mid > worst
    const outcomes: PairOutcome[] = [
      ...repeat("best", "mid", "a", 20),
      ...repeat("mid", "worst", "a", 20),
      ...repeat("best", "worst", "a", 20),
    ];
    const { models } = computeBradleyTerry(outcomes, ["best", "mid", "worst"]);
    expect(models.best.rating).toBeGreaterThan(models.mid.rating);
    expect(models.mid.rating).toBeGreaterThan(models.worst.rating);
  });

  it("gives equal ratings for symmetric data", () => {
    const outcomes: PairOutcome[] = [
      ...repeat("x", "y", "a", 15),
      ...repeat("x", "y", "b", 15),
    ];
    const { models } = computeBradleyTerry(outcomes, ["x", "y"]);
    expect(Math.abs(models.x.rating - models.y.rating)).toBeLessThan(1);
  });

  it("ties contribute as half-wins to both (symmetric -> equal)", () => {
    const outcomes = repeat("x", "y", "tie", 20);
    const { models } = computeBradleyTerry(outcomes, ["x", "y"]);
    expect(Math.abs(models.x.rating - models.y.rating)).toBeLessThan(1);
    expect(models.x.nVotes).toBe(20);
  });

  it("more votes => tighter interval", () => {
    const few = computeBradleyTerry(repeat("a", "b", "a", 4), ["a", "b"]);
    const many = computeBradleyTerry(repeat("a", "b", "a", 400), ["a", "b"]);
    expect(many.models.a.interval).toBeLessThan(few.models.a.interval);
  });

  it("a thin-data model gets a wide interval", () => {
    // 'a' has many votes, 'rare' has just one.
    const outcomes: PairOutcome[] = [
      ...repeat("a", "b", "a", 50),
      { a: "a", b: "rare", winner: "a" },
    ];
    const { models } = computeBradleyTerry(outcomes, ["a", "b", "rare"]);
    expect(models.rare.interval).toBeGreaterThan(models.a.interval);
    expect(models.rare.nVotes).toBe(1);
  });

  it("ignores both_bad for fitting but counts it nowhere in BT nVotes", () => {
    const outcomes: PairOutcome[] = [
      ...repeat("x", "y", "a", 10),
      ...repeat("x", "y", "both_bad", 5),
    ];
    const { models } = computeBradleyTerry(outcomes, ["x", "y"]);
    // both_bad excluded from BT's rating-affecting count
    expect(models.x.nVotes).toBe(10);
    expect(models.x.rating).toBeGreaterThan(models.y.rating);
  });

  it("seeds a zero-vote model at the center with the widest interval", () => {
    const outcomes = repeat("a", "b", "a", 10);
    const { models } = computeBradleyTerry(outcomes, ["a", "b", "ghost"]);
    expect(models.ghost.rating).toBeCloseTo(1000, 0);
    expect(models.ghost.nVotes).toBe(0);
    expect(models.ghost.interval).toBeGreaterThan(models.a.interval);
  });

  it("handles empty input without throwing", () => {
    const { models } = computeBradleyTerry([], []);
    expect(Object.keys(models)).toHaveLength(0);
  });
});
