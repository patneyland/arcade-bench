import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { ArenaCard } from "./ArenaCard";
import type { ArenaPairing } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

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

const nextPairing: ArenaPairing = {
  ...pairing,
  game: { ...pairing.game, id: "game-2", slug: "snake", title: "Snake", year: 1976 },
  a: { generationId: "gen-c", artifactPath: "/artifacts/snake/c.html", status: "ok" },
  b: { generationId: "gen-d", artifactPath: "/artifacts/snake/d.html", status: "ok" },
};

const reveal = {
  a: { id: "ma", slug: "gemma", name: "Gemma 3 4B", vendor: "Google", paramSize: "4B", costPerGen: 0.003, tier: "featherweight" },
  b: { id: "mb", slug: "qwen", name: "Qwen3 4B", vendor: "Alibaba", paramSize: "4B", costPerGen: 0.004, tier: "featherweight" },
};

/** fetch stub routing the two arena endpoints. */
function stubFetch() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/vote") {
      return { ok: true, json: async () => ({ ok: true, reveal }) };
    }
    if (url.startsWith("/api/arena/next")) {
      return { ok: true, json: async () => nextPairing };
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ArenaCard — the one-cabinet round flow", () => {
  it("coin screen: marquee meta, Build A gate on stage, no iframe, no vote buttons", () => {
    stubFetch();
    const { container, getByText, queryByText, getByRole } = render(
      <ArenaCard pairing={pairing} />,
    );
    expect(getByText("Pong")).toBeInTheDocument();
    expect(getByText(/1972 · Atari · Round 1 of 5/)).toBeInTheDocument();
    expect(getByText(/models hidden until you vote/i)).toBeInTheDocument();
    // The gate IS the CTA on the coin screen.
    expect(getByRole("button", { name: /insert coin — play build a/i })).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    expect(queryByText("← A is better")).toBeNull();
    // Build B exists but is off stage (hidden), so it is not accessible yet.
    expect(getByText("BUILD B")).not.toBeVisible();
  });

  it("walks coin → play A → play B, keeping both iframes mounted", () => {
    stubFetch();
    const { container, getByRole, getByText, queryByRole } = render(
      <ArenaCard pairing={pairing} />,
    );

    // Play A: insert coin → the primary CTA leading to B appears (red side).
    fireEvent.click(getByRole("button", { name: /insert coin — play build a/i }));
    expect(container.querySelectorAll("iframe").length).toBe(1);
    fireEvent.click(getByRole("button", { name: /next: play build b/i }));

    // Play B: red stage, its own coin gate; A's frame stays mounted but hidden.
    expect(getByText("BUILD B")).toBeVisible();
    expect(getByText("BUILD A")).not.toBeVisible();
    expect(container.querySelectorAll("iframe").length).toBe(1);
    fireEvent.click(getByRole("button", { name: /insert coin — play build b/i }));
    expect(container.querySelectorAll("iframe").length).toBe(2);

    // Once both are started the primary CTA is the vote, whichever build is on stage.
    expect(getByRole("button", { name: /cast your vote/i })).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: /replay build a/i }));
    expect(getByText("BUILD A")).toBeVisible();
    expect(getByRole("button", { name: /cast your vote/i })).toBeInTheDocument();
    expect(queryByRole("button", { name: /next: play build b/i })).toBeNull();
    expect(getByRole("button", { name: /replay build b/i })).toBeInTheDocument();
  });

  it("verdict step replaces the stage without unmounting the iframes, and can go back", () => {
    stubFetch();
    const { container, getByRole, getByText } = render(<ArenaCard pairing={pairing} />);
    fireEvent.click(getByRole("button", { name: /insert coin — play build a/i }));
    fireEvent.click(getByRole("button", { name: /next: play build b/i }));
    fireEvent.click(getByRole("button", { name: /insert coin — play build b/i }));
    fireEvent.click(getByRole("button", { name: /cast your vote/i }));

    // The stage yields to the four vote buttons + the single judging line…
    expect(getByText("← A is better")).toBeInTheDocument();
    expect(getByText("B is better →")).toBeInTheDocument();
    expect(getByText("Tie")).toBeInTheDocument();
    expect(getByText("Both bad")).toBeInTheDocument();
    expect(getByText(/Judge faithfulness to the original/i)).toBeInTheDocument();
    // …but both game frames stay MOUNTED for the whole round (hidden, not removed).
    expect(container.querySelectorAll("iframe").length).toBe(2);

    // "go back and replay" returns to the play step with game state intact.
    fireEvent.click(getByRole("button", { name: /go back and replay/i }));
    expect(getByRole("button", { name: /cast your vote/i })).toBeInTheDocument();
    expect(container.querySelectorAll("iframe").length).toBe(2);
  });

  it("vote → reveal with session tally, then NEXT ROUND loads a fresh coin screen", async () => {
    stubFetch();
    const { container, getByRole, getByText, findByText } = render(
      <ArenaCard pairing={pairing} />,
    );
    fireEvent.click(getByRole("button", { name: /insert coin — play build a/i }));
    fireEvent.click(getByRole("button", { name: /next: play build b/i }));
    fireEvent.click(getByRole("button", { name: /insert coin — play build b/i }));
    fireEvent.click(getByRole("button", { name: /cast your vote/i }));
    fireEvent.click(getByText("← A is better"));

    // Reveal: identities + the client-side session tally.
    expect(await findByText("Gemma 3 4B")).toBeInTheDocument();
    expect(getByText(/1 round judged this session/i)).toBeInTheDocument();

    // Next round: a fresh pairing resets the flow — new marquee, gates back, iframes unmounted.
    fireEvent.click(getByText("NEXT ROUND →"));
    await waitFor(() => expect(getByText("Snake")).toBeInTheDocument());
    expect(container.querySelectorAll("iframe").length).toBe(0);
    expect(getByRole("button", { name: /insert coin — play build a/i })).toBeInTheDocument();
  });
});
