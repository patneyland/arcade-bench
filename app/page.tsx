// Home — a funnel for the two journeys (docs/ux-overhaul.md §7): signed-out
// visitors play the certified Arcade for free; signing in makes you a tester
// who screens new builds in the Test Lab. Fold: hero copy + certified cabinets
// playable in place. Standings preview and history banner stay as light strips.

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { getArcade, getLeaderboard, getHistoryTimeline } from "@/lib/data";
import type { ArcadeEntry } from "@/lib/types";
import { ArcadeCabinet } from "@/components/ArcadeCabinet";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { ButtonLink } from "@/components/Button";
import { Container, SectionDivider } from "@/components/Layout";
import { PlayIcon } from "@/components/icons";

// Live data on every request: certification state and ratings move with every
// tester vote — never prerender this at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [arcade, leaderboard, timeline] = await Promise.all([
    getArcade(),
    getLeaderboard(),
    getHistoryTimeline(),
  ]);
  const teaser = pickTeaser(arcade);

  return (
    <main>
      {/* Band 1: hero + certified cabinets, playable in place (zero-auth). */}
      <Container className="pb-12 pt-10">
        <span className="eyebrow mb-4 inline-flex">Play · Test · Rank</span>
        <h1 className="font-display text-[clamp(20px,2.6vw,34px)] leading-[1.3]">
          Play <span className="text-blue">arcade classics</span> rebuilt by{" "}
          <span className="text-red">tiny AI models</span>
        </h1>
        <p className="mt-4 max-w-[68ch] font-sans text-[18px] leading-relaxed text-ink-soft">
          Cheap, fast models each get one locked prompt to recreate a classic game.
          Human testers screen every build — the ones certified playable land in the
          arcade, free to play, no sign-in.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <ButtonLink
            href="/arcade"
            variant="primary"
            size="lg"
            leftIcon={<PlayIcon size={16} color="#fff" />}
          >
            Play the Arcade
          </ButtonLink>
          <ButtonLink href="/leaderboard" variant="ghost" size="sm">
            See the leaderboard →
          </ButtonLink>
          <Link
            href="/about"
            className="font-sans text-[13px] text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            How it works
          </Link>
        </div>

        <div className="mt-8">
          {teaser.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {teaser.map((entry) => (
                  <ArcadeCabinet key={entry.generationId} entry={entry} showGame />
                ))}
              </div>
              <p className="mt-4 font-mono text-[12px] text-ink-soft">
                Certified playable by testers ·{" "}
                <Link
                  href="/arcade"
                  className="font-semibold text-ink underline underline-offset-2"
                >
                  see the full arcade →
                </Link>
              </p>
            </>
          ) : (
            <EmptyArcadeTeaser />
          )}
        </div>
      </Container>

      <SectionDivider />

      {/* Band 2: the second journey — screening new builds in the Test Lab. */}
      <TesterBand />

      <SectionDivider />

      {/* Band 3: standings preview — a lighter supporting strip. */}
      <Container className="py-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-grotesk text-[22px] font-bold tracking-[-0.01em]">
            Current standings
          </h2>
          <ButtonLink href="/leaderboard" variant="ghost" size="sm">
            Full board →
          </ButtonLink>
        </div>
        <LeaderboardTable rows={leaderboard} limit={5} caption="Top models by rating" />
      </Container>

      <SectionDivider />

      {/* Band 4: history slimmed to a banner. */}
      <Container className="py-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-grotesk text-[18px] font-bold tracking-[-0.01em]">
            Walking through arcade history
          </h2>
          <ButtonLink href="/history" variant="ghost" size="sm">
            Full timeline →
          </ButtonLink>
        </div>
        <HistoryTimeline entries={timeline} />
      </Container>
    </main>
  );
}

/** Up to 3 teaser cabinets: highest certification first, one per game. */
function pickTeaser(entries: ArcadeEntry[]): ArcadeEntry[] {
  const sorted = [...entries].sort(
    (a, b) => b.playablePct - a.playablePct || b.votes - a.votes,
  );
  const seen = new Set<string>();
  const picks: ArcadeEntry[] = [];
  for (const entry of sorted) {
    if (seen.has(entry.game.slug)) continue;
    seen.add(entry.game.slug);
    picks.push(entry);
    if (picks.length === 3) break;
  }
  return picks;
}

function TesterBand() {
  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-[14px] border-2 border-ink bg-surface p-6 shadow-hard sm:px-8">
        <div>
          <h2 className="font-display text-[14px] leading-[1.6]">
            BECOME A <span className="text-blue">TESTER</span>
          </h2>
          <Show when="signed-out">
            <p className="mt-2 max-w-[54ch] font-sans text-[15px] text-ink-soft">
              New builds need judges — sign in and vote playable or not. Certified
              builds join the arcade; the rest show up on their model&apos;s record.
            </p>
          </Show>
          <Show when="signed-in">
            <p className="mt-2 max-w-[54ch] font-sans text-[15px] text-ink-soft">
              You are on the tester roster — fresh builds are waiting for a verdict
              in the Test Lab.
            </p>
          </Show>
        </div>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="btn bg-blue px-6 py-3.5 text-base text-white shadow-hard-sm hover:bg-blue-deep">
              Sign in to start testing
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <ButtonLink href="/test" variant="primary" size="lg">
            Enter the Test Lab →
          </ButtonLink>
        </Show>
      </div>
    </Container>
  );
}

function EmptyArcadeTeaser() {
  return (
    <div className="rounded-[14px] border-2 border-dashed border-line bg-surface p-12 text-center shadow-hard">
      <p className="font-grotesk text-xl font-bold">The arcade floor is being set up</p>
      <p className="mx-auto mt-2 max-w-[48ch] font-sans text-ink-soft">
        Testers are screening the first builds — sign in below to help certify them,
        and the first playable cabinets will light up here.
      </p>
    </div>
  );
}
