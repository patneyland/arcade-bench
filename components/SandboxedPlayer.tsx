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

const SANDBOX = "allow-scripts";

export interface SandboxedPlayerProps {
  /** Path under /public, e.g. "/artifacts/pong/qwen3-4b.html". */
  artifactPath: string;
  /** Accessible title for the frame, e.g. "Build A — Pong". */
  title: string;
  className?: string;
}

export function SandboxedPlayer({ artifactPath, title, className }: SandboxedPlayerProps) {
  return (
    <div className={`game-canvas ${className ?? ""}`}>
      <iframe
        // Load the artifact by URL (under public). Never inline untrusted HTML via srcDoc.
        src={artifactPath}
        title={title}
        // STRICT sandbox: scripts only. No allow-same-origin, no network, no forms/popups.
        sandbox={SANDBOX}
        // Belt-and-suspenders: no referrer leakage, lazy load.
        referrerPolicy="no-referrer"
        loading="lazy"
        className="absolute inset-0 h-full w-full border-0 bg-[#0B0B12]"
      />
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
