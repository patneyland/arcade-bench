// Compact metadata that travels with every model (design.md §7).

import { clsx } from "clsx";
import { VENDOR_COLORS, type CostTier } from "@/lib/constants";

/** Vendor badge: surface, 2px ink border, 9px radius, colored square dot. */
export function VendorBadge({ vendor }: { vendor: string }) {
  const color = VENDOR_COLORS[vendor] ?? "#57545F";
  return (
    <span className="inline-flex items-center gap-2 rounded-chip border-2 border-ink bg-surface px-2 py-1 font-grotesk text-[13px] font-medium">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5"
        style={{ backgroundColor: color }}
      />
      {vendor}
    </span>
  );
}

/** Param chip: grape pill, white mono text. */
export function ParamChip({ params }: { params: string | null }) {
  if (!params) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-grape px-2.5 py-1 font-mono text-[12px] font-bold text-white">
      {params} params
    </span>
  );
}

/** Cost chip: white pill, mono. */
export function CostChip({ costPerGen }: { costPerGen: number }) {
  return (
    <span className="inline-flex items-center rounded-full border-2 border-ink bg-surface px-2.5 py-1 font-mono text-[12px] font-medium">
      ${costPerGen.toFixed(3)} / gen
    </span>
  );
}

const TIER_STYLES: Record<CostTier, { bg: string; text: string; label: string }> = {
  featherweight: { bg: "#E8F6EE", text: "#0E7A45", label: "Featherweight" },
  midweight: { bg: "#FFF3D6", text: "#9A6B00", label: "Midweight" },
  heavyweight: { bg: "#FBE3E3", text: "#B12B2B", label: "Heavyweight" },
};

/** Cost tier tag: square tag, 2px ink border, tinted by weight. */
export function CostTierTag({ tier, className }: { tier: CostTier | null; className?: string }) {
  if (!tier) return null;
  const s = TIER_STYLES[tier];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-chip border-2 border-ink px-2 py-1 font-grotesk text-[12px] font-semibold",
        className,
      )}
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}
