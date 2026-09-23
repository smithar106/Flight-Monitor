import { AIRPORTS, airportByIcao } from "./airports";
import { AIRLINES, airlineFromCallsign } from "./airlines";
import {
  airportBaseline,
  airlineBaseline,
  expectedHourlyMovements,
  baselineSourceLabel,
  baselinePeriodLabel,
} from "./baselines";
import { computeDisruptionScore, statusLabel } from "./disruption";
import { distanceNm } from "./geo";
import type { OpenSkyStates } from "./opensky";
import type {
  AirportPerformance,
  AirlinePerformance,
  NationalOverview,
  StatusLevel,
  Trend,
  AirlineExposure,
} from "./types";

// Maximum distance (nautical miles) from a reference airport at which a
// low-altitude aircraft is attributed to that airport.
const ATTRIBUTION_RADIUS_NM = 60;

// Modeling assumption (documented in /methodology): a low-altitude aircraft is
// observable in the terminal-area regime for ~35 minutes on average, so
// instantaneous aircraft count ≈ hourly throughput × 0.6. The constant is
// calibrated so a typical airport at a typical hour yields a ratio near 1.0.
const DWELL_FRACTION = 0.6;

export interface LocalTime {
  hour: number;
  dayOfWeek: number; // 0 = Sunday
  month: number;
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function localTime(now: Date, tz: string): LocalTime {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
      weekday: "short",
      month: "numeric",
    }).formatToParts(now);
    let hour = 0;
    let dayOfWeek = 0;
    let month = 1;
    for (const p of parts) {
      if (p.type === "hour") hour = parseInt(p.value, 10) % 24;
      else if (p.type === "weekday") dayOfWeek = WEEKDAYS[p.value] ?? 0;
      else if (p.type === "month") month = parseInt(p.value, 10);
    }
    return { hour, dayOfWeek, month };
  } catch {
    return { hour: 12, dayOfWeek: 3, month: 1 };
  }
}

// Assign each low-altitude airborne aircraft to its NEAREST reference airport,
// so closely-spaced airports (e.g. LGA/JFK/EWR) do not double-count the same
// aircraft. Cruise-altitude traffic (above 15,000 ft) is excluded so we capture
// only terminal-area movements.
interface AirportAttribution {
  total: number;
  airlines: Map<string, number>;
}

function attributeAirborne(states: OpenSkyStates): Map<string, AirportAttribution> {
  const map = new Map<string, AirportAttribution>();
  for (const s of states.states) {
    if (s.onGround) continue;
    if (s.latitude === null || s.longitude === null) continue;
    if (s.baroAltitude !== null && s.baroAltitude > 15_000) continue;

    let nearest: (typeof AIRPORTS)[number] | null = null;
    let nearestD = Infinity;
    for (const a of AIRPORTS) {
      const d = distanceNm(a.lat, a.lon, s.latitude, s.longitude);
      if (d < nearestD) {
        nearestD = d;
        nearest = a;
      }
    }
    if (!nearest || nearestD > ATTRIBUTION_RADIUS_NM) continue;

    let entry = map.get(nearest.iata);
    if (!entry) {
      entry = { total: 0, airlines: new Map() };
      map.set(nearest.iata, entry);
    }
    entry.total += 1;
    const airline = airlineFromCallsign(s.callsign);
    if (airline) {
      entry.airlines.set(airline.iata, (entry.airlines.get(airline.iata) ?? 0) + 1);
    }
  }
  return map;
}

function countAirborneUs(states: OpenSkyStates): number {
  let count = 0;
  for (const s of states.states) {
    if (!s.onGround) count += 1;
  }
  return count;
}

function buildAirportPerformance(
  attribution: Map<string, AirportAttribution>,
  iata: string,
  now: Date
): AirportPerformance {
  const airport = AIRPORTS.find((a) => a.iata === iata)!;
  const baseline = airportBaseline(iata);
  const lt = localTime(now, airport.tz);

  const attr = attribution.get(iata);
  const liveActivity = attr?.total ?? 0;
  const expectedHourly = expectedHourlyMovements(iata, lt.hour, lt.dayOfWeek);
  const expectedInstantaneous =
    expectedHourly !== null ? expectedHourly * DWELL_FRACTION : null;
  const volumeRatio =
    liveActivity > 0 && expectedInstantaneous
      ? liveActivity / expectedInstantaneous
      : null;

  const disruption = computeDisruptionScore({
    delayPct: baseline?.delayPct ?? null,
    canceledPct: baseline?.canceledPct ?? null,
    avgDelayMin: baseline?.avgDelayMin ?? null,
    volumeRatio,
  });

  const trend: Trend = "unknown";

  const topAirlines: AirlineExposure[] = buildAirlineExposure(attr);

  return {
    airport,
    metrics: {
      flightsTracked: liveActivity,
      onTimePct: baseline?.onTimePct ?? null,
      delayPct: baseline?.delayPct ?? null,
      canceledPct: baseline?.canceledPct ?? null,
      avgDelayMin: baseline?.avgDelayMin ?? null,
      liveArrivals: 0,
      liveDepartures: 0,
      liveVolume: liveActivity,
      expectedVolume: expectedInstantaneous
        ? Math.round(expectedInstantaneous)
        : null,
      volumeRatio,
    },
    baseline,
    disruptionScore: disruption.score,
    status: disruption.status,
    trend,
    factors: disruption.factors,
    topAirlines,
  };
}

function buildAirlineExposure(attr?: AirportAttribution): AirlineExposure[] {
  const exposure: AirlineExposure[] = [];
  if (!attr) return exposure;
  for (const [iata, flights] of attr.airlines) {
    const airline = AIRLINES.find((a) => a.iata === iata);
    if (!airline) continue;
    const b = airlineBaseline(iata);
    exposure.push({
      airline,
      delayPct: b?.delayPct ?? null,
      canceledPct: b?.canceledPct ?? null,
      flights,
    });
  }
  return exposure.sort((a, b) => b.flights - a.flights).slice(0, 5);
}

export function buildAllAirports(states: OpenSkyStates, now: Date): AirportPerformance[] {
  const attribution = attributeAirborne(states);
  return AIRPORTS.map((a) => buildAirportPerformance(attribution, a.iata, now)).sort(
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

export function buildNationalOverview(
  states: OpenSkyStates,
  airports: AirportPerformance[],
  now: Date
): NationalOverview {
  const flightsTracked = countAirborneUs(states);
  const status = deriveNationalStatus(airports);

  // Movement-weighted baseline aggregate (delay/cancel/on-time are baseline,
  // since free live sources do not expose per-flight status).
  let weightSum = 0;
  let delaySum = 0;
  let cancelSum = 0;
  let delayMinSum = 0;
  let delayCount = 0;
  for (const a of airports) {
    const w = a.baseline ? a.baseline.sampleSize : 0;
    if (!a.baseline || w <= 0) continue;
    weightSum += w;
    delaySum += (a.baseline.delayPct ?? 0) * w;
    cancelSum += (a.baseline.canceledPct ?? 0) * w;
    if (a.baseline.avgDelayMin != null) {
      delayMinSum += a.baseline.avgDelayMin * w;
      delayCount += w;
    }
  }
  const delayPct = weightSum ? delaySum / weightSum : null;
  const canceledPct = weightSum ? cancelSum / weightSum : null;
  const avgDelayMin = delayCount ? delayMinSum / delayCount : null;
  const onTimePct =
    delayPct !== null && canceledPct !== null
      ? Math.max(0, Math.min(100, 100 - delayPct - canceledPct))
      : null;

  return {
    status,
    statusLabel: nationalStatusLabel(status),
    flightsTracked,
    onTimePct: onTimePct === null ? null : round1(onTimePct),
    delayPct: delayPct === null ? null : round1(delayPct),
    canceledPct: canceledPct === null ? null : round1(canceledPct),
    avgDelayMin: avgDelayMin === null ? null : Math.round(avgDelayMin),
    delayDeltaPct: null,
    airportsElevated: airports.filter((a) => a.status === "elevated").length,
    airportsHigh: airports.filter((a) => a.status === "high").length,
    airportsSevere: airports.filter((a) => a.status === "severe").length,
    totalAirports: airports.length,
    updatedAt: new Date(states.time * 1000).toISOString(),
    freshness: "live",
    live: true,
  };
}

export function buildAirlinePerformance(
  states: OpenSkyStates
): AirlinePerformance[] {
  const counts = new Map<string, number>();
  for (const s of states.states) {
    if (s.onGround) continue;
    const airline = airlineFromCallsign(s.callsign);
    if (!airline) continue;
    counts.set(airline.iata, (counts.get(airline.iata) ?? 0) + 1);
  }

  // National baseline for context (movement-weighted across all airlines).
  let total = 0;
  let sum = 0;
  for (const a of AIRLINES) {
    const b = airlineBaseline(a.iata);
    if (!b) continue;
    total += 1;
    sum += b.delayPct ?? 0;
  }
  const nationalDelay = total ? sum / total : null;

  return AIRLINES.map((airline) => {
    const b = airlineBaseline(airline.iata);
    const flightsTracked = counts.get(airline.iata) ?? 0;
    const delta =
      b && nationalDelay !== null ? b.delayPct - nationalDelay : null;

    let band: AirlinePerformance["band"] = "near";
    if (delta !== null) {
      if (delta <= -3) band = "outperforming";
      else if (delta >= 3) band = "underperforming";
    }

    return {
      airline,
      flightsTracked,
      onTimePct: b?.onTimePct ?? null,
      delayPct: b?.delayPct ?? null,
      canceledPct: b?.canceledPct ?? null,
      avgDelayMin: b?.avgDelayMin ?? null,
      baselineDelayPct: b?.delayPct ?? null,
      deltaDelayPct: delta === null ? null : round1(delta),
      band,
    };
  }).sort((a, b) => (a.delayPct ?? 0) - (b.delayPct ?? 0));
}

export function dataContext(): {
  baselineSource: string;
  baselinePeriod: string;
  updatedAt: string;
} {
  return {
    baselineSource: baselineSourceLabel(),
    baselinePeriod: baselinePeriodLabel(),
    updatedAt: new Date().toISOString(),
  };
}

export { statusLabel };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Keep the import of airportByIcao available for callers that map ICAO→IATA.
export { airportByIcao };
