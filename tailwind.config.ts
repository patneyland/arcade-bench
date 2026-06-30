import type { Config } from "tailwindcss";

// Design tokens from design.md (Pixel Pop). Agent C owns and may extend this file.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF7EF",
        "cream-2": "#F3ECDD",
        surface: "#FFFFFF",
        ink: "#1B1A22",
        "ink-soft": "#57545F",
        line: "#E6DFCF",
        blue: "#2D6CFF",
        "blue-deep": "#1A4FCC",
        red: "#FF4D4D",
        yellow: "#FFC700",
        "gold-1": "#FFD64A",
        "gold-2": "#FFB200",
        grape: "#7B5CFF",
        win: "#18B26B",
        danger: "#E23B3B",
      },
      fontFamily: {
        display: ["var(--font-press-start)", "monospace"],
        grotesk: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: { DEFAULT: "14px", btn: "12px", chip: "9px" },
      boxShadow: {
        hard: "4px 4px 0 #1B1A22",
        "hard-sm": "3px 3px 0 #1B1A22",
      },
      maxWidth: { container: "1120px" },
    },
  },
  plugins: [],
};

export default config;
