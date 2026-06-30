"use client";

// VoteBar — the arena's four vote controls (design.md §5).
//
//   [ ← A is better (blue) ] [ B is better → (red) ]   <- 1fr 1fr, extra padding
//          [ Tie ]   [ Both bad (danger) ]             <- centered secondary row
//
// On click → POST /api/vote { gameId, genAId, genBId, winner }. On success the two
// model identities are revealed (badges). If the user is not signed in the response
// is { error: "unauthenticated" } — we surface a Clerk sign-in prompt, and once the user
// signs in the pending vote is retried automatically.
// "Next match" loads a fresh pairing via GET /api/arena/next?game=<slug>.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { SignInButton, useUser } from "@clerk/nextjs";
import type { ArenaPairing, ModelView, RecordVoteResult, VoteWinner } from "@/lib/types";
import { VendorBadge, ParamChip, CostChip } from "./Badges";

interface VoteBarProps {
  pairing: ArenaPairing;
  /** Called with a fresh pairing when "Next match" loads one (e.g. to swap in the parent). */
  onNext?: (next: ArenaPairing | null) => void;
}

type Reveal = { a: ModelView; b: ModelView };

export function VoteBar({ pairing, onNext }: VoteBarProps) {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [pending, setPending] = useState<VoteWinner | null>(null);
  const [castWinner, setCastWinner] = useState<VoteWinner | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  // When the user completes Clerk sign-in from the prompt below, retry the vote they
  // were trying to cast — so signing in feels continuous with voting.
  useEffect(() => {
    if (isSignedIn && needsSignIn && castWinner) {
      setNeedsSignIn(false);
      void castVote(castWinner);
    }
    // castVote is stable for this purpose; we only want to react to the sign-in transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  async function castVote(winner: VoteWinner) {
    setError(null);
    setNeedsSignIn(false);
    setPending(winner);
    setCastWinner(winner);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: pairing.game.id,
          genAId: pairing.a.generationId,
          genBId: pairing.b.generationId,
          winner,
        }),
      });
      const data: RecordVoteResult = await res.json();
      if (data.ok && data.reveal) {
        setReveal(data.reveal);
      } else if (data.error === "unauthenticated") {
        setNeedsSignIn(true);
      } else {
        setError(errorMessage(data.error));
      }
    } catch {
      setError("Something went wrong recording your vote. Try again.");
    } finally {
      setPending(null);
    }
  }

  async function loadNext() {
    try {
      const res = await fetch(`/api/arena/next?game=${encodeURIComponent(pairing.game.slug)}`);
      const next: ArenaPairing | null = res.ok ? await res.json() : null;
      if (onNext) onNext(next);
      else router.refresh();
    } catch {
      router.refresh();
    }
  }

  if (reveal) {
    return (
      <div className="bg-cream-2 p-5">
        <Revealed reveal={reveal} winner={lastWinnerLabel(castWinner)} onNext={loadNext} />
      </div>
    );
  }

  const voted = pending !== null;

  return (
    <div className="bg-cream-2 p-5">
      {needsSignIn && (
        <div className="mb-4 rounded-chip border-2 border-ink bg-yellow/30 px-4 py-3 font-sans text-sm">
          You need to sign in to vote.{" "}
          <SignInButton mode="modal">
            <button className="font-grotesk font-semibold underline underline-offset-2">
              Sign in and record this vote
            </button>
          </SignInButton>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-chip border-2 border-danger px-4 py-3 font-sans text-sm text-danger">
          {error}
        </div>
      )}

      {/* Top row: A / B side by side, extra padding so they read as the primary act. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          className="btn rounded-btn border-2 border-ink bg-blue px-5 py-[15px] font-grotesk font-semibold text-white shadow-hard-sm hover:bg-blue-deep disabled:opacity-60"
          onClick={() => castVote("a")}
          disabled={voted}
          aria-label="Build A is better"
        >
          ← A is better
        </button>
        <button
          className="btn rounded-btn border-2 border-ink bg-red px-5 py-[15px] font-grotesk font-semibold text-white shadow-hard-sm hover:brightness-95 disabled:opacity-60"
          onClick={() => castVote("b")}
          disabled={voted}
          aria-label="Build B is better"
        >
          B is better →
        </button>
      </div>

      {/* Secondary row: Tie and Both bad, centered. */}
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <button
          className="btn rounded-btn border-2 border-ink bg-surface px-5 py-2.5 font-grotesk font-semibold text-ink shadow-hard-sm disabled:opacity-60"
          onClick={() => castVote("tie")}
          disabled={voted}
        >
          Tie
        </button>
        <button
          className="btn rounded-btn border-2 border-danger bg-surface px-5 py-2.5 font-grotesk font-semibold text-danger shadow-[3px_3px_0_#E23B3B] active:shadow-none disabled:opacity-60"
          onClick={() => castVote("both_bad")}
          disabled={voted}
        >
          Both bad
        </button>
      </div>

      {voted && !needsSignIn && (
        <p className="mt-3 text-center font-mono text-[12px] uppercase tracking-[0.16em] text-ink-soft">
          Recording vote…
        </p>
      )}
    </div>
  );
}

function Revealed({
  reveal,
  winner,
  onNext,
}: {
  reveal: Reveal;
  winner: string | null;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="mb-4 text-center font-grotesk text-lg font-bold">
        Vote recorded{winner ? ` · ${winner}` : ""} — identities revealed
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RevealCard side="A" model={reveal.a} accent="blue" />
        <RevealCard side="B" model={reveal.b} accent="red" />
      </div>
      <div className="mt-5 flex justify-center">
        <button
          className="btn rounded-btn border-2 border-ink bg-blue px-6 py-3 font-grotesk font-semibold text-white shadow-hard-sm hover:bg-blue-deep"
          onClick={onNext}
        >
          Next match →
        </button>
      </div>
    </div>
  );
}

function RevealCard({
  side,
  model,
  accent,
}: {
  side: "A" | "B";
  model: ModelView;
  accent: "blue" | "red";
}) {
  return (
    <div className="rounded-chip border-2 border-ink bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={clsx(
            "rounded px-2 py-0.5 font-display text-[10px] text-white",
            accent === "blue" ? "bg-blue" : "bg-red",
          )}
        >
          BUILD {side}
        </span>
        <span className="font-grotesk font-bold">{model.name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <VendorBadge vendor={model.vendor} />
        <ParamChip params={model.paramSize} />
        <CostChip costPerGen={model.costPerGen} />
      </div>
    </div>
  );
}

function errorMessage(error: RecordVoteResult["error"]): string {
  switch (error) {
    case "duplicate":
      return "You already voted on this match.";
    case "rate_limited":
      return "Slow down a moment, then try again.";
    case "invalid":
    default:
      return "That vote could not be recorded.";
  }
}

function lastWinnerLabel(winner: VoteWinner | null): string | null {
  switch (winner) {
    case "a":
      return "Build A";
    case "b":
      return "Build B";
    case "tie":
      return "Tie";
    case "both_bad":
      return "Both bad";
    default:
      return null;
  }
}
