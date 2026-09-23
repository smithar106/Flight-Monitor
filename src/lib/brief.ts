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

function fmtDelta(n: number | null): string {
  if (n === null) return "";
  return ` (${n >= 0 ? "+" : ""}${n.toFixed(1)} pts vs baseline)`;
}

function buildFacts(ctx: Context): string {
  const o = ctx.overview;
  const top = ctx.airports.slice(0, 5);
  const topAirports = top
    .map(
      (a) =>
        `${a.airport.iata} (${a.airport.city}): score ${a.disruptionScore}/100 ${a.status}, ` +
        `live delay ${fmtPct(a.metrics.delayPct)} (baseline ${fmtPct(a.baseline?.delayPct ?? null)}), ` +
        `${a.metrics.canceledToday} canceled today, ${a.metrics.flightsTracked} flights tracked`
    )
    .join("\n");

  const airlineLines = ctx.airlines
    .filter((a) => a.live)
    .slice(0, 6)
    .map(
      (a) =>
        `${a.airline.name}: live delay ${fmtPct(a.delayPct)}, ${a.flightsTracked} flights tracked`
    )
    .join("\n");

  return [
    `National status: ${o.statusLabel.toUpperCase()} (${o.status}).`,
    `Live sample: ${o.flightsTracked} flights tracked across major U.S. carriers.`,
    `Live performance: on-time ${fmtPct(o.onTimePct)}, delayed ${fmtPct(o.delayPct)}${fmtDelta(o.delayDeltaPct)}, ${o.canceledToday} canceled today, average delay ${o.avgDelayMin ?? "n/a"} min.`,
    `Airports elevated: ${o.airportsElevated}, high: ${o.airportsHigh}, severe: ${o.airportsSevere} (of ${o.totalAirports} tracked).`,
    ``,
    `Most disrupted airports (by disruption score):`,
    topAirports,
    ``,
    `Airlines with live data:`,
    airlineLines || "none",
  ].join("\n");
}

const SYSTEM = `You write concise operations briefs for Flight Pulse, a U.S. flight operations intelligence product.

Rules:
- Explain ONLY the numbers provided in the context. Never invent statistics, airports, or airlines.
- If a number is "n/a" or missing, do not discuss it.
- "Live" figures are current flight status; "baseline" figures are historical norms. Preserve that distinction.
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
    `National conditions are ${o.statusLabel.toLowerCase()} with ${o.flightsTracked} flights tracked in the live sample.`
  );
  if (o.delayPct !== null) {
    parts.push(
      `Live delay is ${fmtPct(o.delayPct)}${fmtDelta(o.delayDeltaPct)} with ${o.canceledToday} cancellations today.`
    );
  }
  if (worst) {
    parts.push(
      `The most disrupted airport is ${worst.airport.iata} (${worst.airport.city}) at ${worst.disruptionScore}/100 (${statusLabel(worst.status)}), with a live delay rate of ${fmtPct(worst.metrics.delayPct)} against a ${fmtPct(worst.baseline?.delayPct ?? null)} baseline.`
    );
  }
  if (second && second !== worst) {
    parts.push(
      `${second.airport.iata} (${second.airport.city}) follows at ${second.disruptionScore}/100 (${statusLabel(second.status)}).`
    );
  }
  if (topAirline) {
    parts.push(
      `${topAirline.airline.name} currently shows the most tracked flights (${topAirline.flightsTracked}).`
    );
  }
  parts.push(
    `Baselines are ${ctx.baselineSource === "BTS" ? "BTS" : "sample"} values (${ctx.baselinePeriod}).`
  );
  return parts.join(" ");
}

export async function buildOperationsBrief(ctx: Context): Promise<OperationsBrief> {
  const facts = buildFacts(ctx);
  const references: BriefReference[] = [
    ref("Status", ctx.overview.statusLabel),
    ref("Flights tracked (live)", String(ctx.overview.flightsTracked)),
    ref("Delayed (live)", fmtPct(ctx.overview.delayPct)),
    ref("vs baseline", ctx.overview.delayDeltaPct === null ? "n/a" : `${ctx.overview.delayDeltaPct >= 0 ? "+" : ""}${ctx.overview.delayDeltaPct} pts`),
    ref("Canceled today", String(ctx.overview.canceledToday)),
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
