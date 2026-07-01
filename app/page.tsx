// Home — hero + live ArenaCard + compact leaderboard preview + history strip.

import { getArenaPairing, getLeaderboard, getHistoryTimeline } from "@/lib/data";
import { ArenaCard } from "@/components/ArenaCard";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { ButtonLink } from "@/components/Button";
import { Container, SectionDivider, SectionHead } from "@/components/Layout";
import { PlayIcon, TrophyIcon, InfoIcon } from "@/components/icons";

// Live data on every request: a fresh arena pairing and the current leaderboard.
// Without this, Next prerenders the page at build time and every visitor sees the
// same frozen matchup and stale ratings until the next deploy.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [pairing, leaderboard, timeline] = await Promise.all([
    getArenaPairing(),
    getLeaderboard(),
    getHistoryTimeline(),
  ]);

  return (
    <main>
      {/* Hero */}
      <Container className="py-14 sm:py-[54px]">
        <span className="eyebrow mb-5 inline-flex">Play · Vote · Rank</span>
        <h1 className="max-w-[18ch] font-display text-[clamp(26px,4.6vw,46px)] leading-[1.25]">
          Which small model rebuilds <span className="text-blue">arcade</span> history{" "}
          <span className="text-red">best</span>?
        </h1>
        <p className="mt-6 max-w-[60ch] font-sans text-[19px] leading-relaxed text-ink-soft">
          arcade-bench gives cheap, fast AI models one locked prompt to recreate a classic
          game as a single HTML file. You play two side by side and vote the better one.
          The votes become a leaderboard of the most cost-effective models.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink href="/arena" variant="primary" size="lg" leftIcon={<PlayIcon size={16} color="#fff" />}>
            Enter the Arena
          </ButtonLink>
          <ButtonLink href="/leaderboard" variant="secondary" size="lg" leftIcon={<TrophyIcon size={16} />}>
            See the leaderboard
          </ButtonLink>
          <ButtonLink href="/about" variant="ghost" size="lg" leftIcon={<InfoIcon size={16} />}>
            How it works
          </ButtonLink>
        </div>
      </Container>

      <SectionDivider />

      {/* Live arena */}
      <Container className="py-[54px]">
        <SectionHead eyebrow="The Arena" title="Today's match">
          <ButtonLink href="/arena" variant="ghost" size="sm">
            Full arena →
          </ButtonLink>
        </SectionHead>
        {pairing ? (
          <ArenaCard pairing={pairing} />
        ) : (
          <EmptyArena />
        )}
      </Container>

      <SectionDivider />

      {/* Leaderboard preview */}
      <Container className="py-[54px]">
        <SectionHead eyebrow="Leaderboard" title="Most cost-effective models">
          <ButtonLink href="/leaderboard" variant="ghost" size="sm">
            Full board →
          </ButtonLink>
        </SectionHead>
        <LeaderboardTable rows={leaderboard} limit={5} caption="Top models by rating" />
      </Container>

      <SectionDivider />

      {/* History strip */}
      <Container className="py-[54px]">
        <SectionHead eyebrow="History" title="Walking through 1952 → present">
          <ButtonLink href="/history" variant="ghost" size="sm">
            Full timeline →
          </ButtonLink>
        </SectionHead>
        <HistoryTimeline entries={timeline} />
      </Container>
    </main>
  );
}

function EmptyArena() {
  return (
    <div className="rounded-[14px] border-2 border-dashed border-line bg-surface p-12 text-center shadow-hard">
      <p className="font-grotesk text-xl font-bold">No live match yet</p>
      <p className="mx-auto mt-2 max-w-[48ch] font-sans text-ink-soft">
        Once a game has two published builds, the arena lights up here. In the meantime,
        read how the benchmark works.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/about" variant="primary">
          How it works
        </ButtonLink>
      </div>
    </div>
  );
}
