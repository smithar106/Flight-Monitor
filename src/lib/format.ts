import type { StatusLevel } from "./types";

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtDelta(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}

export function fmtClock(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export const STATUS_META: Record<
  StatusLevel,
  { label: string; text: string; dot: string; bg: string; border: string; hex: string }
> = {
  normal: {
    label: "Normal",
    text: "text-normal",
    dot: "bg-normal",
    bg: "bg-normal-soft",
    border: "border-normal/30",
    hex: "#15803D",
  },
  elevated: {
    label: "Elevated",
    text: "text-elevated",
    dot: "bg-elevated",
    bg: "bg-elevated-soft",
    border: "border-elevated/30",
    hex: "#B45309",
  },
  high: {
    label: "High",
    text: "text-high",
    dot: "bg-high",
    bg: "bg-high-soft",
    border: "border-high/30",
    hex: "#C2410C",
  },
  severe: {
    label: "Severe",
    text: "text-severe",
    dot: "bg-severe",
    bg: "bg-severe-soft",
    border: "border-severe/30",
    hex: "#B91C1C",
  },
};
