import { AIRPORTS } from "./airports";
import { AIRLINES } from "./airlines";
import { generateText } from "./llm";
import { statusLabel } from "./disruption";
import type {
  AirportPerformance,
  AirlinePerformance,
  NationalOverview,
  AskAnswer,
  AskEvidence,
} from "./types";

interface Context {
  overview: NationalOverview;
  airports: AirportPerformance[];
  airlines: AirlinePerformance[];
  baselineSource: string;
  baselinePeriod: string;
}

function fmtPct(n: number | null): string {
  return n === null ? "n/a" : `${n.toFixed(1)}%`;
}

function findAirport(ctx: Context, q: string): AirportPerformance | null {
  const upper = q.toUpperCase();
  for (const a of AIRPORTS) {
    if (new RegExp(`\\b${a.iata}\\b`).test(upper)) {
      return ctx.airports.find((x) => x.airport.iata === a.iata) ?? null;
    }
  }
  return null;
}

function findAirline(ctx: Context, q: string): AirlinePerformance | null {
  const upper = q.toUpperCase();
  for (const al of AIRLINES) {
    if (upper.includes(al.iata) || upper.includes(al.name.toUpperCase())) {
      return ctx.airlines.find((x) => x.airline.iata === al.iata) ?? null;
    }
  }
  return null;
}

function buildEvidenceCard(
  ctx: Context,
  q: string
): {
  title: string;
  facts: AskEvidence[];
  narrative: string;
} {
  const o = ctx.overview;
  const airport = findAirport(ctx, q);
  const airline = findAirline(ctx, q);

  // --- Airport-specific questions ---------------------------------------
  if (airport) {
    const a = airport;
    const facts: AskEvidence[] = [
      { label: "Airport", value: `${a.airport.name} (${a.airport.iata})` },
      { label: "Disruption score", value: `${a.disruptionScore}/100 — ${statusLabel(a.status)}` },
      { label: "Live aircraft in terminal airspace", value: String(a.metrics.liveVolume) },
      { label: "Delay rate (baseline)", value: fmtPct(a.metrics.delayPct) },
      { label: "Cancellation rate (baseline)", value: fmtPct(a.metrics.canceledPct) },
      { label: "Average delay (baseline)", value: a.metrics.avgDelayMin ? `${a.metrics.avgDelayMin} min` : "n/a" },
    ];
    const reasons = a.factors.join("; ").toLowerCase();
    const narrative =
      `${a.airport.iata} is currently rated ${statusLabel(a.status).toLowerCase()} with a disruption score of ${a.disruptionScore}/100. ` +
      `Its baseline delay rate is ${fmtPct(a.metrics.delayPct)} with a cancellation rate of ${fmtPct(a.metrics.canceledPct)}. ` +
      `${a.metrics.liveVolume} aircraft are currently in its terminal airspace` +
      (a.metrics.expectedVolume ? ` versus ~${a.metrics.expectedVolume} typical for this hour` : "") +
      `. Why: ${reasons}.`;
    return { title: `Status of ${a.airport.iata}`, facts, narrative };
  }

  // --- Airline-specific questions ---------------------------------------
  if (airline) {
    const facts: AskEvidence[] = [
      { label: "Airline", value: airline.airline.name },
      { label: "Aircraft in flight (live)", value: String(airline.flightsTracked) },
      { label: "Delay rate (baseline)", value: fmtPct(airline.delayPct) },
      { label: "vs national baseline", value: airline.deltaDelayPct === null ? "n/a" : `${airline.deltaDelayPct >= 0 ? "+" : ""}${airline.deltaDelayPct} pts` },
      { label: "Cancellation rate (baseline)", value: fmtPct(airline.canceledPct) },
    ];
    const band =
      airline.band === "outperforming"
        ? "outperforming the national baseline"
        : airline.band === "underperforming"
          ? "underperforming the national baseline"
          : "near the national baseline";
    const narrative =
      `${airline.airline.name} is ${band} with a baseline delay rate of ${fmtPct(airline.delayPct)}` +
      (airline.deltaDelayPct !== null ? ` (${airline.deltaDelayPct >= 0 ? "+" : ""}${airline.deltaDelayPct} pts vs national)` : "") +
      ` and ${airline.flightsTracked} aircraft currently in flight.`;
    return { title: `Performance of ${airline.airline.name}`, facts, narrative };
  }

  // --- Cancellation concentration --------------------------------------
  if (/\bcancel/.test(q)) {
    const ranked = [...ctx.airports].sort(
      (a, b) => (b.metrics.canceledPct ?? 0) - (a.metrics.canceledPct ?? 0)
    );
    const top = ranked.slice(0, 5);
    const facts: AskEvidence[] = top.map((a) => ({
      label: a.airport.iata,
      value: `${fmtPct(a.metrics.canceledPct)} canceled`,
    }));
    const narrative =
      `Cancellations (baseline) are most concentrated at ${top.map((a) => a.airport.iata).join(", ")}. ` +
      `${top[0]?.airport.iata} has the highest baseline cancellation rate at ${fmtPct(top[0]?.metrics.canceledPct)}.`;
    return { title: "Where cancellations are concentrated", facts, narrative };
  }

  // --- Deteriorating / improving ---------------------------------------
  if (/\bdeteriorat|\bworsen|\bimprov|\bbetter|\bworst/.test(q)) {
    const ranked = [...ctx.airports].sort(
      (a, b) => b.disruptionScore - a.disruptionScore
    );
    const top = ranked.slice(0, 5);
    const facts: AskEvidence[] = top.map((a) => ({
      label: a.airport.iata,
      value: `${a.disruptionScore}/100 ${statusLabel(a.status)}`,
    }));
    const narrative =
      `The most disrupted airports right now are ${top.map((a) => a.airport.iata).join(", ")}, ` +
      `led by ${top[0]?.airport.iata} at ${top[0]?.disruptionScore}/100. ` +
      `Note: live trend (improving/worsening) requires recent historical data; the current baseline is a static sample.`;
    return { title: "Most disrupted airports", facts, narrative };
  }

  // --- Why are delays high ---------------------------------------------
  if (/\bwhy\b|\bdelay/.test(q)) {
    const ranked = [...ctx.airports].sort(
      (a, b) => (b.metrics.delayPct ?? 0) - (a.metrics.delayPct ?? 0)
    );
    const top = ranked.slice(0, 3);
    const facts: AskEvidence[] = top.map((a) => ({
      label: a.airport.iata,
      value: `${fmtPct(a.metrics.delayPct)} delayed (baseline)`,
    }));
    const narrative =
      `Baseline delay rates are highest at ${top.map((a) => a.airport.iata).join(", ")}, ` +
      `with ${top[0]?.airport.iata} at ${fmtPct(top[0]?.metrics.delayPct)}. These figures are historical baselines (${ctx.baselineSource}); ` +
      `live per-flight delay status is not available from the current free data sources.`;
    return { title: "Why delays are elevated", facts, narrative };
  }

  // --- Best airline ----------------------------------------------------
  if (/\bbest\b|\bwell\b|\boutperform/.test(q)) {
    const ranked = [...ctx.airlines].sort(
      (a, b) => (a.delayPct ?? 0) - (b.delayPct ?? 0)
    );
    const top = ranked.slice(0, 3);
    const facts: AskEvidence[] = top.map((a) => ({
      label: a.airline.name,
      value: `${fmtPct(a.delayPct)} delay (baseline)`,
    }));
    const narrative =
      `The airlines with the lowest baseline delay rates are ${top.map((a) => a.airline.name).join(", ")}. ` +
      `${top[0]?.airline.name} leads at ${fmtPct(top[0]?.delayPct)}.`;
    return { title: "Best-performing airlines", facts, narrative };
  }

  // --- Default: national snapshot -------------------------------------
  const facts: AskEvidence[] = [
    { label: "Status", value: o.statusLabel },
    { label: "Flights tracked (live)", value: String(o.flightsTracked) },
    { label: "Delayed (baseline)", value: fmtPct(o.delayPct) },
    { label: "Canceled (baseline)", value: fmtPct(o.canceledPct) },
    { label: "Airports elevated/high/severe", value: `${o.airportsElevated} / ${o.airportsHigh} / ${o.airportsSevere}` },
  ];
  const worst = ctx.airports[0];
  const narrative =
    `U.S. aviation is ${o.statusLabel.toLowerCase()} with ${o.flightsTracked} aircraft airborne. ` +
    `The most disrupted airport is ${worst?.airport.iata} at ${worst?.disruptionScore}/100. ` +
    `Baseline delay is ${fmtPct(o.delayPct)} and cancellation ${fmtPct(o.canceledPct)}.`;
  return { title: "National operations snapshot", facts, narrative };
}

const SYSTEM = `You answer operational questions for Flight Pulse, a U.S. flight operations intelligence product.
Rules:
- Answer using ONLY the facts provided. Never invent statistics, airports, or airlines.
- If the provided facts do not answer the question, say so plainly.
- Be concise (2-4 sentences). Mention the numbers.
- Do not add caveats about being an AI.`;

export async function askFlightPulse(
  ctx: Context,
  question: string
): Promise<AskAnswer> {
  const card = buildEvidenceCard(ctx, question);

  const factsBlock = card.facts.map((f) => `${f.label}: ${f.value}`).join("\n");
  const user = `Question: ${question}\n\nRelevant data:\n${factsBlock}\n\nAnswer the question using only this data.`;

  const answer = await generateText(SYSTEM, user, 500, 0.2);
  if (answer) {
    return {
      answer,
      generatedBy: "llm",
      evidence: card.facts,
    };
  }
  return {
    answer: card.narrative,
    generatedBy: "template",
    evidence: card.facts,
  };
}
