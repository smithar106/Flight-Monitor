"use client";

import { useMemo, useState } from "react";
import type { AirlinePerformance } from "@/lib/types";
import { fmtPct, fmtInt } from "@/lib/format";

type SortKey =
  | "name"
  | "flights"
  | "onTime"
  | "delay"
  | "cancel"
  | "avgDelay"
  | "delta";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Airline" },
  { key: "flights", label: "In flight", align: "right" },
  { key: "onTime", label: "On-time", align: "right" },
  { key: "delay", label: "Delayed", align: "right" },
  { key: "cancel", label: "Canceled", align: "right" },
  { key: "avgDelay", label: "Avg delay", align: "right" },
  { key: "delta", label: "vs national", align: "right" },
];

function bandMeta(band: AirlinePerformance["band"]) {
  if (band === "outperforming") return { label: "Outperforming", cls: "text-normal border-normal/30 bg-normal-soft" };
  if (band === "underperforming") return { label: "Underperforming", cls: "text-severe border-severe/30 bg-severe-soft" };
  return { label: "Near normal", cls: "text-ink-muted border-line bg-surface-2" };
}

export function Airlines({ airlines }: { airlines: AirlinePerformance[] }) {
  const [sort, setSort] = useState<SortKey>("delay");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    const val = (a: AirlinePerformance, k: SortKey): number | string => {
      switch (k) {
        case "name":
          return a.airline.name;
        case "flights":
          return a.flightsTracked;
        case "onTime":
          return a.onTimePct ?? -1;
        case "delay":
          return a.delayPct ?? -1;
        case "cancel":
          return a.canceledPct ?? -1;
        case "avgDelay":
          return a.avgDelayMin ?? -1;
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-[0.6875rem] uppercase tracking-eyebrow text-ink-faint">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
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
            return (
              <tr key={a.airline.iata} className="transition-colors hover:bg-surface-2">
                <td className="px-3 py-2.5">
                  <div className="font-medium text-ink">{a.airline.name}</div>
                  <div className="font-mono text-[0.6875rem] text-ink-faint">
                    {a.airline.iata}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">
                  {fmtInt(a.flightsTracked)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">
                  {fmtPct(a.onTimePct)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">
                  {fmtPct(a.delayPct)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">
                  {fmtPct(a.canceledPct)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">
                  {a.avgDelayMin !== null ? `${a.avgDelayMin}m` : "—"}
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
      <div className="flex flex-wrap gap-2 border-t border-line px-3 py-2.5 text-[0.6875rem] text-ink-faint">
        <span className={`rounded-full border px-2 py-0.5 ${bandMeta("outperforming").cls}`}>
          Outperforming
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${bandMeta("near").cls}`}>
          Near normal
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${bandMeta("underperforming").cls}`}>
          Underperforming
        </span>
        <span className="ml-auto self-center">
          Relative to the national baseline delay rate
        </span>
      </div>
    </div>
  );
}
