import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { VoteBar } from "./VoteBar";
import type { ArenaPairing } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// Clerk: render signed-out so the unauthenticated prompt path is exercised. SignInButton
// just renders its child trigger (the modal itself is Clerk's concern, not under test).
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: false, isLoaded: true, user: null }),
  SignInButton: ({ children }: { children: unknown }) => children,
}));

const pairing: ArenaPairing = {
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
  roundOf: 5,
  a: { generationId: "gen-a", artifactPath: "/artifacts/pong/a.html", status: "ok" },
  b: { generationId: "gen-b", artifactPath: "/artifacts/pong/b.html", status: "ok" },
};

const reveal = {
  a: { id: "ma", slug: "gemma", name: "Gemma 3 4B", vendor: "Google", paramSize: "4B", costPerGen: 0.003, tier: "featherweight" },
  b: { id: "mb", slug: "qwen", name: "Qwen3 4B", vendor: "Alibaba", paramSize: "4B", costPerGen: 0.004, tier: "featherweight" },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VoteBar", () => {
  it("renders the four vote controls and the single judging line", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { getByText } = render(<VoteBar pairing={pairing} />);
    expect(getByText("← A is better")).toBeInTheDocument();
    expect(getByText("B is better →")).toBeInTheDocument();
    expect(getByText("Tie")).toBeInTheDocument();
    expect(getByText("Both bad")).toBeInTheDocument();
    expect(getByText(/Judge faithfulness to the original/i)).toBeInTheDocument();
  });

  it("posts the correct winner to /api/vote when 'A is better' is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reveal: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText } = render(<VoteBar pairing={pairing} />);
    fireEvent.click(getByText("← A is better"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/vote");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      gameId: "game-1",
      genAId: "gen-a",
      genBId: "gen-b",
      winner: "a",
    });
  });

  it("posts winner 'both_bad' when 'Both bad' is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reveal: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText } = render(<VoteBar pairing={pairing} />);
    fireEvent.click(getByText("Both bad"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.winner).toBe("both_bad");
  });

  it("reveals both model identities on a successful vote, highlighting the pick", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reveal }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const onRevealed = vi.fn();
    const { getByText, findByText } = render(
      <VoteBar pairing={pairing} onRevealed={onRevealed} />,
    );
    fireEvent.click(getByText("B is better →"));

    expect(await findByText("Gemma 3 4B")).toBeInTheDocument();
    expect(getByText("Qwen3 4B")).toBeInTheDocument();
    expect(getByText("NEXT ROUND →")).toBeInTheDocument();
    expect(getByText(/your pick/i)).toBeInTheDocument();
    expect(onRevealed).toHaveBeenCalledTimes(1);
  });

  it("shows the client-side session tally on the reveal step", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reveal }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, findByText } = render(<VoteBar pairing={pairing} sessionTally={2} />);
    fireEvent.click(getByText("Tie"));

    expect(await findByText(/2 rounds judged this session/i)).toBeInTheDocument();
  });

  it("nudges the voter to play both builds first, without disabling the vote", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { getByText, queryByText, rerender } = render(
      <VoteBar pairing={pairing} bothPlayed={false} />,
    );
    expect(getByText(/play both builds, then vote/i)).toBeInTheDocument();
    expect((getByText("← A is better") as HTMLButtonElement).disabled).toBe(false);
    rerender(<VoteBar pairing={pairing} bothPlayed />);
    expect(queryByText(/play both builds, then vote/i)).toBeNull();
  });

  it("offers a 'go back and replay' link that returns the flow to the play step", () => {
    vi.stubGlobal("fetch", vi.fn());
    const onBack = vi.fn();
    const { getByRole } = render(<VoteBar pairing={pairing} onBack={onBack} />);
    fireEvent.click(getByRole("button", { name: /go back and replay/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("prompts sign-in with a real primary button when the vote returns unauthenticated", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: "unauthenticated" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, findByText, getByRole } = render(<VoteBar pairing={pairing} />);
    fireEvent.click(getByText("← A is better"));

    expect(await findByText(/You need to sign in to vote/i)).toBeInTheDocument();
    expect(getByRole("button", { name: /sign in and record this vote/i })).toBeInTheDocument();
  });
});
