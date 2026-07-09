import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { DesktopPlayNote } from "./DesktopPlayNote";

// jsdom has no matchMedia; stub it per-test. The hook must treat a missing
// matchMedia (and the server render) as a FINE pointer — desktop is the default.
type Listener = (ev: { matches: boolean }) => void;

function stubMatchMedia(matches: boolean) {
  const listeners: Listener[] = [];
  const mql = {
    matches,
    media: "(pointer: coarse)",
    addEventListener: (_: string, cb: Listener) => listeners.push(cb),
    removeEventListener: (_: string, cb: Listener) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  const matchMedia = vi.fn().mockReturnValue(mql);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    /** Simulate the pointer capability changing live (tablet docks a keyboard). */
    change(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next }));
    },
    listeners,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DesktopPlayNote (coarse-pointer framing, docs/ux-overhaul.md §2)", () => {
  it("renders nothing when matchMedia is unavailable (SSR/jsdom → fine pointer)", () => {
    const { queryByRole } = render(<DesktopPlayNote>you can still vote</DesktopPlayNote>);
    expect(queryByRole("note")).toBeNull();
  });

  it("renders nothing on a fine pointer (desktop unchanged)", () => {
    stubMatchMedia(false);
    const { queryByRole } = render(<DesktopPlayNote>you can still vote</DesktopPlayNote>);
    expect(queryByRole("note")).toBeNull();
  });

  it("shows the 'best played on desktop' framing on a coarse pointer", () => {
    const stub = stubMatchMedia(true);
    const { getByRole } = render(
      <DesktopPlayNote>you can still screen builds and cast your verdict</DesktopPlayNote>,
    );
    const note = getByRole("note");
    expect(note).toHaveTextContent(/best played on desktop/i);
    expect(note).toHaveTextContent(/you can still screen builds and cast your verdict/i);
    expect(stub.matchMedia).toHaveBeenCalledWith("(pointer: coarse)");
  });

  it("targets pointer capability, not viewport width (queries '(pointer: coarse)' only)", () => {
    const stub = stubMatchMedia(true);
    render(<DesktopPlayNote>you can still vote</DesktopPlayNote>);
    for (const call of stub.matchMedia.mock.calls) {
      expect(call[0]).toBe("(pointer: coarse)");
    }
  });

  it("reacts when the pointer capability changes live", () => {
    const stub = stubMatchMedia(false);
    const { queryByRole } = render(<DesktopPlayNote>you can still vote</DesktopPlayNote>);
    expect(queryByRole("note")).toBeNull();
    act(() => stub.change(true));
    expect(queryByRole("note")).not.toBeNull();
    act(() => stub.change(false));
    expect(queryByRole("note")).toBeNull();
  });

  it("unsubscribes from the media query on unmount", () => {
    const stub = stubMatchMedia(true);
    const { unmount } = render(<DesktopPlayNote>you can still vote</DesktopPlayNote>);
    expect(stub.listeners.length).toBe(1);
    unmount();
    expect(stub.listeners.length).toBe(0);
  });
});
