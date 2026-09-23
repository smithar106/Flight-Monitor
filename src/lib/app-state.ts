import {
  buildAllAirports,
  buildNationalOverview,
  buildAirlinePerformance,
  dataContext,
} from "./analytics";
import { fetchUsStates, type OpenSkyStates } from "./opensky";
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
  error: string | null;
}

function emptyStates(): OpenSkyStates {
  return { time: Math.floor(Date.now() / 1000), states: [] };
}

export async function getAppContext(): Promise<AppContext> {
  let states: OpenSkyStates;
  let live = true;
  let error: string | null = null;
  try {
    states = await fetchUsStates();
  } catch (e) {
    states = emptyStates();
    live = false;
    error = e instanceof Error ? e.message : "OpenSky unavailable";
  }

  const now = new Date();
  const airports = buildAllAirports(states, now);
  const overview = buildNationalOverview(states, airports, now);
  const airlines = buildAirlinePerformance(states);
  const ctx = dataContext();

  return {
    overview,
    airports,
    airlines,
    baselineSource: ctx.baselineSource,
    baselinePeriod: ctx.baselinePeriod,
    live,
    error,
  };
}
