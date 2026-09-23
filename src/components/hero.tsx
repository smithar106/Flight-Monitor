import type { NationalOverview } from "@/lib/types";
import { fmtInt, fmtPct, fmtDate, fmtClock } from "@/lib/format";
import { Metric, StatusPill } from "./ui";

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const good = value <= 0;
  return (
    <span className={good ? "text-normal" : "text-severe"}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)} pts vs normal
    </span>
  );
}

function summary(o: NationalOverview): string {
  const disrupted = o.airportsElevated + o.airportsHigh + o.airportsSevere;
  switch (o.status) {
    case "normal":
      return "U.S. aviation is operating close to historical norms.";
    case "elevated":
      return `${disrupted} major airports are showing elevated disruption, with delays above their normal range.`;
    case "high":
      return `Disruption is elevated across the network — ${o.airportsHigh} airports are high and ${o.airportsSevere} severe.`;
    case "severe":
      return `Severe disruption across the network — ${o.airportsSevere} airports are critically impacted.`;
  }
}

export function Hero({
  overview,
  baselineSource,
  live,
  liveReason,
  liveUpdatedAt,
  liveSampleSize,
  liveCarriers,
}: {
  overview: NationalOverview;
  baselineSource: string;
  live: boolean;
  liveReason: string | null;
  liveUpdatedAt: string | null;
  liveSampleSize: number;
  liveCarriers: number;
}) {
  const updated = liveUpdatedAt ? new Date(liveUpdatedAt) : new Date(overview.updatedAt);
  const disrupted = overview.airportsElevated + overview.airportsHigh + overview.airportsSevere;

  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <div className="text-[0.6875rem] font-medium uppercase tracking-eyebrow text-ink-faint">
              National status · {fmtDate(updated)}
            </div>
            <h1 className="mt-3 text-display font-semibold tracking-tight text-ink">
              {overview.statusLabel}
            </h1>
            <p className="mt-3 text-lead text-ink-muted">{summary(overview)}</p>
            <div className="mt-4">
              <StatusPill status={overview.status} size="lg" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[0.75rem] text-ink-faint lg:mt-2">
            {live ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-normal animate-pulse-dot" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-elevated">
                <span className="h-1.5 w-1.5 rounded-full bg-elevated" />
                Live data unavailable
              </span>
            )}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-line pt-8 sm:grid-cols-3 lg:grid-cols-6">
          <Metric value={fmtInt(overview.flightsTracked)} label="Flights tracked" />
          <Metric value={fmtPct(overview.onTimePct)} label="On time" />
          <Metric
            value={fmtPct(overview.delayPct)}
            label="Delayed"
            sub={<Delta value={overview.delayDeltaPct} />}
          />
          <Metric label="Canceled (baseline)" value={fmtPct(overview.canceledPctBaseline)} />
          <Metric
            value={overview.avgDelayMin !== null ? `${overview.avgDelayMin} min` : "—"}
            label="Average delay"
          />
          <Metric
            value={fmtInt(disrupted)}
            label="Airports disrupted"
            sub={`${overview.airportsHigh} high · ${overview.airportsSevere} severe`}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.75rem] text-ink-faint">
          {live ? (
            <span>
              Live sample · {liveSampleSize} flights across {liveCarriers} carriers · updated{" "}
              {fmtClock(updated)} UTC
            </span>
          ) : (
            <span className="text-elevated">
              Live data unavailable{liveReason ? ` — ${liveReason}` : ""}
            </span>
          )}
          <span>Historical baselines · {baselineSource}</span>
        </div>
      </div>
    </section>
  );
}
