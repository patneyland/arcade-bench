"use client";

// TestCabinet — the Test Lab's one-cabinet screening flow (docs/ux-overhaul.md §7),
// reusing the arena's session pattern (ArenaCard) for a single unvetted build:
//
//   coin → play → verdict (PLAYABLE / NOT PLAYABLE) → reveal → next candidate
//
// A slim marquee carries the game meta and the one anonymity note — the model is
// NEVER named before the verdict; TestVerdict reveals it. The stage stays MOUNTED
// (hidden, not unmounted) during the verdict step so "go back and play more"
// resumes the same run; it unmounts only when the next candidate loads.

import { useState } from "react";
import type { TestCandidate } from "@/lib/types";
import { SandboxedPlayer } from "./SandboxedPlayer";
import { TestVerdict } from "./TestVerdict";
import { ButtonLink } from "./Button";

export function TestCabinet({ initial }: { initial: TestCandidate | null }) {
  const [candidate, setCandidate] = useState<TestCandidate | null>(initial);
  const [step, setStep] = useState<"play" | "verdict">("play");
  const [started, setStarted] = useState(false);
  // Session tally — plain client state, no persistence; survives across candidates.
  const [screened, setScreened] = useState(0);

  function handleNext(next: TestCandidate | null) {
    setCandidate(next);
    setStep("play");
    setStarted(false);
  }

  // Queue empty is a first-class state, not an error.
  if (!candidate) return <QueueEmpty />;

  const { game } = candidate;

  return (
    // overflow-clip (not hidden) so the CTA row can be position:sticky on mobile.
    <div className="overflow-clip rounded-[14px] border-2 border-ink bg-surface shadow-hard">
      {/* Marquee: what this is, what game, and the one anonymity note. */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b-2 border-ink bg-cream-2 px-5 py-3">
        <span className="font-display text-[11px] leading-none text-ink">TEST LAB</span>
        <h1 className="font-grotesk text-lg font-bold leading-tight">{game.title}</h1>
        <span className="font-mono text-[12px] text-ink-soft">
          {game.year} · model hidden until you vote
        </span>
        <span className="ml-auto rounded-chip border-2 border-ink bg-surface px-2 py-0.5 font-mono text-[11px] text-ink">
          {candidate.votes} vote{candidate.votes === 1 ? "" : "s"} so far
        </span>
      </div>

      {/* Stage: hidden (not unmounted) during the verdict so the run survives
          "go back and play more". Keyed per candidate for a fresh coin screen. */}
      <div hidden={step !== "play"} className="p-4 sm:p-5">
        {/* max-w keeps the 7:6 stage under ~62vh so stage + CTA share the viewport. */}
        <div className="mx-auto w-full max-w-[calc(62vh*7/6)]">
          <SandboxedPlayer
            key={candidate.generationId}
            artifactPath={candidate.artifactPath}
            title={`Unvetted build — ${game.title}`}
            accent="blue"
            onStarted={() => setStarted(true)}
          />
        </div>
      </div>

      {/* CTA row: slim, sticky at the bottom on phones. Restart lives in the
          player's own overlay chip — no extra controls here. */}
      {step === "play" && (
        <div className="border-t-2 border-ink bg-cream-2 px-4 py-3 max-[759px]:sticky max-[759px]:bottom-0 max-[759px]:z-10">
          {!started ? (
            <p className="py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
              ▶ insert a coin to start this build
            </p>
          ) : (
            <div className="flex justify-center">
              {/* Coin gold: the neutral "step forward" color. */}
              <button
                type="button"
                onClick={() => setStep("verdict")}
                className="btn rounded-btn bg-yellow px-6 py-3 font-grotesk font-semibold text-ink shadow-hard-sm hover:brightness-95"
              >
                GIVE YOUR VERDICT →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Verdict → reveal (TestVerdict handles both; remounts per candidate). */}
      {step === "verdict" && (
        <TestVerdict
          candidate={candidate}
          onBack={() => setStep("play")}
          onRevealed={() => setScreened((n) => n + 1)}
          sessionTally={screened}
          onNext={handleNext}
        />
      )}
    </div>
  );
}

function QueueEmpty() {
  return (
    <div className="mx-auto max-w-container rounded-[14px] border-2 border-dashed border-line bg-surface p-12 text-center shadow-hard">
      <p className="font-grotesk text-xl font-bold">
        You&apos;ve screened everything in the queue
      </p>
      <p className="mx-auto mt-2 max-w-[48ch] font-sans text-ink-soft">
        Check back when new builds land. Meanwhile, the Arcade is stocked with the
        builds testers like you certified.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/arcade" variant="primary">
          Play the Arcade
        </ButtonLink>
        <ButtonLink href="/leaderboard" variant="ghost">
          See the leaderboard
        </ButtonLink>
      </div>
    </div>
  );
}
