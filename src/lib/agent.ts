import { AIRPORTS } from "./airports";
import { AIRLINES } from "./airlines";
import { generateText } from "./llm";
import { logRun } from "./mlflow";
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
  demo: boolean;
}

function fmtPct(n: number | null): string {
  return n === null ? "n/a" : `${n.toFixed(1)}%`;
}

function fmtDelta(n: number | null): string {
  if (n === null) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)} pts`;
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
    const iataMatch = new RegExp(`\\b${al.iata}\\b`).test(upper);
    const nameMatch = upper.includes(al.name.toUpperCase());
    if (iataMatch || nameMatch) {
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
      { label: "Flights tracked", value: String(a.metrics.flightsTracked) },
      { label: "Delay rate", value: fmtPct(a.metrics.delayPct) },
      { label: "vs baseline", value: fmtDelta(a.deltaDelayPct) },
      { label: "Cancellation (baseline)", value: fmtPct(a.baseline?.canceledPct ?? null) },
      { label: "Average delay", value: a.metrics.avgDelayMin != null ? `${a.metrics.avgDelayMin} min` : "n/a" },
    ];
    const reasons = a.factors.join("; ").toLowerCase();
    const narrative =
      `${a.airport.iata} is currently rated ${statusLabel(a.status).toLowerCase()} with a disruption score of ${a.disruptionScore}/100. ` +
      `Its delay rate is ${fmtPct(a.metrics.delayPct)} (${fmtDelta(a.deltaDelayPct)} vs its ${fmtPct(a.baseline?.delayPct ?? null)} baseline) ` +
      `with ${a.metrics.flightsTracked} flights tracked. Why: ${reasons}.`;
    return { title: `Status of ${a.airport.iata}`, facts, narrative };
  }

  // --- Airline-specific questions ---------------------------------------
  if (airline) {
    const facts: AskEvidence[] = [
      { label: "Airline", value: airline.airline.name },
      { label: "Flights tracked", value: String(airline.flightsTracked) },
      { label: "Delay rate", value: fmtPct(airline.delayPct) },
      { label: "vs baseline", value: fmtDelta(airline.deltaDelayPct) },
    ];
    const band =
      airline.band === "outperforming"
        ? "outperforming the national baseline"
        : airline.band === "underperforming"
          ? "underperforming the national baseline"
          : "near the national baseline";
    const narrative =
      `${airline.airline.name} is ${band} with a delay rate of ${fmtPct(airline.delayPct)}` +
      (airline.deltaDelayPct !== null ? ` (${fmtDelta(airline.deltaDelayPct)} vs baseline)` : "") +
      ` and ${airline.flightsTracked} flights tracked.`;
    return { title: `Performance of ${airline.airline.name}`, facts, narrative };
  }

  // --- Cancellation concentration --------------------------------------
  if (/\bcancel/.test(q)) {
    const ranked = [...ctx.airports].sort(
      (a, b) => (b.baseline?.canceledPct ?? 0) - (a.baseline?.canceledPct ?? 0)
    );
    const top = ranked.slice(0, 5);
    const facts: AskEvidence[] = top.map((a) => ({
      label: a.airport.iata,
      value: `${fmtPct(a.baseline?.canceledPct ?? null)} canceled (baseline)`,
    }));
    const narrative =
      `Historical cancellations are most concentrated at ${top.map((a) => a.airport.iata).join(", ")}. ` +
      `${top[0]?.airport.iata} has the highest baseline cancellation rate at ${fmtPct(top[0]?.baseline?.canceledPct ?? null)}.`;
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
      `Note: a live improving/worsening trend requires recent historical data, which is not part of the current baseline.`;
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
      value: `${fmtPct(a.metrics.delayPct)} delayed`,
    }));
    const narrative =
      `Delay rates are highest at ${top.map((a) => a.airport.iata).join(", ")}, ` +
      `with ${top[0]?.airport.iata} at ${fmtPct(top[0]?.metrics.delayPct)}. ` +
      `These are current figures; historical baselines are ${ctx.baselineSource}.`;
    return { title: "Why delays are elevated", facts, narrative };
  }

  // --- Best airline ----------------------------------------------------
  if (/\bbest\b|\bwell\b|\boutperform/.test(q)) {
    const ranked = [...ctx.airlines].sort(
      (a, b) => (a.delayPct ?? a.baselineDelayPct ?? 0) - (b.delayPct ?? b.baselineDelayPct ?? 0)
    );
    const top = ranked.slice(0, 3);
    const facts: AskEvidence[] = top.map((a) => ({
      label: a.airline.name,
      value: `${fmtPct(a.delayPct)} delay`,
    }));
    const narrative =
      `The airlines with the lowest delay rates are ${top.map((a) => a.airline.name).join(", ")}. ` +
      `${top[0]?.airline.name} leads at ${fmtPct(top[0]?.delayPct)}.`;
    return { title: "Best-performing airlines", facts, narrative };
  }

  // --- Default: national snapshot -------------------------------------
  const facts: AskEvidence[] = [
    { label: "Status", value: o.statusLabel },
    { label: "Flights tracked", value: String(o.flightsTracked) },
    { label: "Delayed", value: fmtPct(o.delayPct) },
    { label: "Canceled (baseline)", value: fmtPct(o.canceledPctBaseline) },
    { label: "Airports elevated/high/severe", value: `${o.airportsElevated} / ${o.airportsHigh} / ${o.airportsSevere}` },
  ];
  const worst = ctx.airports[0];
  const narrative =
    `U.S. aviation is ${o.statusLabel.toLowerCase()} with ${o.flightsTracked} flights tracked. ` +
    `The most disrupted airport is ${worst?.airport.iata} at ${worst?.disruptionScore}/100. ` +
    `Delay is ${fmtPct(o.delayPct)}.`;
  return { title: "National operations snapshot", facts, narrative };
}

const SYSTEM = `You answer operational questions for Flight Pulse, a U.S. flight operations intelligence product.
Rules:
- Answer using ONLY the facts provided. Never invent statistics, airports, or airlines.
- If the provided facts do not answer the question, say so plainly.
- Be concise (2-4 sentences). Mention the numbers.
- "demo" figures are synthetic sample data, not real flights — say so plainly. "yesterday" figures are actual results from the previous day; "baseline" figures are historical norms.
- Do not add caveats about being an AI.`;

export async function askFlightPulse(
  ctx: Context,
  question: string
): Promise<AskAnswer> {
  const card = buildEvidenceCard(ctx, question);

  const factsBlock = card.facts.map((f) => `${f.label}: ${f.value}`).join("\n");
  const demoHint = ctx.demo ? "Note: this is synthetic demo data, not real flights.\n\n" : "";
  const user = `${demoHint}Question: ${question}\n\nRelevant data:\n${factsBlock}\n\nAnswer the question using only this data.`;

  const r = await generateText(SYSTEM, user, 500, 0.2);
  const answer = r.text;
  const generatedBy: "llm" | "template" = answer ? "llm" : "template";

  void logRun({
    experiment: "flight-pulse",
    runName: `ask-${Date.now()}`,
    params: {
      question: question.slice(0, 200),
      generated_by: generatedBy,
      demo: String(ctx.demo),
      title: card.title,
    },
    metrics: {
      latency_ms: r.ms,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      output_chars: answer ? answer.length : 0,
      evidence_count: card.facts.length,
    },
    tags: { kind: "ask" },
    status: generatedBy === "llm" ? "FINISHED" : "FAILED",
  });

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
