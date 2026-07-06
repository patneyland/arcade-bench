import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { TestCabinet } from "./TestCabinet";
import type { GameView, TestCandidate } from "@/lib/types";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace }),
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: false, isLoaded: true, user: null }),
  SignInButton: ({ children }: { children: unknown }) => children,
}));

const candidate: TestCandidate = {
  generationId: "gen-1",
  artifactPath: "/artifacts/pong/mystery.html",
  game: {
    id: "game-1",
    slug: "pong",
    title: "Pong",
    year: 1972,
    creator: "Atari",
    roundOrder: 1,
    status: "now",
    referenceMediaUrl: null,
    specMarkdown: null,
  },
  votes: 4,
};

function gameView(slug: string, title: string, roundOrder: number): GameView {
  return {
    id: `game-${slug}`,
    slug,
    title,
    year: 1976,
    creator: "Atari",
    roundOrder,
    status: "live",
    referenceMediaUrl: null,
    specMarkdown: null,
  };
}

const GAMES: GameView[] = [
  gameView("pong", "Pong", 1),
  gameView("snake", "Snake", 2),
  gameView("breakout", "Breakout", 3),
];

beforeEach(() => {
  vi.restoreAllMocks();
  replace.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TestCabinet", () => {
  it("renders the queue-empty state (with Arcade + leaderboard links) when there is no candidate", () => {
    const { getByText } = render(<TestCabinet initial={null} />);
    expect(getByText(/screened everything in the queue/i)).toBeInTheDocument();
    expect(getByText(/play the arcade/i).closest("a")).toHaveAttribute("href", "/arcade");
    expect(getByText(/see the leaderboard/i).closest("a")).toHaveAttribute(
      "href",
      "/leaderboard",
    );
  });

  it("shows the marquee (game, anonymity note, vote chip) and the coin gate", () => {
    const { getByText, getByRole } = render(<TestCabinet initial={candidate} />);
    expect(getByText("TEST LAB")).toBeInTheDocument();
    expect(getByText("Pong")).toBeInTheDocument();
    expect(getByText(/model hidden until you vote/i)).toBeInTheDocument();
    expect(getByText(/4 votes so far/i)).toBeInTheDocument();
    expect(getByRole("button", { name: /insert coin/i })).toBeInTheDocument();
    // No verdict CTA until the game has been started.
    expect(getByText(/insert a coin to start this build/i)).toBeInTheDocument();
  });

  it("walks coin → play → verdict, keeping the frame mounted under the verdict step", () => {
    const { getByText, getByRole, getByTitle, container } = render(
      <TestCabinet initial={candidate} />,
    );

    // Coin: starting the build swaps the caption for the verdict CTA.
    fireEvent.click(getByRole("button", { name: /insert coin/i }));
    const cta = getByText("GIVE YOUR VERDICT →");
    expect(cta).toBeInTheDocument();

    // Verdict replaces the stage visually — but the iframe stays mounted (hidden)
    // so "go back and play more" resumes the same run.
    fireEvent.click(cta);
    expect(getByText(/Could a person actually play this\?/i)).toBeInTheDocument();
    const frame = getByTitle("Unvetted build — Pong");
    expect(frame).toBeInTheDocument();
    expect(container.querySelector("div[hidden] iframe")).toBe(frame);

    // Go back: the stage returns without re-inserting a coin.
    fireEvent.click(getByRole("button", { name: /go back and play more/i }));
    expect(container.querySelector("div[hidden] iframe")).toBeNull();
    expect(getByText("GIVE YOUR VERDICT →")).toBeInTheDocument();
  });

  it("hides the game picker when there is at most one screenable game", () => {
    const { queryByText } = render(
      <TestCabinet initial={candidate} games={[GAMES[0]]} />,
    );
    expect(queryByText("All games")).toBeNull();
  });

  it("shows the picker for multiple games and marks the active one", () => {
    const { getByRole } = render(
      <TestCabinet initial={candidate} games={GAMES} initialGame="pong" />,
    );
    // "All games" + one chip per game.
    expect(getByRole("button", { name: "Snake" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Breakout" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Pong" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(getByRole("button", { name: "All games" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("switching game fetches the filtered queue, syncs the URL, and loads the new build", async () => {
    const snakeBuild: TestCandidate = {
      ...candidate,
      generationId: "gen-snake",
      artifactPath: "/artifacts/snake/mystery.html",
      game: GAMES[1],
      votes: 1,
    };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => snakeBuild,
    });

    const { getByRole, getByText } = render(
      <TestCabinet initial={candidate} games={GAMES} />,
    );

    fireEvent.click(getByRole("button", { name: "Snake" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/playability/next?game=snake"),
    );
    expect(replace).toHaveBeenCalledWith("/test?game=snake", { scroll: false });
    // The newly loaded Snake build replaces the old one (its "1 vote" chip is unique).
    await waitFor(() => expect(getByText(/1 vote so far/i)).toBeInTheDocument());
  });

  it("shows a game-specific empty state (and keeps the picker) when a game's queue is exhausted", () => {
    const { getByText, getByRole } = render(
      <TestCabinet initial={null} games={GAMES} initialGame="pong" />,
    );
    expect(getByText(/screened every Pong build/i)).toBeInTheDocument();
    // Picker still present so the tester can jump to another game.
    expect(getByRole("button", { name: "Snake" })).toBeInTheDocument();
  });
});
