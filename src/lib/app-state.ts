import {
  getLiveFlights,
  TRACKED_CARRIERS,
  liveFlightsAvailable,
} from "./aviationstack";
import {
  buildAllAirports,
  buildNationalOverview,
  buildAirlinePerformance,
  dataContext,
} from "./analytics";
import type {
  AirportPerformance,
  AirlinePerformance,
  NationalOverview,
} from "./types";

export interface AppContext {
  overview: NationalOverview;
  airports: AirportPerformance[];
  airlines: AirlinePerformance[];
  baselineSource: string;
  baselinePeriod: string;
  live: boolean;
  liveReason: string | null;
  liveUpdatedAt: string | null;
  liveSampleSize: number;
  liveCarriers: number;
  error: string | null;
}

export async function getAppContext(): Promise<AppContext> {
  const live = await getLiveFlights();

  const airports = buildAllAirports(live.records);
  const overview = buildNationalOverview(
    live.records,
    airports,
    live.live,
    live.updatedAt
  );
  const airlines = buildAirlinePerformance(live.records, live.live);
  const ctx = dataContext();

  return {
    overview,
    airports,
    airlines,
    baselineSource: ctx.baselineSource,
    baselinePeriod: ctx.baselinePeriod,
    live: live.live,
    liveReason: live.reason,
    liveUpdatedAt: live.live ? new Date(live.updatedAt).toISOString() : null,
    liveSampleSize: live.records.length,
    liveCarriers: liveFlightsAvailable() ? TRACKED_CARRIERS.length : 0,
    error: null,
  };
}
