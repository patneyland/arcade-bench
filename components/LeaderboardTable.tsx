// LeaderboardTable — bordered card, full-width table (design.md §8).
//
// Columns: # · Model (name + grape param chip) · Vendor (badge) · Rating (mono 700 +
// ±CI in ink-soft) · Cost/gen (mono, cents) · Playable (screening record) · Rating/¢
// (win-green, tinted column). Ranked by Rating (the statistically honest order); the
// efficiency story gets its own winner: the row with the best Rating/¢ carries a ⚡
// chip. The #1 row keeps the coin-gold wash + ★1 crown. Both crowns are suppressed
// when fewer than 2 rows show. Under `sm`, Vendor/Rating/Cost collapse so #, Model,
// Playable (% only) and Rating/¢ always fit.

import { clsx } from "clsx";
import { CERTIFIED_PLAYABLE_PCT } from "@/lib/constants";
import type { LeaderboardRow } from "@/lib/types";
import { VendorBadge, ParamChip } from "./Badges";

/** Cost-per-generation in cents, sub-cent safe — never renders "$0.000". */
export function formatCostCents(costPerGen: number): string {
  const cents = costPerGen * 100;
  if (cents === 0) return "0¢";
  const s = cents >= 1 ? cents.toFixed(2) : String(Number(cents.toPrecision(2)));
  return `${s}¢`;
}

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  /** When set, only show the first N rows (e.g. a compact home preview). */
  limit?: number;
  caption?: string;
}

export function LeaderboardTable({ rows, limit, caption }: LeaderboardTableProps) {
  const shown = limit ? rows.slice(0, limit) : rows;

  if (shown.length === 0) {
    return (
      <div className="rounded-[14px] border-2 border-ink bg-surface p-10 text-center shadow-hard">
        <p className="font-grotesk text-lg font-bold">No ratings yet</p>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Once the arena collects votes, ranked models appear here with confidence intervals.
        </p>
      </div>
    );
  }

  // Crowns are earned against a field, not for showing up alone.
  const crowns = shown.length >= 2;
  const bestEff = crowns
    ? shown.reduce<LeaderboardRow | null>(
        (best, r) =>
          r.ratingPerCent != null && (best?.ratingPerCent == null || r.ratingPerCent > best.ratingPerCent)
            ? r
            : best,
        null,
      )
    : null;

  return (
    <div className="overflow-hidden rounded-[14px] border-2 border-ink bg-surface shadow-hard">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b-2 border-ink bg-cream-2">
              <Th>#</Th>
              <Th>Model</Th>
              <Th className="hidden sm:table-cell">Vendor</Th>
              <Th align="right" className="hidden sm:table-cell">
                Rating
              </Th>
              <Th align="right" className="hidden sm:table-cell">
                Cost / gen
              </Th>
              <Th align="right">Playable</Th>
              <Th align="right" className="bg-win/[0.08]">
                <span className="text-win">Rating / ¢</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const isFirst = crowns && row.rank === 1;
              const isBestEff = bestEff != null && row.model.id === bestEff.model.id;
              return (
                <tr
                  key={row.model.id}
                  className={clsx(
                    "border-b border-line transition-colors last:border-b-0 hover:bg-cream",
                    isFirst && "border-b-2 !border-b-gold-2",
                  )}
                  style={
                    isFirst
                      ? {
                          background:
                            "linear-gradient(90deg, rgba(255,199,0,0.16), rgba(255,199,0,0.04))",
                        }
                      : undefined
                  }
                >
                  <Td>
                    {isFirst ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-chip border-2 border-ink px-2 py-0.5 font-mono text-[12px] font-bold"
                        style={{ background: "linear-gradient(180deg,#FFD64A,#FFB200)" }}
                      >
                        ★ 1
                      </span>
                    ) : (
                      <span className="font-mono text-[14px] font-bold text-ink-soft">
                        {row.rank}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="font-grotesk font-bold">{row.model.name}</span>
                      <span className="hidden sm:inline-flex">
                        <ParamChip params={row.model.paramSize} />
                      </span>
                    </span>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <VendorBadge vendor={row.model.vendor} />
                  </Td>
                  <Td align="right" className="hidden sm:table-cell">
                    <span className="font-mono text-[15px] font-bold">{Math.round(row.rating)}</span>{" "}
                    <span className="font-mono text-[12px] text-ink-soft">
                      ±{Math.round(row.interval)}
                    </span>
                  </Td>
                  <Td align="right" className="hidden sm:table-cell">
                    <span className="font-mono text-[13px]">
                      {formatCostCents(row.model.costPerGen)}
                    </span>
                  </Td>
                  <PlayableCell row={row} />
                  <Td align="right" className="bg-win/[0.06]">
                    <span className="inline-flex items-center gap-2">
                      {isBestEff && (
                        <span
                          className="inline-flex items-center rounded-chip border-2 border-ink bg-win px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
                          title="Best rating per cent of cost"
                        >
                          ⚡ BEST /¢
                        </span>
                      )}
                      <span className="font-mono text-[14px] font-bold text-win">
                        {row.ratingPerCent != null ? Math.round(row.ratingPerCent) : "—"}
                      </span>
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Playability screening record, e.g. "92% · 3/3 ✓". ≥85% reads win-green, below
 *  reads danger; a majority-unplayable model gets a muted danger wash on the cell.
 *  Absent/null fields degrade to "—" or an "unscreened" chip — never NaN. */
function PlayableCell({ row }: { row: LeaderboardRow }) {
  const pct = row.playablePct;
  const shamed = pct != null && pct < 50;

  if (pct == null) {
    return (
      <Td align="right">
        {row.totalBuilds ? (
          <span
            className="inline-flex items-center rounded-chip border border-line bg-cream-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft"
            title="No playability votes yet"
          >
            unscreened
          </span>
        ) : (
          <span className="font-mono text-[13px] text-ink-soft">—</span>
        )}
      </Td>
    );
  }

  return (
    <Td align="right" className={clsx(shamed && "bg-danger/[0.06]")}>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap font-mono text-[13px]">
        <span
          className={clsx(
            "font-bold",
            pct >= CERTIFIED_PLAYABLE_PCT ? "text-win" : "text-danger",
          )}
        >
          {Math.round(pct)}%
        </span>
        {row.totalBuilds != null && row.totalBuilds > 0 && (
          <span className="hidden text-[12px] text-ink-soft sm:inline">
            · {row.certifiedBuilds ?? 0}/{row.totalBuilds}
            {(row.certifiedBuilds ?? 0) > 0 && <span className="text-win"> ✓</span>}
          </span>
        )}
      </span>
    </Td>
  );
}

function Th({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={clsx(
        "px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={clsx(
        "px-4 py-3 align-middle",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}
