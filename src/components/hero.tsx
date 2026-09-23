import type { NationalOverview } from "@/lib/types";
import { fmtInt, fmtPct, fmtDate, fmtClock } from "@/lib/format";
import { StatusPill } from "./ui";

function Metric({
  label,
  value,
  sub,
  note,
}: {
  label: string;
  value: string;
  sub?: string;
  note?: string;
}) {
  return (
    <div className="rounded-sm2 border border-line bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[0.6875rem] uppercase tracking-eyebrow text-ink-faint">
          {label}
        </span>
        {note ? <span className="text-[0.625rem] text-ink-faint">{note}</span> : null}
      </div>
      <div className="mt-1.5 font-mono text-[1.75rem] font-semibold leading-none tabular-nums text-ink">
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-xs text-ink-muted">{sub}</div> : null}
    </div>
  );
}

export function Hero({
  overview,
  baselineSource,
}: {
  overview: NationalOverview;
  baselineSource: string;
}) {
  const updated = new Date(overview.updatedAt);
  const disrupted = overview.airportsElevated + overview.airportsHigh + overview.airportsSevere;

  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-eyebrow text-ink-faint">
              U.S. Flight Operations · {fmtDate(updated)}
            </div>
            <h1 className="mt-2 text-display font-semibold tracking-tight text-ink">
              Flight Pulse
            </h1>
            <p className="mt-1 text-ink-muted">
              What is happening across U.S. aviation today — and why it matters.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[0.6875rem] uppercase tracking-eyebrow text-ink-faint">
                National status
              </div>
              <div className="mt-1 text-xl font-semibold tracking-tight text-ink">
                {overview.statusLabel}
              </div>
            </div>
            <StatusPill status={overview.status} size="lg" />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric
            label="Flights tracked"
            value={fmtInt(overview.flightsTracked)}
            note="live"
          />
          <Metric
            label="On-time"
            value={fmtPct(overview.onTimePct)}
            note="baseline"
          />
          <Metric
            label="Delayed"
            value={fmtPct(overview.delayPct)}
            note="baseline"
          />
          <Metric
            label="Canceled"
            value={fmtPct(overview.canceledPct)}
            note="baseline"
          />
          <Metric
            label="Avg delay"
            value={
              overview.avgDelayMin !== null ? `${overview.avgDelayMin} min` : "—"
            }
            note="baseline"
          />
          <Metric
            label="Airports disrupted"
            value={fmtInt(disrupted)}
            sub={`${overview.airportsHigh} high · ${overview.airportsSevere} severe`}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.6875rem] text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-normal animate-pulse-dot" />
            Live air traffic · updated {fmtClock(updated)} UTC
          </span>
          <span>Historical baselines · {baselineSource}</span>
        </div>
      </div>
    </section>
  );
}
