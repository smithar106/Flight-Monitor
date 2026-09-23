import { describe, it, expect } from "vitest";
import {
  computeDisruptionScore,
  statusFromScore,
  statusLabel,
} from "./disruption";

describe("computeDisruptionScore", () => {
  it("stays within 0–100", () => {
    const r = computeDisruptionScore({
      delayPct: 60,
      canceledPct: 10,
      avgDelayMin: 90,
      volumeRatio: 0,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("returns zero for an ideal airport with no anomaly", () => {
    const r = computeDisruptionScore({
      delayPct: 0,
      canceledPct: 0,
      avgDelayMin: 0,
      volumeRatio: 1.2,
    });
    expect(r.score).toBe(0);
    expect(r.status).toBe("normal");
  });

  it("ignores a missing live-anomaly signal", () => {
    const withAnomaly = computeDisruptionScore({
      delayPct: 20,
      canceledPct: 1,
      avgDelayMin: 30,
      volumeRatio: 0.5,
    });
    const without = computeDisruptionScore({
      delayPct: 20,
      canceledPct: 1,
      avgDelayMin: 30,
      volumeRatio: null,
    });
    expect(withAnomaly.score).toBeGreaterThan(without.score);
    expect(withAnomaly.breakdown.anomaly).toBeGreaterThan(0);
    expect(without.breakdown.anomaly).toBe(0);
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
