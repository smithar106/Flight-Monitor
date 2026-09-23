import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Canvas & surfaces
        canvas: "#F8F9FB",
        surface: "#FFFFFF",
        "surface-2": "#F1F3F6",
        "surface-3": "#E9EDF2",
        // Borders
        line: "#E8EBEF",
        "line-strong": "#D5DAE1",
        // Text (black + navy — no neutral grays)
        ink: "#000000",
        "ink-muted": "#1E3A5F",
        "ink-faint": "#33527A",
        // Accent (single blue)
        pulse: "#2563EB",
        "pulse-soft": "#EAF1FE",
        "pulse-ink": "#1D4ED8",
        // Status
        normal: "#15803D",
        "normal-soft": "#E8F5EE",
        elevated: "#B45309",
        "elevated-soft": "#FAF3E1",
        high: "#C2410C",
        "high-soft": "#FCEFE4",
        severe: "#B91C1C",
        "severe-soft": "#FCECEA",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        display: ["clamp(2rem, 3.6vw, 2.75rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        title: ["clamp(1.5rem, 2.4vw, 1.9rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        heading: ["1.25rem", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        lead: ["1.0625rem", { lineHeight: "1.6" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        small: ["0.8125rem", { lineHeight: "1.5" }],
        micro: ["0.6875rem", { lineHeight: "1.45" }],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(16,21,28,0.04)",
        raised: "0 1px 2px rgba(16,21,28,0.05), 0 4px 12px -4px rgba(16,21,28,0.06)",
        drawer: "0 0 0 1px rgba(16,21,28,0.04), 0 24px 48px -12px rgba(16,21,28,0.24)",
      },
      letterSpacing: {
        eyebrow: "0.12em",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "slide-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
        "fade-up": "fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-dot": "pulse-dot 2.2s ease-in-out infinite",
        "slide-in": "slide-in 0.24s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
