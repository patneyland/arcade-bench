import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { SandboxedPlayer, EmptyCanvas } from "./SandboxedPlayer";

/** Render a player and click through the INSERT COIN gate so the iframe mounts. */
function renderStarted(props: Partial<Parameters<typeof SandboxedPlayer>[0]> = {}) {
  const utils = render(
    <SandboxedPlayer
      artifactPath="/artifacts/pong/qwen3-4b.html"
      title="Build A — Pong"
      {...props}
    />,
  );
  fireEvent.click(utils.getByRole("button", { name: /insert coin/i }));
  return utils;
}

describe("SandboxedPlayer", () => {
  it("gates the game behind INSERT COIN — no iframe mounts until the player clicks", () => {
    const { container, getByRole } = render(
      <SandboxedPlayer artifactPath="/artifacts/pong/qwen3-4b.html" title="Build A — Pong" />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(getByRole("button", { name: /insert coin/i }));
    expect(container.querySelector("iframe")).not.toBeNull();
  });

  // autoStart is for surfaces where an explicit click already opened the player
  // (the arcade's pop-up window) — the gate's "no game before someone is looking"
  // job is done by that click.
  it("autoStart mounts the iframe immediately with the same strict sandbox, and reports the start", () => {
    const onStarted = vi.fn();
    const { container, queryByRole } = render(
      <SandboxedPlayer
        artifactPath="/artifacts/pong/qwen3-4b.html"
        title="Pong — Qwen3 4B"
        autoStart
        onStarted={onStarted}
      />,
    );
    expect(queryByRole("button", { name: /insert coin/i })).toBeNull();
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    const sandbox = iframe!.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it("fires onStarted when the gate is clicked", () => {
    const onStarted = vi.fn();
    renderStarted({ onStarted });
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it("renders an iframe pointing at the artifact path once started", () => {
    const { container } = renderStarted();
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toBe("/artifacts/pong/qwen3-4b.html");
    expect(iframe!.getAttribute("title")).toBe("Build A — Pong");
  });

  // SECURITY REGRESSION GUARD (PRD §D, design.md §9): the sandbox must allow scripts
  // but MUST NOT grant same-origin access. allow-same-origin would let AI-written JS
  // escape the frame and reach the parent origin, cookies, and storage.
  it("uses a strict sandbox WITHOUT allow-same-origin", () => {
    const { container } = renderStarted();
    const iframe = container.querySelector("iframe")!;
    const sandbox = iframe.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
  });

  it("does not grant network/popup/form/top-navigation escapes", () => {
    const { container } = renderStarted();
    const sandbox = container.querySelector("iframe")!.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-popups");
    expect(sandbox).not.toContain("allow-forms");
    expect(sandbox).not.toContain("allow-top-navigation");
  });

  // VIRTUAL VIEWPORT (docs/ux-overhaul.md §1, the rating-integrity fix): the iframe
  // always renders at a fixed 820×700 and is scaled to fit with a transform on the
  // iframe element — the artifact never sees a clipped viewport.
  it("renders the iframe at the fixed 820×700 virtual viewport, scaled via transform", () => {
    const { container } = renderStarted();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.style.width).toBe("820px");
    expect(iframe.style.height).toBe("700px");
    expect(iframe.style.transformOrigin).toBe("top left");
    expect(iframe.style.transform).toContain("scale(");
  });

  it("offers a Restart control that keeps the same strict sandbox and virtual viewport", () => {
    const { container, getByRole } = renderStarted();
    fireEvent.click(getByRole("button", { name: /restart/i }));
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toBe("/artifacts/pong/qwen3-4b.html");
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe.style.width).toBe("820px");
    expect(iframe.style.height).toBe("700px");
  });

  // FOCUS HANDOFF REGRESSION: after Restart the keyboard must return to the iframe
  // automatically — the player should never need an extra click on the game.
  it("hands keyboard focus back to the iframe after Restart without another click", async () => {
    const { container, getByRole } = renderStarted();
    const restart = getByRole("button", { name: /restart/i });
    restart.focus();
    fireEvent.click(restart);
    // The refocus effect runs on the next frame and again at +120ms; wait past both.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(document.activeElement).toBe(iframe);
  });

  it("keeps Restart and the focus hint as overlay chips inside the canvas (no row below)", () => {
    const { container, getByRole, getByText } = renderStarted();
    const canvas = container.querySelector(".game-canvas")!;
    expect(canvas.contains(getByRole("button", { name: /restart/i }))).toBe(true);
    expect(canvas.contains(getByText(/click the game to use keys/i))).toBe(true);
  });

  it("prevents browser key-scroll for arrow keys while an active started cabinet is running", () => {
    renderStarted();
    const event = new KeyboardEvent("keydown", { key: "ArrowUp", cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it("locks document scroll while active and restores it on unmount", () => {
    const { unmount } = renderStarted();
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
  });

  it("renders an empty canvas placeholder when there is no artifact", () => {
    const { getByText } = render(<EmptyCanvas label="No build yet" />);
    expect(getByText("No build yet")).toBeInTheDocument();
  });
});
