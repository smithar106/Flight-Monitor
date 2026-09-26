import { AIRPORTS } from "./airports";
import { AIRLINES } from "./airlines";
import { generateText, generateJson, llmCost, llmModel, llmProvider } from "./llm";
import { logRun } from "./mlflow";
import { logJson, incr } from "./observability";
import { ASK_SYSTEM, TOOL_SELECT_SYSTEM } from "./prompts";
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

type ToolName =
  | "airport"
  | "airline"
  | "cancel"
  | "rank_airports"
  | "delays"
  | "rank_airlines"
  | "national";

interface ToolCall {
  tool: ToolName;
  args: Record<string, string>;
}

function fmtPct(n: number | null): string {
  return n === null ? "n/a" : `${n.toFixed(1)}%`;
}

function fmtDelta(n: number | null): string {
  if (n === null) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)} pts`;
}

interface Card {
  title: string;
  facts: AskEvidence[];
  narrative: string;
}

// --- Deterministic tool executors -----------------------------------------

function airportCard(a: AirportPerformance): Card {
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

function airlineCard(a: AirlinePerformance): Card {
  const facts: AskEvidence[] = [
    { label: "Airline", value: a.airline.name },
    { label: "Flights tracked", value: String(a.flightsTracked) },
    { label: "Delay rate", value: fmtPct(a.delayPct) },
    { label: "vs baseline", value: fmtDelta(a.deltaDelayPct) },
  ];
  const band =
    a.band === "outperforming"
      ? "outperforming the national baseline"
      : a.band === "underperforming"
        ? "underperforming the national baseline"
        : "near the national baseline";
  const narrative =
    `${a.airline.name} is ${band} with a delay rate of ${fmtPct(a.delayPct)}` +
    (a.deltaDelayPct !== null ? ` (${fmtDelta(a.deltaDelayPct)} vs baseline)` : "") +
    ` and ${a.flightsTracked} flights tracked.`;
  return { title: `Performance of ${a.airline.name}`, facts, narrative };
}

function cancelCard(ctx: Context): Card {
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

function rankAirportsCard(ctx: Context): Card {
  const ranked = [...ctx.airports].sort((a, b) => b.disruptionScore - a.disruptionScore);
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

function delaysCard(ctx: Context): Card {
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

function bestAirlinesCard(ctx: Context): Card {
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

function nationalCard(ctx: Context): Card {
  const o = ctx.overview;
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

function dispatchTool(ctx: Context, tool: ToolName, args: Record<string, string>): Card {
  switch (tool) {
    case "airport": {
      const iata = (args.airport ?? "").toUpperCase();
      const a = ctx.airports.find((x) => x.airport.iata === iata);
      return a ? airportCard(a) : nationalCard(ctx);
    }
    case "airline": {
      const a = matchAirline(ctx, args.airline ?? "");
      return a ? airlineCard(a) : nationalCard(ctx);
    }
    case "cancel":
      return cancelCard(ctx);
    case "rank_airports":
      return rankAirportsCard(ctx);
    case "delays":
      return delaysCard(ctx);
    case "rank_airlines":
      return bestAirlinesCard(ctx);
    default:
      return nationalCard(ctx);
  }
}

// --- Tool selection --------------------------------------------------------

const TOOLS: ToolName[] = [
  "airport",
  "airline",
  "cancel",
  "rank_airports",
  "delays",
  "rank_airlines",
  "national",
];

function findAirportIata(q: string): string | null {
  const upper = q.toUpperCase();
  for (const a of AIRPORTS) {
    if (new RegExp(`\\b${a.iata}\\b`).test(upper)) return a.iata;
  }
  return null;
}

function airlineBrand(name: string): string {
  return name
    .replace(/\s+Air Lines$/, "")
    .replace(/\s+Airlines$/, "")
    .replace(/\s+Airways$/, "")
    .replace(/\s+Air$/, "");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findAirlineIata(q: string): string | null {
  const upper = q.toUpperCase();
  for (const al of AIRLINES) {
    const brand = airlineBrand(al.name).toUpperCase();
    const matches =
      new RegExp(`\\b${al.iata}\\b`).test(upper) ||
      new RegExp(`\\b${escapeRe(brand)}\\b`).test(upper) ||
      upper.includes(al.name.toUpperCase());
    if (matches) return al.iata;
  }
  return null;
}

function matchAirline(ctx: Context, key: string): AirlinePerformance | null {
  const k = key.toUpperCase();
  return (
    ctx.airlines.find(
      (x) =>
        x.airline.iata === k ||
        x.airline.name.toUpperCase() === k ||
        airlineBrand(x.airline.name).toUpperCase() === k
    ) ?? null
  );
}

// Deterministic keyword fallback — always available, no LLM required.
function keywordSelect(q: string): ToolCall {
  const iata = findAirportIata(q);
  if (iata) return { tool: "airport", args: { airport: iata } };
  const airline = findAirlineIata(q);
  if (airline) return { tool: "airline", args: { airline } };
  if (/\bcancel/.test(q)) return { tool: "cancel", args: {} };
  if (/\bdeteriorat|\bworsen|\bimprov|\bbetter|\bworst/.test(q)) return { tool: "rank_airports", args: {} };
  if (/\bwhy\b|\bdelay/.test(q)) return { tool: "delays", args: {} };
  if (/\bbest\b|\bwell\b|\boutperform/.test(q)) return { tool: "rank_airlines", args: {} };
  return { tool: "national", args: {} };
}

async function llmSelect(q: string): Promise<ToolCall | null> {
  const sel = await generateJson<{ tool?: string; args?: Record<string, string> }>(
    TOOL_SELECT_SYSTEM.text,
    `Question: ${q}`
  );
  if (!sel || !sel.tool || !TOOLS.includes(sel.tool as ToolName)) return null;
  return { tool: sel.tool as ToolName, args: sel.args ?? {} };
}

// --- Orchestration ---------------------------------------------------------

export async function askFlightPulse(
  ctx: Context,
  question: string
): Promise<AskAnswer> {
  const llmTool = await llmSelect(question);
  const sel = llmTool ?? keywordSelect(question);
  const card = dispatchTool(ctx, sel.tool, sel.args);

  const factsBlock = card.facts.map((f) => `${f.label}: ${f.value}`).join("\n");
  const demoHint = ctx.demo ? "Note: this is synthetic demo data, not real flights.\n\n" : "";
  const user = `${demoHint}Question: ${question}\n\nRelevant data:\n${factsBlock}\n\nAnswer the question using only this data.`;

  const r = await generateText(ASK_SYSTEM.text, user, 500, 0.2);
  const answer = r.text;
  const generatedBy: "llm" | "template" = answer ? "llm" : "template";
  const cost = llmCost(r.inputTokens, r.outputTokens);

  incr(generatedBy === "llm" ? "llm.ask" : "llm.ask.fallback");
  incr("llm.calls");
  logJson("llm", {
    kind: "ask",
    tool: sel.tool,
    routed_by: llmTool ? "llm" : "keyword",
    generated_by: generatedBy,
    demo: ctx.demo,
    ms: r.ms,
    input_tokens: r.inputTokens,
    output_tokens: r.outputTokens,
    cost_usd: cost,
  });

  void logRun({
    experiment: "flight-pulse",
    runName: `ask-${Date.now()}`,
    params: {
      question: question.slice(0, 200),
      tool: sel.tool,
      routed_by: llmTool ? "llm" : "keyword",
      generated_by: generatedBy,
      demo: String(ctx.demo),
      model: llmModel(),
      provider: llmProvider(),
      prompt_version: ASK_SYSTEM.version,
    },
    metrics: {
      latency_ms: r.ms,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      output_chars: answer ? answer.length : 0,
      evidence_count: card.facts.length,
      cost_usd: cost,
    },
    tags: { kind: "ask", tool: sel.tool, fallback: generatedBy === "llm" ? "false" : "true" },
    status: "FINISHED",
  });

  if (answer) {
    return { answer, generatedBy: "llm", evidence: card.facts };
  }
  return { answer: card.narrative, generatedBy: "template", evidence: card.facts };
}
