"use client";

import type { AirportPerformance } from "@/lib/types";
import { fmtPct, fmtInt } from "@/lib/format";
import { StatusPill } from "./ui";

export function Ranking({
  airports,
  onSelect,
  limit = 8,
}: {
  airports: AirportPerformance[];
  onSelect: (a: AirportPerformance) => void;
  limit?: number;
}) {
  const top = airports.slice(0, limit);

  return (
    <ol className="divide-y divide-line">
      {top.map((a, i) => (
        <li key={a.airport.iata}>
          <button
            onClick={() => onSelect(a)}
            className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
          >
            <span className="w-5 font-mono text-xs tabular-nums text-ink-faint">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-ink">
                  {a.airport.iata}
                </span>
                <span className="truncate text-xs text-ink-muted">
                  {a.airport.city}, {a.airport.state}
                </span>
              </div>
              <div className="mt-0.5 text-[0.6875rem] text-ink-faint">
                {fmtPct(a.metrics.delayPct)} delayed · {fmtPct(a.metrics.canceledPct)} canceled
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm font-semibold tabular-nums text-ink">
                {a.disruptionScore}
              </div>
              <div className="text-[0.625rem] text-ink-faint">
                {fmtInt(a.metrics.liveVolume)} acft
              </div>
            </div>
            <StatusPill status={a.status} size="sm" />
          </button>
        </li>
      ))}
    </ol>
  );
}
