import { generateText } from "./llm";
import type {
  AirportPerformance,
  AirlinePerformance,
  NationalOverview,
  OperationsBrief,
  BriefReference,
} from "./types";
import { statusLabel } from "./disruption";

interface Context {
  overview: NationalOverview;
  airports: AirportPerformance[];
  airlines: AirlinePerformance[];
  baselineSource: string;
  baselinePeriod: string;
}

function ref(label: string, value: string): BriefReference {
  return { label, value };
}

function fmtPct(n: number | null): string {
  return n === null ? "n/a" : `${n.toFixed(1)}%`;
}

function buildFacts(ctx: Context): string {
  const o = ctx.overview;
  const top = ctx.airports.slice(0, 5);
  const worst = top[0];
  const topAirports = top
    .map((a) =>
      `${a.airport.iata} (${a.airport.city}): score ${a.disruptionScore}/100 ${a.status}, ` +
      `delay ${fmtPct(a.metrics.delayPct)}, cancel ${fmtPct(a.metrics.canceledPct)}, ` +
      `live aircraft ${a.metrics.liveVolume} vs ~${a.metrics.expectedVolume ?? "n/a"} expected`
    )
    .join("\n");

  const airlineLines = ctx.airlines
    .filter((a) => a.flightsTracked > 0)
    .slice(0, 6)
    .map(
      (a) =>
        `${a.airline.name}: delay ${fmtPct(a.delayPct)}, ${a.flightsTracked} aircraft in flight`
    )
    .join("\n");

  return [
    `National status: ${o.statusLabel.toUpperCase()} (${o.status}).`,
    `Flights tracked (live, airborne over continental U.S.): ${o.flightsTracked}.`,
    `Baseline performance (${ctx.baselineSource}, ${ctx.baselinePeriod}): on-time ${fmtPct(o.onTimePct)}, delayed ${fmtPct(o.delayPct)}, canceled ${fmtPct(o.canceledPct)}, average delay ${o.avgDelayMin ?? "n/a"} min.`,
    `Airports elevated: ${o.airportsElevated}, high: ${o.airportsHigh}, severe: ${o.airportsSevere} (of ${o.totalAirports} tracked).`,
    ``,
    `Most disrupted airports (by disruption score):`,
    topAirports,
    ``,
    `Airlines with aircraft currently in flight:`,
    airlineLines || "none detected",
  ].join("\n");
}

const SYSTEM = `You write concise operations briefs for Flight Pulse, a U.S. flight operations intelligence product.

Rules:
- Explain ONLY the numbers provided in the context. Never invent statistics, airports, or airlines.
- If a number is "n/a" or missing, do not discuss it.
- Distinguish clearly between LIVE data (flights tracked, live aircraft) and BASELINE data (delay/cancel/on-time percentages, which are historical baselines).
- Write 3-5 sentences of tight, journalistic prose plus a short "What to watch" line.
- Use airport IATA codes with city names on first mention.
- Do not use bullet points. Return plain prose.`;

function buildUser(facts: string): string {
  return `Here is the current structured data for U.S. flight operations:\n\n${facts}\n\nWrite the operations brief.`;
}

function templateBody(ctx: Context): string {
  const o = ctx.overview;
  const worst = ctx.airports[0];
  const second = ctx.airports[1];
  const topAirline = ctx.airlines.reduce<AirlinePerformance | null>(
    (best, a) => (a.flightsTracked > (best?.flightsTracked ?? 0) ? a : best),
    null
  );

  const parts: string[] = [];
  parts.push(
    `National conditions are ${o.statusLabel.toLowerCase()} with ${o.flightsTracked} aircraft currently airborne over the continental United States.`
  );
  if (worst) {
    parts.push(
      `The most disrupted airport is ${worst.airport.iata} (${worst.airport.city}) at ${worst.disruptionScore}/100 (${statusLabel(worst.status)}), with a baseline delay rate of ${fmtPct(worst.metrics.delayPct)} and ${worst.metrics.liveVolume} aircraft currently in terminal airspace.`
    );
  }
  if (second && second !== worst) {
    parts.push(
      `${second.airport.iata} (${second.airport.city}) follows at ${second.disruptionScore}/100 (${statusLabel(second.status)}).`
    );
  }
  if (topAirline) {
    parts.push(
      `${topAirline.airline.name} currently shows the most aircraft in flight (${topAirline.flightsTracked}).`
    );
  }
  parts.push(
    `Delay, cancellation, and on-time figures shown here are ${ctx.baselineSource === "BTS" ? "BTS" : "sample"} baselines (${ctx.baselinePeriod}); live per-flight delay status is not available from the current free data sources.`
  );
  return parts.join(" ");
}

export async function buildOperationsBrief(ctx: Context): Promise<OperationsBrief> {
  const facts = buildFacts(ctx);
  const references: BriefReference[] = [
    ref("Status", ctx.overview.statusLabel),
    ref("Flights tracked (live)", String(ctx.overview.flightsTracked)),
    ref("Delayed (baseline)", fmtPct(ctx.overview.delayPct)),
    ref("Canceled (baseline)", fmtPct(ctx.overview.canceledPct)),
    ref("Average delay (baseline)", ctx.overview.avgDelayMin ? `${ctx.overview.avgDelayMin} min` : "n/a"),
    ref("Baseline source", `${ctx.baselineSource} — ${ctx.baselinePeriod}`),
  ];

  const body = await generateText(SYSTEM, buildUser(facts), 700, 0.3);
  if (body) {
    return {
      headline: `National conditions: ${ctx.overview.statusLabel}`,
      body,
      generatedBy: "llm",
      references,
      updatedAt: ctx.overview.updatedAt,
    };
  }
  return {
    headline: `National conditions: ${ctx.overview.statusLabel}`,
    body: templateBody(ctx),
    generatedBy: "template",
    references,
    updatedAt: ctx.overview.updatedAt,
  };
}
