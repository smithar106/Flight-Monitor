// Deterministic synthetic flight data used as a clearly-labeled fallback when
// the real data source is unavailable (e.g. monthly quota exhausted). Seeded by
// date so it is stable within a day but refreshes each day, and it is always
// surfaced as "demo data" in the UI — never presented as real.

import { AIRPORTS } from "./airports";
import type { FlightRecord } from "./aviationstack";

// Carriers used in the demo dataset (weighted toward the majors).
const CARRIERS: { iata: string; weight: number }[] = [
  { iata: "UA", weight: 4 },
  { iata: "AA", weight: 4 },
  { iata: "DL", weight: 4 },
  { iata: "WN", weight: 4 },
  { iata: "AS", weight: 2 },
  { iata: "B6", weight: 2 },
  { iata: "NK", weight: 2 },
  { iata: "F9", weight: 2 },
];

export const SYNTHETIC_CARRIERS = CARRIERS.length;

// Hubs get more traffic.
const HUB_WEIGHTS: Record<string, number> = {
  ATL: 5, ORD: 5, DFW: 5, DEN: 4, LAX: 4, JFK: 4, SFO: 3, SEA: 3, LAS: 3,
  MCO: 3, EWR: 3, CLT: 3, PHX: 3, IAH: 3, MIA: 3, BOS: 3, MSP: 2, DTW: 2,
  PHL: 2, LGA: 2, BWI: 2, SLC: 2, SAN: 2, IAD: 2, TPA: 2, MDW: 2, DCA: 2,
  FLL: 2, PDX: 1, STL: 1, AUS: 1, HNL: 1, BNA: 1, RDU: 1, SMF: 1, SJC: 1,
  OAK: 1, RSW: 1, CLE: 1, CVG: 1,
};

const FLIGHT_COUNT = 360;

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function weightedPick<T extends { weight: number }>(items: T[], rng: () => number): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function delayMinutes(rng: () => number, disrupted: boolean): number {
  const r = rng();
  if (disrupted) {
    if (r < 0.4) return Math.floor(rng() * 15); // on-time
    if (r < 0.85) return 15 + Math.floor(rng() * 70); // delayed
    return 85 + Math.floor(rng() * 60); // badly delayed
  }
  if (r < 0.8) return Math.floor(rng() * 15); // on-time
  if (r < 0.97) return 15 + Math.floor(rng() * 45); // delayed
  return 60 + Math.floor(rng() * 60); // badly delayed
}

export function generateSyntheticFlights(): FlightRecord[] {
  const rng = mulberry32(daySeed());

  // Pick 3 "disrupted" airports deterministically for the day.
  const airportPool = AIRPORTS.map((a) => a.iata);
  const shuffled = [...airportPool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const disrupted = new Set(shuffled.slice(0, 3));

  // Weighted airport list (by hub weight).
  const airportWeights = AIRPORTS.map((a) => ({
    iata: a.iata,
    weight: HUB_WEIGHTS[a.iata] ?? 1,
  }));

  const records: FlightRecord[] = [];
  for (let i = 0; i < FLIGHT_COUNT; i++) {
    const carrier = weightedPick(CARRIERS, rng).iata;
    const origin = weightedPick(airportWeights, rng).iata;
    let dest = weightedPick(airportWeights, rng).iata;
    while (dest === origin) dest = weightedPick(airportWeights, rng).iata;

    const isDisrupted = disrupted.has(origin) || disrupted.has(dest);
    const delay = delayMinutes(rng, isDisrupted);

    records.push({
      airlineIata: carrier,
      originIata: origin,
      destIata: dest,
      status: "landed",
      departureDelayMin: null,
      arrivalDelayMin: delay,
    });
  }

  return records;
}
