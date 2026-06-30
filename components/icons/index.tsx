// Eight inline SVG pixel icons drawn on a 16x16 grid from <rect> blocks, plus the
// joystick wordmark glyph (design.md §6). `image-rendering: pixelated` keeps the
// blocks crisp. Colors come from palette tokens; the brand icons (GitHub mono,
// Google 4-color) keep their real brand colors.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function PixelSvg({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role="img"
      aria-hidden={props["aria-label"] ? undefined : true}
      className="pixelated"
      shapeRendering="crispEdges"
      {...props}
    >
      {children}
    </svg>
  );
}

// Helper: a row of filled cells given (x, y, width, height) tuples.
function Blocks({ cells, fill }: { cells: [number, number, number, number][]; fill: string }) {
  return (
    <>
      {cells.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
    </>
  );
}

/** Play (triangle made of stepped blocks). */
export function PlayIcon({ color = "currentColor", ...props }: IconProps & { color?: string }) {
  return (
    <PixelSvg {...props}>
      <Blocks
        fill={color}
        cells={[
          [4, 3, 2, 10],
          [6, 4, 2, 8],
          [8, 5, 2, 6],
          [10, 6, 2, 4],
          [12, 7, 1, 2],
        ]}
      />
    </PixelSvg>
  );
}

/** Trophy. */
export function TrophyIcon({ color = "#FFC700", ...props }: IconProps & { color?: string }) {
  return (
    <PixelSvg {...props}>
      <Blocks
        fill={color}
        cells={[
          [3, 2, 10, 2],
          [3, 4, 2, 3],
          [11, 4, 2, 3],
          [5, 4, 6, 4],
          [6, 8, 4, 2],
          [7, 10, 2, 2],
          [5, 12, 6, 2],
        ]}
      />
    </PixelSvg>
  );
}

/** Vote (checkmark). */
export function VoteIcon({ color = "currentColor", ...props }: IconProps & { color?: string }) {
  return (
    <PixelSvg {...props}>
      <Blocks
        fill={color}
        cells={[
          [2, 7, 2, 2],
          [4, 9, 2, 2],
          [6, 11, 2, 2],
          [8, 8, 2, 2],
          [10, 5, 2, 2],
          [12, 3, 2, 2],
        ]}
      />
    </PixelSvg>
  );
}

/** Info ("i"). */
export function InfoIcon({ color = "currentColor", ...props }: IconProps & { color?: string }) {
  return (
    <PixelSvg {...props}>
      <Blocks
        fill={color}
        cells={[
          [7, 2, 2, 2],
          [7, 6, 2, 8],
          [5, 6, 2, 2],
          [5, 12, 6, 2],
        ]}
      />
    </PixelSvg>
  );
}

/** GitHub (mono brand). */
export function GitHubIcon({ ...props }: IconProps) {
  return (
    <PixelSvg {...props}>
      <Blocks
        fill="#1B1A22"
        cells={[
          [5, 2, 6, 2],
          [3, 4, 2, 6],
          [11, 4, 2, 6],
          [4, 6, 2, 2],
          [10, 6, 2, 2],
          [3, 10, 10, 2],
          [4, 12, 2, 2],
          [10, 12, 2, 2],
        ]}
      />
    </PixelSvg>
  );
}

/** Google (4-color brand). */
export function GoogleIcon({ ...props }: IconProps) {
  return (
    <PixelSvg {...props}>
      {/* red top */}
      <Blocks fill="#EA4335" cells={[[5, 2, 6, 2], [3, 4, 2, 2]]} />
      {/* yellow left */}
      <Blocks fill="#FBBC05" cells={[[3, 6, 2, 4], [3, 10, 2, 2]]} />
      {/* green bottom */}
      <Blocks fill="#34A853" cells={[[5, 12, 6, 2], [11, 10, 2, 2]]} />
      {/* blue right + bar */}
      <Blocks fill="#4285F4" cells={[[11, 4, 2, 2], [11, 6, 2, 2], [8, 7, 5, 2]]} />
    </PixelSvg>
  );
}

/** Controller. */
export function ControllerIcon({ color = "currentColor", ...props }: IconProps & { color?: string }) {
  return (
    <PixelSvg {...props}>
      <Blocks
        fill={color}
        cells={[
          [2, 5, 12, 2],
          [1, 7, 14, 3],
          [2, 10, 3, 2],
          [11, 10, 3, 2],
          // d-pad
          [3, 7, 1, 1],
          [2, 8, 3, 1],
          [3, 9, 1, 1],
        ]}
      />
      {/* buttons */}
      <rect x={11} y={7} width={1} height={1} fill="#FF4D4D" />
      <rect x={12} y={8} width={1} height={1} fill="#2D6CFF" />
    </PixelSvg>
  );
}

/** History (clock with hand). */
export function HistoryIcon({ color = "currentColor", ...props }: IconProps & { color?: string }) {
  return (
    <PixelSvg {...props}>
      <Blocks
        fill={color}
        cells={[
          [5, 2, 6, 2],
          [3, 4, 2, 2],
          [11, 4, 2, 2],
          [2, 6, 2, 4],
          [12, 6, 2, 4],
          [3, 10, 2, 2],
          [11, 10, 2, 2],
          [5, 12, 6, 2],
          // hands
          [7, 5, 2, 3],
          [9, 7, 2, 2],
        ]}
      />
    </PixelSvg>
  );
}

/**
 * The joystick wordmark glyph (design.md §6): red ball-top, blue base, gold button.
 * The canonical logo mark.
 */
export function JoystickIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role="img"
      aria-label="arcade-bench logo"
      className="pixelated"
      shapeRendering="crispEdges"
      {...props}
    >
      {/* red ball top */}
      <Blocks fill="#FF4D4D" cells={[[5, 1, 6, 2], [4, 3, 8, 2]]} />
      {/* gold button on the ball */}
      <rect x={7} y={2} width={2} height={2} fill="#FFC700" />
      {/* stick */}
      <rect x={7} y={5} width={2} height={4} fill="#1B1A22" />
      {/* blue base */}
      <Blocks fill="#2D6CFF" cells={[[3, 9, 10, 3], [2, 12, 12, 3]]} />
      {/* base ink detail */}
      <rect x={5} y={13} width={6} height={1} fill="#1B1A22" />
    </svg>
  );
}
