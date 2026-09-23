import type { Config } from "tailwindcss";

// Design tokens per design_handoff_pouls/README.md — "Design Tokens" section.
// Fidelity is high; do not adjust these values without checking the handoff.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#f5f3ee",
        surface: "#fffdf9",
        field: "#ffffff",
        ink: "#22201c",
        muted: "#6b665d",
        insetText: "#4a463f",
        border: "#e4e0d7",
        subtle: "#efece5",
        // Named "dottedLine" (not "dashed") to avoid colliding with Tailwind's
        // built-in `border-dashed` border-style utility.
        dottedLine: "#d6d1c6",
        pillar: {
          bienetre: "oklch(0.6 0.1 155)",
          engagement: "oklch(0.6 0.1 265)",
          performance: "oklch(0.6 0.1 60)",
        },
        score: {
          good: "oklch(0.62 0.1 155)",
          mid: "oklch(0.66 0.13 55)",
          low: "oklch(0.6 0.14 30)",
        },
        success: {
          bg: "oklch(0.9 0.05 155)",
          text: "oklch(0.45 0.1 155)",
        },
        error: "oklch(0.5 0.14 30)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xs: "6px",
        sm: "7px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "14px",
        "2xl": "16px",
        pill: "20px",
      },
      spacing: {
        "4.5": "18px",
        "5.5": "22px",
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};

export default config;
