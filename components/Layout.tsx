// Small shared layout primitives: the max-width container, section eyebrow header,
// and the dashed section divider (design.md §4).

import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("mx-auto max-w-container px-6", className)}>{children}</div>;
}

export function SectionDivider() {
  return (
    <Container>
      <hr className="section-divider my-2" />
    </Container>
  );
}

export function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <span className="eyebrow mb-3 inline-flex">{eyebrow}</span>}
        <h2 className="font-grotesk text-[26px] font-bold tracking-[-0.01em]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t-2 border-ink bg-cream-2">
      <Container className="flex flex-wrap items-center justify-between gap-4 py-8">
        <p className="font-mono text-[12px] text-ink-soft">
          arcade<span className="text-blue">-</span>bench · a benchmark of small models, judged by people
        </p>
        <p className="font-sans text-[13px] text-ink-soft">
          Built by Patrick Neyland ·{" "}
          <a
            href="https://neylandsolutions.com"
            className="font-semibold text-ink underline underline-offset-2"
          >
            Neyland Solutions
          </a>
        </p>
      </Container>
    </footer>
  );
}
