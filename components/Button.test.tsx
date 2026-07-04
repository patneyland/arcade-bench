import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders the label and the shared .btn class (which carries the press interaction)", () => {
    const { getByRole } = render(<Button>Enter the Arena</Button>);
    const btn = getByRole("button", { name: "Enter the Arena" });
    // The press interaction (active:translate + active:shadow-none) is encapsulated in
    // the shared `.btn` component class in globals.css, so all buttons inherit it.
    expect(btn).toHaveClass("btn");
  });

  it("applies the primary variant (blue) by default", () => {
    const { getByRole } = render(<Button>Go</Button>);
    expect(getByRole("button").className).toContain("bg-blue");
  });

  it("applies the secondary variant (yellow)", () => {
    const { getByRole } = render(<Button variant="secondary">Board</Button>);
    expect(getByRole("button").className).toContain("bg-yellow");
  });

  it("ghost variant has no shadow", () => {
    const { getByRole } = render(<Button variant="ghost">How</Button>);
    expect(getByRole("button").className).toContain("shadow-none");
  });

  it("disabled button is disabled and does not fire onClick", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    const btn = getByRole("button");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onClick when enabled", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
