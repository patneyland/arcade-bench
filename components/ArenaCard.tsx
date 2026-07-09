"use client";

// ArenaCard — the "one cabinet" session flow (docs/ux-overhaul.md §1). One game on
// screen at a time; the round is a state machine, not a comparison table:
//
//   coin → play A → play B → verdict → reveal → next round
//
// A slim marquee header carries the game meta and the single anonymity note. The
// stage shows exactly one build (A = blue chrome, B = red — the load-bearing
// convention from lib/constants.ts); the INSERT COIN gate inside SandboxedPlayer is
// the coin screen. Both builds stay MOUNTED for the whole round — the off-stage one
// is hidden via the `hidden` attribute (browser rAF throttling pauses most canvas
// games) — and unmount only when a fresh pairing loads. The verdict/reveal steps
// (VoteBar) replace the stage visually while the frames stay mounted underneath.

import { useState } from "react";
import { clsx } from "clsx";
import type { ArenaPairing } from "@/lib/types";
import { SandboxedPlayer } from "./SandboxedPlayer";
import { VoteBar } from "./VoteBar";

interface ArenaCardProps {
  pairing: ArenaPairing;
  /** Legacy home-page prop — the flow always includes the vote step now (no-op). */
  showVote?: boolean;
}

type Stage = "a" | "b";

export function ArenaCard({ pairing: initial }: ArenaCardProps) {
  const [pairing, setPairing] = useState<ArenaPairing>(initial);
  const [step, setStep] = useState<"play" | "vote">("play");
  const [stage, setStage] = useState<Stage>("a");
  const [started, setStarted] = useState({ a: false, b: false });
  // Session tally — plain client state, no persistence; survives across rounds.
  const [judged, setJudged] = useState(0);

  const { game, roundOf } = pairing;
  const bothStarted = started.a && started.b;

  function handleNext(next: ArenaPairing | null) {
    if (!next) return;
    setPairing(next);
    setStep("play");
    setStage("a");
    setStarted({ a: false, b: false });
  }

  return (
    // overflow-clip (not hidden) so the CTA row can be position:sticky on mobile.
    <div className="overflow-clip rounded-[14px] border-2 border-ink bg-surface shadow-hard">
      {/* Marquee: game meta + the one anonymity note. */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b-2 border-ink bg-cream-2 px-5 py-3">
        <h3 className="font-grotesk text-lg font-bold leading-tight">{game.title}</h3>
        <span className="font-mono text-[12px] text-ink-soft">
          {game.year} · {game.creator} · Round {game.roundOrder} of {roundOf}
        </span>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          models hidden until you vote
        </span>
      </div>

      {/* Stage: both builds mounted for the whole round, one on stage at a time.
          Hidden (not unmounted) during verdict/reveal so game state survives
          "go back and replay". */}
      <div hidden={step !== "play"} className="p-4 sm:p-5">
        <StageFrame
          key={`a-${pairing.a.generationId}`}
          side="a"
          onStage={stage === "a"}
          pairing={pairing}
          onStarted={() => setStarted((p) => ({ ...p, a: true }))}
        />
        <StageFrame
          key={`b-${pairing.b.generationId}`}
          side="b"
          onStage={stage === "b"}
          pairing={pairing}
          onStarted={() => setStarted((p) => ({ ...p, b: true }))}
        />
      </div>

      {/* CTA row: the current step's primary action — slim sticky bottom row on phones. */}
      {step === "play" && (
        <div className="border-t-2 border-ink bg-cream-2 px-4 py-3 max-[759px]:sticky max-[759px]:bottom-0 max-[759px]:z-10">
          {!started.a && stage === "a" ? (
            <p className="py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
              ▶ insert a coin to start build A
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {stage === "b" && (
                <button
                  type="button"
                  onClick={() => setStage("a")}
                  className="btn rounded-btn bg-surface px-4 py-2 font-grotesk text-sm font-semibold text-ink shadow-hard-sm"
                >
                  ↩ replay Build A
                </button>
              )}
              {stage === "a" && bothStarted && (
                <button
                  type="button"
                  onClick={() => setStage("b")}
                  className="btn rounded-btn bg-surface px-4 py-2 font-grotesk text-sm font-semibold text-ink shadow-hard-sm"
                >
                  replay Build B ↪
                </button>
              )}
              {stage === "a" && !bothStarted ? (
                // Red: it leads to Build B.
                <button
                  type="button"
                  onClick={() => setStage("b")}
                  className="btn rounded-btn bg-red px-6 py-3 font-grotesk font-semibold text-white shadow-hard-sm hover:brightness-95"
                >
                  NEXT: PLAY BUILD B →
                </button>
              ) : (
                // Coin gold: neutral between A and B.
                <button
                  type="button"
                  onClick={() => setStep("vote")}
                  className="btn rounded-btn bg-yellow px-6 py-3 font-grotesk font-semibold text-ink shadow-hard-sm hover:brightness-95"
                >
                  CAST YOUR VOTE →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Verdict → reveal (VoteBar handles both; remounts per pairing via unmount). */}
      {step === "vote" && (
        <VoteBar
          pairing={pairing}
          bothPlayed={bothStarted}
          onBack={() => setStep("play")}
          onRevealed={() => setJudged((n) => n + 1)}
          sessionTally={judged}
          onNext={handleNext}
        />
      )}
    </div>
  );
}

function StageFrame({
  side,
  onStage,
  pairing,
  onStarted,
}: {
  side: Stage;
  onStage: boolean;
  pairing: ArenaPairing;
  onStarted: () => void;
}) {
  const build = side === "a" ? pairing.a : pairing.b;
  const label = side.toUpperCase();
  const { width: vw, height: vh } = build.viewport ?? { width: 820, height: 700 };
  return (
    // Off-stage builds stay mounted but hidden — rAF throttling pauses their games.
    // max-w keeps the stage under ~62vh tall at the build's own aspect ratio, so
    // stage + CTA share the viewport.
    <div
      hidden={!onStage}
      className="mx-auto w-full"
      style={{ maxWidth: `calc(62vh * ${(vw / vh).toFixed(4)})` }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={clsx(
            "rounded px-2.5 py-1.5 font-display text-[11px] leading-none text-white",
            side === "a" ? "bg-blue" : "bg-red",
          )}
        >
          BUILD {label}
        </span>
      </div>
      <SandboxedPlayer
        artifactPath={build.artifactPath}
        title={`Build ${label} — ${pairing.game.title}`}
        accent={side === "a" ? "blue" : "red"}
        viewport={build.viewport}
        onStarted={onStarted}
      />
    </div>
  );
}
