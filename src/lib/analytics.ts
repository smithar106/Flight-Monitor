import { AIRPORTS } from "./airports";
import { AIRLINES } from "./airlines";
import {
  airportBaseline,
  airlineBaseline,
  baselineSourceLabel,
  baselinePeriodLabel,
} from "./baselines";
import { computeDisruptionScore, statusLabel } from "./disruption";
import type { FlightRecord } from "./aviationstack";
import type {
  AirportPerformance,
  AirlinePerformance,
  AirlineExposure,
  AirportMetrics,
  NationalOverview,
  StatusLevel,
  Trend,
} from "./types";

// Minimum live sample size before percentages are reported (avoids reporting
// statistically meaningless rates from a handful of flights).
export const MIN_SAMPLE = 10;

type ActiveCategory = "ontime" | "delayed" | "unknown";

function classifyActive(record: FlightRecord): ActiveCategory {
  const d = record.arrivalDelayMin ?? record.departureDelayMin;
  if (d === null) return "unknown";
  return d >= 15 ? "delayed" : "ontime";
}

function delayOf(record: FlightRecord): number | null {
  return record.arrivalDelayMin ?? record.departureDelayMin;
}

interface Agg {
  active: number;
  onTime: number;
  delayed: number;
  unknown: number;
  delaySum: number;
  canceled: number;
  airlines: Map<string, Agg>;
}

function newAgg(): Agg {
  return {
    active: 0,
    onTime: 0,
    delayed: 0,
    unknown: 0,
    delaySum: 0,
    canceled: 0,
    airlines: new Map(),
  };
}

function addTo(agg: Agg, record: FlightRecord): void {
  if (record.status === "cancelled") {
    agg.canceled += 1;
    return;
  }
  agg.active += 1;
  const c = classifyActive(record);
  if (c === "ontime") {
    agg.onTime += 1;
  } else if (c === "delayed") {
    agg.delayed += 1;
    const d = delayOf(record);
    if (d !== null) agg.delaySum += d;
  } else {
    agg.unknown += 1;
  }
}

function metricsFromAgg(agg: Agg): AirportMetrics {
  const perf = agg.onTime + agg.delayed;
  const live = perf >= MIN_SAMPLE;
  if (!live) {
    return {
      flightsTracked: agg.active + agg.canceled,
      onTimePct: null,
      delayPct: null,
      avgDelayMin: null,
      canceledToday: agg.canceled,
      live: false,
    };
  }
  return {
    flightsTracked: agg.active + agg.canceled,
    onTimePct: r1((agg.onTime / perf) * 100),
    delayPct: r1((agg.delayed / perf) * 100),
    avgDelayMin: agg.delayed ? Math.round(agg.delaySum / agg.delayed) : 0,
    canceledToday: agg.canceled,
    live: true,
  };
}

interface Aggregates {
  airports: Map<string, Agg>;
  airlines: Map<string, Agg>;
}

function aggregate(records: FlightRecord[]): Aggregates {
  const airports = new Map<string, Agg>();
  const airlines = new Map<string, Agg>();

  const airportAgg = (iata: string): Agg => {
    let a = airports.get(iata);
    if (!a) {
      a = newAgg();
      airports.set(iata, a);
    }
    return a;
  };
  const airlineAgg = (iata: string): Agg => {
    let a = airlines.get(iata);
    if (!a) {
      a = newAgg();
      airlines.set(iata, a);
    }
    return a;
  };

  for (const r of records) {
    if (r.airlineIata) addTo(airlineAgg(r.airlineIata), r);

    if (r.originIata) {
      const ap = airportAgg(r.originIata);
      addTo(ap, r);
      if (r.airlineIata) {
        let al = ap.airlines.get(r.airlineIata);
        if (!al) {
          al = newAgg();
          ap.airlines.set(r.airlineIata, al);
        }
        addTo(al, r);
      }
    }
    if (r.destIata && r.destIata !== r.originIata) {
      const ap = airportAgg(r.destIata);
      addTo(ap, r);
      if (r.airlineIata) {
        let al = ap.airlines.get(r.airlineIata);
        if (!al) {
          al = newAgg();
          ap.airlines.set(r.airlineIata, al);
        }
        addTo(al, r);
      }
    }
  }

  return { airports, airlines };
}

function buildTopAirlines(agg: Agg | undefined): AirlineExposure[] {
  if (!agg) return [];
  const exposure: AirlineExposure[] = [];
  for (const [iata, a] of agg.airlines) {
    const airline = AIRLINES.find((x) => x.iata === iata);
    if (!airline) continue;
    const m = metricsFromAgg(a);
    exposure.push({
      airline,
      delayPct: m.delayPct,
      flights: a.active + a.canceled,
    });
  }
  return exposure.sort((a, b) => b.flights - a.flights).slice(0, 6);
}

function buildAirportPerformance(
  agg: Agg | undefined,
  iata: string
): AirportPerformance {
  const airport = AIRPORTS.find((a) => a.iata === iata)!;
  const baseline = airportBaseline(iata);
  const metrics = metricsFromAgg(agg ?? newAgg());

  const disruption = computeDisruptionScore({
    baselineDelayPct: baseline?.delayPct ?? null,
    baselineCanceledPct: baseline?.canceledPct ?? null,
    baselineAvgDelayMin: baseline?.avgDelayMin ?? null,
    liveDelayPct: metrics.live ? metrics.delayPct : null,
    liveCanceledCount: metrics.canceledToday,
  });

  const trend: Trend = "unknown";
  const deltaDelayPct =
    metrics.live && baseline && metrics.delayPct !== null
      ? r1(metrics.delayPct - baseline.delayPct)
      : null;

  return {
    airport,
    metrics,
    baseline,
    disruptionScore: disruption.score,
    status: disruption.status,
    trend,
    deltaDelayPct,
    factors: disruption.factors,
    topAirlines: buildTopAirlines(agg),
  };
}

export function buildAllAirports(records: FlightRecord[]): AirportPerformance[] {
  const { airports } = aggregate(records);
  return AIRPORTS.map((a) => buildAirportPerformance(airports.get(a.iata), a.iata)).sort(
    (a, b) => b.disruptionScore - a.disruptionScore
  );
}

function nationalStatusLabel(status: StatusLevel): string {
  switch (status) {
    case "severe":
      return "Severe disruption";
    case "high":
      return "High disruption";
    case "elevated":
      return "Elevated";
    case "normal":
      return "Normal";
  }
}

function deriveNationalStatus(list: AirportPerformance[]): StatusLevel {
  const severe = list.filter((a) => a.status === "severe").length;
  const high = list.filter((a) => a.status === "high").length;
  const elevated = list.filter((a) => a.status === "elevated").length;
  if (severe >= 2) return "severe";
  if (severe >= 1 || high >= 3) return "high";
  if (high >= 1 || elevated >= 8) return "elevated";
  return "normal";
}

function nationalBaseline(
  airports: AirportPerformance[]
): { delayPct: number; canceledPct: number; avgDelayMin: number } | null {
  let w = 0;
  let delaySum = 0;
  let cancelSum = 0;
  let delayMinSum = 0;
  for (const a of airports) {
    const b = a.baseline;
    if (!b || b.sampleSize <= 0) continue;
    w += b.sampleSize;
    delaySum += b.delayPct * b.sampleSize;
    cancelSum += b.canceledPct * b.sampleSize;
    delayMinSum += b.avgDelayMin * b.sampleSize;
  }
  if (!w) return null;
  return {
    delayPct: delaySum / w,
    canceledPct: cancelSum / w,
    avgDelayMin: delayMinSum / w,
  };
}

export function buildNationalOverview(
  records: FlightRecord[],
  airports: AirportPerformance[],
  live: boolean,
  updatedAt: number
): NationalOverview {
  const nationalAgg = newAgg();
  for (const r of records) addTo(nationalAgg, r);
  const m = metricsFromAgg(nationalAgg);
  const base = nationalBaseline(airports);

  const status = deriveNationalStatus(airports);
  const delayDeltaPct =
    m.live && base && m.delayPct !== null ? r1(m.delayPct - base.delayPct) : null;

  return {
    status,
    statusLabel: nationalStatusLabel(status),
    flightsTracked: m.flightsTracked,
    onTimePct: m.onTimePct,
    delayPct: m.delayPct,
    avgDelayMin: m.avgDelayMin,
    canceledToday: m.canceledToday,
    canceledPctBaseline: base ? r1(base.canceledPct) : null,
    delayDeltaPct,
    airportsElevated: airports.filter((a) => a.status === "elevated").length,
    airportsHigh: airports.filter((a) => a.status === "high").length,
    airportsSevere: airports.filter((a) => a.status === "severe").length,
    totalAirports: airports.length,
    updatedAt: new Date(updatedAt).toISOString(),
    freshness: live ? "live" : "stale",
    live,
  };
}

export function buildAirlinePerformance(
  records: FlightRecord[],
  live: boolean
): AirlinePerformance[] {
  const { airlines: aggs } = aggregate(records);

  let baseSum = 0;
  let baseCount = 0;
  for (const a of AIRLINES) {
    const b = airlineBaseline(a.iata);
    if (b) {
      baseSum += b.delayPct;
      baseCount += 1;
    }
  }
  const nationalBaselineDelay = baseCount ? baseSum / baseCount : null;

  return AIRLINES.map((airline) => {
    const agg = aggs.get(airline.iata);
    const m = metricsFromAgg(agg ?? newAgg());
    const baseline = airlineBaseline(airline.iata);

    const deltaDelayPct =
      m.live && baseline && m.delayPct !== null
        ? r1(m.delayPct - baseline.delayPct)
        : baseline && nationalBaselineDelay !== null
          ? r1(baseline.delayPct - nationalBaselineDelay)
          : null;

    let band: AirlinePerformance["band"] = "near";
    if (deltaDelayPct !== null) {
      if (deltaDelayPct <= -3) band = "outperforming";
      else if (deltaDelayPct >= 3) band = "underperforming";
    }

    return {
      airline,
      flightsTracked: m.flightsTracked,
      onTimePct: m.onTimePct,
      delayPct: m.delayPct,
      avgDelayMin: m.avgDelayMin,
      canceledToday: m.canceledToday,
      baselineDelayPct: baseline?.delayPct ?? null,
      deltaDelayPct,
      live: m.live,
      band,
    };
  }).sort(
    (a, b) =>
      (a.delayPct ?? a.baselineDelayPct ?? 0) -
      (b.delayPct ?? b.baselineDelayPct ?? 0)
  );
}

export function dataContext(): {
  baselineSource: string;
  baselinePeriod: string;
} {
  return {
    baselineSource: baselineSourceLabel(),
    baselinePeriod: baselinePeriodLabel(),
  };
}

export { statusLabel };

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}
