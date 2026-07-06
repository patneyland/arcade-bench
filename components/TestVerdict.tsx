"use client";

// TestVerdict — the verdict + reveal steps of the Test Lab screening flow
// (docs/ux-overhaul.md §7). Rendered where the stage was, mirroring VoteBar:
//
//   "Could a person actually play this?"
//   [ ✓ PLAYABLE (win) ]  [ ✗ NOT PLAYABLE (danger) ]
//
// On click → POST /api/playability/vote { generationId, playable }. On success the
// model identity is revealed (the payoff — it must never render before this), with
// the updated playable % and certified state. Signed-out testers get a Clerk
// sign-in prompt and their pending verdict is retried after sign-in; a duplicate
// verdict shows a notice and auto-advances to the next candidate.
// "NEXT BUILD →" loads a fresh candidate via GET /api/playability/next.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useUser } from "@clerk/nextjs";
import type { RecordPlayabilityResult, TestCandidate } from "@/lib/types";
import { CERTIFIED_PLAYABLE_PCT } from "@/lib/constants";
import { VendorBadge, ParamChip, CostChip } from "./Badges";

type Reveal = NonNullable<RecordPlayabilityResult["reveal"]>;

interface TestVerdictProps {
  candidate: TestCandidate;
  /** Active game filter (undefined = All) — carried into the "next build" fetch. */
  gameSlug?: string;
  /** Called with the next candidate (or null = queue empty) when one loads. */
  onNext?: (next: TestCandidate | null) => void;
  /** "↩ go back and play more" — returns the flow to the play step. */
  onBack?: () => void;
  /** Fires once when a verdict succeeds and the identity is revealed. */
  onRevealed?: () => void;
  /** Builds screened this session (client-side tally, shown on the reveal step). */
  sessionTally?: number;
}

/** How long the duplicate notice stays up before auto-advancing. */
const DUPLICATE_ADVANCE_MS = 1400;

export function TestVerdict({
  candidate,
  gameSlug,
  onNext,
  onBack,
  onRevealed,
  sessionTally,
}: TestVerdictProps) {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [pending, setPending] = useState(false);
  const [cast, setCast] = useState<boolean | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [duplicate, setDuplicate] = useState(false);

  // When the user completes Clerk sign-in from the prompt below, retry the verdict
  // they were casting — so signing in feels continuous with screening.
  useEffect(() => {
    if (isSignedIn && needsSignIn && cast !== null) {
      setNeedsSignIn(false);
      void castVerdict(cast);
    }
    // castVerdict is stable for this purpose; react only to the sign-in transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // Duplicate = nothing left to do on this build: show the notice, then advance.
  useEffect(() => {
    if (!duplicate) return;
    const id = window.setTimeout(() => void loadNext(), DUPLICATE_ADVANCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicate]);

  async function castVerdict(playable: boolean) {
    setError(null);
    setNeedsSignIn(false);
    setPending(true);
    setCast(playable);
    try {
      const res = await fetch("/api/playability/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: candidate.generationId, playable }),
      });
      const data: RecordPlayabilityResult = await res.json();
      if (data.ok && data.reveal) {
        setReveal(data.reveal);
        onRevealed?.();
      } else if (data.error === "unauthenticated") {
        setNeedsSignIn(true);
      } else if (data.error === "duplicate") {
        setDuplicate(true);
      } else {
        setError(errorMessage(data.error));
      }
    } catch {
      setError("Something went wrong recording your verdict. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function loadNext() {
    try {
      const q = gameSlug ? `?game=${encodeURIComponent(gameSlug)}` : "";
      const res = await fetch(`/api/playability/next${q}`);
      if (res.ok) {
        const next: TestCandidate | null = await res.json();
        if (onNext) onNext(next);
        else router.refresh();
      } else {
        // 401 (signed out mid-session) or a server hiccup — let the page re-decide.
        router.refresh();
      }
    } catch {
      router.refresh();
    }
  }

  if (reveal) {
    return (
      <div className="bg-cream-2 p-5 sm:p-8">
        <Revealed
          reveal={reveal}
          verdict={cast}
          sessionTally={sessionTally}
          onNext={loadNext}
        />
      </div>
    );
  }

  return (
    <div className="bg-cream-2 p-5 sm:p-8">
      <div className="mx-auto max-w-[760px]">
        <p className="mb-3 text-center font-display text-[13px] leading-none">THE VERDICT</p>
        <p className="mb-5 text-center font-sans text-[16px] font-medium">
          Could a person actually play this?
        </p>

        {needsSignIn && (
          <div className="mb-4 flex flex-col items-center gap-3 rounded-chip border-2 border-ink bg-yellow/30 px-4 py-4 text-center font-sans text-sm">
            <p>You need to sign in to screen builds — your verdict is cast right after.</p>
            <SignInButton mode="modal">
              <button className="btn rounded-btn border-2 border-ink bg-blue px-5 py-2.5 font-grotesk font-semibold text-white shadow-hard-sm hover:bg-blue-deep">
                Sign in and record this verdict
              </button>
            </SignInButton>
          </div>
        )}
        {duplicate && (
          <div className="mb-4 rounded-chip border-2 border-ink bg-yellow/30 px-4 py-3 text-center font-sans text-sm">
            You already screened this one — loading the next build…
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-chip border-2 border-danger px-4 py-3 text-center font-sans text-sm text-danger">
            {error}
          </div>
        )}

        {/* The two verdicts, side by side — the primary act. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            className="btn rounded-btn border-2 border-ink bg-win px-5 py-5 font-grotesk text-[17px] font-semibold text-white shadow-hard-sm hover:brightness-95 disabled:opacity-60 sm:py-6"
            onClick={() => castVerdict(true)}
            disabled={pending || duplicate}
            aria-label="This build is playable"
          >
            ✓ PLAYABLE
          </button>
          <button
            className="btn rounded-btn border-2 border-danger bg-surface px-5 py-5 font-grotesk text-[17px] font-semibold text-danger shadow-[3px_3px_0_#E23B3B] active:shadow-none disabled:opacity-60 sm:py-6"
            onClick={() => castVerdict(false)}
            disabled={pending || duplicate}
            aria-label="This build is not playable"
          >
            ✗ NOT PLAYABLE
          </button>
        </div>

        {pending && !needsSignIn && (
          <p className="mt-3 text-center font-mono text-[12px] uppercase tracking-[0.16em] text-ink-soft">
            Recording verdict…
          </p>
        )}

        {onBack && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={onBack}
              className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-soft underline underline-offset-4 hover:text-ink"
            >
              ↩ go back and play more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Revealed({
  reveal,
  verdict,
  sessionTally,
  onNext,
}: {
  reveal: Reveal;
  verdict: boolean | null;
  sessionTally?: number;
  onNext: () => void;
}) {
  const status = statusLine(reveal);
  return (
    <div className="mx-auto max-w-[760px]">
      <p className="mb-4 text-center font-grotesk text-lg font-bold">
        Verdict recorded{verdict == null ? "" : verdict ? " · playable" : " · not playable"} —
        identity revealed
      </p>

      {/* The payoff: who built it, and where it stands now. */}
      <div className="rounded-chip border-2 border-ink bg-surface p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-blue px-2 py-0.5 font-display text-[10px] text-white">
            BUILT BY
          </span>
          <span className="font-grotesk text-lg font-bold">{reveal.model.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VendorBadge vendor={reveal.model.vendor} />
          <ParamChip params={reveal.model.paramSize} />
          <CostChip costPerGen={reveal.model.costPerGen} />
        </div>
        <div className="mt-3 border-t-2 border-dashed border-line pt-3">
          <p className="font-mono text-[13px] font-bold">
            {Math.round(reveal.playablePct)}% playable · {reveal.votes}{" "}
            vote{reveal.votes === 1 ? "" : "s"}
          </p>
          <p className={`mt-1 font-mono text-[12px] uppercase tracking-[0.08em] ${status.tone}`}>
            {status.text}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2.5">
        <button
          className="btn rounded-btn border-2 border-ink bg-blue px-8 py-4 font-grotesk text-[17px] font-semibold text-white shadow-hard-sm hover:bg-blue-deep"
          onClick={onNext}
        >
          NEXT BUILD →
        </button>
        {sessionTally != null && sessionTally > 0 && (
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-soft">
            {sessionTally} build{sessionTally === 1 ? "" : "s"} screened this session
          </p>
        )}
      </div>
    </div>
  );
}

/** Certified → in the Arcade; well below the bar → reported unplayable; the middle
 *  ground is honestly on the bubble (no minimum vote count, so % can swing). */
function statusLine(reveal: Reveal): { text: string; tone: string } {
  if (reveal.certified) {
    return { text: "✓ this build is in the Arcade", tone: "text-win" };
  }
  if (reveal.playablePct >= 50) {
    return {
      text: `on the bubble — needs ≥${CERTIFIED_PLAYABLE_PCT}% playable to enter the Arcade`,
      tone: "text-ink-soft",
    };
  }
  return { text: "✗ reported unplayable", tone: "text-danger" };
}

function errorMessage(error: RecordPlayabilityResult["error"]): string {
  switch (error) {
    case "rate_limited":
      return "Slow down a moment, then try again.";
    case "invalid":
    default:
      return "That verdict could not be recorded.";
  }
}
