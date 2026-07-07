"use client";

// TestCabinet — the Test Lab's one-cabinet screening flow (docs/ux-overhaul.md §7),
// reusing the arena's session pattern (ArenaCard) for a single unvetted build:
//
//   coin → play → verdict (PLAYABLE / NOT PLAYABLE) → reveal → next candidate
//
// A game picker sits above the cabinet: "All games" (default) serves the least-tested
// build across every game; picking a game narrows the queue to just that game. The
// choice is mirrored into the URL (?game=<slug>) so a refresh or shared link keeps it.
//
// A slim marquee carries the game meta and the one anonymity note — the model is
// NEVER named before the verdict; TestVerdict reveals it. The stage stays MOUNTED
// (hidden, not unmounted) during the verdict step so "go back and play more"
// resumes the same run; it unmounts only when the next candidate loads.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { GameView, TestCandidate } from "@/lib/types";
import { LOCKED_PROMPT } from "@/lib/constants";
import { SandboxedPlayer } from "./SandboxedPlayer";
import { PromptTab } from "./PromptTab";
import { TestVerdict } from "./TestVerdict";
import { ButtonLink } from "./Button";

export function TestCabinet({
  initial,
  games = [],
  initialGame,
}: {
  initial: TestCandidate | null;
  /** Games with at least one screenable build — powers the picker. Omit to hide it. */
  games?: GameView[];
  /** Slug of the game filter in effect on load (undefined = "All games"). */
  initialGame?: string;
}) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<TestCandidate | null>(initial);
  const [step, setStep] = useState<"play" | "verdict">("play");
  const [started, setStarted] = useState(false);
  // Session tally — plain client state, no persistence; survives across candidates.
  const [screened, setScreened] = useState(0);
  // Active game filter (undefined = All). Mirrored to the URL on change.
  const [activeGame, setActiveGame] = useState<string | undefined>(initialGame);
  const [switching, setSwitching] = useState(false);

  function handleNext(next: TestCandidate | null) {
    setCandidate(next);
    setStep("play");
    setStarted(false);
  }

  // Switch the queue to a game (or back to All), keeping the URL in sync and pulling
  // a fresh candidate for that filter.
  async function switchGame(slug: string | undefined) {
    if (slug === activeGame) return;
    setActiveGame(slug);
    setSwitching(true);
    router.replace(slug ? `/test?game=${encodeURIComponent(slug)}` : "/test", {
      scroll: false,
    });
    try {
      const q = slug ? `?game=${encodeURIComponent(slug)}` : "";
      const res = await fetch(`/api/playability/next${q}`);
      handleNext(res.ok ? await res.json() : null);
    } catch {
      handleNext(null);
    } finally {
      setSwitching(false);
    }
  }

  const picker =
    games.length > 1 ? (
      <GamePicker
        games={games}
        active={activeGame}
        onSelect={switchGame}
        disabled={switching}
      />
    ) : null;

  // Queue empty is a first-class state, not an error — but keep the picker so a tester
  // who's cleared one game can jump to another.
  if (!candidate) {
    const gameTitle = games.find((g) => g.slug === activeGame)?.title;
    return (
      <div>
        {picker}
        <QueueEmpty gameTitle={gameTitle} />
      </div>
    );
  }

  const { game } = candidate;

  return (
    <div>
      {picker}

      {/* overflow-clip (not hidden) so the CTA row can be position:sticky on mobile. */}
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

        {/* The prompt never names the model, so showing it doesn't break the
            pre-verdict anonymity rule. */}
        <PromptTab prompt={game.prompt ?? LOCKED_PROMPT(game.title)} />

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
            gameSlug={activeGame}
            onBack={() => setStep("play")}
            onRevealed={() => setScreened((n) => n + 1)}
            sessionTally={screened}
            onNext={handleNext}
          />
        )}
      </div>
    </div>
  );
}

/** The game filter: "All games" plus one chip per screenable game. Buttons (not links)
 *  because switching pulls a fresh candidate client-side without a full navigation. */
function GamePicker({
  games,
  active,
  onSelect,
  disabled,
}: {
  games: GameView[];
  active: string | undefined;
  onSelect: (slug: string | undefined) => void;
  disabled: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        Game
      </span>
      <PickerTab
        label="All games"
        active={active === undefined}
        disabled={disabled}
        onClick={() => onSelect(undefined)}
      />
      {games.map((g) => (
        <PickerTab
          key={g.id}
          label={g.title}
          active={active === g.slug}
          disabled={disabled}
          onClick={() => onSelect(g.slug)}
        />
      ))}
    </div>
  );
}

function PickerTab({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "true" : undefined}
      className={clsx(
        "inline-flex items-baseline rounded-chip border-2 border-ink px-3 py-1.5 font-grotesk text-[13px] font-semibold transition-colors disabled:cursor-default disabled:opacity-60",
        active
          ? "bg-ink text-cream shadow-hard-sm"
          : "bg-surface text-ink hover:bg-cream-2",
      )}
    >
      {label}
    </button>
  );
}

function QueueEmpty({ gameTitle }: { gameTitle?: string }) {
  return (
    <div className="mx-auto max-w-container rounded-[14px] border-2 border-dashed border-line bg-surface p-12 text-center shadow-hard">
      <p className="font-grotesk text-xl font-bold">
        {gameTitle
          ? `You've screened every ${gameTitle} build`
          : "You've screened everything in the queue"}
      </p>
      <p className="mx-auto mt-2 max-w-[48ch] font-sans text-ink-soft">
        {gameTitle
          ? "Pick another game above to keep screening, or check back when new builds land."
          : "Check back when new builds land. Meanwhile, the Arcade is stocked with the builds testers like you certified."}
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
