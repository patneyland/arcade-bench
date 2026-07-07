import { describe, it, expect } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import type { ArcadeEntry } from "@/lib/types";
import { ArcadeFloor } from "./ArcadeFloor";

function entry(overrides: Partial<ArcadeEntry> = {}): ArcadeEntry {
  return {
    generationId: "gen-1",
    artifactPath: "/artifacts/pong/qwen3-8b.html",
    game: {
      id: "game-1",
      slug: "pong",
      title: "Pong",
      year: 1972,
      creator: "Atari",
      roundOrder: 1,
      status: "live",
      referenceMediaUrl: null,
      specMarkdown: null,
      prompt: "Create Pong as a single self-contained HTML file that runs in a browser.",
    },
    model: {
      id: "model-1",
      slug: "qwen3-8b",
      name: "Qwen3 8B",
      vendor: "Alibaba",
      paramSize: "8B",
      costPerGen: 0.002,
      tier: "featherweight",
    },
    playablePct: 92,
    votes: 12,
    tokensOut: 4700,
    ...overrides,
  };
}

function renderFloor(entries: ArcadeEntry[] = [entry()]) {
  return render(
    <ArcadeFloor sections={[{ game: entries[0].game, cabinets: entries }]} />,
  );
}

describe("ArcadeFloor", () => {
  it("renders a thumbnail per build carrying brand, params, tokens, and certification", () => {
    const { getByRole } = renderFloor();
    const thumb = getByRole("button", { name: /insert coin — play pong by qwen3 8b/i });
    expect(within(thumb).getByText("Alibaba")).toBeInTheDocument();
    expect(within(thumb).getByText("Qwen3 8B")).toBeInTheDocument();
    expect(within(thumb).getByText("8B params")).toBeInTheDocument();
    expect(within(thumb).getByText("4.7k tokens")).toBeInTheDocument();
    expect(within(thumb).getByText(/✓ 92% playable/)).toBeInTheDocument();
    expect(within(thumb).getByText(/\$0\.002 \/ gen/)).toBeInTheDocument();
  });

  it("omits the params chip for closed-weight models (paramSize null)", () => {
    const { getByRole } = renderFloor([
      entry({ model: { ...entry().model, name: "GPT-4.1 nano", vendor: "OpenAI", paramSize: null } }),
    ]);
    const thumb = getByRole("button", { name: /insert coin/i });
    expect(within(thumb).queryByText(/params/)).toBeNull();
    expect(within(thumb).getByText("4.7k tokens")).toBeInTheDocument();
  });

  it("does not mount any iframe in the grid — thumbnails are not play frames", () => {
    const { container } = renderFloor();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("opens the play window on click, auto-starting the build (no second coin gate)", () => {
    const { getByRole } = renderFloor();
    fireEvent.click(getByRole("button", { name: /insert coin/i }));
    const dialog = getByRole("dialog", { name: /pong — qwen3 8b/i });
    const iframe = dialog.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toBe("/artifacts/pong/qwen3-8b.html");
    // Model identity + the full certification seal live in the window's strip.
    expect(within(dialog as HTMLElement).getByText(/CERTIFIED PLAYABLE · 92% · 12 votes/)).toBeInTheDocument();
  });

  // SECURITY REGRESSION GUARD (PRD §D): the pop-up must use the same strict
  // sandbox as every other surface — scripts only, never same-origin.
  it("keeps the strict sandbox on the pop-up's iframe", () => {
    const { getByRole } = renderFloor();
    fireEvent.click(getByRole("button", { name: /insert coin/i }));
    const sandbox = getByRole("dialog").querySelector("iframe")!.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
  });

  it("closes via the ✕ button, unmounts the game, and returns focus to the card", () => {
    const { getByRole, queryByRole, container } = renderFloor();
    const thumb = getByRole("button", { name: /insert coin/i });
    fireEvent.click(thumb);
    fireEvent.click(getByRole("button", { name: /close/i }));
    expect(queryByRole("dialog")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(document.activeElement).toBe(thumb);
  });

  it("closes on Escape", () => {
    const { getByRole, queryByRole } = renderFloor();
    fireEvent.click(getByRole("button", { name: /insert coin/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(queryByRole("dialog")).toBeNull();
  });

  it("locks page scroll while the window is open and restores it on close", () => {
    const { getByRole } = renderFloor();
    fireEvent.click(getByRole("button", { name: /insert coin/i }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(getByRole("button", { name: /close/i }));
    expect(document.body.style.overflow).toBe("");
  });

  it("shows the locked prompt behind the window's PROMPT tab", () => {
    const { getByRole, getByText } = renderFloor();
    fireEvent.click(getByRole("button", { name: /insert coin/i }));
    fireEvent.click(getByRole("button", { name: /prompt/i }));
    expect(
      getByText(/Create Pong as a single self-contained HTML file/),
    ).toBeInTheDocument();
  });
});
