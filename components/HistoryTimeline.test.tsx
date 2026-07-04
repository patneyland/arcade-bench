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

const threeStates = [
  entry("Pong", 1972, "live"),
  entry("Breakout", 1976, "now"),
  entry("Asteroids", 1979, "upcoming"),
];

describe("HistoryTimeline", () => {
  it("renders an empty state when there are no entries", () => {
    const { getByText } = render(<HistoryTimeline entries={[]} />);
    expect(getByText("The timeline is being written")).toBeInTheDocument();
  });

  it("renders all three states with their tags", () => {
    const { getByText } = render(<HistoryTimeline entries={threeStates} />);

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

  it("renders one list item per game (end markers are not list items)", () => {
    const entries = [entry("Pong", 1972, "live"), entry("Snake", 1976, "now")];
    const { getAllByRole } = render(<HistoryTimeline entries={entries} />);
    expect(getAllByRole("listitem")).toHaveLength(2);
  });

  it("links the Now node to the arena with a play affordance", () => {
    const { getByRole } = render(<HistoryTimeline entries={threeStates} />);
    const link = getByRole("link", { name: /Breakout.*Play this round/s });
    expect(link).toHaveAttribute("href", "/arena");
  });

  it("links Live nodes to that game's leaderboard", () => {
    const { getByRole } = render(<HistoryTimeline entries={threeStates} />);
    const link = getByRole("link", { name: /Pong.*See results/s });
    expect(link).toHaveAttribute("href", "/leaderboard?game=pong");
  });

  it("keeps Upcoming nodes non-interactive", () => {
    const { getAllByRole } = render(<HistoryTimeline entries={threeStates} />);
    const links = getAllByRole("link");
    expect(links).toHaveLength(2); // Now + Live only
    for (const link of links) {
      expect(link).not.toHaveTextContent("Asteroids");
    }
  });

  it("anchors the track with origin and terminus markers", () => {
    const { getByText } = render(<HistoryTimeline entries={threeStates} />);
    expect(getByText("1952 · the dawn")).toBeInTheDocument();
    expect(getByText("→ present · more rounds coming")).toBeInTheDocument();
  });

  it("shows round and creator only in expanded mode", () => {
    const compact = render(<HistoryTimeline entries={[entry("Pong", 1972, "live")]} />);
    expect(compact.queryByText("Round 1972 · Atari")).not.toBeInTheDocument();
    compact.unmount();

    const expanded = render(
      <HistoryTimeline entries={[entry("Pong", 1972, "live")]} expanded />,
    );
    expect(expanded.getByText("Round 1972 · Atari")).toBeInTheDocument();
  });
});
