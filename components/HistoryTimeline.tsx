"use client";

// HistoryTimeline — a horizontal, scrollable strip; one node per game on a 4px track
// (design.md §8, docs/ux-overhaul.md §5 "doors, not dots"). Three states: Live (green
// dot, links to that game's leaderboard), Now (gold dot + glow ring, links to the
// arena), Upcoming (dashed ~62%, non-interactive). Ghost markers anchor both ends of
// the track — "1952 · the dawn" → "present" — so the seeded games read as chapter one.
// `expanded` (the /history page) renders richer cards; the home strip omits it.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import type { TimelineEntry, GameStatus } from "@/lib/types";

export function HistoryTimeline({
  entries,
  expanded = false,
}: {
  entries: TimelineEntry[];
  expanded?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLLIElement>(null);
  const [overflowRight, setOverflowRight] = useState(false);

  // Center the Now node on load (on narrow screens it otherwise sits off-screen) and
  // keep the right-edge scroll affordance in sync with scroll position.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const now = nowRef.current;
    if (now) {
      scroller.scrollLeft = Math.max(
        0,
        now.offsetLeft - (scroller.clientWidth - now.clientWidth) / 2,
      );
    }
    const update = () =>
      setOverflowRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4);
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="rounded-[14px] border-2 border-dashed border-line bg-surface p-10 text-center">
        <p className="font-grotesk text-lg font-bold">The timeline is being written</p>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Games appear here in chronological order as rounds go live.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={scrollRef} className="overflow-x-auto pb-4">
        {/* The 4px track behind the nodes — it runs edge to edge, past both markers. */}
        <div className="relative min-w-max px-2 pt-8">
          <div aria-hidden className="absolute left-0 right-0 top-[42px] h-1 bg-line" />
          <div className="relative flex items-start gap-6">
            <EndMarker label="1952 · the dawn" />
            <ol className="flex items-start gap-6">
              {entries.map((entry) => (
                <TimelineNode
                  key={entry.game.id}
                  entry={entry}
                  expanded={expanded}
                  ref={entry.state === "now" ? nowRef : undefined}
                />
              ))}
            </ol>
            <EndMarker label="→ present · more rounds coming" arrow />
          </div>
        </div>
      </div>
      {/* Right-edge fade + chevron: there's more track off-screen. */}
      {overflowRight && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-4 right-0 top-0 flex w-14 items-center justify-end bg-gradient-to-l from-cream to-transparent"
        >
          <span className="pr-1 font-mono text-lg font-bold text-ink-soft">›</span>
        </div>
      )}
    </div>
  );
}

/** Ghost anchor at either end of the track — narrative, not a game node. */
function EndMarker({ label, arrow = false }: { label: string; arrow?: boolean }) {
  return (
    <div className="flex w-32 shrink-0 flex-col items-center opacity-70">
      <span className="flex h-5 w-5 items-center justify-center">
        {arrow ? (
          <span aria-hidden className="font-mono text-sm font-bold leading-none text-ink-soft">
            →
          </span>
        ) : (
          <span className="h-2.5 w-2.5 border-2 border-dashed border-ink-soft bg-cream" />
        )}
      </span>
      <p className="mt-4 text-center font-mono text-[11px] leading-snug text-ink-soft">{label}</p>
    </div>
  );
}

function TimelineNode({
  entry,
  expanded,
  ref,
}: {
  entry: TimelineEntry;
  expanded: boolean;
  ref?: React.Ref<HTMLLIElement>;
}) {
  const { game, state } = entry;
  const href =
    state === "now" ? "/arena" : state === "live" ? `/leaderboard?game=${game.slug}` : null;

  const cardBody = (
    <>
      <p className="font-mono text-[13px] font-bold text-ink-soft">{game.year}</p>
      <p className="mt-0.5 font-grotesk font-bold leading-tight">{game.title}</p>
      {expanded && (
        <p className="mt-1 font-mono text-[11px] text-ink-soft">
          Round {game.roundOrder} · {game.creator}
        </p>
      )}
      <div className="mt-2">
        <StatusTag state={state} />
      </div>
      {href && (
        <p
          className={clsx(
            "mt-2 font-grotesk text-[12px] font-semibold",
            state === "now" ? "text-blue" : "text-ink-soft",
          )}
        >
          {state === "now" ? "Play this round →" : "See results →"}
        </p>
      )}
    </>
  );

  return (
    <li
      ref={ref}
      className={clsx("flex shrink-0 flex-col items-center", expanded ? "w-56" : "w-44")}
    >
      <Dot state={state} />
      {href ? (
        // A door, not a dot: the whole card is the link and takes the press interaction.
        <Link
          href={href}
          className="mt-4 block w-full rounded-chip border-2 border-ink bg-surface p-3 shadow-hard-sm transition-[transform,box-shadow] duration-75 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#1B1A22] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          {cardBody}
        </Link>
      ) : (
        <div className="mt-4 w-full rounded-chip border-2 border-dashed border-line bg-surface p-3 opacity-[0.62]">
          {cardBody}
        </div>
      )}
    </li>
  );
}

function Dot({ state }: { state: GameStatus }) {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      {state === "now" && (
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse rounded-full"
          style={{
            boxShadow: "0 0 0 4px rgba(255,199,0,0.85), 0 0 0 8px rgba(255,199,0,0.3)",
          }}
        />
      )}
      <span
        className={clsx(
          "h-3.5 w-3.5 border-2 border-ink",
          state === "live" && "bg-win",
          state === "now" && "bg-yellow",
          state === "upcoming" && "border-dashed bg-surface",
        )}
      />
    </span>
  );
}

function StatusTag({ state }: { state: GameStatus }) {
  switch (state) {
    case "live":
      return (
        <span className="inline-flex items-center rounded-chip border-2 border-ink bg-win px-2 py-0.5 font-grotesk text-[11px] font-semibold text-white">
          Live
        </span>
      );
    case "now":
      return (
        <span className="inline-flex items-center rounded-chip border-2 border-ink bg-yellow px-2 py-0.5 font-grotesk text-[11px] font-semibold text-ink">
          ▶ Now
        </span>
      );
    case "upcoming":
    default:
      return (
        <span className="inline-flex items-center rounded-chip border-2 border-dashed border-line px-2 py-0.5 font-grotesk text-[11px] font-semibold text-ink-soft">
          Upcoming
        </span>
      );
  }
}
