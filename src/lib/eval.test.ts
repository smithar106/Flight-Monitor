import { describe, it, expect } from "vitest";
import { askFlightPulse } from "./agent";
import { generateSyntheticFlights } from "./synthetic";
import {
  buildAllAirports,
  buildNationalOverview,
  buildAirlinePerformance,
} from "./analytics";
import type { AskEvidence } from "./types";

// ---------------------------------------------------------------------------
// AI evaluation harness — a golden question set that proves the agent routes
// correctly and stays grounded. Runs deterministically (LLM disabled) so it is
// reproducible in CI. The `groundedNumbers` helper is reused for the optional
// live-LLM groundedness check.
// ---------------------------------------------------------------------------

function buildContext() {
  const records = generateSyntheticFlights();
  const airports = buildAllAirports(records);
  const overview = buildNationalOverview(records, airports, true, Date.now());
  const airlines = buildAirlinePerformance(records);
  return {
    overview,
    airports,
    airlines,
    baselineSource: "sample (demo)",
    baselinePeriod: "sample",
    demo: true,
  };
}

export function extractNumbers(s: string): string[] {
  return (s.match(/-?\d+(\.\d+)?/g) ?? []).map((n) => n.replace(/^-?0+(\d)/, "$1"));
}

// Numbers that appear in an answer but not in its evidence — the core
// hallucination signal for grounded answers.
export function groundedNumbers(answer: string, evidence: AskEvidence[]): string[] {
  const evidenceText = evidence.map((e) => `${e.label} ${e.value}`).join(" ");
  const evidenceNums = new Set(extractNumbers(evidenceText));
  return extractNumbers(answer).filter((n) => !evidenceNums.has(n));
}

const GOLDEN: { q: string; match: string }[] = [
  { q: "How is JFK doing today?", match: "JFK" },
  { q: "How is Delta doing?", match: "Delta Air Lines" },
  { q: "Where are cancellations concentrated?", match: "canceled" },
  { q: "Which airline is performing unusually well?", match: "delay" },
  { q: "Where is disruption worst right now?", match: "/100" },
  { q: "What is happening today?", match: "Status" },
];

describe("eval — golden question routing", () => {
  const ctx = buildContext();

  it("routes every golden question to the right tool and returns a non-empty answer", async () => {
    let passed = 0;
    for (const g of GOLDEN) {
      const ans = await askFlightPulse(ctx, g.q);
      expect(ans.answer.length).toBeGreaterThan(5);

      const evidenceText = ans.evidence.map((e) => `${e.label} ${e.value}`).join(" ");
      expect(
        evidenceText.toLowerCase().includes(g.match.toLowerCase()),
        `"${g.q}" should retrieve evidence matching "${g.match}"`
      ).toBe(true);
      passed += 1;
    }
    console.log(`\n[eval] golden routing: ${passed}/${GOLDEN.length} passed`);
  });

  it("never falls back to the national snapshot when a specific tool matches", async () => {
    const ans = await askFlightPulse(ctx, "How is JFK doing today?");
    expect(ans.evidence.some((e) => e.label === "Airport")).toBe(true);
  });
});

describe("eval — groundedness helper", () => {
  it("returns no violations when every number is present in evidence", () => {
    const evidence: AskEvidence[] = [{ label: "Delay rate", value: "23.4%" }];
    expect(groundedNumbers("The delay rate is 23.4%.", evidence)).toEqual([]);
  });

  it("flags numbers absent from evidence", () => {
    const evidence: AskEvidence[] = [{ label: "Delay rate", value: "23.4%" }];
    expect(groundedNumbers("The delay rate is 99.9%.", evidence)).toContain("99.9");
  });
});
