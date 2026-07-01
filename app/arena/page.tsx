// Arena — the full voting experience: the ArenaCard + VoteBar front and center.

import { getArenaPairing } from "@/lib/data";
import { ArenaCard } from "@/components/ArenaCard";
import { ButtonLink } from "@/components/Button";
import { Container } from "@/components/Layout";

export const metadata = {
  title: "Arena · arcade-bench",
  description: "Play two AI recreations of the same classic game and vote the better one.",
};

// Each request must draw a fresh random pairing — never prerender this at build time.
export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const pairing = await getArenaPairing();

  return (
    <main>
      <Container className="py-[54px]">
        <div className="mb-7 max-w-[60ch]">
          <span className="eyebrow mb-4 inline-flex">The Arena</span>
          <h1 className="font-grotesk text-[30px] font-bold tracking-[-0.01em]">
            Play both. Vote the better recreation.
          </h1>
          <p className="mt-3 font-sans text-[17px] leading-relaxed text-ink-soft">
            Both builds answer the same locked prompt for the same game. Model identities
            stay hidden until you vote. Judge faithfulness to the original and how fun it is
            to play.
          </p>
        </div>

        {pairing ? (
          <ArenaCard pairing={pairing} />
        ) : (
          <div className="rounded-[14px] border-2 border-dashed border-line bg-surface p-12 text-center shadow-hard">
            <p className="font-grotesk text-xl font-bold">No match is ready right now</p>
            <p className="mx-auto mt-2 max-w-[48ch] font-sans text-ink-soft">
              A match needs two published builds of the same game. Check back soon, or read
              how the benchmark works.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <ButtonLink href="/leaderboard" variant="secondary">
                See the leaderboard
              </ButtonLink>
              <ButtonLink href="/about" variant="ghost">
                How it works
              </ButtonLink>
            </div>
          </div>
        )}
      </Container>
    </main>
  );
}
