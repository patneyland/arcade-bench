// Leaderboard — overall by default; labeled filter rows for cost tier and game that
// combine (tier + game) instead of resetting each other. The CI column carries the
// "thin data reads as thin" intent; the flywheel banner routes testers to /test,
// where playability screening votes now come from.

import Link from "next/link";
import { clsx } from "clsx";
import { getLeaderboard, getGames } from "@/lib/data";
import { COST_TIERS } from "@/lib/constants";
import { LeaderboardTable, formatCostCents } from "@/components/LeaderboardTable";
import { ButtonLink } from "@/components/Button";
import { Container } from "@/components/Layout";
import type { CostTier, LeaderboardRow } from "@/lib/types";

export const metadata = {
  title: "Leaderboard · arcade-bench",
  description: "Cost-efficient AI models ranked by Bradley-Terry rating with confidence intervals.",
};

// Tier tints from design.md §7 (same values as the CostTierTag).
const TIER_TINTS: Record<CostTier, { bg: string; text: string }> = {
  featherweight: { bg: "#E8F6EE", text: "#0E7A45" },
  midweight: { bg: "#FFF3D6", text: "#9A6B00" },
  heavyweight: { bg: "#FBE3E3", text: "#B12B2B" },
};

/** Cost/gen span of a tier's roster, e.g. "0.044–0.17¢" — the chip's price hint. */
function tierPriceHint(rows: LeaderboardRow[], tier: CostTier): string | null {
  const costs = rows.filter((r) => r.model.tier === tier).map((r) => r.model.costPerGen);
  if (costs.length === 0) return null;
  const min = Math.min(...costs);
  const max = Math.max(...costs);
  if (min === max) return formatCostCents(min);
  return `${formatCostCents(min).replace("¢", "")}–${formatCostCents(max)}`;
}

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
  // Price hints describe each tier's full roster, so compute them from the overall board.
  const overall = !gameSlug && !tier ? rows : await getLeaderboard({});

  const href = (next: { tier?: CostTier; game?: string }) => {
    const q = new URLSearchParams();
    if (next.tier) q.set("tier", next.tier);
    if (next.game) q.set("game", next.game);
    const s = q.toString();
    return s ? `/leaderboard?${s}` : "/leaderboard";
  };

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
            <strong className="text-ink">±confidence interval</strong> — the honesty check: a model
            with five votes never reads as equal to one with five hundred. Rows rank by Rating; the
            efficiency story lives in the green <span className="font-semibold text-win">Rating / ¢</span>{" "}
            column — rating earned per cent of generation cost — and the{" "}
            <span className="font-semibold text-win">⚡ BEST /¢</span> chip marks its winner.
            Testers screen every build — the <span className="font-semibold text-ink">Playable</span>{" "}
            column is the share of votes that say a build actually runs and plays; ✗-heavy
            models sink.
          </p>
        </div>

        {/* Cost-tier filter (combines with the game filter below) */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <FilterLabel>Cost tier</FilterLabel>
          <Tab href={href({ game: gameSlug })} active={!tier} label="Overall" />
          {COST_TIERS.map((t) => (
            <Tab
              key={t}
              href={href({ tier: t, game: gameSlug })}
              active={tier === t}
              label={t[0].toUpperCase() + t.slice(1)}
              hint={tierPriceHint(overall, t) ?? undefined}
              tint={TIER_TINTS[t]}
            />
          ))}
        </div>

        {/* Per-game filter */}
        {games.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <FilterLabel>Game</FilterLabel>
            <Tab href={href({ tier })} active={!gameSlug} label="All games" subtle />
            {games.map((g) => (
              <Tab
                key={g.id}
                href={href({ tier, game: g.slug })}
                active={gameSlug === g.slug}
                label={g.title}
                subtle
              />
            ))}
          </div>
        )}

        <LeaderboardTable rows={rows} caption="Models ranked by rating" />

        {/* Flywheel: the board is only as sharp as its screening count. */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border-2 border-ink bg-cream-2 px-5 py-4 shadow-hard">
          <p className="font-sans text-[15px]">
            <span className="font-grotesk font-bold">
              This board sharpens one screened build at a time.
            </span>{" "}
            <span className="text-ink-soft">
              Play an unvetted build, call it playable or not — your vote lands here.
            </span>
          </p>
          <ButtonLink href="/test" variant="primary" size="sm">
            Screen a build →
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-[76px] shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
      {children}
    </span>
  );
}

function Tab({
  href,
  active,
  label,
  hint,
  tint,
  subtle,
}: {
  href: string;
  active: boolean;
  label: string;
  /** Small mono price-range hint rendered after the label (tier chips). */
  hint?: string;
  /** design.md §7 tier tint — used as the active fill instead of ink. */
  tint?: { bg: string; text: string };
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={clsx(
        "inline-flex items-baseline gap-1.5 rounded-chip border-2 border-ink px-3 py-1.5 font-grotesk text-[13px] font-semibold transition-colors",
        active
          ? tint
            ? "shadow-hard-sm"
            : "bg-ink text-cream shadow-hard-sm"
          : subtle
            ? "bg-surface text-ink-soft hover:bg-cream-2"
            : "bg-surface text-ink hover:bg-cream-2",
      )}
      style={active && tint ? { backgroundColor: tint.bg, color: tint.text } : undefined}
    >
      {label}
      {hint && (
        <span
          className={clsx(
            "font-mono text-[10px] font-medium",
            active && !tint ? "text-cream/80" : !active && "text-ink-soft",
          )}
        >
          {hint}
        </span>
      )}
    </Link>
  );
}
