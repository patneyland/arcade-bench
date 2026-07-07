import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PromptTab } from "./PromptTab";

const PROMPT =
  "Create Pong as a single self-contained HTML file that runs in a browser.";

describe("PromptTab", () => {
  it("starts collapsed — the prompt text is hidden until the tab is clicked", () => {
    const { queryByText, getByRole } = render(<PromptTab prompt={PROMPT} />);
    expect(queryByText(PROMPT)).toBeNull();
    expect(getByRole("button", { name: /prompt/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens on click to show the exact prompt, and closes again", () => {
    const { getByRole, queryByText, getByText } = render(
      <PromptTab prompt={PROMPT} />,
    );
    const tab = getByRole("button", { name: /prompt/i });
    fireEvent.click(tab);
    expect(getByText(PROMPT)).toBeInTheDocument();
    expect(tab).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(tab);
    expect(queryByText(PROMPT)).toBeNull();
  });

  it("copies the prompt to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { getByRole, findByRole } = render(<PromptTab prompt={PROMPT} />);
    fireEvent.click(getByRole("button", { name: /prompt/i }));
    fireEvent.click(getByRole("button", { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith(PROMPT);
    // Button confirms the copy.
    expect(await findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });
});
