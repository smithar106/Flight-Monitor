import {
  getLiveFlights,
  TRACKED_CARRIERS,
  liveFlightsAvailable,
} from "./aviationstack";
import { generateSyntheticFlights, SYNTHETIC_CARRIERS } from "./synthetic";
import {
  buildAllAirports,
  buildNationalOverview,
  buildAirlinePerformance,
  buildRoutes,
  dataContext,
} from "./analytics";
import type {
  AirportPerformance,
  AirlinePerformance,
  NationalOverview,
  Route,
} from "./types";

export interface AppContext {
  overview: NationalOverview;
  airports: AirportPerformance[];
  airlines: AirlinePerformance[];
  routes: Route[];
  baselineSource: string;
  baselinePeriod: string;
  live: boolean;
  demo: boolean;
  liveReason: string | null;
  liveUpdatedAt: string | null;
  liveSampleSize: number;
  liveCarriers: number;
  error: string | null;
}

export async function getAppContext(): Promise<AppContext> {
  const real = await getLiveFlights();

  let records = real.records;
  let demo = false;
  let live = real.live;
  let updatedAt = real.updatedAt;
  let carriers = liveFlightsAvailable() ? TRACKED_CARRIERS.length : 0;

  // When the real source is unavailable (e.g. monthly quota exhausted), fall
  // back to clearly-labeled synthetic demo data so the product stays alive.
  if (!live || records.length === 0) {
    records = generateSyntheticFlights();
    demo = true;
    live = true;
    updatedAt = Date.now();
    carriers = SYNTHETIC_CARRIERS;
  }

  const airports = buildAllAirports(records);
  const overview = buildNationalOverview(records, airports, true, updatedAt);
  const airlines = buildAirlinePerformance(records, true);
  const routes = buildRoutes(records);
  const ctx = dataContext();

  return {
    overview,
    airports,
    airlines,
    routes,
    baselineSource: ctx.baselineSource,
    baselinePeriod: ctx.baselinePeriod,
    live,
    demo,
    liveReason: demo ? null : real.reason,
    liveUpdatedAt: new Date(updatedAt).toISOString(),
    liveSampleSize: records.length,
    liveCarriers: carriers,
    error: null,
  };
}
