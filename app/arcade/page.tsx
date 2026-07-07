// The Arcade — the free, public product (docs/ux-overhaul.md §7): browse and
// play ONLY certified-playable builds (≥ CERTIFIED_PLAYABLE_PCT), grouped by
// game, model identity shown. No intro essay: a slim marquee band, then a floor
// of small thumbnail cabinets — each card is the coin gate (brand, params,
// tokens spent); clicking it opens the pop-up play window (owner 2026-07-06).

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { getArcade } from "@/lib/data";
import type { ArcadeEntry, GameView } from "@/lib/types";
import { ArcadeFloor } from "@/components/ArcadeFloor";
import { ButtonLink } from "@/components/Button";
import { Container } from "@/components/Layout";

export const metadata = {
  title: "The Arcade · arcade-bench",
  description:
    "Play AI-rebuilt arcade classics — every build here was certified playable by human testers.",
};

// Certification state moves with every tester vote — always render fresh.
export const dynamic = "force-dynamic";

export default async function ArcadePage() {
  const entries = await getArcade();
  const sections = groupByGame(entries);

  return (
    <main>
      {/* Slim marquee title band — the cabinets are the page. */}
      <Container className="pb-8 pt-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border-2 border-ink bg-ink px-5 py-4 shadow-hard">
          <h1 className="font-display text-[15px] leading-none text-yellow">THE ARCADE</h1>
          <p className="font-mono text-[12px] text-[#8f8fa0]">
            every game here was certified playable by testers
          </p>
          <Link
            href="/test"
            className="ml-auto shrink-0 font-grotesk text-[13px] font-semibold text-cream underline underline-offset-2 hover:text-yellow"
          >
            Help test new builds →
          </Link>
        </div>
      </Container>

      {sections.length > 0 ? <ArcadeFloor sections={sections} /> : <EmptyArcade />}
    </main>
  );
}

/** Group by game in roundOrder, best-certified cabinets first within each. */
function groupByGame(
  entries: ArcadeEntry[],
): { game: GameView; cabinets: ArcadeEntry[] }[] {
  const byGame = new Map<string, { game: GameView; cabinets: ArcadeEntry[] }>();
  for (const entry of entries) {
    const section = byGame.get(entry.game.slug) ?? { game: entry.game, cabinets: [] };
    section.cabinets.push(entry);
    byGame.set(entry.game.slug, section);
  }
  const sections = [...byGame.values()];
  for (const s of sections) {
    s.cabinets.sort((a, b) => b.playablePct - a.playablePct || b.votes - a.votes);
  }
  return sections.sort((a, b) => a.game.roundOrder - b.game.roundOrder);
}

function EmptyArcade() {
  return (
    <Container className="pb-[54px]">
      <div className="rounded-[14px] border-2 border-dashed border-line bg-surface p-12 text-center shadow-hard">
        <p className="font-grotesk text-xl font-bold">No cabinets on the floor yet</p>
        <p className="mx-auto mt-2 max-w-[48ch] font-sans text-ink-soft">
          Testers are screening the first builds — a game lands here the moment a
          build is certified playable. Sign in to help.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="btn bg-blue px-6 py-3.5 text-base text-white shadow-hard-sm hover:bg-blue-deep">
                Sign in to test builds
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <ButtonLink href="/test" variant="primary" size="lg">
              Enter the Test Lab →
            </ButtonLink>
          </Show>
          <ButtonLink href="/about" variant="ghost">
            How it works
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
