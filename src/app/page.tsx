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
    <div className="mx-auto max-w-7xl space-y-10 px-5 py-10 sm:px-8">
      <div className="space-y-4">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-3" />
        <div className="h-9 w-72 animate-pulse rounded bg-surface-3" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-surface-3" />
        <div className="mt-6 grid grid-cols-2 gap-6 border-t border-line pt-8 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-surface-3" />
          ))}
        </div>
      </div>
      <div className="h-40 animate-pulse rounded-lg bg-surface-3" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="h-96 animate-pulse rounded-lg bg-surface-3 lg:col-span-3" />
        <div className="h-96 animate-pulse rounded-lg bg-surface-3 lg:col-span-2" />
      </div>
      <div className="h-72 animate-pulse rounded-lg bg-surface-3" />
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
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <div className="text-lg font-semibold text-ink">
          We couldn't load flight operations
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          The data service didn't respond. Please try again.
        </p>
        <button
          onClick={load}
          className="mt-6 rounded-lg bg-pulse px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pulse-ink"
        >
          Try again
        </button>
      </div>
    );
  }

  const {
    overview,
    airports,
    airlines,
    routes,
    baselineSource,
    live,
    demo,
    liveReason,
    liveUpdatedAt,
    liveSampleSize,
    liveCarriers,
  } = data;

  return (
    <>
      <Hero
        overview={overview}
        baselineSource={baselineSource}
        live={live}
        demo={demo}
        liveReason={liveReason}
        liveUpdatedAt={liveUpdatedAt}
        liveSampleSize={liveSampleSize}
        liveCarriers={liveCarriers}
      />

      {demo && (
        <div className="border-b border-pulse-soft bg-pulse-soft px-5 py-2 text-center text-[0.8125rem] text-pulse-ink">
          Demo data — synthetic sample, not real flights. Real data resumes when the API quota resets.
        </div>
      )}

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <Brief />
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-4 sm:px-8">
        <SectionHeading
          eyebrow="Where"
          title="Airport disruption"
          right={
            <span className="text-[0.75rem] text-ink-faint">Select an airport for detail</span>
          }
        />
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="p-4 lg:col-span-3">
            <MapView airports={airports} routes={routes} onSelect={setSelected} />
            {routes.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="text-[0.6875rem] font-medium uppercase tracking-eyebrow text-ink-faint">
                  Busiest routes
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {routes.slice(0, 10).map((r) => (
                    <span
                      key={`${r.originIata}-${r.destIata}`}
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[0.6875rem] text-ink"
                    >
                      {r.originIata}→{r.destIata}
                      <span className="text-ink-faint">{r.flights}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <Ranking airports={airports} onSelect={setSelected} />
          </Card>
        </div>
      </section>

      <section id="airlines" className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <SectionHeading
          eyebrow="Who"
          title="Airline performance"
          right={
            <span className="text-[0.75rem] text-ink-faint">Sort by any column</span>
          }
        />
        <Card className="overflow-hidden">
          <Airlines airlines={airlines} />
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
        <SectionHeading
          eyebrow="Ask the data"
          title="Ask a question"
          right={<span className="text-[0.75rem] text-ink-faint">Grounded in application data</span>}
        />
        <Ask />
      </section>

      <AirportDrawer airport={selected} onClose={() => setSelected(null)} />
    </>
  );
}
