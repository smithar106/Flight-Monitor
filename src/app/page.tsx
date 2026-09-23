"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppContext } from "@/lib/app-state";
import type { AirportPerformance } from "@/lib/types";
import { Hero } from "@/components/hero";
import { MapView } from "@/components/map";
import { Ranking } from "@/components/ranking";
import { Airlines } from "@/components/airlines";
import { Brief } from "@/components/brief";
import { Ask } from "@/components/ask";
import { AirportDrawer } from "@/components/airport-drawer";
import { Card, SectionHeading } from "@/components/ui";

function Skeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-5 py-10 sm:px-8">
      <div className="h-40 animate-pulse rounded-sm2 border border-line bg-surface" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-sm2 border border-line bg-surface" />
        <div className="h-96 animate-pulse rounded-sm2 border border-line bg-surface" />
      </div>
      <div className="h-72 animate-pulse rounded-sm2 border border-line bg-surface" />
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<AppContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AirportPerformance | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/overview", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <div className="text-lg font-semibold text-ink">
          Unable to load flight operations data
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          {error ?? "The data service did not respond."}
        </p>
        <button
          onClick={load}
          className="mt-6 rounded-sm2 bg-pulse px-4 py-2.5 text-sm font-medium text-abyss hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  const { overview, airports, airlines, baselineSource, live, error: dataError } = data;

  return (
    <>
      <Hero overview={overview} baselineSource={baselineSource} />

      {!live && (
        <div className="border-b border-elevated/30 bg-elevated-soft px-5 py-2 text-center text-xs text-elevated">
          Live air-traffic data is temporarily unavailable{dataError ? ` (${dataError})` : ""}. Showing
          historical baselines only.
        </div>
      )}

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3 p-4">
            <SectionHeading
              eyebrow="U.S. Airports"
              title="Disruption map"
              right={
                <span className="text-[0.6875rem] text-ink-faint">
                  Circle size = disruption score
                </span>
              }
            />
            <MapView airports={airports} onSelect={setSelected} />
          </Card>

          <Card className="lg:col-span-2">
            <SectionHeading eyebrow="Ranking" title="Most disrupted airports" />
            <Ranking airports={airports} onSelect={setSelected} />
          </Card>
        </div>
      </section>

      <section id="airlines" className="mx-auto max-w-7xl px-5 pb-4 sm:px-8">
        <Card className="p-4 sm:p-5">
          <SectionHeading
            eyebrow="Carriers"
            title="Airline performance"
            right={
              <span className="text-[0.6875rem] text-ink-faint">
                Delay figures are historical baselines · click headers to sort
              </span>
            }
          />
          <Airlines airlines={airlines} />
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <SectionHeading
              eyebrow="AI"
              title="Operations brief"
              right={<span className="text-[0.6875rem] text-ink-faint">Auto-generated</span>}
            />
            <Brief />
          </Card>

          <Card className="p-5">
            <SectionHeading eyebrow="Analysis" title="Ask Flight Pulse" />
            <Ask />
          </Card>
        </div>
      </section>

      <AirportDrawer airport={selected} onClose={() => setSelected(null)} />
    </>
  );
}
