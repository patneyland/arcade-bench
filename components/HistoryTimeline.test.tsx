import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HistoryTimeline } from "./HistoryTimeline";
import type { TimelineEntry, GameStatus } from "@/lib/types";

function entry(title: string, year: number, state: GameStatus): TimelineEntry {
  return {
    state,
    game: {
      id: title,
      slug: title.toLowerCase(),
      title,
      year,
      creator: "Atari",
      roundOrder: year,
      status: state,
      referenceMediaUrl: null,
      specMarkdown: null,
    },
  };
}

describe("HistoryTimeline", () => {
  it("renders an empty state when there are no entries", () => {
    const { getByText } = render(<HistoryTimeline entries={[]} />);
    expect(getByText("The timeline is being written")).toBeInTheDocument();
  });

  it("renders all three states with their tags", () => {
    const entries = [
      entry("Pong", 1972, "live"),
      entry("Breakout", 1976, "now"),
      entry("Asteroids", 1979, "upcoming"),
    ];
    const { getByText } = render(<HistoryTimeline entries={entries} />);

    expect(getByText("Pong")).toBeInTheDocument();
    expect(getByText("Breakout")).toBeInTheDocument();
    expect(getByText("Asteroids")).toBeInTheDocument();

    // State tags
    expect(getByText("Live")).toBeInTheDocument();
    expect(getByText("▶ Now")).toBeInTheDocument();
    expect(getByText("Upcoming")).toBeInTheDocument();
  });

  it("shows the year for each node", () => {
    const { getByText } = render(<HistoryTimeline entries={[entry("Pong", 1972, "live")]} />);
    expect(getByText("1972")).toBeInTheDocument();
  });

  it("renders one list item per game", () => {
    const entries = [entry("Pong", 1972, "live"), entry("Snake", 1976, "now")];
    const { getAllByRole } = render(<HistoryTimeline entries={entries} />);
    expect(getAllByRole("listitem")).toHaveLength(2);
  });
});
