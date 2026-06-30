// About — "How it works" + methodology. Copy grounded in README / PRD / PLAN.

import { LOCKED_PROMPT } from "@/lib/constants";
import { Container } from "@/components/Layout";
import { ButtonLink } from "@/components/Button";

export const metadata = {
  title: "How it works · arcade-bench",
  description:
    "The methodology: one locked prompt, single-file builds, a strict sandbox, pairwise voting, and Bradley-Terry ratings.",
};

export default function AboutPage() {
  return (
    <main>
      <Container className="py-[54px]">
        <div className="max-w-[68ch]">
          <span className="eyebrow mb-4 inline-flex">How it works</span>
          <h1 className="font-grotesk text-[30px] font-bold tracking-[-0.01em]">
            A play-and-vote arena for AI rebuilding the history of games
          </h1>
          <p className="mt-4 font-sans text-[18px] leading-relaxed text-ink-soft">
            Every frontier model can build Pong, so testing them is boring. The interesting
            question is the efficiency frontier: when a new small, cheap, fast model ships, how
            well can <em>it</em> recreate a real game from a single prompt? arcade-bench answers
            that with people, not a script.
          </p>

          <Step n={1} title="One locked prompt, never tuned">
            Each model gets the same single sentence per game — only the game name changes. This
            is a benchmark of <strong className="text-ink">models</strong>, not of prompting.
            <pre className="mt-3 overflow-x-auto rounded-chip border-2 border-ink bg-cream-2 px-4 py-3 font-mono text-[13px]">
              {LOCKED_PROMPT("{game}")}
            </pre>
          </Step>

          <Step n={2} title="A single self-contained HTML file">
            The required output is one file — inline JS and CSS, no build step, no external
            assets, no network. That single-file rule is the permanent spine: it keeps every
            entry safe, instantly playable, and fair. One shot, fixed token budget, no human
            iteration. A build that returns broken code competes anyway and earns the loss —
            that's signal, not noise.
          </Step>

          <Step n={3} title="Served in a strict sandbox">
            Because the site runs code written by AI models, every artifact renders inside a
            strict sandboxed <code className="font-mono text-[14px]">&lt;iframe&gt;</code>:{" "}
            <strong className="text-ink">scripts only, no same-origin access, no network</strong>.
            That is the one hard security requirement, and it is non-negotiable — model-written
            JavaScript can never touch the site, your account, or the network.
          </Step>

          <Step n={4} title="Pairwise voting">
            You see two recreations of the same game side by side, with the original described
            for reference, identities hidden. You play both and pick the better one — or call a
            tie or both bad. Pairwise comparison is far more reliable than asking for a 1–5
            score, and it is what makes the rating math work. Anyone can play; casting a vote
            takes a quick sign-in so the human grading stays honest.
          </Step>

          <Step n={5} title="Elo → Bradley-Terry ratings">
            Votes feed a rating — Elo to start, Bradley-Terry as volume grows — the same family
            of methods LMArena uses for LLMs. Every rating ships with a confidence interval so a
            five-vote model never reads as equal to a five-hundred-vote one. The leaderboard
            ranks models overall, per game, and per cost tier, with the headline view being{" "}
            <strong className="text-win">rating per cent spent</strong>.
          </Step>

          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/arena" variant="primary">
              Enter the Arena
            </ButtonLink>
            <ButtonLink href="/leaderboard" variant="secondary">
              See the leaderboard
            </ButtonLink>
          </div>
        </div>
      </Container>
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 border-t-2 border-dashed border-line pt-6">
      <div className="mb-2 flex items-center gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-chip border-2 border-ink bg-yellow font-mono text-[13px] font-bold">
          {n}
        </span>
        <h2 className="font-grotesk text-[22px] font-bold">{title}</h2>
      </div>
      <div className="font-sans text-[16px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}
