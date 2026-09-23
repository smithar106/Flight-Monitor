"use client";

import { useEffect } from "react";
import type { AirportPerformance } from "@/lib/types";
import { fmtPct, fmtInt } from "@/lib/format";
import { ScoreBadge, StatusPill } from "./ui";

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-[0.8125rem] text-ink-muted">{label}</span>
      <span className="text-right">
        <span className="font-mono text-sm tabular-nums text-ink">{value}</span>
        {sub ? <span className="ml-1 text-[0.6875rem] text-ink-faint">{sub}</span> : null}
      </span>
    </div>
  );
}

export function AirportDrawer({
  airport,
  onClose,
}: {
  airport: AirportPerformance | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (airport) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [airport, onClose]);

  if (!airport) return null;
  const a = airport;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-line bg-surface shadow-panel-lg">
        <div className="sticky top-0 flex items-start justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-ink">
                {a.airport.iata}
              </span>
              <StatusPill status={a.status} size="sm" />
            </div>
            <div className="mt-0.5 text-sm text-ink-muted">{a.airport.name}</div>
            <div className="text-[0.6875rem] text-ink-faint">
              {a.airport.city}, {a.airport.state}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-sm2 border border-line text-ink-muted hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-center justify-between rounded-sm2 border border-line bg-surface-2 px-4 py-3">
            <div>
              <div className="text-[0.6875rem] uppercase tracking-eyebrow text-ink-faint">
                Disruption score
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">
                Explainable 0–100 composite
              </div>
            </div>
            <ScoreBadge score={a.disruptionScore} status={a.status} />
          </div>

          <div className="mt-6">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-eyebrow text-ink-faint">
              Live
            </h3>
            <div className="mt-1 divide-y divide-line">
              <Row label="Flights tracked" value={fmtInt(a.metrics.flightsTracked)} />
              <Row label="On-time" value={fmtPct(a.metrics.onTimePct)} />
              <Row
                label="Delayed"
                value={fmtPct(a.metrics.delayPct)}
                sub={
                  a.deltaDelayPct !== null
                    ? `${a.deltaDelayPct >= 0 ? "+" : ""}${a.deltaDelayPct} pts vs baseline`
                    : undefined
                }
              />
              <Row label="Canceled today" value={fmtInt(a.metrics.canceledToday)} />
              <Row
                label="Average delay"
                value={a.metrics.avgDelayMin !== null ? `${a.metrics.avgDelayMin} min` : "—"}
              />
            </div>
            {!a.metrics.live && (
              <p className="mt-2 text-[0.6875rem] text-ink-faint">
                Live sample too small to report percentages for this airport.
              </p>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-eyebrow text-ink-faint">
              Historical baseline
            </h3>
            <div className="mt-1 divide-y divide-line">
              <Row label="On-time" value={fmtPct(a.baseline?.onTimePct ?? null)} />
              <Row label="Delayed" value={fmtPct(a.baseline?.delayPct ?? null)} />
              <Row label="Canceled" value={fmtPct(a.baseline?.canceledPct ?? null)} />
              <Row
                label="Average delay"
                value={a.baseline?.avgDelayMin != null ? `${a.baseline.avgDelayMin} min` : "—"}
              />
            </div>
            <p className="mt-2 text-[0.6875rem] text-ink-faint">
              {a.baseline?.periodLabel ?? "Baseline unavailable"}
            </p>
          </div>

          <div className="mt-6">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-eyebrow text-ink-faint">
              Why this score
            </h3>
            <ul className="mt-2 space-y-1.5">
              {a.factors.map((f, i) => (
                <li key={i} className="flex gap-2 text-[0.8125rem] text-ink-muted">
                  <span className="text-ink-faint">·</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {a.topAirlines.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-eyebrow text-ink-faint">
                Airlines in terminal airspace
              </h3>
              <div className="mt-2 divide-y divide-line">
                {a.topAirlines.map((al) => (
                  <div key={al.airline.iata} className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-sm text-ink">{al.airline.name}</span>
                      <span className="ml-1.5 font-mono text-[0.6875rem] text-ink-faint">
                        {al.airline.iata}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm tabular-nums text-ink">
                        {al.flights} acft
                      </div>
                      <div className="text-[0.6875rem] text-ink-faint">
                        {fmtPct(al.delayPct)} delay
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
