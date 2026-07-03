"use client";

// SandboxedPlayer — the security-critical component (PRD §D, design.md §9).
//
// Renders an artifact's untrusted, AI-generated HTML inside a STRICT sandboxed
// <iframe>. The sandbox grants ONLY `allow-scripts` so the game's JS can run — it
// deliberately omits `allow-same-origin` (so the frame can never reach the parent
// origin, cookies, or storage) and never enables network/popups/forms. This is the
// one hard, non-negotiable security rule: model-written JavaScript must not be able
// to touch the site, the account, or the network.
//
// The component-test guard in SandboxedPlayer.test.tsx asserts the sandbox string
// does NOT contain `allow-same-origin`, so a regression here fails CI.
//
// Virtual viewport (docs/ux-overhaul.md §1 — the rating-integrity fix): the iframe
// always renders at a fixed 820×700 CSS px (bigger than the worst native artifact
// size in the corpus, 808×688) and is scaled DOWN to fit its frame with a CSS
// transform on the iframe element itself. Pointer coordinates remap through
// transforms automatically and keyboard focus is unaffected, so nothing about the
// sandbox or the artifact changes — voters just stop penalizing a clipped viewport.
//
// Playability layer (all app-side; the artifact HTML is never modified):
// - INSERT COIN gate: the iframe is not mounted until the player clicks, so games
//   can't auto-play before anyone is looking. The dismissing click doubles as the
//   focus handoff — every build listens for keys on its own document, and keys only
//   reach the frame while the iframe element holds focus.
// - Focus indicator: a cross-origin frame gives no visible cue that it owns the
//   keyboard, so we poll document.activeElement and show an accent ring + status.
// - Restart: remounts the iframe (fresh run of the same artifact) without redrawing
//   the pairing — rescues builds that died before the player had control.
// - Restart + the focus hint live as overlay chips on the canvas corners: a row
//   beneath the canvas shifts the layout when it appears.

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { PlayIcon } from "./icons";

const SANDBOX = "allow-scripts";

/** Fixed virtual viewport every artifact renders into before being scaled to fit. */
const VIRTUAL_W = 820;
const VIRTUAL_H = 700;
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Up",
  "Down",
  "Left",
  "Right",
  "Space",
  "Spacebar",
  " ",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);
let activePlayerId: string | null = null;
let nextPlayerId = 1;
let scrollLockOwnerId: string | null = null;
let previousRootOverflow = "";
let previousBodyOverflow = "";

function lockPageScroll(ownerId: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  if (!root || !body) return;

  if (scrollLockOwnerId === null) {
    previousRootOverflow = root.style.overflow;
    previousBodyOverflow = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
  }
  scrollLockOwnerId = ownerId;
}

function unlockPageScroll(ownerId: string) {
  if (typeof document === "undefined") return;
  if (scrollLockOwnerId !== ownerId) return;
  const root = document.documentElement;
  const body = document.body;
  if (root) root.style.overflow = previousRootOverflow;
  if (body) body.style.overflow = previousBodyOverflow;
  scrollLockOwnerId = null;
  previousRootOverflow = "";
  previousBodyOverflow = "";
}

export interface SandboxedPlayerProps {
  /** Path under /public, e.g. "/artifacts/pong/qwen3-4b.html". */
  artifactPath: string;
  /** Accessible title for the frame, e.g. "Build A — Pong". */
  title: string;
  className?: string;
  /** Build identity accent for the focus ring: A is blue, B is red (design.md §2). */
  accent?: "blue" | "red";
  /** Fires once, the first time the player starts this build. */
  onStarted?: () => void;
}

type Fit = { scale: number; x: number; y: number };

export function SandboxedPlayer({
  artifactPath,
  title,
  className,
  accent = "blue",
  onStarted,
}: SandboxedPlayerProps) {
  const [started, setStarted] = useState(false);
  const [runId, setRunId] = useState(0);
  const [focused, setFocused] = useState(false);
  // scale=1 until measured — a zero-size box (off-stage frame, jsdom) keeps the last fit.
  const [fit, setFit] = useState<Fit>({ scale: 1, x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const playerIdRef = useRef<string>(`player-${nextPlayerId++}`);
  const focusFrame = () => frameRef.current?.focus();
  const activate = () => {
    activePlayerId = playerIdRef.current;
    lockPageScroll(playerIdRef.current);
    focusFrame();
  };
  const deactivate = () => {
    if (activePlayerId === playerIdRef.current) {
      activePlayerId = null;
    }
    unlockPageScroll(playerIdRef.current);
  };

  // Measure the frame box and fit the 820×700 virtual viewport into it, centered.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const { width, height } = box.getBoundingClientRect();
      if (width <= 0 || height <= 0) return; // hidden or non-browser env — keep last fit
      const scale = Math.min(width / VIRTUAL_W, height / VIRTUAL_H);
      setFit({
        scale,
        x: (width - VIRTUAL_W * scale) / 2,
        y: (height - VIRTUAL_H * scale) / 2,
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return; // jsdom
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // Focus moving into/out of a cross-origin iframe doesn't fire DOM events the parent
  // can subscribe to reliably, so poll activeElement while the game is running.
  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(() => {
      setFocused(document.activeElement === frameRef.current);
    }, 250);
    return () => window.clearInterval(id);
  }, [started]);

  // Focus handoff reliability: when the coin gate opens (or Restart remounts the
  // frame), move keyboard focus into the iframe immediately and again shortly after
  // mount. Without this, ArrowUp/ArrowDown can scroll the page before the frame
  // captures keys.
  useEffect(() => {
    if (!started) return;
    const raf = window.requestAnimationFrame(() => focusFrame());
    const timeout = window.setTimeout(() => focusFrame(), 120);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [started, runId]);

  // Fail-safe scroll lock: while this cabinet is the active one, prevent browser
  // key-scroll and hand focus back to the iframe so arrow-key games remain playable.
  useEffect(() => {
    if (!started) return;

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (activePlayerId !== playerIdRef.current) return;
      if (!SCROLL_KEYS.has(event.key) && event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.cancelable) event.preventDefault();
      focusFrame();
    };

    const onWindowPointerDown = (event: PointerEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const node = event.target as Node | null;
      if (node && box.contains(node)) {
        activate();
        return;
      }
      deactivate();
    };

    window.addEventListener("keydown", onWindowKeyDown, true);
    window.addEventListener("pointerdown", onWindowPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown, true);
      window.removeEventListener("pointerdown", onWindowPointerDown, true);
      deactivate();
    };
  }, [started]);

  return (
    <div
      ref={boxRef}
      onPointerDownCapture={() => {
        if (started) activate();
      }}
      className={clsx(
        "game-canvas",
        focused && (accent === "red" ? "ring-[3px] ring-red" : "ring-[3px] ring-blue"),
        className,
      )}
    >
      {started ? (
        <>
          <iframe
            key={runId}
            ref={frameRef}
            // Load the artifact by URL (under public). Never inline untrusted HTML via srcDoc.
            src={artifactPath}
            title={title}
            // STRICT sandbox: scripts only. No allow-same-origin, no network, no forms/popups.
            sandbox={SANDBOX}
            // Belt-and-suspenders: no referrer leakage, lazy load.
            referrerPolicy="no-referrer"
            loading="lazy"
            tabIndex={0}
            // Hand the keyboard to the game as soon as it's running (also after Restart).
            onLoad={() => activate()}
            onFocus={() => {
              setFocused(true);
              lockPageScroll(playerIdRef.current);
              activePlayerId = playerIdRef.current;
            }}
            onBlur={() => setFocused(false)}
            // Fixed 820×700 virtual viewport, scaled to fit and centered in the frame.
            // The transform remaps pointer coordinates automatically.
            style={{
              width: VIRTUAL_W,
              height: VIRTUAL_H,
              transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
              transformOrigin: "top left",
            }}
            className="absolute left-0 top-0 border-0 bg-[#0B0B12]"
          />
          {/* Overlay chips — corner controls instead of a layout-shifting row below. */}
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
            <button
              type="button"
              onClick={() => setRunId((n) => n + 1)}
              className="btn pointer-events-auto rounded-chip bg-surface px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink shadow-hard-sm"
            >
              ↻ Restart
            </button>
            <span
              className={clsx(
                "rounded-chip border-2 border-ink bg-surface/90 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]",
                focused ? (accent === "red" ? "text-red" : "text-blue") : "text-ink-soft",
              )}
              aria-live="polite"
            >
              {focused ? "⌨ keys go to this build" : "click the game to use keys"}
            </span>
          </div>
        </>
      ) : (
        <button
          type="button"
          aria-label={`Insert coin — play ${title}`}
          onClick={() => {
            setStarted(true);
            lockPageScroll(playerIdRef.current);
            activePlayerId = playerIdRef.current;
            onStarted?.();
          }}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-3"
        >
          <PlayIcon size={22} color="#FFC700" />
          <span className="font-display text-[13px] leading-none text-yellow group-hover:text-gold-1">
            INSERT COIN
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8f8fa0]">
            click to play
          </span>
        </button>
      )}
    </div>
  );
}

/** Placeholder shown when there is no artifact to render (empty arena state). */
export function EmptyCanvas({ label = "No build yet" }: { label?: string }) {
  return (
    <div className="game-canvas flex items-center justify-center">
      <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#6b6b7a]">
        {label}
      </span>
    </div>
  );
}
