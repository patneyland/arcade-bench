import { describe, it, expect } from "vitest";
import { render, within } from "@testing-library/react";
import { LeaderboardTable } from "./LeaderboardTable";
import type { LeaderboardRow } from "@/lib/types";

function row(over: Partial<LeaderboardRow> & { rank: number; name: string }): LeaderboardRow {
  const { rank, name, ...rest } = over;
  return {
    rank,
    rating: 1400,
    interval: 38,
    nVotes: 50,
    ratingPerCent: 120,
    model: {
      id: `m-${rank}`,
      slug: name.toLowerCase(),
      name,
      vendor: "Google",
      paramSize: "4B",
      costPerGen: 0.003,
      tier: "featherweight",
    },
    ...rest,
  };
}

describe("LeaderboardTable", () => {
  it("renders an empty state when there are no rows", () => {
    const { getByText } = render(<LeaderboardTable rows={[]} />);
    expect(getByText("No ratings yet")).toBeInTheDocument();
  });

  it("renders one row per model with rating and ±CI", () => {
    const rows = [
      row({ rank: 1, name: "Gemma-3-4b", rating: 1412, interval: 38 }),
      row({ rank: 2, name: "Qwen3-4b", rating: 1380, interval: 51 }),
    ];
    const { getByText, getAllByRole } = render(<LeaderboardTable rows={rows} />);
    expect(getByText("Gemma-3-4b")).toBeInTheDocument();
    expect(getByText("Qwen3-4b")).toBeInTheDocument();
    expect(getByText("1412")).toBeInTheDocument();
    expect(getByText("±38")).toBeInTheDocument();
    // header row + 2 data rows
    expect(getAllByRole("row")).toHaveLength(3);
  });

  it("gives the #1 row the ★ 1 crown chip", () => {
    const rows = [row({ rank: 1, name: "Top" }), row({ rank: 2, name: "Second" })];
    const { getByText } = render(<LeaderboardTable rows={rows} />);
    expect(getByText("★ 1")).toBeInTheDocument();
  });

  it("right-aligns numeric columns (Rating, Params, Cost, Rating/¢)", () => {
    const rows = [row({ rank: 1, name: "Only" })];
    const { getAllByRole } = render(<LeaderboardTable rows={rows} />);
    const headers = getAllByRole("columnheader");
    const labels = headers.map((h) => h.textContent);
    // The four numeric headers must carry text-right.
    ["Rating", "Params", "Cost / gen", "Rating / ¢"].forEach((label) => {
      const th = headers[labels.indexOf(label)];
      expect(th.className).toContain("text-right");
    });
  });

  it("respects the limit prop for previews", () => {
    const rows = [
      row({ rank: 1, name: "A" }),
      row({ rank: 2, name: "B" }),
      row({ rank: 3, name: "C" }),
    ];
    const { getAllByRole, queryByText } = render(<LeaderboardTable rows={rows} limit={2} />);
    // header + 2 rows
    expect(getAllByRole("row")).toHaveLength(3);
    expect(queryByText("C")).toBeNull();
  });
});
