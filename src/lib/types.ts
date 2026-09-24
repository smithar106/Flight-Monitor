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

// Live (current) metrics computed from the active-flight sample. Cancellation
// rate is historical only (the live sample is active flights, which are by
// definition not yet canceled).
export interface AirportMetrics {
  flightsTracked: number;
  onTimePct: number | null;
  delayPct: number | null;
  avgDelayMin: number | null;
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
  baselineDelayPct: number | null;
  baselineOnTimePct: number | null;
  baselineAvgDelayMin: number | null;
  deltaDelayPct: number | null;
  live: boolean;
  band: "outperforming" | "near" | "underperforming";
}

export interface Route {
  originIata: string;
  destIata: string;
  flights: number;
  delayPct: number | null;
}

export interface NationalOverview {
  status: StatusLevel;
  statusLabel: string;
  flightsTracked: number;
  onTimePct: number | null;
  delayPct: number | null;
  avgDelayMin: number | null;
  canceledPctBaseline: number | null;
  onTimePctBaseline: number | null;
  delayPctBaseline: number | null;
  avgDelayMinBaseline: number | null;
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
