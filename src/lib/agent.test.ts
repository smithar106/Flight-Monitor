import { describe, it, expect } from "vitest";
import { askFlightPulse } from "./agent";
import { buildAllAirports, buildNationalOverview } from "./analytics";
import type { OpenSkyStates } from "./opensky";

const empty: OpenSkyStates = { time: 1758000000, states: [] };

function context() {
  const airports = buildAllAirports(empty, new Date());
  const overview = buildNationalOverview(empty, airports, new Date());
  return {
    overview,
    airports,
    airlines: [] as never[],
    baselineSource: "sample (demo)",
    baselinePeriod: "sample",
  };
}

describe("askFlightPulse", () => {
  it("answers an airport-specific question with evidence", async () => {
    const answer = await askFlightPulse(context(), "How is JFK doing today?");
    expect(answer.answer.length).toBeGreaterThan(10);
    expect(answer.evidence.some((e) => e.label === "Airport")).toBe(true);
    expect(answer.evidence.find((e) => e.label === "Airport")?.value).toContain("JFK");
  });

  it("falls back to a template answer when the LLM is unavailable", async () => {
    const answer = await askFlightPulse(context(), "Why are delays high today?");
    expect(answer.generatedBy).toBe("template");
    expect(answer.answer).toContain("delay");
  });

  it("handles cancellation-concentration questions", async () => {
    const answer = await askFlightPulse(context(), "Where are cancellations concentrated?");
    expect(answer.evidence.length).toBeGreaterThan(0);
  });

  it("answers a generic question with the national snapshot", async () => {
    const answer = await askFlightPulse(context(), "What is happening today?");
    expect(answer.evidence.some((e) => e.label === "Status")).toBe(true);
  });
});
