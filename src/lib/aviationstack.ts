// AviationStack live flight client. Returns real per-flight delay/status data
// for a small sample of major U.S. carriers, with caching, a persistent monthly
// request budget, and rate-limit backoff. The free tier is 100 requests/month,
// so the default is intentionally lean: four carriers, active-only, refreshed
// about once a day.

import { z } from "zod";
import { AIRLINES } from "./airlines";
import { logRun } from "./mlflow";
import { logJson, incr } from "./observability";
import { counterAdd, counterGet } from "./store";

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

// Runtime schema validation at the API boundary — malformed rows are dropped
// rather than flowing silently into the analytics.
const RawFlightSchema = z.object({
  flight_date: z.string().optional(),
  flight_status: z.string().optional(),
  departure: z
    .object({ iata: z.string().nullable().optional(), delay: z.coerce.number().nullable().optional() })
    .optional(),
  arrival: z
    .object({ iata: z.string().nullable().optional(), delay: z.coerce.number().nullable().optional() })
    .optional(),
  airline: z
    .object({ iata: z.string().nullable().optional(), icao: z.string().nullable().optional() })
    .optional(),
  flight: z
    .object({
      iata: z.string().nullable().optional(),
      icao: z.string().nullable().optional(),
      codeshared: z
        .object({ airline_iata: z.string().nullable().optional(), flight_iata: z.string().nullable().optional() })
        .nullable()
        .optional(),
    })
    .optional(),
});

const DEFAULT_CARRIERS = ["UA", "AA", "DL"];

// "Yesterday" in US Eastern time (YYYY-MM-DD) — the ingest runs once a day and
// shows the previous day's actual (landed) results.
function flightDate(): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

// Persistent budget (Postgres when available, else a JSON file) so the request
// count survives restarts and redeploys within a deployment.
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
  const n = parseInt(process.env.AVIATIONSTACK_MAX_REQUESTS ?? "90", 10);
  return Number.isFinite(n) && n > 0 ? n : 90;
}

function ttlMs(): number {
  const n = parseInt(
    process.env.AVIATIONSTACK_TTL_MS ?? String(24 * 60 * 60 * 1000),
    10
  );
  return Number.isFinite(n) && n > 0 ? n : 24 * 60 * 60 * 1000;
}

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
  let valid = 0;
  let invalid = 0;
  for (const item of raw) {
    const parsed = RawFlightSchema.safeParse(item);
    if (!parsed.success) {
      invalid += 1;
      continue;
    }
    valid += 1;
    const f = parsed.data;

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
  incr("ingest.records_valid", valid);
  incr("ingest.records_invalid", invalid);
  return records;
}

async function fetchCarrierYesterday(carrierIata: string): Promise<RawFlight[]> {
  const params = new URLSearchParams({
    access_key: key()!,
    flight_date: flightDate(),
    flight_status: "landed",
    airline_iata: carrierIata,
    limit: "100",
  });
  const url = `${BASE}?${params.toString()}`;

  const backoff = [600, 1800, 4000];
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
      });
      const json = (await res.json().catch(() => null)) as
        | { data?: RawFlight[]; error?: { code?: string; message?: string } }
        | null;

      if (json?.error) {
        const code = json.error.code;
        if (code === "usage_limit_reached" || code === "rate_limit_reached") {
          throw new Error("AviationStack monthly request limit reached — live data resumes next month");
        }
        throw new Error(`AviationStack error: ${json.error.message ?? code ?? "unknown"}`);
      }

      if (res.status === 429 && attempt < backoff.length) {
        await new Promise((r) => setTimeout(r, backoff[attempt]));
        continue;
      }
      if (!res.ok) throw new Error(`AviationStack HTTP ${res.status}`);
      return json?.data ?? [];
    } finally {
      clearTimeout(timer);
    }
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
  const carrierList = carriers();
  const used = await counterGet("aviationstack-requests", month);

  if (cache && Date.now() - cache.at < ttlMs()) {
    return cache.data;
  }

  const needed = carrierList.length;
  if (used + needed > maxRequestsPerMonth()) {
    return {
      records: cache?.data.records ?? [],
      live: false,
      reason: "Monthly request budget reached — live data paused until next month",
      updatedAt: cache?.at ?? Date.now(),
      requestCount: used,
    };
  }

  const start = Date.now();
  try {
    const all: RawFlight[] = [];
    for (const c of carrierList) {
      const batch = await fetchCarrierYesterday(c);
      all.push(...batch);
    }
    const requestCount = await counterAdd(
      "aviationstack-requests",
      month,
      carrierList.length
    );

    const records = normalize(all);
    const result: LiveFlightsResult = {
      records,
      live: true,
      reason: null,
      updatedAt: Date.now(),
      requestCount,
    };
    cache = { at: Date.now(), data: result };

    incr("ingest.fetch");
    incr("ingest.records", records.length);
    logJson("ingest", {
      source: "aviationstack",
      carriers: carrierList.join(","),
      records: records.length,
      requests: requestCount,
      latency_ms: Date.now() - start,
    });

    void logRun({
      experiment: "flight-pulse",
      runName: `fetch-${Date.now()}`,
      params: { source: "aviationstack", carriers: carrierList.join(","), date: flightDate() },
      metrics: {
        latency_ms: Date.now() - start,
        requests: requestCount,
        records: records.length,
      },
      tags: { kind: "infra" },
      status: "FINISHED",
    });

    return result;
  } catch (e) {
    void logRun({
      experiment: "flight-pulse",
      runName: `fetch-${Date.now()}`,
      params: { source: "aviationstack", carriers: carrierList.join(",") },
      metrics: { latency_ms: Date.now() - start, requests: used, records: 0 },
      tags: { kind: "infra", error: e instanceof Error ? e.message : "unknown" },
      status: "FAILED",
    });
    return {
      records: cache?.data.records ?? [],
      live: false,
      reason: e instanceof Error ? e.message : "AviationStack unavailable",
      updatedAt: cache?.at ?? Date.now(),
      requestCount: used,
    };
  }
}

export const TRACKED_CARRIERS = AIRLINES.filter((a) =>
  carriers().includes(a.iata)
);
