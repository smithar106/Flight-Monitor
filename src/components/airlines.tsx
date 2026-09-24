"use client";

import { useMemo, useState } from "react";
import type { AirlinePerformance } from "@/lib/types";
import { fmtPct, fmtInt } from "@/lib/format";

type SortKey = "name" | "flights" | "onTime" | "delay" | "avgDelay" | "delta";

interface Column {
  key: SortKey;
  label: string;
  align?: "right";
}

const FULL_COLUMNS: Column[] = [
  { key: "name", label: "Airline" },
  { key: "flights", label: "Tracked", align: "right" },
  { key: "onTime", label: "On-time", align: "right" },
  { key: "delay", label: "Delayed", align: "right" },
  { key: "avgDelay", label: "Avg delay", align: "right" },
  { key: "delta", label: "Δ vs baseline", align: "right" },
];

const BASELINE_COLUMNS: Column[] = FULL_COLUMNS.filter((c) => c.key !== "flights");

function bandMeta(band: AirlinePerformance["band"]) {
  if (band === "outperforming") return { label: "Outperforming", cls: "text-normal border-normal/30 bg-normal-soft" };
  if (band === "underperforming") return { label: "Underperforming", cls: "text-severe border-severe/30 bg-severe-soft" };
  return { label: "Near normal", cls: "text-ink-muted border-line bg-surface-2" };
}

export function Airlines({ airlines }: { airlines: AirlinePerformance[] }) {
  const [sort, setSort] = useState<SortKey>("delay");
  const [asc, setAsc] = useState(false);

  const anyLive = useMemo(() => airlines.some((a) => a.live), [airlines]);
  const columns = anyLive ? FULL_COLUMNS : BASELINE_COLUMNS;

  const mostDelayed = useMemo(() => {
    const live = airlines.filter((a) => a.live && a.delayPct !== null);
    if (live.length > 0) {
      return live.reduce((w, a) => (a.delayPct! > (w?.delayPct ?? -1) ? a : w), live[0]);
    }
    const base = airlines.filter((a) => a.baselineDelayPct !== null);
    if (base.length === 0) return null;
    return base.reduce((w, a) => (a.baselineDelayPct! > (w?.baselineDelayPct ?? -1) ? a : w), base[0]);
  }, [airlines]);

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    const val = (a: AirlinePerformance, k: SortKey): number | string => {
      switch (k) {
        case "name":
          return a.airline.name;
        case "flights":
          return a.flightsTracked;
        case "onTime":
          return a.onTimePct ?? a.baselineOnTimePct ?? -1;
        case "delay":
          return a.delayPct ?? a.baselineDelayPct ?? -1;
        case "avgDelay":
          return a.avgDelayMin ?? a.baselineAvgDelayMin ?? -1;
        case "delta":
          return a.deltaDelayPct ?? -999;
      }
    };
    return [...airlines].sort((a, b) => {
      const va = val(a, sort);
      const vb = val(b, sort);
      if (typeof va === "string" && typeof vb === "string")
        return va.localeCompare(vb) * (asc ? 1 : -1);
      return ((va as number) - (vb as number)) * dir;
    });
  }, [airlines, sort, asc]);

  function toggle(key: SortKey) {
    if (sort === key) setAsc(!asc);
    else {
      setSort(key);
      setAsc(key === "name");
    }
  }

  return (
    <div>
      {mostDelayed && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 text-[0.8125rem]">
          <span className="text-ink-muted">Most delayed carrier</span>
          <span className="font-medium text-ink">{mostDelayed.airline.name}</span>
          <span className="font-mono text-severe">
            {fmtPct(mostDelayed.live ? mostDelayed.delayPct : mostDelayed.baselineDelayPct)} delayed
          </span>
          <span className="text-[0.6875rem] text-ink-faint">
            ({mostDelayed.live ? "live" : "baseline"})
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-[0.6875rem] uppercase tracking-eyebrow text-ink-faint">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sort === c.key ? (asc ? "ascending" : "descending") : "none"}
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 font-medium ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                  onClick={() => toggle(c.key)}
                >
                  <span className={sort === c.key ? "text-ink" : ""}>
                    {c.label}
                    {sort === c.key ? (asc ? " ↑" : " ↓") : ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((a) => {
              const band = bandMeta(a.band);
              const onTime = a.live ? a.onTimePct : a.baselineOnTimePct;
              const delay = a.live ? a.delayPct : a.baselineDelayPct;
              const avgDelay = a.live ? a.avgDelayMin : a.baselineAvgDelayMin;
              return (
                <tr key={a.airline.iata} className="transition-colors hover:bg-surface-2">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{a.airline.name}</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[0.625rem] ${band.cls}`}>
                        {band.label}
                      </span>
                    </div>
                    <div className="font-mono text-[0.6875rem] text-ink-faint">
                      {a.airline.iata}
                    </div>
                  </td>
                  {anyLive && (
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">
                      {fmtInt(a.flightsTracked)}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">
                    {fmtPct(onTime)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">
                    {fmtPct(delay)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">
                    {avgDelay !== null ? `${avgDelay}m` : "—"}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                      a.deltaDelayPct !== null && a.deltaDelayPct > 0
                        ? "text-severe"
                        : a.deltaDelayPct !== null && a.deltaDelayPct < 0
                          ? "text-normal"
                          : "text-ink-faint"
                    }`}
                  >
                    {a.deltaDelayPct === null
                      ? "—"
                      : `${a.deltaDelayPct > 0 ? "+" : ""}${a.deltaDelayPct}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-[0.6875rem] text-ink-faint">
        {anyLive ? (
          <span>Sample covers {airlines.filter((a) => a.live).length} of {airlines.length} carriers</span>
        ) : (
          <span className="text-ink-muted">Showing historical baselines · no data</span>
        )}
        <span className="ml-auto">Δ vs the airline's historical baseline</span>
      </div>
    </div>
  );
}
