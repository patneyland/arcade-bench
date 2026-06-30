// LeaderboardTable — bordered card, full-width table (design.md §8).
//
// Columns: # · Model · Vendor (badge) · Rating (mono 700 + ±CI in ink-soft) ·
// Params (mono) · Cost/gen (mono) · Rating/¢ (in win-green). Numeric columns are
// right-aligned. The #1 row gets the coin-gold gradient wash + gold bottom border +
// a ★ 1 crown chip. Row hover: cream. Takes LeaderboardRow[].

import { clsx } from "clsx";
import type { LeaderboardRow } from "@/lib/types";
import { VendorBadge } from "./Badges";

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

  return (
    <div className="overflow-hidden rounded-[14px] border-2 border-ink bg-surface shadow-hard">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b-2 border-ink bg-cream-2">
              <Th>#</Th>
              <Th>Model</Th>
              <Th>Vendor</Th>
              <Th align="right">Rating</Th>
              <Th align="right">Params</Th>
              <Th align="right">Cost / gen</Th>
              <Th align="right">Rating / ¢</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const isFirst = row.rank === 1;
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
                    <span className="font-grotesk font-bold">{row.model.name}</span>
                  </Td>
                  <Td>
                    <VendorBadge vendor={row.model.vendor} />
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[15px] font-bold">{Math.round(row.rating)}</span>{" "}
                    <span className="font-mono text-[12px] text-ink-soft">
                      ±{Math.round(row.interval)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[13px]">{row.model.paramSize ?? "—"}</span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[13px]">${row.model.costPerGen.toFixed(3)}</span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[14px] font-bold text-win">
                      {row.ratingPerCent != null ? Math.round(row.ratingPerCent) : "—"}
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

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={clsx(
        "px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td className={clsx("px-4 py-3 align-middle", align === "right" ? "text-right" : "text-left")}>
      {children}
    </td>
  );
}
