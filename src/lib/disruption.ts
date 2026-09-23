import type { StatusLevel } from "./types";

// ---------------------------------------------------------------------------
// Disruption Score — an explainable 0–100 composite.
//
// Methodology (documented in /methodology and in the UI):
//
//   Component                  Weight  Derivation
//   -------------------------  ------  ---------------------------------------
//   Delay rate                 up to 40  baseline delay % (1 point per 1% up to 40%)
//   Cancellation rate          up to 20  baseline cancel % × 8 (saturates at 2.5%)
//   Average delay duration     up to 15  avg delay min / 60 × 15 (saturates at 60 min)
//   Live traffic anomaly       up to 25  (1 − liveVolume/expected) / 0.5 × 25,
//                                       zero when traffic is at/above expected
//
// All inputs are deterministic application metrics. The LLM never contributes
// to the score — it only explains the resulting numbers.
// ---------------------------------------------------------------------------

export interface DisruptionInput {
  delayPct: number | null;
  canceledPct: number | null;
  avgDelayMin: number | null;
  volumeRatio: number | null;
}

export interface DisruptionBreakdown {
  delay: number;
  cancellation: number;
  avgDelay: number;
  anomaly: number;
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
  const delayPct = input.delayPct ?? 0;
  const canceledPct = input.canceledPct ?? 0;
  const avgDelayMin = input.avgDelayMin ?? 0;

  const delay = clamp(delayPct, 0, 40);
  const cancellation = clamp(canceledPct * 8, 0, 20);
  const avgDelay = clamp((avgDelayMin / 60) * 15, 0, 15);

  let anomaly = 0;
  if (input.volumeRatio !== null && input.volumeRatio >= 0) {
    const shortfall = 1 - input.volumeRatio;
    anomaly = clamp((shortfall / 0.5) * 25, 0, 25);
  }

  const breakdown = {
    delay: round1(delay),
    cancellation: round1(cancellation),
    avgDelay: round1(avgDelay),
    anomaly: round1(anomaly),
  };

  const score = Math.round(
    clamp(delay + cancellation + avgDelay + anomaly, 0, 100)
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

  if (input.delayPct !== null && b.delay >= 12) {
    factors.push(
      `Delay rate of ${fmt(input.delayPct)}% is elevated (contributes ${fmt(b.delay)} pts)`
    );
  }
  if (input.canceledPct !== null && input.canceledPct >= 1.5) {
    factors.push(
      `Cancellation rate of ${fmt(input.canceledPct)}% (contributes ${fmt(b.cancellation)} pts)`
    );
  }
  if (input.avgDelayMin !== null && input.avgDelayMin >= 30) {
    factors.push(
      `Average delay of ${fmt(input.avgDelayMin)} min is above typical (contributes ${fmt(b.avgDelay)} pts)`
    );
  }
  if (input.volumeRatio !== null && input.volumeRatio < 0.85) {
    factors.push(
      `Live traffic is ${fmt(input.volumeRatio * 100)}% of expected volume, suggesting a reduction in throughput`
    );
  }
  if (factors.length === 0) {
    factors.push("No individual component is materially above typical levels");
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
