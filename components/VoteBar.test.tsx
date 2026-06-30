import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { VoteBar } from "./VoteBar";
import type { ArenaPairing } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
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

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VoteBar", () => {
  it("renders the four vote controls", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { getByText } = render(<VoteBar pairing={pairing} />);
    expect(getByText("← A is better")).toBeInTheDocument();
    expect(getByText("B is better →")).toBeInTheDocument();
    expect(getByText("Tie")).toBeInTheDocument();
    expect(getByText("Both bad")).toBeInTheDocument();
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

  it("reveals both model identities on a successful vote", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        reveal: {
          a: { id: "ma", slug: "gemma", name: "Gemma 3 4B", vendor: "Google", paramSize: "4B", costPerGen: 0.003, tier: "featherweight" },
          b: { id: "mb", slug: "qwen", name: "Qwen3 4B", vendor: "Alibaba", paramSize: "4B", costPerGen: 0.004, tier: "featherweight" },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, findByText } = render(<VoteBar pairing={pairing} />);
    fireEvent.click(getByText("B is better →"));

    expect(await findByText("Gemma 3 4B")).toBeInTheDocument();
    expect(getByText("Qwen3 4B")).toBeInTheDocument();
    expect(getByText("Next match →")).toBeInTheDocument();
  });

  it("prompts a sign-in when the vote returns unauthenticated", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: "unauthenticated" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, findByText } = render(<VoteBar pairing={pairing} />);
    fireEvent.click(getByText("← A is better"));

    expect(await findByText(/You need to sign in to vote/i)).toBeInTheDocument();
  });
});
