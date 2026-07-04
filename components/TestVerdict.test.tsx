import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { TestVerdict } from "./TestVerdict";
import type { TestCandidate } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// Clerk: render signed-out so the unauthenticated prompt path is exercised. SignInButton
// just renders its child trigger (the modal itself is Clerk's concern, not under test).
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

const certifiedReveal = {
  model: {
    id: "m1",
    slug: "gemma",
    name: "Gemma 3 4B",
    vendor: "Google",
    paramSize: "4B",
    costPerGen: 0.003,
    tier: "featherweight",
  },
  playablePct: 88,
  votes: 5,
  certified: true,
};

/** fetch stub that answers the vote POST and the next-candidate GET separately. */
function stubFetch(voteBody: unknown, nextBody: unknown = null) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
    Promise.resolve({
      ok: true,
      json: async () => (url === "/api/playability/vote" ? voteBody : nextBody),
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TestVerdict", () => {
  it("asks the playability question with both verdict buttons — and no model identity", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { getByText, queryByText } = render(<TestVerdict candidate={candidate} />);
    expect(getByText(/Could a person actually play this\?/i)).toBeInTheDocument();
    expect(getByText("✓ PLAYABLE")).toBeInTheDocument();
    expect(getByText("✗ NOT PLAYABLE")).toBeInTheDocument();
    // The load-bearing anonymity rule: nothing about the model renders pre-vote.
    expect(queryByText(/Gemma/)).toBeNull();
    expect(queryByText(/Google/)).toBeNull();
  });

  it("posts { generationId, playable: true } when PLAYABLE is clicked", async () => {
    const fetchMock = stubFetch({ ok: true, reveal: null });
    const { getByText } = render(<TestVerdict candidate={candidate} />);
    fireEvent.click(getByText("✓ PLAYABLE"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/playability/vote");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      generationId: "gen-1",
      playable: true,
    });
  });

  it("posts playable: false when NOT PLAYABLE is clicked", async () => {
    const fetchMock = stubFetch({ ok: true, reveal: null });
    const { getByText } = render(<TestVerdict candidate={candidate} />);
    fireEvent.click(getByText("✗ NOT PLAYABLE"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.playable).toBe(false);
  });

  it("reveals the model, updated stats, and certified status on success", async () => {
    stubFetch({ ok: true, reveal: certifiedReveal });
    const onRevealed = vi.fn();
    const { getByText, findByText } = render(
      <TestVerdict candidate={candidate} onRevealed={onRevealed} />,
    );
    fireEvent.click(getByText("✓ PLAYABLE"));

    expect(await findByText("Gemma 3 4B")).toBeInTheDocument();
    expect(getByText(/88% playable · 5 votes/)).toBeInTheDocument();
    expect(getByText(/this build is in the Arcade/i)).toBeInTheDocument();
    expect(getByText("NEXT BUILD →")).toBeInTheDocument();
    expect(onRevealed).toHaveBeenCalledTimes(1);
  });

  it("shows the below-bar status when the build is reported unplayable", async () => {
    stubFetch({
      ok: true,
      reveal: { ...certifiedReveal, playablePct: 20, certified: false },
    });
    const { getByText, findByText } = render(<TestVerdict candidate={candidate} />);
    fireEvent.click(getByText("✗ NOT PLAYABLE"));

    expect(await findByText(/reported unplayable/i)).toBeInTheDocument();
  });

  it("shows on-the-bubble copy for uncertified builds near the bar", async () => {
    stubFetch({
      ok: true,
      reveal: { ...certifiedReveal, playablePct: 75, certified: false },
    });
    const { getByText, findByText } = render(<TestVerdict candidate={candidate} />);
    fireEvent.click(getByText("✓ PLAYABLE"));

    expect(await findByText(/on the bubble/i)).toBeInTheDocument();
    expect(getByText(/≥85% playable/i)).toBeInTheDocument();
  });

  it("prompts sign-in with a real primary button when the verdict returns unauthenticated", async () => {
    stubFetch({ ok: false, error: "unauthenticated" });
    const { getByText, findByText, getByRole, queryByText } = render(
      <TestVerdict candidate={candidate} />,
    );
    fireEvent.click(getByText("✓ PLAYABLE"));

    expect(await findByText(/You need to sign in to screen builds/i)).toBeInTheDocument();
    expect(
      getByRole("button", { name: /sign in and record this verdict/i }),
    ).toBeInTheDocument();
    // Still no identity leak on the auth-failure path.
    expect(queryByText(/Gemma/)).toBeNull();
  });

  it("notices a duplicate verdict and auto-advances to the next candidate", async () => {
    const fetchMock = stubFetch({ ok: false, error: "duplicate" }, null);
    const onNext = vi.fn();
    const { getByText, findByText } = render(
      <TestVerdict candidate={candidate} onNext={onNext} />,
    );
    fireEvent.click(getByText("✓ PLAYABLE"));

    expect(await findByText(/already screened this one/i)).toBeInTheDocument();
    await waitFor(
      () => expect(fetchMock).toHaveBeenCalledWith("/api/playability/next"),
      { timeout: 3000 },
    );
    await waitFor(() => expect(onNext).toHaveBeenCalledWith(null));
  });

  it("surfaces the rate-limit error", async () => {
    stubFetch({ ok: false, error: "rate_limited" });
    const { getByText, findByText } = render(<TestVerdict candidate={candidate} />);
    fireEvent.click(getByText("✗ NOT PLAYABLE"));

    expect(await findByText(/slow down a moment/i)).toBeInTheDocument();
  });

  it("surfaces the invalid-verdict error", async () => {
    stubFetch({ ok: false, error: "invalid" });
    const { getByText, findByText } = render(<TestVerdict candidate={candidate} />);
    fireEvent.click(getByText("✓ PLAYABLE"));

    expect(await findByText(/could not be recorded/i)).toBeInTheDocument();
  });

  it("offers a 'go back and play more' link that returns the flow to the play step", () => {
    vi.stubGlobal("fetch", vi.fn());
    const onBack = vi.fn();
    const { getByRole } = render(<TestVerdict candidate={candidate} onBack={onBack} />);
    fireEvent.click(getByRole("button", { name: /go back and play more/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("loads the next candidate from /api/playability/next on NEXT BUILD", async () => {
    const next: TestCandidate = { ...candidate, generationId: "gen-2", votes: 0 };
    const fetchMock = stubFetch({ ok: true, reveal: certifiedReveal }, next);
    const onNext = vi.fn();
    const { getByText, findByText } = render(
      <TestVerdict candidate={candidate} onNext={onNext} sessionTally={3} />,
    );
    fireEvent.click(getByText("✓ PLAYABLE"));

    // Reveal shows the session tally, then NEXT BUILD fetches the queue.
    expect(await findByText(/3 builds screened this session/i)).toBeInTheDocument();
    fireEvent.click(getByText("NEXT BUILD →"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/playability/next"));
    await waitFor(() =>
      expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ generationId: "gen-2" })),
    );
  });
});
