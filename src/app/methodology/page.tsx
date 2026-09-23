import type { Metadata } from "next";
import { Card, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Methodology — Flight Pulse",
  description:
    "How Flight Pulse defines on-time performance, historical baselines, and the disruption score.",
};

function Term({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-1 text-[0.875rem] leading-relaxed text-ink-muted">{children}</div>
    </div>
  );
}

const SCORE_ROWS = [
  ["Delay rate", "up to 40", "Baseline delay % (1 point per 1%, saturates at 40%)"],
  ["Cancellation rate", "up to 20", "Baseline cancellation % × 8 (saturates at 2.5%)"],
  ["Average delay duration", "up to 15", "Average delay minutes ÷ 60 × 15 (saturates at 60 min)"],
  ["Live traffic anomaly", "up to 25", "(1 − live/expected) ÷ 0.5 × 25, zero when at/above expected"],
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-eyebrow text-ink-faint">
        About the data
      </div>
      <h1 className="mt-2 text-title font-semibold tracking-tight text-ink">Methodology</h1>
      <p className="mt-3 text-lead text-ink-muted">
        Flight Pulse distinguishes live traffic from historical performance and never
        presents one as the other. Here is exactly how each number is derived.
      </p>

      <Card className="mt-8 p-6">
        <SectionHeading eyebrow="Definitions" title="What the metrics mean" />
        <div className="divide-y divide-line">
          <Term title="On-time">
            A flight is considered on-time when it arrives within 15 minutes of its scheduled
            arrival time — the standard used by the U.S. Department of Transportation.
          </Term>
          <Term title="Delayed / canceled / diverted / unknown">
            Performance is classified into on-time, delayed (≥15 min), canceled, and diverted.
            Missing or unclassifiable records are kept distinct and never silently folded into
            another category.
          </Term>
          <Term title="Average delay">
            The mean delay in minutes among flights that were delayed (arrival delay ≥ 15 min),
            not across all flights.
          </Term>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <SectionHeading eyebrow="Score" title="The Disruption Score (0–100)" />
        <p className="text-[0.875rem] leading-relaxed text-ink-muted">
          Each airport receives an explainable composite score. The four components are
          deterministic and add to at most 100. The interpretation bands are:
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[0.8125rem]">
          <span className="rounded-full border border-normal/30 bg-normal-soft px-2.5 py-1 text-normal">0–24 Normal</span>
          <span className="rounded-full border border-elevated/30 bg-elevated-soft px-2.5 py-1 text-elevated">25–49 Elevated</span>
          <span className="rounded-full border border-high/30 bg-high-soft px-2.5 py-1 text-high">50–74 High</span>
          <span className="rounded-full border border-severe/30 bg-severe-soft px-2.5 py-1 text-severe">75–100 Severe</span>
        </div>
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[0.6875rem] uppercase tracking-eyebrow text-ink-faint">
              <th className="py-2 pr-2 font-medium">Component</th>
              <th className="py-2 pr-2 font-medium">Weight</th>
              <th className="py-2 font-medium">Derivation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {SCORE_ROWS.map(([name, weight, derivation]) => (
              <tr key={name}>
                <td className="py-2.5 pr-2 text-ink">{name}</td>
                <td className="py-2.5 pr-2 font-mono tabular-nums text-ink">{weight}</td>
                <td className="py-2.5 text-[0.8125rem] text-ink-muted">{derivation}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-faint">
          The score is computed in code and is fully reproducible. The AI layer only explains
          the numbers — it never contributes to or alters them. The live traffic-anomaly
          component attributes each low-altitude (below 15,000 ft) aircraft to its nearest
          reference airport within 60 nm, then compares that instantaneous count to the
          airport's expected hourly volume. The dwell-time constant (0.6, i.e. ~35 minutes) is
          a modeling assumption calibrated so a typical airport at a typical hour yields a
          ratio near 1.0.
        </p>
      </Card>

      <Card className="mt-6 p-6">
        <SectionHeading eyebrow="Baselines" title="Historical comparison" />
        <div className="space-y-4 text-[0.875rem] leading-relaxed text-ink-muted">
          <p>
            Current conditions are compared against a historical baseline that controls for the
            relevant dimensions where the data permits — airport, airline, month/season, day of
            week, and time of day — to avoid misleading apples-to-oranges comparisons (e.g. a
            Monday-morning hub in January against the whole year).
          </p>
          <p>
            The baseline used by this deployment is <strong className="text-ink">clearly labeled</strong>.
            A real Bureau of Transportation Statistics (BTS) On-Time Performance baseline can be
            generated with <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.8125rem]">node scripts/ingest-bts.mjs</code>.
            Until then, the product runs on the explicitly-marked sample baseline.
          </p>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <SectionHeading eyebrow="Sources" title="Data sources & freshness" />
        <div className="divide-y divide-line">
          <Term title="Live air traffic — OpenSky Network">
            Real-time aircraft positions (ADS-B) for the continental United States. This powers
            flights-tracked counts and the live traffic-anomaly signal. Anonymous access is
            rate-limited; results are cached to avoid excess requests.
          </Term>
          <Term title="Historical performance — U.S. BTS">
            The Bureau of Transportation Statistics On-Time Performance data provides the
            delay, cancellation, on-time, and average-delay baselines. This data is published
            monthly with a lag of several months.
          </Term>
          <Term title="Freshness">
            The interface always shows when the live snapshot was captured. When live data is
            unavailable, stale, or degraded, the product says so and falls back to historical
            baselines rather than fabricating a live figure.
          </Term>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <SectionHeading eyebrow="Limits" title="Known limitations" />
        <ul className="space-y-2 text-[0.875rem] leading-relaxed text-ink-muted">
          <li className="flex gap-2"><span className="text-ink-faint">·</span>Live per-flight delay and cancellation status is not available from the current free data sources; these figures are historical baselines.</li>
          <li className="flex gap-2"><span className="text-ink-faint">·</span>Live coverage is continental U.S.; Alaska and Hawaii are not in the live state snapshot.</li>
          <li className="flex gap-2"><span className="text-ink-faint">·</span>Airline attribution from ADS-B callsigns is approximate (unassigned or non-ICAO callsigns are omitted).</li>
          <li className="flex gap-2"><span className="text-ink-faint">·</span>Trend (improving/worsening) requires recent historical data and is unavailable with the sample baseline.</li>
        </ul>
      </Card>
    </div>
  );
}
