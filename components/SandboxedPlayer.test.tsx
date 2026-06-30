import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SandboxedPlayer, EmptyCanvas } from "./SandboxedPlayer";

describe("SandboxedPlayer", () => {
  it("renders an iframe pointing at the artifact path", () => {
    const { container } = render(
      <SandboxedPlayer artifactPath="/artifacts/pong/qwen3-4b.html" title="Build A — Pong" />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toBe("/artifacts/pong/qwen3-4b.html");
    expect(iframe!.getAttribute("title")).toBe("Build A — Pong");
  });

  // SECURITY REGRESSION GUARD (PRD §D, design.md §9): the sandbox must allow scripts
  // but MUST NOT grant same-origin access. allow-same-origin would let AI-written JS
  // escape the frame and reach the parent origin, cookies, and storage.
  it("uses a strict sandbox WITHOUT allow-same-origin", () => {
    const { container } = render(
      <SandboxedPlayer artifactPath="/artifacts/pong/qwen3-4b.html" title="Build A" />,
    );
    const iframe = container.querySelector("iframe")!;
    const sandbox = iframe.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
  });

  it("does not grant network/popup/form/top-navigation escapes", () => {
    const { container } = render(
      <SandboxedPlayer artifactPath="/artifacts/pong/qwen3-4b.html" title="Build A" />,
    );
    const sandbox = container.querySelector("iframe")!.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-popups");
    expect(sandbox).not.toContain("allow-forms");
    expect(sandbox).not.toContain("allow-top-navigation");
  });

  it("renders an empty canvas placeholder when there is no artifact", () => {
    const { getByText } = render(<EmptyCanvas label="No build yet" />);
    expect(getByText("No build yet")).toBeInTheDocument();
  });
});
