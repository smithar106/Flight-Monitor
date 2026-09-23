import fs from "fs";
import path from "path";
import type { PerformanceBaseline } from "./types";

export interface AirportBaselineRow {
  delayPct: number;
  canceledPct: number;
  avgDelayMin: number;
  dailyMovements: number;
  trend: number;
}

export interface AirlineBaselineRow {
  delayPct: number;
  canceledPct: number;
  avgDelayMin: number;
}

export interface BaselineDataset {
  source: "bts" | "sample";
  periodLabel: string;
  note?: string;
  generated: string;
  hourlyCurve: number[];
  dayOfWeek: number[];
  airports: Record<string, AirportBaselineRow>;
  airlines: Record<string, AirlineBaselineRow>;
}

const DATA_DIR = path.join(process.cwd(), "data", "baselines");

let cached: BaselineDataset | null = null;

function normalize(ds: BaselineDataset): BaselineDataset {
  const hourlySum = ds.hourlyCurve.reduce((a, b) => a + b, 0) || 1;
  const dowSum = ds.dayOfWeek.reduce((a, b) => a + b, 0) || 7;
  return {
    ...ds,
    hourlyCurve: ds.hourlyCurve.map((v) => v / hourlySum),
    dayOfWeek: ds.dayOfWeek.map((v) => v / (dowSum / 7)),
  };
}

export function loadBaseline(): BaselineDataset | null {
  if (cached) return cached;

  // Prefer a real BTS-derived baseline if it has been generated; otherwise
  // fall back to the explicitly-labelled sample.
  const candidates = ["bts.json", "sample.json"];
  for (const file of candidates) {
    const p = path.join(DATA_DIR, file);
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as BaselineDataset;
        cached = normalize(raw);
        return cached;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function airportRow(ds: BaselineDataset, iata: string): AirportBaselineRow | null {
  return ds.airports[iata] ?? null;
}

function airlineRow(ds: BaselineDataset, iata: string): AirlineBaselineRow | null {
  return ds.airlines[iata] ?? null;
}

export function airportBaseline(iata: string): PerformanceBaseline | null {
  const ds = loadBaseline();
  if (!ds) return null;
  const row = airportRow(ds, iata);
  if (!row) return null;
  const onTime = Math.max(0, Math.min(100, 100 - row.delayPct - row.canceledPct));
  return {
    onTimePct: round1(onTime),
    delayPct: row.delayPct,
    canceledPct: row.canceledPct,
    avgDelayMin: row.avgDelayMin,
    sampleSize: Math.round(row.dailyMovements * 30),
    periodLabel: ds.periodLabel,
    source: ds.source,
  };
}

export function airlineBaseline(iata: string): PerformanceBaseline | null {
  const ds = loadBaseline();
  if (!ds) return null;
  const row = airlineRow(ds, iata);
  if (!row) return null;
  const onTime = Math.max(0, Math.min(100, 100 - row.delayPct - row.canceledPct));
  return {
    onTimePct: round1(onTime),
    delayPct: row.delayPct,
    canceledPct: row.canceledPct,
    avgDelayMin: row.avgDelayMin,
    sampleSize: 0,
    periodLabel: ds.periodLabel,
    source: ds.source,
  };
}

// Expected movements (arrivals + departures) in a single local hour, derived
// from the airport's typical daily volume and the diurnal curve. Used as the
// denominator for the live traffic-anomaly signal.
export function expectedHourlyMovements(iata: string, localHour: number, dayOfWeek: number): number | null {
  const ds = loadBaseline();
  if (!ds) return null;
  const row = airportRow(ds, iata);
  if (!row) return null;
  const hour = Math.max(0, Math.min(23, Math.floor(localHour)));
  const dow = Math.max(0, Math.min(6, Math.floor(dayOfWeek)));
  const frac = ds.hourlyCurve[hour] ?? 0;
  const dowFactor = ds.dayOfWeek[dow] ?? 1;
  return row.dailyMovements * frac * dowFactor;
}

export function baselineSourceLabel(): string {
  const ds = loadBaseline();
  if (!ds) return "unavailable";
  return ds.source === "bts" ? "BTS" : "sample (demo)";
}

export function baselinePeriodLabel(): string {
  const ds = loadBaseline();
  if (!ds) return "";
  return ds.periodLabel;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
