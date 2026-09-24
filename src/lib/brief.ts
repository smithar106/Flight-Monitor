import { generateText, llmCost, llmModel, llmProvider } from "./llm";
import { logRun } from "./mlflow";
import { logJson, incr } from "./observability";
import { BRIEF_SYSTEM } from "./prompts";
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
  demo: boolean;
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
  const live = o.live && !ctx.demo;
  const demo = ctx.demo;
  const top = ctx.airports.slice(0, 5);

  const topAirports = top
    .map((a) =>
      live
        ? `${a.airport.iata} (${a.airport.city}): score ${a.disruptionScore}/100 ${a.status}, ` +
          `delay ${fmtPct(a.metrics.delayPct)} (baseline ${fmtPct(a.baseline?.delayPct ?? null)})`
        : `${a.airport.iata} (${a.airport.city}): score ${a.disruptionScore}/100 ${a.status}, ` +
          `baseline delay ${fmtPct(a.baseline?.delayPct ?? null)}`
    )
    .join("\n");

  const airlineLines = ctx.airlines
    .filter((a) => (live ? a.live : a.baselineDelayPct !== null))
    .slice(0, 6)
    .map((a) =>
      live
        ? `${a.airline.name}: delay ${fmtPct(a.delayPct)}`
        : `${a.airline.name}: baseline delay ${fmtPct(a.baselineDelayPct)}`
    )
    .join("\n");

  return [
    `National status: ${o.statusLabel.toUpperCase()} (${o.status}).`,
    demo
      ? `Demo data: ${o.flightsTracked} synthetic flights across major U.S. carriers.`
      : live
        ? `Yesterday's flights: ${o.flightsTracked} flights across major U.S. carriers.`
        : `No flight data (monthly request limit reached); showing historical baselines.`,
    demo
      ? `Demo performance: on-time ${fmtPct(o.onTimePct)}, delayed ${fmtPct(o.delayPct)}${fmtDelta(o.delayDeltaPct)}, average delay ${o.avgDelayMin ?? "n/a"} min.`
      : live
        ? `Yesterday's performance: on-time ${fmtPct(o.onTimePct)}, delayed ${fmtPct(o.delayPct)}${fmtDelta(o.delayDeltaPct)}, average delay ${o.avgDelayMin ?? "n/a"} min.`
        : `Baseline performance: on-time ${fmtPct(o.onTimePctBaseline)}, delayed ${fmtPct(o.delayPctBaseline)}, average delay ${o.avgDelayMinBaseline ?? "n/a"} min.`,
    `Historical cancellation rate: ${fmtPct(o.canceledPctBaseline)} (baseline).`,
    `Airports elevated: ${o.airportsElevated}, high: ${o.airportsHigh}, severe: ${o.airportsSevere} (of ${o.totalAirports} tracked).`,
    ``,
    `Most disrupted airports (by disruption score):`,
    topAirports,
    ``,
    live ? `Airlines:` : `Airlines (baseline):`,
    airlineLines || "none",
  ].join("\n");
}

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
    ctx.demo
      ? `National conditions are ${o.statusLabel.toLowerCase()} based on ${o.flightsTracked} synthetic demo flights.`
      : `National conditions are ${o.statusLabel.toLowerCase()} with ${o.flightsTracked} flights tracked in yesterday's sample.`
  );
  if (o.delayPct !== null) {
    parts.push(
      `${ctx.demo ? "Demo delay" : "Delay"} is ${fmtPct(o.delayPct)}${fmtDelta(o.delayDeltaPct)}.`
    );
  }
  if (worst) {
    parts.push(
      `The most disrupted airport is ${worst.airport.iata} (${worst.airport.city}) at ${worst.disruptionScore}/100 (${statusLabel(worst.status)}), with a delay rate of ${fmtPct(worst.metrics.delayPct)} against a ${fmtPct(worst.baseline?.delayPct ?? null)} baseline.`
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
    ref("Flights tracked", ctx.overview.live ? String(ctx.overview.flightsTracked) : "n/a"),
    ref(ctx.demo ? "Delayed (demo)" : ctx.overview.live ? "Delayed (yesterday)" : "Delayed (baseline)", fmtPct(ctx.overview.live ? ctx.overview.delayPct : ctx.overview.delayPctBaseline)),
    ref("vs baseline", ctx.overview.delayDeltaPct === null ? "n/a" : `${ctx.overview.delayDeltaPct >= 0 ? "+" : ""}${ctx.overview.delayDeltaPct} pts`),
    ref("Canceled (baseline)", fmtPct(ctx.overview.canceledPctBaseline)),
    ref("Baseline source", `${ctx.baselineSource} — ${ctx.baselinePeriod}`),
  ];

  const r = await generateText(BRIEF_SYSTEM.text, buildUser(facts), 700, 0.3);
  const body = r.text;
  const generatedBy: "llm" | "template" = body ? "llm" : "template";
  const cost = llmCost(r.inputTokens, r.outputTokens);

  incr(generatedBy === "llm" ? "llm.brief" : "llm.brief.fallback");
  incr("llm.calls");
  logJson("llm", { kind: "brief", generated_by: generatedBy, demo: ctx.demo, ms: r.ms, input_tokens: r.inputTokens, output_tokens: r.outputTokens, cost_usd: cost });

  void logRun({
    experiment: "flight-pulse",
    runName: `brief-${Date.now()}`,
    params: {
      generated_by: generatedBy,
      demo: String(ctx.demo),
      status: ctx.overview.statusLabel,
      model: llmModel(),
      provider: llmProvider(),
      prompt_version: BRIEF_SYSTEM.version,
    },
    metrics: {
      latency_ms: r.ms,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      output_chars: body ? body.length : 0,
      cost_usd: cost,
    },
    tags: { kind: "brief" },
    status: generatedBy === "llm" ? "FINISHED" : "FAILED",
  });

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
