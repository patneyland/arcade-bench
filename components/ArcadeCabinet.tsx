// ArcadeCabinet — one certified-playable build in the public Arcade
// (docs/ux-overhaul.md §7). Model identity is SHOWN: arcade visitors don't
// vote, so there's nothing to bias. The frame is the shared SandboxedPlayer,
// INSERT COIN gate intact — playing is always free and zero-auth.

import type { ArcadeEntry } from "@/lib/types";
import { SandboxedPlayer } from "./SandboxedPlayer";
import { CostChip, VendorBadge } from "./Badges";

export function ArcadeCabinet({
  entry,
  showGame = false,
}: {
  entry: ArcadeEntry;
  /** Dark marquee strip with the game title — for contexts (home teaser) where
   *  cabinets aren't already grouped under a game heading. */
  showGame?: boolean;
}) {
  const { game, model } = entry;
  return (
    <div className="overflow-hidden rounded-[14px] border-2 border-ink bg-surface shadow-hard">
      {showGame && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-ink bg-ink px-4 py-2.5">
          <span className="font-display text-[12px] leading-none text-yellow">{game.title}</span>
          <span className="font-mono text-[11px] text-[#8f8fa0]">
            {game.year} · {game.creator}
          </span>
        </div>
      )}

      <div className="p-4">
        <SandboxedPlayer
          artifactPath={entry.artifactPath}
          title={`${game.title} — ${model.name}`}
        />
      </div>

      {/* Identity + certification strip. */}
      <div className="flex flex-wrap items-center gap-2 border-t-2 border-ink bg-cream-2 px-4 py-3">
        <span className="font-grotesk text-[15px] font-bold">{model.name}</span>
        <VendorBadge vendor={model.vendor} />
        <CostChip costPerGen={model.costPerGen} />
        <CertifiedChip playablePct={entry.playablePct} votes={entry.votes} />
      </div>
    </div>
  );
}

/** "✓ CERTIFIED PLAYABLE · 96% · 12 votes" — win-green mono, the arcade's seal. */
export function CertifiedChip({ playablePct, votes }: { playablePct: number; votes: number }) {
  return (
    <span className="ml-auto inline-flex items-center rounded-chip border-2 border-ink bg-surface px-2 py-1 font-mono text-[11px] font-bold text-win">
      ✓ CERTIFIED PLAYABLE · {Math.round(playablePct)}% · {votes} {votes === 1 ? "vote" : "votes"}
    </span>
  );
}
