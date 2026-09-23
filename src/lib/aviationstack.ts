// AviationStack live flight client. Returns real per-flight status/delay data
// for a bounded sample of major U.S. carriers, with caching and a monthly
// request-budget guard (the free tier is 100 requests/month).

import { AIRLINES } from "./airlines";

const BASE = "https://api.aviationstack.com/v1/flights";

export type FlightStatus =
  | "scheduled"
  | "active"
  | "landed"
  | "cancelled"
  | "diverted"
  | "unknown";

export interface FlightRecord {
  airlineIata: string | null;
  originIata: string | null;
  destIata: string | null;
  status: FlightStatus;
  departureDelayMin: number | null;
  arrivalDelayMin: number | null;
}

export interface LiveFlightsResult {
  records: FlightRecord[];
  live: boolean;
  reason: string | null;
  updatedAt: number;
  requestCount: number;
}

interface RawFlight {
  flight_date?: string;
  flight_status?: string;
  departure?: { iata?: string | null; delay?: number | null };
  arrival?: { iata?: string | null; delay?: number | null };
  airline?: { iata?: string | null; icao?: string | null };
  flight?: {
    iata?: string | null;
    icao?: string | null;
    codeshared?: { airline_iata?: string | null; flight_iata?: string | null } | null;
  };
}

const DEFAULT_CARRIERS = ["UA", "AA", "DL", "WN", "B6", "AS", "NK", "F9"];

function key(): string | null {
  return process.env.AVIATIONSTACK_API_KEY ?? null;
}

function carriers(): string[] {
  const raw = process.env.AVIATIONSTACK_CARRIERS;
  if (raw) {
    const list = raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (list.length) return list;
  }
  return DEFAULT_CARRIERS;
}

function maxRequestsPerMonth(): number {
  const n = parseInt(process.env.AVIATIONSTACK_MAX_REQUESTS ?? "80", 10);
  return Number.isFinite(n) && n > 0 ? n : 80;
}

function ttlMs(): number {
  const n = parseInt(process.env.AVIATIONSTACK_TTL_MS ?? String(10 * 60 * 1000), 10);
  return Number.isFinite(n) && n > 0 ? n : 10 * 60 * 1000;
}

// In-memory budget counter (resets monthly by keying on the current month).
let budgetMonth = "";
let budgetUsed = 0;
let cache: { at: number; data: LiveFlightsResult } | null = null;

function normalizeStatus(s: string | undefined): FlightStatus {
  switch (s) {
    case "scheduled":
    case "active":
    case "landed":
    case "cancelled":
    case "diverted":
      return s;
    default:
      return "unknown";
  }
}

function normalize(raw: RawFlight[]): FlightRecord[] {
  const seen = new Set<string>();
  const records: FlightRecord[] = [];
  for (const f of raw) {
    const marketingAirline = (f.airline?.iata ?? "").toUpperCase() || null;
    const op = f.flight?.codeshared;
    const operatingAirline = (op?.airline_iata ?? "").toUpperCase() || marketingAirline;
    const opFlightIata = (op?.flight_iata ?? f.flight?.iata ?? "").toUpperCase();

    const origin = (f.departure?.iata ?? "").toUpperCase() || null;
    const dest = (f.arrival?.iata ?? "").toUpperCase() || null;

    const depDelay = f.departure?.delay != null ? f.departure.delay : null;
    const arrDelay = f.arrival?.delay != null ? f.arrival.delay : null;

    const dedupKey = opFlightIata || `${f.flight_date ?? ""}|${marketingAirline ?? ""}|${origin ?? ""}|${dest ?? ""}`;
    if (dedupKey && seen.has(dedupKey)) continue;
    if (dedupKey) seen.add(dedupKey);

    records.push({
      airlineIata: operatingAirline,
      originIata: origin,
      destIata: dest,
      status: normalizeStatus(f.flight_status),
      departureDelayMin: depDelay,
      arrivalDelayMin: arrDelay,
    });
  }
  return records;
}

async function fetchCarrier(carrierIata: string, status: string): Promise<RawFlight[]> {
  const params = new URLSearchParams({
    access_key: key()!,
    flight_status: status,
    airline_iata: carrierIata,
    limit: "100",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${BASE}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`AviationStack HTTP ${res.status}`);
    const json = (await res.json()) as { data?: RawFlight[]; error?: unknown };
    if (json.error) throw new Error(`AviationStack error: ${JSON.stringify(json.error)}`);
    return json.data ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export function liveFlightsAvailable(): boolean {
  return Boolean(key());
}

export async function getLiveFlights(): Promise<LiveFlightsResult> {
  if (!key()) {
    return {
      records: [],
      live: false,
      reason: "AVIATIONSTACK_API_KEY not configured",
      updatedAt: Date.now(),
      requestCount: 0,
    };
  }

  const month = new Date().toISOString().slice(0, 7);
  if (month !== budgetMonth) {
    budgetMonth = month;
    budgetUsed = 0;
  }

  if (cache && Date.now() - cache.at < ttlMs()) {
    return cache.data;
  }

  const needed = carriers().length * 2; // active + cancelled per carrier
  if (budgetUsed + needed > maxRequestsPerMonth()) {
    return {
      records: cache?.data.records ?? [],
      live: false,
      reason: "Monthly request budget reached — live data paused",
      updatedAt: cache?.at ?? Date.now(),
      requestCount: budgetUsed,
    };
  }

  try {
    const all: RawFlight[] = [];
    for (const c of carriers()) {
      for (const status of ["active", "cancelled"]) {
        const batch = await fetchCarrier(c, status);
        budgetUsed += 1;
        all.push(...batch);
      }
    }
    const result: LiveFlightsResult = {
      records: normalize(all),
      live: true,
      reason: null,
      updatedAt: Date.now(),
      requestCount: budgetUsed,
    };
    cache = { at: Date.now(), data: result };
    return result;
  } catch (e) {
    return {
      records: cache?.data.records ?? [],
      live: false,
      reason: e instanceof Error ? e.message : "AviationStack unavailable",
      updatedAt: cache?.at ?? Date.now(),
      requestCount: budgetUsed,
    };
  }
}

// Keep AIRLINES import used (carrier list is validated against known airlines).
export const TRACKED_CARRIERS = AIRLINES.filter((a) =>
  carriers().includes(a.iata)
);
