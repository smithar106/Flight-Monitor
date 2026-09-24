"use client";

import { useEffect } from "react";
import type { AirportPerformance } from "@/lib/types";
import { fmtPct, fmtInt } from "@/lib/format";
import { ScoreBadge, StatusPill } from "./ui";

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="text-[0.8125rem] text-ink-muted">{label}</span>
      <span className="text-right">
        <span className="font-mono text-[0.875rem] tabular-nums text-ink">{value}</span>
        {sub ? <span className="ml-1.5 text-[0.75rem] text-ink-faint">{sub}</span> : null}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[0.6875rem] font-medium uppercase tracking-eyebrow text-ink-faint">
      {children}
    </h3>
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
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md animate-slide-in overflow-y-auto border-l border-line bg-surface shadow-drawer">
        <div className="sticky top-0 flex items-start justify-between border-b border-line bg-surface/95 px-6 py-5 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-semibold tracking-tight text-ink">
                {a.airport.iata}
              </span>
              <StatusPill status={a.status} size="sm" />
            </div>
            <div className="mt-1 text-[0.875rem] text-ink">{a.airport.name}</div>
            <div className="text-[0.75rem] text-ink-faint">
              {a.airport.city}, {a.airport.state}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2 px-4 py-3.5">
            <div>
              <div className="text-[0.6875rem] font-medium uppercase tracking-eyebrow text-ink-faint">
                Disruption score
              </div>
              <div className="mt-0.5 text-[0.75rem] text-ink-muted">Explainable 0–100 composite</div>
            </div>
            <ScoreBadge score={a.disruptionScore} status={a.status} />
          </div>

          {a.metrics.flightsTracked > 0 && (
            <div className="mt-7">
              <SectionTitle>Live</SectionTitle>
              <div className="mt-1 divide-y divide-line">
                <Row label="Flights tracked" value={fmtInt(a.metrics.flightsTracked)} />
                <Row label="On time" value={fmtPct(a.metrics.onTimePct)} />
                <Row
                  label="Delayed"
                  value={fmtPct(a.metrics.delayPct)}
                  sub={
                    a.deltaDelayPct !== null
                      ? `${a.deltaDelayPct >= 0 ? "+" : ""}${a.deltaDelayPct} pts`
                      : undefined
                  }
                />
                <Row
                  label="Average delay"
                  value={a.metrics.avgDelayMin !== null ? `${a.metrics.avgDelayMin} min` : "—"}
                />
              </div>
              {!a.metrics.live && (
                <p className="mt-2 text-[0.75rem] text-ink-faint">
                  Sample too small to report percentages for this airport.
                </p>
              )}
            </div>
          )}

          <div className="mt-7">
            <SectionTitle>Historical baseline</SectionTitle>
            <div className="mt-1 divide-y divide-line">
              <Row label="On time" value={fmtPct(a.baseline?.onTimePct ?? null)} />
              <Row label="Delayed" value={fmtPct(a.baseline?.delayPct ?? null)} />
              <Row label="Canceled" value={fmtPct(a.baseline?.canceledPct ?? null)} />
              <Row
                label="Average delay"
                value={a.baseline?.avgDelayMin != null ? `${a.baseline.avgDelayMin} min` : "—"}
              />
            </div>
            <p className="mt-2 text-[0.75rem] text-ink-faint">
              {a.baseline?.periodLabel ?? "Baseline unavailable"}
            </p>
          </div>

          <div className="mt-7">
            <SectionTitle>Why this score</SectionTitle>
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
            <div className="mt-7">
              <SectionTitle>Airlines in sample</SectionTitle>
              <div className="mt-1 divide-y divide-line">
                {a.topAirlines.map((al) => (
                  <div key={al.airline.iata} className="flex items-center justify-between py-2.5">
                    <div>
                      <span className="text-[0.8125rem] text-ink">{al.airline.name}</span>
                      <span className="ml-1.5 font-mono text-[0.6875rem] text-ink-faint">
                        {al.airline.iata}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[0.8125rem] tabular-nums text-ink">
                        {al.flights} flights
                      </div>
                      <div className="text-[0.6875rem] text-ink-faint">{fmtPct(al.delayPct)} delay</div>
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
