import { describe, it, expect } from "vitest";
import { render, within } from "@testing-library/react";
import { LeaderboardTable, formatCostCents } from "./LeaderboardTable";
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

  it("marks the best Rating/¢ row with the efficiency crown", () => {
    const rows = [
      row({ rank: 1, name: "Champ", ratingPerCent: 120 }),
      row({ rank: 2, name: "Effy", ratingPerCent: 900 }),
      row({ rank: 3, name: "Third", ratingPerCent: 300 }),
    ];
    const { getByText } = render(<LeaderboardTable rows={rows} />);
    const effRow = getByText("Effy").closest("tr")!;
    expect(within(effRow).getByText(/BEST \/¢/)).toBeInTheDocument();
    // Only one efficiency crown on the board.
    const champRow = getByText("Champ").closest("tr")!;
    expect(within(champRow).queryByText(/BEST \/¢/)).toBeNull();
  });

  it("suppresses both crowns when fewer than 2 rows are shown", () => {
    const rows = [row({ rank: 1, name: "Lonely", ratingPerCent: 500 })];
    const { queryByText, getByText } = render(<LeaderboardTable rows={rows} />);
    expect(queryByText("★ 1")).toBeNull();
    expect(queryByText(/BEST \/¢/)).toBeNull();
    // Plain rank still renders.
    expect(getByText("1")).toBeInTheDocument();
  });

  it("formats cost in sub-cent-safe cents (never $0.000)", () => {
    expect(formatCostCents(0.003)).toBe("0.3¢");
    expect(formatCostCents(0.00044)).toBe("0.044¢");
    expect(formatCostCents(0.0125)).toBe("1.25¢");
    expect(formatCostCents(0)).toBe("0¢");
    const cheap = row({ rank: 1, name: "Cheap" });
    cheap.model = { ...cheap.model, costPerGen: 0.00044 };
    const { getByText } = render(<LeaderboardTable rows={[cheap, row({ rank: 2, name: "Also" })]} />);
    expect(getByText("0.044¢")).toBeInTheDocument();
  });

  it("folds params into the model cell as a chip (no Params column)", () => {
    const rows = [
      row({ rank: 1, name: "WithParams" }),
      row({ rank: 2, name: "NoParams" }),
    ];
    rows[1].model = { ...rows[1].model, paramSize: null };
    const { getByText, getAllByRole } = render(<LeaderboardTable rows={rows} />);
    const labels = getAllByRole("columnheader").map((h) => h.textContent);
    expect(labels).not.toContain("Params");
    const withRow = getByText("WithParams").closest("tr")!;
    expect(within(withRow).getByText("4B params")).toBeInTheDocument();
    const withoutRow = getByText("NoParams").closest("tr")!;
    expect(within(withoutRow).queryByText(/params/)).toBeNull();
  });

  it("right-aligns numeric columns (Rating, Cost, Rating/¢)", () => {
    const rows = [row({ rank: 1, name: "Only" }), row({ rank: 2, name: "Two" })];
    const { getAllByRole } = render(<LeaderboardTable rows={rows} />);
    const headers = getAllByRole("columnheader");
    const labels = headers.map((h) => h.textContent);
    ["Rating", "Cost / gen", "Rating / ¢"].forEach((label) => {
      const th = headers[labels.indexOf(label)];
      expect(th.className).toContain("text-right");
    });
  });

  it("collapses middle columns under sm so #, Model and Rating/¢ survive 390px", () => {
    const rows = [row({ rank: 1, name: "A" }), row({ rank: 2, name: "B" })];
    const { getAllByRole } = render(<LeaderboardTable rows={rows} />);
    const headers = getAllByRole("columnheader");
    const labels = headers.map((h) => h.textContent);
    ["Vendor", "Rating", "Cost / gen"].forEach((label) => {
      const th = headers[labels.indexOf(label)];
      expect(th.className).toContain("hidden sm:table-cell");
    });
    // The promised column is never hidden.
    const ratingPerCent = headers[labels.indexOf("Rating / ¢")];
    expect(ratingPerCent.className).not.toContain("hidden");
  });

  it("renders the playability record from populated fields", () => {
    const rows = [
      row({ rank: 1, name: "Solid", playablePct: 92, certifiedBuilds: 3, totalBuilds: 3 }),
      row({ rank: 2, name: "Shaky", playablePct: 60, certifiedBuilds: 1, totalBuilds: 4 }),
    ];
    const { getByText } = render(<LeaderboardTable rows={rows} />);
    const solid = getByText("Solid").closest("tr")!;
    expect(within(solid).getByText("92%")).toBeInTheDocument();
    expect(within(solid).getByText(/3\/3/)).toBeInTheDocument();
    expect(within(solid).getByText("✓")).toBeInTheDocument();
    // Certified threshold split: ≥85 reads win, below reads danger.
    expect(within(solid).getByText("92%").className).toContain("text-win");
    const shaky = getByText("Shaky").closest("tr")!;
    expect(within(shaky).getByText("60%").className).toContain("text-danger");
  });

  it("shames a majority-unplayable model with a danger wash on the cell", () => {
    const rows = [
      row({ rank: 1, name: "Broken", playablePct: 30, certifiedBuilds: 0, totalBuilds: 5 }),
      row({ rank: 2, name: "Fine", playablePct: 90, certifiedBuilds: 2, totalBuilds: 2 }),
    ];
    const { getByText } = render(<LeaderboardTable rows={rows} />);
    const brokenCell = getByText("30%").closest("td")!;
    expect(brokenCell.className).toContain("bg-danger");
    // No ✓ when nothing is certified; the fine row's cell carries no wash.
    const brokenRow = getByText("Broken").closest("tr")!;
    expect(within(brokenRow).queryByText("✓")).toBeNull();
    expect(getByText("90%").closest("td")!.className).not.toContain("bg-danger");
  });

  it("degrades gracefully when playability fields are absent — never NaN", () => {
    // The row() helper sets no playability fields at all (pre-pivot shape).
    const rows = [row({ rank: 1, name: "Old" }), row({ rank: 2, name: "Older" })];
    const { getAllByText, queryByText } = render(<LeaderboardTable rows={rows} />);
    expect(getAllByText("—")).toHaveLength(2);
    expect(queryByText(/NaN/)).toBeNull();
  });

  it("shows a muted 'unscreened' chip when builds exist but no votes yet", () => {
    const rows = [
      row({ rank: 1, name: "Fresh", playablePct: null, totalBuilds: 2, certifiedBuilds: 0 }),
      row({ rank: 2, name: "Voted", playablePct: 100, totalBuilds: 1, certifiedBuilds: 1 }),
    ];
    const { getByText } = render(<LeaderboardTable rows={rows} />);
    expect(getByText("unscreened")).toBeInTheDocument();
  });

  it("keeps the Playable column visible under sm, collapsing only its fraction", () => {
    const rows = [
      row({ rank: 1, name: "A", playablePct: 92, certifiedBuilds: 3, totalBuilds: 3 }),
      row({ rank: 2, name: "B", playablePct: 88, certifiedBuilds: 1, totalBuilds: 1 }),
    ];
    const { getAllByRole, getByText } = render(<LeaderboardTable rows={rows} />);
    const headers = getAllByRole("columnheader");
    const playable = headers[headers.map((h) => h.textContent).indexOf("Playable")];
    expect(playable.className).not.toContain("hidden");
    // The % survives 390px; the certified fraction is sm-and-up only.
    expect(getByText(/3\/3/).className).toContain("hidden");
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
