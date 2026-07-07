"use client";

// PromptTab — a slim disclosure strip on a cabinet that flips open to show the
// exact locked prompt this build was generated from, with a copy button so a
// player can save it. Display-only: the prompt is the locked benchmark prompt
// (lib/constants.ts / Game.prompt) — never edited or tuned here.

import { useState } from "react";

export function PromptTab({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (permissions / insecure context) — the text is still
      // on screen to select by hand, so just leave the button label alone.
    }
  }

  return (
    <div className="border-t-2 border-ink bg-cream-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2 px-4 py-2 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink"
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="font-bold">Prompt</span>
        <span className="normal-case tracking-normal">
          the exact instruction this build was generated from
        </span>
      </button>

      {open && (
        <div className="flex flex-wrap items-start gap-2 px-4 pb-3">
          <code className="min-w-0 flex-1 basis-64 whitespace-pre-wrap rounded-[8px] border-2 border-ink bg-surface px-3 py-2 font-mono text-[12px] leading-relaxed text-ink">
            {prompt}
          </code>
          <button
            type="button"
            onClick={copy}
            className="btn rounded-chip border-2 border-ink bg-surface px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink shadow-hard-sm"
          >
            {copied ? "✓ Copied" : "⧉ Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
