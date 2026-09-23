import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Canvas
        abyss: "#070B12",
        surface: "#0C121C",
        "surface-2": "#111826",
        "surface-3": "#16202F",
        line: "#1D2735",
        "line-strong": "#2A3648",
        // Text
        ink: "#E6EAF2",
        "ink-muted": "#8B98A9",
        "ink-faint": "#5B6675",
        // Aviation accent
        pulse: "#3E8BFF",
        "pulse-soft": "#16304F",
        // Status
        normal: "#1FBF8A",
        "normal-soft": "#0C2B22",
        elevated: "#E0A82E",
        "elevated-soft": "#2E2410",
        high: "#F07B3F",
        "high-soft": "#33190C",
        severe: "#F0483E",
        "severe-soft": "#32100E",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        display: ["clamp(2.25rem, 4.5vw, 3.75rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        hero: ["clamp(2rem, 3.6vw, 3rem)", { lineHeight: "1.08", letterSpacing: "-0.025em" }],
        title: ["clamp(1.6rem, 2.6vw, 2.25rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        lead: ["1.125rem", { lineHeight: "1.6" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        small: ["0.8125rem", { lineHeight: "1.5" }],
        micro: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        sm2: "4px",
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.4)",
        "panel-lg": "0 24px 48px -24px rgba(0,0,0,0.6)",
      },
      letterSpacing: {
        eyebrow: "0.16em",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "pulse-dot": "pulse-dot 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
