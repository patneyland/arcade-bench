// Leaderboard — overall by default; query-param tabs for per-game and per cost-tier
// views. The CI column carries the "thin data reads as thin" intent.

import Link from "next/link";
import { clsx } from "clsx";
import { getLeaderboard, getGames } from "@/lib/data";
import { COST_TIERS } from "@/lib/constants";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { Container } from "@/components/Layout";
import type { CostTier } from "@/lib/types";

export const metadata = {
  title: "Leaderboard · arcade-bench",
  description: "Cost-efficient AI models ranked by Bradley-Terry rating with confidence intervals.",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; tier?: string }>;
}) {
  const params = await searchParams;
  const games = await getGames();

  const tier = COST_TIERS.includes(params.tier as CostTier) ? (params.tier as CostTier) : undefined;
  const gameSlug = params.game && games.some((g) => g.slug === params.game) ? params.game : undefined;

  const rows = await getLeaderboard({ gameSlug, tier });

  return (
    <main>
      <Container className="py-[54px]">
        <div className="mb-6 max-w-[64ch]">
          <span className="eyebrow mb-4 inline-flex">Leaderboard</span>
          <h1 className="font-grotesk text-[30px] font-bold tracking-[-0.01em]">
            Most cost-effective models
          </h1>
          <p className="mt-3 font-sans text-[17px] leading-relaxed text-ink-soft">
            Ratings come from pairwise human votes via{" "}
            <strong className="text-ink">Bradley-Terry</strong> (Elo-style for v0), shown with a{" "}
            <strong className="text-ink">±confidence interval</strong>. The interval is the honesty
            check: a model with five votes never reads as equal to one with five hundred. The
            headline column is <span className="font-semibold text-win">Rating / ¢</span> — rating
            earned per cent of generation cost.
          </p>
        </div>

        {/* Scope tabs (overall + per cost tier) */}
        <div className="mb-3 flex flex-wrap gap-2">
          <Tab href="/leaderboard" active={!tier && !gameSlug} label="Overall" />
          {COST_TIERS.map((t) => (
            <Tab
              key={t}
              href={`/leaderboard?tier=${t}`}
              active={tier === t}
              label={t[0].toUpperCase() + t.slice(1)}
            />
          ))}
        </div>

        {/* Per-game tabs */}
        {games.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {games.map((g) => (
              <Tab
                key={g.id}
                href={`/leaderboard?game=${g.slug}`}
                active={gameSlug === g.slug}
                label={g.title}
                subtle
              />
            ))}
          </div>
        )}

        <LeaderboardTable rows={rows} caption="Models ranked by rating" />
      </Container>
    </main>
  );
}

function Tab({
  href,
  active,
  label,
  subtle,
}: {
  href: string;
  active: boolean;
  label: string;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center rounded-chip border-2 border-ink px-3 py-1.5 font-grotesk text-[13px] font-semibold transition-colors",
        active
          ? "bg-ink text-cream shadow-hard-sm"
          : subtle
            ? "bg-surface text-ink-soft hover:bg-cream-2"
            : "bg-surface text-ink hover:bg-cream-2",
      )}
    >
      {label}
    </Link>
  );
}
