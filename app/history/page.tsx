// History — the timeline as the centerpiece + short "walking through history" narrative.

import { getHistoryTimeline } from "@/lib/data";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { Container } from "@/components/Layout";

export const metadata = {
  title: "History · arcade-bench",
  description: "The game roster walks forward through video game history, 1952 to present.",
};

// Game statuses (live / now / upcoming) come from the DB and change between deploys.
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const entries = await getHistoryTimeline();

  return (
    <main>
      <Container className="py-[54px]">
        <div className="mb-7 max-w-[64ch]">
          <span className="eyebrow mb-4 inline-flex">History</span>
          <h1 className="font-grotesk text-[30px] font-bold tracking-[-0.01em]">
            Walking through history, 1952 → present
          </h1>
          <p className="mt-3 font-sans text-[17px] leading-relaxed text-ink-soft">
            The roster is the backbone. We start at the dawn of gaming — when games were
            simple enough that a small model has a real shot — and add one game per round,
            moving forward in time. The rising difficulty is exactly where each model's
            ceiling shows up.
          </p>
        </div>

        <HistoryTimeline entries={entries} />

        <div className="mt-8 flex flex-wrap gap-4 font-sans text-[13px] text-ink-soft">
          <LegendItem swatch="bg-win" label="Live — votes are open" />
          <LegendItem swatch="bg-yellow" label="Now — the current round" />
          <LegendItem swatch="border-dashed bg-surface" label="Upcoming — not yet built" border />
        </div>
      </Container>
    </main>
  );
}

function LegendItem({
  swatch,
  label,
  border,
}: {
  swatch: string;
  label: string;
  border?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-3.5 w-3.5 border-2 border-ink ${swatch} ${border ? "border-dashed" : ""}`} />
      {label}
    </span>
  );
}
