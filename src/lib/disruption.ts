import type { StatusLevel } from "./types";

// ---------------------------------------------------------------------------
// Disruption Score — an explainable 0–100 composite.
//
// Methodology (documented in /methodology and in the UI):
//
//   Component                       Weight  Derivation
//   ------------------------------  ------  ---------------------------------
//   Baseline delay rate             up to 35  baseline delay % (1 pt per 1%, saturates 35%)
//   Baseline cancellation rate      up to 15  baseline cancel % × 6 (saturates 2.5%)
//   Baseline average delay          up to 10  avg delay min ÷ 60 × 10 (saturates 60 min)
//   Live delay deviation            up to 25  live delay % above baseline, scaled
//   Live cancellations              up to 15  cancelled flights today (capped at 15)
//
// When live data is unavailable, the two live components are zero and the
// score reflects historical (baseline) propensity only.
//
// All inputs are deterministic application metrics. The LLM never contributes
// to the score — it only explains the resulting numbers.
// ---------------------------------------------------------------------------

export interface DisruptionInput {
  baselineDelayPct: number | null;
  baselineCanceledPct: number | null;
  baselineAvgDelayMin: number | null;
  liveDelayPct: number | null;
  liveCanceledCount: number;
}

export interface DisruptionBreakdown {
  baselineDelay: number;
  baselineCancellation: number;
  baselineAvgDelay: number;
  liveDeviation: number;
  liveCancellations: number;
}

export interface DisruptionResult {
  score: number;
  status: StatusLevel;
  breakdown: DisruptionBreakdown;
  factors: string[];
}

export function statusFromScore(score: number): StatusLevel {
  if (score >= 75) return "severe";
  if (score >= 50) return "high";
  if (score >= 25) return "elevated";
  return "normal";
}

export function statusLabel(status: StatusLevel): string {
  switch (status) {
    case "severe":
      return "Severe";
    case "high":
      return "High";
    case "elevated":
      return "Elevated";
    case "normal":
      return "Normal";
  }
}

export function computeDisruptionScore(input: DisruptionInput): DisruptionResult {
  const delayPct = input.baselineDelayPct ?? 0;
  const canceledPct = input.baselineCanceledPct ?? 0;
  const avgDelayMin = input.baselineAvgDelayMin ?? 0;

  const baselineDelay = clamp(delayPct, 0, 35);
  const baselineCancellation = clamp(canceledPct * 6, 0, 15);
  const baselineAvgDelay = clamp((avgDelayMin / 60) * 10, 0, 10);

  let liveDeviation = 0;
  if (input.liveDelayPct !== null) {
    const excess = Math.max(0, input.liveDelayPct - (input.baselineDelayPct ?? 0));
    liveDeviation = clamp(excess * 1.5, 0, 25);
  }
  const liveCancellations = clamp(input.liveCanceledCount, 0, 15);

  const breakdown = {
    baselineDelay: round1(baselineDelay),
    baselineCancellation: round1(baselineCancellation),
    baselineAvgDelay: round1(baselineAvgDelay),
    liveDeviation: round1(liveDeviation),
    liveCancellations: round1(liveCancellations),
  };

  const score = Math.round(
    clamp(
      baselineDelay + baselineCancellation + baselineAvgDelay + liveDeviation + liveCancellations,
      0,
      100
    )
  );

  return {
    score,
    status: statusFromScore(score),
    breakdown,
    factors: buildFactors(input, breakdown),
  };
}

function buildFactors(
  input: DisruptionInput,
  b: DisruptionBreakdown
): string[] {
  const factors: string[] = [];

  if (input.baselineDelayPct !== null && b.baselineDelay >= 12) {
    factors.push(
      `Historical delay rate of ${fmt(input.baselineDelayPct)}% is elevated (${fmt(b.baselineDelay)} pts)`
    );
  }
  if (input.baselineCanceledPct !== null && input.baselineCanceledPct >= 1.5) {
    factors.push(
      `Historical cancellation rate of ${fmt(input.baselineCanceledPct)}% (${fmt(b.baselineCancellation)} pts)`
    );
  }
  if (input.liveDelayPct !== null) {
    const base = input.baselineDelayPct ?? 0;
    const excess = input.liveDelayPct - base;
    if (excess >= 5) {
      factors.push(
        `Live delay rate (${fmt(input.liveDelayPct)}%) is ${fmt(excess)} pts above historical normal (${fmt(b.liveDeviation)} pts)`
      );
    } else {
      factors.push(`Live delay rate (${fmt(input.liveDelayPct)}%) is near historical normal`);
    }
  }
  if (input.liveCanceledCount > 0) {
    factors.push(
      `${input.liveCanceledCount} flight${input.liveCanceledCount === 1 ? "" : "s"} canceled today (${fmt(b.liveCancellations)} pts)`
    );
  }
  if (factors.length === 0) {
    factors.push("No component is materially above typical levels");
  }
  return factors;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}
