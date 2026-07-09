"use client";

// useCoarsePointer — is the PRIMARY pointer coarse (finger on a touchscreen)?
// Used for the page-level "best played on desktop" framing and for enlarging
// tap targets (docs/ux-overhaul.md §2). Deliberately a pointer-capability
// check, NOT a width breakpoint — the tablet (768px) layout must not change.
//
// SSR/hydration safety: the server can't know the pointer, so the first render
// (server AND first client render) always says "fine pointer"; the real value
// lands in an effect after mount. This avoids a hydration mismatch at the cost
// of one extra render on touch devices.

import { useEffect, useState } from "react";

const QUERY = "(pointer: coarse)";

export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    // jsdom (and very old browsers) have no matchMedia — treat as fine pointer.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(QUERY);
    const update = () => setCoarse(mql.matches);
    update();
    // Pointer capability can change live (e.g. tablet docked to a keyboard).
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return coarse;
}
