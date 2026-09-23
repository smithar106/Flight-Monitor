#!/usr/bin/env node
/**
 * ingest-bts.mjs — generate a real BTS On-Time Performance baseline.
 *
 * The Bureau of Transportation Statistics publishes monthly "Reporting Carrier
 * On-Time Performance" CSVs (domestic flights with scheduled vs. actual times).
 * This script aggregates a raw CSV into the baseline schema consumed by the app
 * (data/baselines/bts.json), keyed by origin airport (departure performance)
 * and reporting carrier.
 *
 * Usage:
 *   node scripts/ingest-bts.mjs --csv path/to/On_Time_Reporting.csv
 *
 * Obtaining the CSV: BTS delivers the file via a browser form (TranStats), so
 * it cannot be reliably fetched headlessly. Download the CSV for the month(s)
 * you want, then point this script at it. Multiple months can be concatenated.
 *
 * Column indices below reflect the standard BTS On_Time_Reporting_Carrier
 * On_Time_Performance layout (0-based after the header row).
 */

import fs from "fs";
import readline from "readline";

const COL = {
  month: 2,          // Month (1-12)
  dayOfWeek: 4,      // DayOfWeek (1=Mon .. 7=Sun)
  reportingAirline: 6, // Reporting_Airline (IATA)
  origin: 14,        // Origin airport (IATA)
  dest: 23,          // Dest airport (IATA)
  depDelayMinutes: 32, // DepDelayMinutes (actual - scheduled departure)
  depDel15: 33,      // DepDel15 (1 = departed >= 15 min late)
  cancelled: 47,     // Cancelled (1 = canceled)
  diverted: 49,      // Diverted (1 = diverted)
};

const args = process.argv.slice(2);
const csvPathIdx = args.indexOf("--csv");
if (csvPathIdx === -1 || !args[csvPathIdx + 1]) {
  console.error("Usage: node scripts/ingest-bts.mjs --csv path/to/On_Time_Reporting.csv");
  process.exit(1);
}
const csvPath = args[csvPathIdx + 1];
if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

const airports = new Map(); // iata -> { flights, delayed, cancelled, diverted, delaySum, days:Set }
const airlines = new Map(); // iata -> { flights, delayed, cancelled, diverted, delaySum }
const dates = new Set();

const rl = readline.createInterface({ input: fs.createReadStream(csvPath) });
let header = true;

for await (const line of rl) {
  if (header) {
    header = false;
    continue;
  }
  const c = line.split(",");
  if (c.length < 50) continue;

  const carrier = (c[COL.reportingAirline] || "").trim();
  const origin = (c[COL.origin] || "").trim().toUpperCase();
  const flightDate = (c[5] || "").trim();
  const cancelled = c[COL.cancelled] === "1";
  const diverted = c[COL.diverted] === "1";
  const delayed = c[COL.depDel15] === "1";
  const delayMin = parseInt(c[COL.depDelayMinutes] || "0", 10) || 0;

  if (!origin || !carrier) continue;
  if (diverted) continue; // exclude diverted from delay/cancel baselines
  if (flightDate) dates.add(flightDate);

  const a = airports.get(origin) || {
    flights: 0, delayed: 0, cancelled: 0, delaySum: 0,
  };
  a.flights += 1;
  if (cancelled) a.cancelled += 1;
  else if (delayed) {
    a.delayed += 1;
    a.delaySum += delayMin;
  }
  airports.set(origin, a);

  const al = airlines.get(carrier) || {
    flights: 0, delayed: 0, cancelled: 0, delaySum: 0,
  };
  al.flights += 1;
  if (cancelled) al.cancelled += 1;
  else if (delayed) {
    al.delayed += 1;
    al.delaySum += delayMin;
  }
  airlines.set(carrier, al);
}

const nDays = dates.size || 1;

function rowFor(entry) {
  const total = entry.flights;
  const delayPct = (entry.delayed / total) * 100;
  const canceledPct = (entry.cancelled / total) * 100;
  const avgDelayMin = entry.delayed ? entry.delaySum / entry.delayed : 0;
  return {
    delayPct: Math.round(delayPct * 10) / 10,
    canceledPct: Math.round(canceledPct * 10) / 10,
    avgDelayMin: Math.round(avgDelayMin),
  };
}

// Reuse the sample diurnal curve / day-of-week factors as reasonable defaults;
// these can be re-estimated from the same BTS data if needed.
const sample = JSON.parse(
  fs.readFileSync(new URL("../data/baselines/sample.json", import.meta.url), "utf-8")
);

const out = {
  source: "bts",
  periodLabel: `BTS On-Time Performance (${nDays} days, departure performance)`,
  generated: new Date().toISOString().slice(0, 10),
  hourlyCurve: sample.hourlyCurve,
  dayOfWeek: sample.dayOfWeek,
  airports: {},
  airlines: {},
};

for (const [iata, entry] of airports) {
  const r = rowFor(entry);
  out.airports[iata] = {
    ...r,
    dailyMovements: Math.round(entry.flights / nDays),
    trend: 0,
  };
}
for (const [iata, entry] of airlines) {
  out.airlines[iata] = rowFor(entry);
}

const target = new URL("../data/baselines/bts.json", import.meta.url);
fs.mkdirSync(new URL("../data/baselines/", import.meta.url), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.airports ? Object.keys(out.airports).length : 0} airports, ` +
  `${Object.keys(out.airlines).length} airlines to data/baselines/bts.json`);
