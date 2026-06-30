import { describe, it, expect } from "vitest";
import { computeRatings, type RatingVote } from "./index";

function vote(
  gameId: string,
  modelA: string,
  modelB: string,
  winner: RatingVote["winner"],
): RatingVote {
  return { gameId, modelA, modelB, winner };
}

describe("computeRatings", () => {
  it("orders models by latent quality overall", () => {
    const votes: RatingVote[] = [];
    // best > mid > worst across two games
    for (let i = 0; i < 15; i++) {
      votes.push(vote("g1", "best", "mid", "a"));
      votes.push(vote("g1", "mid", "worst", "a"));
      votes.push(vote("g2", "best", "worst", "a"));
    }
    const { overall, perGame } = computeRatings(votes, ["best", "mid", "worst"]);
    expect(overall[0].modelId).toBe("best");
    expect(overall[overall.length - 1].modelId).toBe("worst");
    expect(perGame.g1).toBeDefined();
    expect(perGame.g2).toBeDefined();
  });

  it("counts both_bad votes are skipped from rating but models still appear", () => {
    const votes: RatingVote[] = [
      ...Array.from({ length: 5 }, () => vote("g1", "x", "y", "both_bad")),
    ];
    const { overall } = computeRatings(votes, ["x", "y"]);
    expect(overall).toHaveLength(2);
    // No signal -> both near center.
    expect(Math.abs(overall[0].rating - overall[1].rating)).toBeLessThan(1);
  });

  it("includes zero-vote models at center with wide intervals", () => {
    const votes = Array.from({ length: 10 }, () => vote("g1", "a", "b", "a"));
    const { overall } = computeRatings(votes, ["a", "b", "unseen"]);
    const unseen = overall.find((r) => r.modelId === "unseen")!;
    expect(unseen.nVotes).toBe(0);
    expect(unseen.rating).toBeCloseTo(1000, 0);
    const a = overall.find((r) => r.modelId === "a")!;
    expect(unseen.interval).toBeGreaterThan(a.interval);
  });

  it("ignores self-pairings (same model on both sides)", () => {
    const votes = [vote("g1", "a", "a", "a")];
    const { overall } = computeRatings(votes, ["a", "b"]);
    // No real comparison -> a stays at center.
    const a = overall.find((r) => r.modelId === "a")!;
    expect(a.rating).toBeCloseTo(1000, 0);
  });
});
