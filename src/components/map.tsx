"use client";

import { useEffect, useMemo, useState } from "react";
import { geoAlbersUsa, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { AirportPerformance, Route } from "@/lib/types";
import { STATUS_META } from "@/lib/format";

export interface MapProps {
  airports: AirportPerformance[];
  routes: Route[];
  onSelect: (a: AirportPerformance) => void;
}

const WIDTH = 960;
const HEIGHT = 560;

function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bend = Math.min(dist * 0.18, 42);
  const cy = my - bend;
  return `M ${x1} ${y1} Q ${mx} ${cy} ${x2} ${y2}`;
}

export function SvgMap({ airports, routes, onSelect }: MapProps) {
  const [nation, setNation] = useState<any>(null);
  const [hovered, setHovered] = useState<AirportPerformance | null>(null);
  const [focusedIata, setFocusedIata] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/us-states.json")
      .then((r) => r.json())
      .then((topo) => {
        if (active && topo?.objects?.nation) {
          setNation(feature(topo, topo.objects.nation));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const projection = useMemo(() => {
    const p = geoAlbersUsa().scale(1300).translate([WIDTH / 2, HEIGHT / 2 + 10]);
    if (nation) p.fitExtent([[12, 12], [WIDTH - 12, HEIGHT - 12]], nation);
    return p;
  }, [nation]);

  const path = useMemo(() => geoPath(projection), [projection]);
  const graticule = useMemo(() => geoGraticule10(), []);

  const points = useMemo(
    () =>
      airports.map((a) => ({
        a,
        pos: projection([a.airport.lon, a.airport.lat]),
      })),
    [airports, projection]
  );

  const posByIata = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const { a, pos } of points) {
      if (pos) m.set(a.airport.iata, pos);
    }
    return m;
  }, [points]);

  const maxFlights = useMemo(
    () => routes.reduce((mx, r) => Math.max(mx, r.flights), 1),
    [routes]
  );

  const radiusFor = (score: number) => 3 + Math.max(0, Math.min(score, 100)) / 18;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="group"
        aria-label="United States airport disruption map. Use Tab to move between airports, Enter to select."
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => {
          setHovered(null);
          setCursor(null);
        }}
      >
        <path d={path(graticule) ?? undefined} fill="none" stroke="#EDF0F3" strokeWidth={0.5} />
        {nation && (
          <path
            d={path(nation) ?? undefined}
            fill="#FFFFFF"
            stroke="#D5DAE1"
            strokeWidth={0.75}
          />
        )}

        {routes.map((r) => {
          const p1 = posByIata.get(r.originIata);
          const p2 = posByIata.get(r.destIata);
          if (!p1 || !p2) return null;
          const w = 0.6 + (r.flights / maxFlights) * 1.8;
          const opacity = 0.12 + (r.flights / maxFlights) * 0.28;
          return (
            <path
              key={`${r.originIata}-${r.destIata}`}
              d={arcPath(p1[0], p1[1], p2[0], p2[1])}
              fill="none"
              stroke="#2563EB"
              strokeWidth={w}
              strokeLinecap="round"
              opacity={opacity}
            />
          );
        })}

        {points.map(({ a, pos }) => {
          if (!pos) return null;
          const meta = STATUS_META[a.status];
          const r = radiusFor(a.disruptionScore);
          const focused = focusedIata === a.airport.iata;
          return (
            <g
              key={a.airport.iata}
              role="button"
              tabIndex={0}
              aria-label={`${a.airport.iata}, ${a.airport.city}. ${meta.label}, disruption score ${a.disruptionScore} out of 100.`}
              onMouseEnter={() => setHovered(a)}
              onMouseLeave={() => setHovered((h) => (h?.airport.iata === a.airport.iata ? null : h))}
              onFocus={() => setFocusedIata(a.airport.iata)}
              onBlur={() => setFocusedIata((cur) => (cur === a.airport.iata ? null : cur))}
              onClick={() => onSelect(a)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(a);
                }
              }}
              className="cursor-pointer outline-none"
            >
              <circle cx={pos[0]} cy={pos[1]} r={r + 5} fill="transparent" />
              {focused && (
                <circle
                  cx={pos[0]}
                  cy={pos[1]}
                  r={r + 4}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth={2}
                />
              )}
              <circle
                cx={pos[0]}
                cy={pos[1]}
                r={r}
                fill={meta.hex}
                stroke="#FFFFFF"
                strokeWidth={1}
                opacity={hovered && hovered.airport.iata !== a.airport.iata ? 0.55 : 1}
                style={{ transition: "opacity 150ms ease" }}
              />
              {r >= 5 && (
                <text
                  x={pos[0]}
                  y={pos[1] - r - 4}
                  textAnchor="middle"
                  className="fill-ink-muted"
                  style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                >
                  {a.airport.iata}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hovered && cursor && (
        <div
          className="pointer-events-none absolute z-10 min-w-[150px] rounded-lg border border-line bg-surface px-3 py-2 shadow-raised"
          style={{ left: cursor.x + 14, top: cursor.y + 10 }}
        >
          <div className="text-xs font-semibold text-ink">
            {hovered.airport.iata} · {hovered.airport.city}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-ink-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[hovered.status].dot}`} />
            {STATUS_META[hovered.status].label} · {hovered.disruptionScore}/100
          </div>
        </div>
      )}
    </div>
  );
}
