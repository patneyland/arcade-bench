// Test Lab — the signed-in screening flow (docs/ux-overhaul.md §7). Signed-out
// visitors get the pitch (and ZERO candidate data — the queue is fetched only
// after the auth check); signed-in testers get the one-cabinet flow:
// coin → play → verdict → reveal → next candidate.

import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { getNextTestCandidate } from "@/lib/data";
import { TestCabinet } from "@/components/TestCabinet";
import { Container } from "@/components/Layout";

export const metadata = {
  title: "Test Lab · arcade-bench",
  description:
    "Screen unvetted AI-built games: play them and vote playable or not playable.",
};

// The queue is per-user and moves with every vote — never prerender this.
export const dynamic = "force-dynamic";

export default async function TestPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main>
        <Container className="py-[54px]">
          <div className="mx-auto max-w-[640px] rounded-[14px] border-2 border-ink bg-surface p-10 text-center shadow-hard">
            <span className="eyebrow mb-4 inline-flex">TEST LAB</span>
            <h1 className="font-display text-[22px] leading-[1.5]">
              BECOME A TESTER
            </h1>
            <p className="mx-auto mt-4 max-w-[46ch] font-sans text-ink-soft">
              New builds need judges: play them and vote playable or not. Builds
              that pass the bar earn their spot in the public Arcade — your
              verdicts decide what ships.
            </p>
            <div className="mt-7 flex flex-col items-center gap-4">
              <SignInButton mode="modal">
                <button className="btn rounded-btn border-2 border-ink bg-blue px-6 py-3 font-grotesk font-semibold text-white shadow-hard-sm hover:bg-blue-deep">
                  Sign in to start testing
                </button>
              </SignInButton>
              <Link
                href="/arcade"
                className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-soft underline underline-offset-4 hover:text-ink"
              >
                ← back to the Arcade
              </Link>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  const candidate = await getNextTestCandidate();

  return (
    <main>
      {/* Wider than the 1120px text container so the stage can grow on big screens. */}
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8 sm:py-10">
        <TestCabinet initial={candidate} />
      </div>
    </main>
  );
}
