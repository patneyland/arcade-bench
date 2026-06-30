// HistoryTimeline — a horizontal, scrollable strip; one node per game on a 4px track
// (design.md §8). Three states: Live (green dot, full card, "Live" tag), Now (yellow
// dot + glow ring, "▶ Now" tag), Upcoming (white dashed dot, dashed ~62% card,
// "Upcoming" tag). Takes TimelineEntry[].

import { clsx } from "clsx";
import type { TimelineEntry, GameStatus } from "@/lib/types";

export function HistoryTimeline({ entries }: { entries: TimelineEntry[] }) {
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
    <div className="relative overflow-x-auto pb-4">
      {/* The 4px track behind the nodes. */}
      <div className="relative min-w-max px-2 pt-8">
        <div
          aria-hidden
          className="absolute left-0 right-0 top-[42px] h-1 bg-line"
        />
        <ol className="relative flex items-start gap-6">
          {entries.map((entry) => (
            <TimelineNode key={entry.game.id} entry={entry} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function TimelineNode({ entry }: { entry: TimelineEntry }) {
  const { game, state } = entry;
  return (
    <li className="flex w-44 shrink-0 flex-col items-center">
      <Dot state={state} />
      <div
        className={clsx(
          "mt-4 w-full rounded-chip border-2 p-3",
          state === "upcoming"
            ? "border-dashed border-line bg-surface opacity-[0.62]"
            : "border-ink bg-surface shadow-hard-sm",
        )}
      >
        <p className="font-mono text-[13px] font-bold text-ink-soft">{game.year}</p>
        <p className="mt-0.5 font-grotesk font-bold leading-tight">{game.title}</p>
        <div className="mt-2">
          <StatusTag state={state} />
        </div>
      </div>
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
          style={{ boxShadow: "0 0 0 4px rgba(255,199,0,0.35)" }}
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
