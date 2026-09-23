import { describe, it, expect } from "vitest";
import {
  buildAllAirports,
  buildNationalOverview,
  buildAirlinePerformance,
  MIN_SAMPLE,
} from "./analytics";
import type { FlightRecord } from "./aviationstack";
import { airportBaseline, airlineBaseline } from "./baselines";

function flight(partial: Partial<FlightRecord> = {}): FlightRecord {
  return {
    airlineIata: "UA",
    originIata: "ORD",
    destIata: "JFK",
    status: "active",
    departureDelayMin: 5,
    arrivalDelayMin: null,
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
    const list = buildAllAirports([]);
    expect(list).toHaveLength(40);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].disruptionScore).toBeGreaterThanOrEqual(
        list[i].disruptionScore
      );
    }
  });

  it("computes a national overview with zero flights when there is no live data", () => {
    const airports = buildAllAirports([]);
    const overview = buildNationalOverview([], airports, false, Date.now());
    expect(overview.flightsTracked).toBe(0);
    expect(overview.live).toBe(false);
    expect(overview.statusLabel).toBeTruthy();
  });

  it("reports live delay only above the minimum sample size", () => {
    const few = buildAllAirports([flight()]);
    const ord = few.find((a) => a.airport.iata === "ORD")!;
    expect(ord.metrics.flightsTracked).toBeGreaterThan(0);
    expect(ord.metrics.live).toBe(false); // below MIN_SAMPLE

    const many = Array.from({ length: MIN_SAMPLE * 2 }, () => flight());
    const list = buildAllAirports(many);
    const ordMany = list.find((a) => a.airport.iata === "ORD")!;
    expect(ordMany.metrics.live).toBe(true);
    expect(ordMany.metrics.delayPct).not.toBeNull();
  });

  it("counts delayed and on-time flights correctly", () => {
    const records = Array.from({ length: MIN_SAMPLE * 2 }, () => flight());
    records.push(flight({ departureDelayMin: 30 }));
    const list = buildAllAirports(records);
    const ord = list.find((a) => a.airport.iata === "ORD")!;
    expect(ord.metrics.delayPct).toBeGreaterThan(0);
  });

  it("builds airline performance for all carriers", () => {
    const list = buildAirlinePerformance([], false);
    expect(list).toHaveLength(12);
    expect(list[0].airline.name).toBeTruthy();
  });
});
