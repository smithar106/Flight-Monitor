import { describe, it, expect } from "vitest";
import {
  buildAllAirports,
  buildNationalOverview,
  buildAirlinePerformance,
} from "./analytics";
import type { OpenSkyStates } from "./opensky";
import { airportBaseline, airlineBaseline } from "./baselines";

const empty: OpenSkyStates = { time: 1758000000, states: [] };

function state(partial: Partial<OpenSkyStates["states"][number]> = {}) {
  return {
    icao24: "abc123",
    callsign: "UAL123",
    originCountry: "United States",
    longitude: -87.9,
    latitude: 41.97,
    baroAltitude: 3000,
    onGround: false,
    velocity: 150,
    verticalRate: -500,
    timePosition: 1758000000,
    ...partial,
  };
}

describe("baselines", () => {
  it("loads the sample baseline and returns airport rows", () => {
    const b = airportBaseline("ORD");
    expect(b).not.toBeNull();
    expect(b!.delayPct).toBeGreaterThan(0);
    expect(b!.source).toBe("sample");
  });

  it("returns airline rows", () => {
    const b = airlineBaseline("DL");
    expect(b).not.toBeNull();
    expect(b!.delayPct).toBeGreaterThan(0);
  });
});

describe("analytics", () => {
  it("builds performance for every reference airport, sorted by score", () => {
    const list = buildAllAirports(empty, new Date());
    expect(list).toHaveLength(40);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].disruptionScore).toBeGreaterThanOrEqual(
        list[i].disruptionScore
      );
    }
  });

  it("computes a national overview with zero live flights when data is empty", () => {
    const airports = buildAllAirports(empty, new Date());
    const overview = buildNationalOverview(empty, airports, new Date());
    expect(overview.flightsTracked).toBe(0);
    expect(overview.live).toBe(true);
    expect(overview.statusLabel).toBeTruthy();
  });

  it("counts airborne flights as tracked", () => {
    const states: OpenSkyStates = {
      time: 1758000000,
      states: [state(), state({ onGround: true }), state()],
    };
    const airports = buildAllAirports(states, new Date());
    const overview = buildNationalOverview(states, airports, new Date());
    expect(overview.flightsTracked).toBe(2);
  });

  it("builds airline performance for all carriers", () => {
    const list = buildAirlinePerformance(empty);
    expect(list).toHaveLength(12);
    expect(list[0].airline.name).toBeTruthy();
  });
});
