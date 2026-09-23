import { describe, it, expect } from "vitest";
import {
  computeDisruptionScore,
  statusFromScore,
  statusLabel,
} from "./disruption";

const base = {
  baselineDelayPct: 20,
  baselineCanceledPct: 1,
  baselineAvgDelayMin: 30,
  liveDelayPct: null as number | null,
  liveCanceledCount: 0,
};

describe("computeDisruptionScore", () => {
  it("stays within 0–100", () => {
    const r = computeDisruptionScore({
      baselineDelayPct: 60,
      baselineCanceledPct: 10,
      baselineAvgDelayMin: 90,
      liveDelayPct: 80,
      liveCanceledCount: 40,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("returns zero for an ideal airport with no live deviation", () => {
    const r = computeDisruptionScore({
      baselineDelayPct: 0,
      baselineCanceledPct: 0,
      baselineAvgDelayMin: 0,
      liveDelayPct: 0,
      liveCanceledCount: 0,
    });
    expect(r.score).toBe(0);
    expect(r.status).toBe("normal");
  });

  it("adds live deviation only when live delay exceeds baseline", () => {
    const atBaseline = computeDisruptionScore({ ...base, liveDelayPct: 20 });
    const above = computeDisruptionScore({ ...base, liveDelayPct: 35 });
    expect(above.score).toBeGreaterThan(atBaseline.score);
    expect(above.breakdown.liveDeviation).toBeGreaterThan(atBaseline.breakdown.liveDeviation);
  });

  it("contributes points for live cancellations", () => {
    const none = computeDisruptionScore(base);
    const withCancel = computeDisruptionScore({ ...base, liveCanceledCount: 12 });
    expect(withCancel.breakdown.liveCancellations).toBe(12);
    expect(withCancel.score).toBeGreaterThan(none.score);
  });

  it("ignores live components when live data is absent", () => {
    const noLive = computeDisruptionScore(base);
    expect(noLive.breakdown.liveDeviation).toBe(0);
    expect(noLive.breakdown.liveCancellations).toBe(0);
  });

  it("maps scores to the documented bands", () => {
    expect(statusFromScore(0)).toBe("normal");
    expect(statusFromScore(24)).toBe("normal");
    expect(statusFromScore(25)).toBe("elevated");
    expect(statusFromScore(49)).toBe("elevated");
    expect(statusFromScore(50)).toBe("high");
    expect(statusFromScore(74)).toBe("high");
    expect(statusFromScore(75)).toBe("severe");
    expect(statusFromScore(100)).toBe("severe");
  });

  it("produces human-readable status labels", () => {
    expect(statusLabel("severe")).toBe("Severe");
    expect(statusLabel("normal")).toBe("Normal");
  });
});
