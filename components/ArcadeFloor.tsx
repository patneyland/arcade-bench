"use client";

// ArcadeFloor — the Arcade's thumbnail grid + pop-up play window (owner direction
// 2026-07-06): cabinets in the grid are small identity thumbnails, NOT playable
// frames. Each card is the coin gate itself — vendor brand, model name, param
// count, and the tokens the model spent writing that exact build sit on the
// INSERT COIN screen. Clicking a card opens the PlayWindow, a centered modal that
// mounts the shared SandboxedPlayer (strict sandbox intact) at full stage size —
// the same window pattern the Test Lab uses. The card click IS the coin drop, so
// the player auto-starts inside the window.

import { useEffect, useRef, useState } from "react";
import type { ArcadeEntry, GameView } from "@/lib/types";
import { LOCKED_PROMPT, VENDOR_COLORS } from "@/lib/constants";
import { SandboxedPlayer } from "./SandboxedPlayer";
import { PromptTab } from "./PromptTab";
import { DesktopPlayNote } from "./DesktopPlayNote";
import { CostChip, ParamChip, TokenChip, VendorBadge, formatTokens } from "./Badges";
import { CertifiedChip } from "./ArcadeCabinet";
import { PlayIcon } from "./icons";

export interface ArcadeSection {
  game: GameView;
  cabinets: ArcadeEntry[];
}

export function ArcadeFloor({ sections }: { sections: ArcadeSection[] }) {
  const [open, setOpen] = useState<ArcadeEntry | null>(null);
  // The card that opened the window, so closing can hand focus back to it.
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function close() {
    setOpen(null);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }

  return (
    <>
      {sections.map(({ game, cabinets }) => (
        <div key={game.slug} className="mx-auto max-w-container px-6 pb-12">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-grotesk text-[24px] font-bold tracking-[-0.01em]">
              {game.title}
            </h2>
            <span className="font-mono text-[12px] text-ink-soft">
              {game.year} · {game.creator} · {cabinets.length} certified{" "}
              {cabinets.length === 1 ? "build" : "builds"}
            </span>
          </div>
          {/* Small identity thumbnails: 4-up on desktop, 2-up on phones. */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {cabinets.map((entry) => (
              <ArcadeThumb
                key={entry.generationId}
                entry={entry}
                onOpen={(el) => {
                  triggerRef.current = el;
                  setOpen(entry);
                }}
              />
            ))}
          </div>
        </div>
      ))}

      {open && <PlayWindow entry={open} onClose={close} />}
    </>
  );
}

/** One thumbnail cabinet: a button whose dark screen is the INSERT COIN gate,
 *  carrying the model's identity (vendor, name, params, tokens spent). */
export function ArcadeThumb({
  entry,
  onOpen,
}: {
  entry: ArcadeEntry;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const { game, model } = entry;
  const vendorColor = VENDOR_COLORS[model.vendor] ?? "#57545F";
  return (
    <button
      type="button"
      aria-label={`Insert coin — play ${game.title} by ${model.name}`}
      onClick={(e) => onOpen(e.currentTarget)}
      className="group flex flex-col overflow-hidden rounded-[14px] border-2 border-ink bg-surface text-left shadow-hard transition-[transform,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#1B1A22] focus-visible:-translate-x-0.5 focus-visible:-translate-y-0.5"
    >
      {/* The screen — 7:6 like the real stage, identity + coin gate on it. */}
      <span className="relative flex aspect-[7/6] w-full flex-col items-center justify-center gap-1.5 bg-[#0B0B12] px-2 py-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#8f8fa0]">
          <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ backgroundColor: vendorColor }} />
          {model.vendor}
        </span>
        <span className="text-balance text-center font-grotesk text-[15px] font-bold leading-tight text-white">
          {model.name}
        </span>
        <span className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
          {model.paramSize && (
            <span className="inline-flex items-center rounded-full bg-grape px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              {model.paramSize} params
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d8d8e2]">
            {formatTokens(entry.tokensOut)} tokens
          </span>
        </span>
        <span className="mt-2 flex flex-col items-center gap-1">
          <PlayIcon size={16} color="#FFC700" />
          <span className="font-display text-[10px] leading-none text-yellow group-hover:text-gold-1 motion-safe:group-hover:animate-coin-blink">
            INSERT COIN
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8f8fa0]">
            click to play
          </span>
        </span>
      </span>

      {/* Slim certification footer — the full seal lives in the play window. */}
      <span className="flex w-full flex-wrap items-center justify-between gap-x-2 border-t-2 border-ink bg-cream-2 px-2.5 py-1.5">
        <span className="whitespace-nowrap font-mono text-[10px] font-bold text-win">
          ✓ {Math.round(entry.playablePct)}% playable
        </span>
        <span className="whitespace-nowrap font-mono text-[10px] text-ink-soft">
          ${model.costPerGen.toFixed(3)} / gen
        </span>
      </span>
    </button>
  );
}

/** The pop-up play window: the full-size cabinet in a centered modal. The thumb
 *  click was the coin drop, so the sandboxed player auto-starts. */
export function PlayWindow({ entry, onClose }: { entry: ArcadeEntry; onClose: () => void }) {
  const { game, model } = entry;
  const vendorColor = VENDOR_COLORS[model.vendor] ?? "#57545F";
  const closeRef = useRef<HTMLButtonElement>(null);

  // The window owns the page scroll lock while open. The player's own lock/unlock
  // (on focus moves) saves and restores THIS "hidden" state, so the two compose.
  useEffect(() => {
    const root = document.documentElement;
    const prevRoot = root.style.overflow;
    const prevBody = document.body.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      root.style.overflow = prevRoot;
      document.body.style.overflow = prevBody;
    };
  }, []);

  // Esc closes (while focus is outside the cross-origin frame; ✕ always works).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 sm:p-6"
      onPointerDown={(e) => {
        // Backdrop click closes; clicks inside the window never reach here.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${game.title} — ${model.name}`}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[860px] flex-col overflow-y-auto rounded-[14px] border-2 border-ink bg-surface shadow-[8px_8px_0_#1B1A22]"
      >
        {/* Marquee header: game + model identity + close. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-ink bg-ink px-4 py-3">
          <span className="font-display text-[12px] leading-none text-yellow">{game.title}</span>
          <span className="inline-flex items-center gap-2 font-grotesk text-[13px] font-semibold text-cream">
            <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ backgroundColor: vendorColor }} />
            {model.name}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            // coarse:min-h grows the tap target past 40px on touch devices only
            // (docs/ux-overhaul.md §2) — desktop keeps the compact chip.
            className="btn ml-auto rounded-chip border-cream bg-transparent px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-cream hover:border-yellow hover:bg-yellow hover:text-ink coarse:min-h-[44px] coarse:min-w-[44px]"
          >
            ✕ Close
          </button>
        </div>

        {/* Coarse-pointer framing (page-level copy only — never inside the frame). */}
        <DesktopPlayNote>you can still browse the arcade and try every build</DesktopPlayNote>

        {/* The stage: same shared player, strict sandbox, coin already dropped. */}
        <div className="p-4">
          <div className="mx-auto w-full max-w-[calc(66vh*7/6)]">
            <SandboxedPlayer
              key={entry.generationId}
              artifactPath={entry.artifactPath}
              title={`${game.title} — ${model.name}`}
              autoStart
            />
          </div>
        </div>

        <PromptTab prompt={game.prompt ?? LOCKED_PROMPT(game.title)} />

        {/* Identity + certification strip — the full seal. */}
        <div className="flex flex-wrap items-center gap-2 border-t-2 border-ink bg-cream-2 px-4 py-3">
          <VendorBadge vendor={model.vendor} />
          <ParamChip params={model.paramSize} />
          <TokenChip tokensOut={entry.tokensOut} />
          <CostChip costPerGen={model.costPerGen} />
          <CertifiedChip playablePct={entry.playablePct} votes={entry.votes} />
        </div>
      </div>
    </div>
  );
}
