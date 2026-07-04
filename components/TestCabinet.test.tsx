import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TestCabinet } from "./TestCabinet";
import type { TestCandidate } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
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

beforeEach(() => {
  vi.restoreAllMocks();
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
});
