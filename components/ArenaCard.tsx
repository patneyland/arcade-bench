"use client";

// ArenaCard — the hero component (design.md §8). A bordered card with three stacked
// regions: Head (reference + game meta), Body (two equal build frames split by a 2px
// ink divider, each with its BUILD A/B label, hidden-model tag, and SandboxedPlayer),
// and the Vote bar. Under 760px the two frames stack and the divider becomes a bottom
// border. Takes an ArenaPairing; manages "Next match" swapping locally.

import { useState } from "react";
import { clsx } from "clsx";
import type { ArenaPairing } from "@/lib/types";
import { SandboxedPlayer } from "./SandboxedPlayer";
import { VoteBar } from "./VoteBar";

interface ArenaCardProps {
  pairing: ArenaPairing;
  /** When false, hide the vote bar (e.g. a compact preview on the home page). */
  showVote?: boolean;
}

export function ArenaCard({ pairing: initial, showVote = true }: ArenaCardProps) {
  const [pairing, setPairing] = useState<ArenaPairing>(initial);
  const { game, roundOf, a, b } = pairing;

  return (
    <div className="overflow-hidden rounded-[14px] border-2 border-ink bg-surface shadow-hard">
      {/* Head */}
      <div className="flex flex-wrap items-center gap-4 border-b-2 border-ink bg-cream-2 px-5 py-4">
        <ReferenceThumb url={game.referenceMediaUrl} title={game.title} />
        <div className="min-w-0 flex-1">
          <h3 className="font-grotesk text-xl font-bold leading-tight">{game.title}</h3>
          <p className="mt-0.5 font-mono text-[13px] text-ink-soft">
            {game.year} · {game.creator} · Round {game.roundOrder} of {roundOf}
          </p>
        </div>
        <span className="eyebrow shrink-0">Reference shown</span>
      </div>

      {/* Body: two equal frames split by a 2px ink divider (stacks under 760px). */}
      <div className="grid grid-cols-1 min-[760px]:grid-cols-2">
        <BuildFrame side="A" pairing={pairing} />
        <BuildFrame side="B" pairing={pairing} />
      </div>

      {/* Vote bar */}
      {showVote && <VoteBar pairing={pairing} onNext={(next) => next && setPairing(next)} />}
    </div>
  );
}

function ReferenceThumb({ url, title }: { url: string | null; title: string }) {
  return (
    <div
      className="game-canvas h-14 w-[74px] shrink-0 !aspect-auto"
      aria-label={`Reference for ${title}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${title} original`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] uppercase tracking-widest text-[#6b6b7a]">
          ref
        </span>
      )}
    </div>
  );
}

function BuildFrame({ side, pairing }: { side: "A" | "B"; pairing: ArenaPairing }) {
  const build = side === "A" ? pairing.a : pairing.b;
  const accent = side === "A" ? "blue" : "red";
  return (
    <div
      className={clsx(
        "p-4",
        // Divider: right border on A at >=760px, bottom border on A when stacked.
        side === "A" && "border-b-2 border-ink min-[760px]:border-b-0 min-[760px]:border-r-2",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            "rounded px-2 py-1 font-display text-[10px] leading-none text-white",
            accent === "blue" ? "bg-blue" : "bg-red",
          )}
        >
          BUILD {side}
        </span>
        <span className="rounded-chip border-2 border-dashed border-line px-2 py-1 font-mono text-[11px] text-ink-soft">
          model hidden until you vote
        </span>
      </div>
      <SandboxedPlayer
        artifactPath={build.artifactPath}
        title={`Build ${side} — ${pairing.game.title}`}
      />
    </div>
  );
}
