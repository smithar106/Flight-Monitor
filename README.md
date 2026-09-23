# Flight Pulse

**U.S. Flight Operations Intelligence**

Flight Pulse answers a single question: *what is happening across U.S. aviation today, what is unusual, and why does it matter?*

It combines live air-traffic data, historical flight-performance baselines, deterministic analytics, and a grounded AI reasoning layer into a premium operations-intelligence interface. It is **not** a flight-search or booking product.

---

## Product overview

The landing page immediately answers "how is U.S. aviation performing today" with a national status (Normal / Elevated / High / Severe), key metrics, a disruption map, and a ranked list of the most disrupted airports.

- **National overview** — flights tracked, on-time/delayed/canceled rates, average delay, and airports with elevated disruption, with a data-freshness indicator.
- **U.S. airport disruption map** — every major U.S. airport plotted and color-coded by severity; click for a detail drawer.
- **Disruption Score** — an explainable 0–100 composite per airport (see Methodology).
- **Most disrupted airports** — ranked by normalized performance, not raw volume.
- **Airline performance** — sortable comparison with historical context (outperforming / near / underperforming).
- **AI Operations Brief** — an auto-generated summary grounded in deterministic metrics.
- **Ask Flight Pulse** — a conversational analysis tool with visible evidence for every answer.
- **Methodology** — a full explanation of definitions, the score, sources, and limitations.

---

## Architecture

```
Live Flight Data (OpenSky ADS-B)
        ↓
Normalization layer (src/lib/opensky.ts)
        ↓
Operational data model (src/lib/types.ts)
        ↓
Analytics engine (src/lib/analytics.ts, src/lib/disruption.ts)
        ↓
Historical baseline comparison (src/lib/baselines.ts)
        ↓
Structured intelligence object (src/lib/app-state.ts)
        ↓
AI explanation layer (src/lib/llm.ts, src/lib/brief.ts, src/lib/agent.ts)
        ↓
Frontend (src/components, src/app)
```

The layering is deliberate: **metrics are computed deterministically; the LLM only explains them.** Disable the LLM and the product still works — the brief and answers fall back to template text generated from the same numbers.

### Core models (`src/lib/types.ts`)

`Airport`, `Airline`, `AirportPerformance`, `AirlinePerformance`, `PerformanceBaseline`, `DisruptionScore`, `NationalOverview`, `OperationsBrief`.

### Data-first, AI-second

- **Live data** (OpenSky): aircraft tracked over the continental U.S., per-airport terminal traffic, per-airline airborne counts.
- **Historical data** (BTS): delay, cancellation, on-time, and average-delay baselines, controlled for airport/airline/season/day-of-week/time-of-day.
- **Analytics**: the Disruption Score and all comparisons are pure, deterministic functions (unit-tested).
- **AI**: `DEEPSEEK_API_KEY` powers the Operations Brief and Ask Flight Pulse. The LLM is handed structured facts and forbidden from inventing statistics; the UI surfaces the underlying evidence.

---

## Data sources

| Source | Role | Access |
|---|---|---|
| [OpenSky Network](https://opensky-network.org) | Live ADS-B aircraft positions (continental U.S.) | Anonymous (rate-limited) or free account |
| [Bureau of Transportation Statistics](https://www.bts.gov) | Historical On-Time Performance baselines | Public CSV download |

**Important:** the free data sources used here do not expose live per-flight delay/cancellation status. Delay, cancellation, on-time, and average-delay figures are therefore **historical baselines**, clearly labeled in the UI, while flights-tracked and terminal-traffic figures are **live**. The product never presents a baseline as live data, and never fabricates a live figure when it is unavailable.

A clearly-labeled **sample baseline** (`data/baselines/sample.json`) ships with the repo so the app runs out of the box. Generate a real BTS-derived baseline with:

```bash
node scripts/ingest-bts.mjs --csv path/to/On_Time_Reporting.csv
```

The script writes `data/baselines/bts.json`, which the app automatically prefers over the sample.

---

## Setup

```bash
npm install
cp .env.example .env.local   # add DEEPSEEK_API_KEY (optional) to enable the AI layer
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DEEPSEEK_API_KEY` | No | Enables the AI Operations Brief and grounded Ask answers (falls back to deterministic text without it) |
| `DEEPSEEK_BASE_URL` | No | Override the DeepSeek endpoint (default `https://api.deepseek.com`) |
| `DEEPSEEK_MODEL` | No | Override the model (default `deepseek-chat`) |
| `OPENSKY_USERNAME` / `OPENSKY_PASSWORD` | No | OpenSky account credentials to raise rate limits (anonymous by default) |

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production server |
| `npm run test` | Run the Vitest suite |
| `npm run typecheck` | Type-check the project |
| `node scripts/ingest-bts.mjs --csv <path>` | Generate a real BTS baseline |

---

## AI architecture

The AI layer is grounded end-to-end:

```
structured analytics → deterministic metrics → structured context → LLM explanation
```

1. `src/lib/app-state.ts` assembles the full intelligence object.
2. `src/lib/brief.ts` serializes only real numbers into a fact block, then asks the LLM to phrase a summary — with an explicit instruction that it may only reference the provided facts.
3. `src/lib/agent.ts` detects intent (airport/airline/trend/cancellation/etc.), retrieves the relevant evidence deterministically, and returns the answer **plus** the evidence behind it.

Without `DEEPSEEK_API_KEY`, both features fall back to deterministic templates built from the same facts, so the product remains useful and honest.

---

## Disruption Score

A reproducible 0–100 composite (see `src/lib/disruption.ts` and `/methodology`):

| Component | Weight | Derivation |
|---|---|---|
| Delay rate | up to 40 | baseline delay % (1 pt per 1%, saturates at 40%) |
| Cancellation rate | up to 20 | baseline cancel % × 8 (saturates at 2.5%) |
| Average delay duration | up to 15 | avg delay min ÷ 60 × 15 (saturates at 60 min) |
| Live traffic anomaly | up to 25 | shortfall vs expected terminal traffic |

Bands: 0–24 Normal · 25–49 Elevated · 50–74 High · 75–100 Severe.

---

## Deployment

A standard Next.js app — deploy anywhere that supports Node (Vercel, Railway, etc.). Set the environment variables above. OpenSky requests are cached server-side (`src/lib/opensky.ts`) to stay within rate limits.

---

## Testing

```bash
npm run test       # Vitest — deterministic analytics, baselines, and agent fallbacks
npm run typecheck  # tsc --noEmit
```

---

## Known limitations

- Live per-flight delay/cancellation status is not available from the free data sources; these figures are historical baselines.
- Live coverage is continental U.S.; Alaska and Hawaii are outside the live snapshot.
- Airline attribution uses ADS-B callsign prefixes and is approximate (non-ICAO callsigns are omitted).
- Trend (improving/worsening) requires recent historical data and is unavailable with the sample baseline.
- The live traffic-anomaly signal uses a documented modeling assumption (dwell-time constant); it is a proxy for throughput, not a precise count.
