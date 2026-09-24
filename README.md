# Flight Pulse

**U.S. Flight Operations Intelligence**

Flight Pulse answers a single question: *what is happening across U.S. aviation today, what is unusual, and why does it matter?*

It combines daily flight-performance data, historical flight-performance baselines, deterministic analytics, and a grounded AI reasoning layer into a premium operations-intelligence interface. It is **not** a flight-search or booking product.

---

## Product overview

The landing page immediately answers "how is U.S. aviation performing today" with a national status (Normal / Elevated / High / Severe), key metrics, a disruption map, and a ranked list of the most disrupted airports.

- **National overview** — flights tracked, previous-day on-time/delayed rates, average delay, baseline cancellation rate, and airports with elevated disruption, with a data-freshness indicator.
- **U.S. airport disruption map** — every major U.S. airport plotted and color-coded by severity, with route corridors between airports; click for a detail drawer.
- **Disruption Score** — an explainable 0–100 composite per airport (see Methodology).
- **Most disrupted airports** — ranked by normalized performance, not raw volume.
- **Airline performance** — sortable comparison with the most-delayed carrier highlighted (outperforming / near / underperforming).
- **AI Operations Brief** — an auto-generated summary grounded in deterministic metrics.
- **Ask Flight Pulse** — a conversational analysis tool with visible evidence for every answer.
- **Methodology** — a full explanation of definitions, the score, sources, and limitations.

---

## Architecture

```
Daily Flight Results (AviationStack)
        ↓
Normalization layer (src/lib/aviationstack.ts)
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

`Airport`, `Airline`, `Route`, `AirportPerformance`, `AirlinePerformance`, `PerformanceBaseline`, `DisruptionScore`, `NationalOverview`, `OperationsBrief`.

### Data-first, AI-second

- **Daily data** (AviationStack): the previous day's actual landed-flight results for three major U.S. carriers (United, American, Delta) — on-time/delay rates, flights tracked, and per-airline exposure, ingested once a day.
- **Historical data** (BTS): delay, cancellation, on-time, and average-delay baselines, controlled for airport/airline/season/day-of-week/time-of-day. Cancellation rates are historical only (the daily ingest covers landed flights).
- **Analytics**: the Disruption Score and all comparisons are pure, deterministic functions (unit-tested).
- **AI**: `DEEPSEEK_API_KEY` powers the Operations Brief and Ask Flight Pulse. The LLM is handed structured facts and forbidden from inventing statistics; the UI surfaces the underlying evidence.

---

## Data sources

| Source | Role | Access |
|---|---|---|
| [AviationStack](https://aviationstack.com) | Previous-day flight results (3 major U.S. carriers) | API key (free tier ~100 req/mo) |
| [Bureau of Transportation Statistics](https://www.bts.gov) | Historical On-Time Performance baselines | Public CSV download |

**Data honesty:** daily delay figures are the previous day's actual results for a *small sample* of three major carriers (limited by the API plan's monthly quota), while cancellation figures and all baselines are historical BTS values. When the API quota is exhausted, the app falls back to **clearly-labeled synthetic demo data** so it remains functional — never presented as real. The product labels every figure as daily, baseline, or demo, and never fabricates a figure as real.

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
| `AVIATIONSTACK_API_KEY` | No | Daily flight data (falls back to baseline-only without it) |
| `AVIATIONSTACK_CARRIERS` | No | Carriers ingested per run (default `UA,AA,DL`) |
| `AVIATIONSTACK_TTL_MS` | No | Data cache TTL (default 24h — daily ingest) |
| `AVIATIONSTACK_MAX_REQUESTS` | No | Persistent monthly request budget (default 90) |
| `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | No | DeepSeek endpoint/model overrides |

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

## Observability (MLflow)

When `MLFLOW_TRACKING_URI` is set, the app logs runs to an MLflow tracking server via its REST API (`src/lib/mlflow.ts`). Telemetry is fire-and-forget and best-effort — it never affects the product if MLflow is unreachable.

Logged under the `flight-pulse` experiment:

| Run | Kind | Captures |
|---|---|---|
| `brief-*` | agent | generated_by, demo, status; latency_ms, input/output tokens, output chars |
| `ask-*` | agent | question, generated_by, demo; latency_ms, tokens, evidence count |
| `fetch-*` | infra | data source (AviationStack), carriers, date; latency_ms, requests, records, success/fail |
| `demo-*` | infra | synthetic fallback (source, reason); records, carriers |

Run a local MLflow server:

```bash
pip install mlflow
mlflow server --host 0.0.0.0 --port 5000
# then set MLFLOW_TRACKING_URI=http://localhost:5000
```

---

## Disruption Score

A reproducible 0–100 composite (see `src/lib/disruption.ts` and `/methodology`):

| Component | Weight | Derivation |
|---|---|---|
| Baseline delay rate | up to 40 | baseline delay % (1 pt per 1%, saturates at 40%) |
| Baseline cancellation rate | up to 20 | baseline cancel % × 8 (saturates at 2.5%) |
| Baseline average delay | up to 15 | avg delay min ÷ 60 × 15 (saturates at 60 min) |
| Live deviation | up to 25 | previous-day delay % above baseline, scaled |

Bands: 0–24 Normal · 25–49 Elevated · 50–74 High · 75–100 Severe.

---

## Deployment

A standard Next.js app — deploy anywhere that supports Node (Vercel, Railway, etc.). Set the environment variables above. AviationStack requests are cached server-side (`src/lib/aviationstack.ts`) and budgeted to stay within the plan's monthly limit.

---

## Testing

```bash
npm run test       # Vitest — deterministic analytics, baselines, and agent fallbacks
npm run typecheck  # tsc --noEmit
```

---

## Known limitations

- Data covers the previous day's actual results for three major carriers — a sample, not every U.S. flight.
- Cancellation figures are historical baselines only; the daily ingest covers landed flights.
- Delay is measured by actual arrival delay (≥ 15 min); airports with too few flights report no percentage.
- Airline attribution uses the operating carrier; a small number of codeshare/regional flights may be misattributed.
- Trend (improving/worsening) requires recent historical data and is unavailable with the sample baseline.
- The sample baseline (`data/baselines/sample.json`) is clearly labeled; replace it with real BTS data via `node scripts/ingest-bts.mjs`.
