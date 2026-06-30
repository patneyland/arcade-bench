"use client";

// Sign-in (dev) — explains the production GitHub/Google plan and offers the dev
// sign-in that the Nav also uses. No full Clerk page needed for v0.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/Layout";
import { GitHubIcon, GoogleIcon } from "@/components/icons";

export default function SignInPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function devSignIn() {
    setBusy(true);
    try {
      await fetch("/api/auth/dev-signin", { method: "POST" });
      router.push("/arena");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <Container className="py-[54px]">
        <div className="mx-auto max-w-[44ch] rounded-[14px] border-2 border-ink bg-surface p-8 shadow-hard">
          <span className="eyebrow mb-4 inline-flex">Sign in</span>
          <h1 className="font-grotesk text-[26px] font-bold tracking-[-0.01em]">
            Sign in to vote
          </h1>
          <p className="mt-3 font-sans text-[15px] leading-relaxed text-ink-soft">
            Anyone can play. Casting a vote takes a quick sign-in — only so the human grading
            can be tracked and trusted. It stays free. In production this is GitHub or Google
            via managed auth.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              className="btn cursor-not-allowed bg-cream-2 px-4 py-3 text-[15px] opacity-70"
              disabled
            >
              <GitHubIcon size={18} /> Continue with GitHub
              <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                soon
              </span>
            </button>
            <button
              className="btn cursor-not-allowed bg-cream-2 px-4 py-3 text-[15px] opacity-70"
              disabled
            >
              <GoogleIcon size={18} /> Continue with Google
              <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                soon
              </span>
            </button>
          </div>

          <hr className="section-divider my-6" />

          <button
            className="btn w-full bg-blue px-4 py-3 text-[15px] text-white shadow-hard-sm hover:bg-blue-deep"
            onClick={devSignIn}
            disabled={busy}
          >
            {busy ? "Signing in…" : "Dev sign-in (no account needed)"}
          </button>
          <p className="mt-3 font-sans text-[12px] text-ink-soft">
            The dev sign-in creates a throwaway grader so you can run the full vote loop
            locally with zero external credentials.
          </p>
        </div>
      </Container>
    </main>
  );
}
