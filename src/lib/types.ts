export type StatusLevel = "normal" | "elevated" | "high" | "severe";

export type Trend = "improving" | "stable" | "deteriorating" | "unknown";

export type Freshness = "live" | "baseline" | "stale" | "unknown";

export interface AirportRef {
  iata: string;
  icao: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  tz: string;
}

export interface AirlineRef {
  iata: string;
  icao: string;
  name: string;
}

export interface PerformanceBaseline {
  onTimePct: number;
  delayPct: number;
  canceledPct: number;
  avgDelayMin: number;
  sampleSize: number;
  periodLabel: string;
  source: "bts" | "sample";
}

// Live (current) metrics. Delay/on-time are rates over the active-flight
// sample; cancellations are a daily count (a rate would mix a snapshot of
// active flights with a full day of cancellations).
export interface AirportMetrics {
  flightsTracked: number;
  onTimePct: number | null;
  delayPct: number | null;
  avgDelayMin: number | null;
  canceledToday: number;
  live: boolean;
}

export interface AirportPerformance {
  airport: AirportRef;
  metrics: AirportMetrics;
  baseline: PerformanceBaseline | null;
  disruptionScore: number;
  status: StatusLevel;
  trend: Trend;
  deltaDelayPct: number | null;
  factors: string[];
  topAirlines: AirlineExposure[];
}

export interface AirlineExposure {
  airline: AirlineRef;
  delayPct: number | null;
  flights: number;
}

export interface AirlinePerformance {
  airline: AirlineRef;
  flightsTracked: number;
  onTimePct: number | null;
  delayPct: number | null;
  avgDelayMin: number | null;
  canceledToday: number;
  baselineDelayPct: number | null;
  deltaDelayPct: number | null;
  live: boolean;
  band: "outperforming" | "near" | "underperforming";
}

export interface NationalOverview {
  status: StatusLevel;
  statusLabel: string;
  flightsTracked: number;
  onTimePct: number | null;
  delayPct: number | null;
  avgDelayMin: number | null;
  canceledToday: number;
  canceledPctBaseline: number | null;
  delayDeltaPct: number | null;
  airportsElevated: number;
  airportsHigh: number;
  airportsSevere: number;
  totalAirports: number;
  updatedAt: string;
  freshness: Freshness;
  live: boolean;
}

export interface OperationsBrief {
  headline: string;
  body: string;
  generatedBy: "llm" | "template";
  references: BriefReference[];
  updatedAt: string;
}

export interface BriefReference {
  label: string;
  value: string;
}

export interface AskAnswer {
  answer: string;
  generatedBy: "llm" | "template";
  evidence: AskEvidence[];
}

export interface AskEvidence {
  label: string;
  value: string;
}
