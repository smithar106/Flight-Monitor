"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { AirportPerformance, Route } from "@/lib/types";
import { STATUS_META } from "@/lib/format";
import { SvgMap, type MapProps } from "./map";

function airportGeoJson(airports: AirportPerformance[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: airports.map((a) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [a.airport.lon, a.airport.lat] },
      properties: {
        iata: a.airport.iata,
        city: a.airport.city,
        score: a.disruptionScore,
        status: a.status,
      },
    })),
  };
}

function routeGeoJson(routes: Route[], airports: AirportPerformance[]): GeoJSON.FeatureCollection {
  const coord = new Map(airports.map((a) => [a.airport.iata, [a.airport.lon, a.airport.lat]]));
  const features: GeoJSON.Feature[] = [];
  for (const r of routes) {
    const from = coord.get(r.originIata);
    const to = coord.get(r.destIata);
    if (!from || !to) continue;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [from, to] },
      properties: { flights: r.flights },
    });
  }
  return { type: "FeatureCollection", features };
}

export function MapboxMap(props: MapProps) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => active && setToken(c.mapboxToken ?? ""))
      .catch(() => active && setToken(""));
    return () => {
      active = false;
    };
  }, []);

  if (token === null) {
    return <div className="h-[480px] w-full animate-pulse rounded-lg bg-surface-3" />;
  }
  if (!token) {
    return <SvgMap {...props} />;
  }
  return <MapboxGl token={token} {...props} />;
}

function MapboxGl({
  token,
  airports,
  routes,
  onSelect,
}: MapProps & { token: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const airportsRef = useRef(airports);
  airportsRef.current = airports;
  const routesRef = useRef(routes);
  routesRef.current = routes;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-98.5, 39.5],
      zoom: 2.6,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("routes", { type: "geojson", data: routeGeoJson(routesRef.current, airportsRef.current) });
      map.addSource("airports", { type: "geojson", data: airportGeoJson(airportsRef.current) });

      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        paint: {
          "line-color": "#2563EB",
          "line-width": ["interpolate", ["linear"], ["get", "flights"], 1, 0.5, 25, 2.5],
          "line-opacity": 0.28,
        },
      });

      map.addLayer({
        id: "airports",
        type: "circle",
        source: "airports",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 4, 100, 11],
          "circle-color": [
            "match",
            ["get", "status"],
            "normal", STATUS_META.normal.hex,
            "elevated", STATUS_META.elevated.hex,
            "high", STATUS_META.high.hex,
            "severe", STATUS_META.severe.hex,
            "#94a3b8",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });

      map.on("click", "airports", (e) => {
        const iata = e.features?.[0]?.properties?.iata;
        if (!iata) return;
        const a = airportsRef.current.find((x) => x.airport.iata === iata);
        if (a) onSelectRef.current(a);
      });

      map.on("mouseenter", "airports", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "airports", () => {
        map.getCanvas().style.cursor = "";
        if (tooltipRef.current) tooltipRef.current.style.display = "none";
      });
      map.on("mousemove", "airports", (e) => {
        const p = e.features?.[0]?.properties;
        if (!p || !tooltipRef.current) return;
        const meta = STATUS_META[p.status as keyof typeof STATUS_META];
        tooltipRef.current.innerHTML = "";
        tooltipRef.current.style.display = "block";
        tooltipRef.current.style.left = `${e.point.x + 14}px`;
        tooltipRef.current.style.top = `${e.point.y + 10}px`;

        const name = document.createElement("div");
        name.className = "text-xs font-semibold text-ink";
        name.textContent = `${p.iata} · ${p.city}`;
        const detail = document.createElement("div");
        detail.className = "mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-ink-muted";
        detail.innerHTML = `<span class="inline-block h-1.5 w-1.5 rounded-full" style="background:${meta.hex}"></span>${meta.label} · ${p.score}/100`;
        tooltipRef.current.appendChild(name);
        tooltipRef.current.appendChild(detail);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    (map.getSource("airports") as mapboxgl.GeoJSONSource | undefined)?.setData(
      airportGeoJson(airportsRef.current)
    );
    (map.getSource("routes") as mapboxgl.GeoJSONSource | undefined)?.setData(
      routeGeoJson(routesRef.current, airportsRef.current)
    );
  }, [airports, routes]);

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[480px] w-full rounded-lg" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 hidden min-w-[150px] rounded-lg border border-line bg-surface px-3 py-2 shadow-raised"
        style={{ display: "none" }}
      />
    </div>
  );
}
