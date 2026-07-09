"use client";

// DesktopPlayNote — the coarse-pointer framing line (docs/ux-overhaul.md §2).
// Touch users are otherwise invited to play keyboard games with zero framing;
// this strip sets expectations at the PAGE level ("best played on desktop —
// you can still …") without touching the sandboxed frame, the artifacts, or
// the locked prompt (all explicitly off-limits per the owner).
//
// Renders nothing on fine-pointer devices — and on the server / first client
// render (useCoarsePointer defaults to fine until mounted), so desktop and
// hydration are untouched.

import { clsx } from "clsx";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";

export function DesktopPlayNote({
  children,
  className,
}: {
  /** The "you can still …" tail, phrased for the surface (browse / screen / vote). */
  children: React.ReactNode;
  className?: string;
}) {
  const coarse = useCoarsePointer();
  if (!coarse) return null;
  return (
    <p
      role="note"
      className={clsx(
        // Caption idiom: slim cream-2 strip, mono uppercase, chunky ink border.
        "border-b-2 border-ink bg-cream-2 px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft",
        className,
      )}
    >
      ⌨ best played on desktop — {children}
    </p>
  );
}
