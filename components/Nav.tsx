"use client";

// Nav — sticky, cream@86% + backdrop blur, 2px ink bottom border (design.md §8).
// Left: joystick glyph + `arcade-bench` wordmark (the `-` in blue). Center links.
// Right: a coin chip with the signed-in user's vote count + a primary Sign in button.
// Session is wired to GET /api/session, POST /api/auth/dev-signin, /api/auth/signout.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import type { SessionUser } from "@/lib/types";
import { JoystickIcon } from "./icons";

const LINKS = [
  { href: "/arena", label: "Arena" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/history", label: "History" },
  { href: "/about", label: "How it works" },
];

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshSession() {
    try {
      const res = await fetch("/api/session");
      if (!res.ok) return setUser(null);
      const data = await res.json();
      setUser((data?.user ?? data ?? null) as SessionUser | null);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    refreshSession();
  }, []);

  async function signIn() {
    setBusy(true);
    try {
      await fetch("/api/auth/dev-signin", { method: "POST" });
      await refreshSession();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      await refreshSession();
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-cream/[0.86] backdrop-blur-[8px]">
      <nav className="mx-auto flex max-w-container items-center gap-4 px-6 py-3">
        {/* Left: wordmark */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <JoystickIcon size={26} />
          <span className="font-display text-[15px] leading-none">
            arcade<span className="text-blue">-</span>bench
          </span>
        </Link>

        {/* Center: links */}
        <ul className="ml-2 hidden items-center gap-5 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={clsx(
                    "font-grotesk text-[15px] transition-colors hover:text-ink",
                    active ? "font-semibold text-ink" : "text-ink-soft",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right: coin chip + sign in / out */}
        <div className="ml-auto flex items-center gap-3">
          {user && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-yellow px-3 py-1 font-mono text-[12px] font-bold text-ink"
              title="Your votes"
            >
              <CoinGlyph />
              {user.voteCount}
            </span>
          )}
          {user ? (
            <button
              className="btn bg-cream-2 px-3 py-2 text-sm shadow-hard-sm"
              onClick={signOut}
              disabled={busy}
            >
              {user.handle ? `Sign out (${user.handle})` : "Sign out"}
            </button>
          ) : (
            <button
              className="btn bg-blue px-4 py-2 text-sm text-white shadow-hard-sm hover:bg-blue-deep"
              onClick={signIn}
              disabled={busy}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

function CoinGlyph() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" className="pixelated" shapeRendering="crispEdges" aria-hidden>
      <rect x={4} y={2} width={8} height={12} fill="#FFB200" />
      <rect x={2} y={4} width={12} height={8} fill="#FFD64A" />
      <rect x={6} y={5} width={4} height={6} fill="#1B1A22" />
    </svg>
  );
}
