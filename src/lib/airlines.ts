import type { AirlineRef } from "./types";

// Major U.S. scheduled passenger carriers. `icao` is the value OpenSky reports
// in the callsign's first three letters (e.g. "UAL", "AAL", "DAL", "SWA").
export const AIRLINES: AirlineRef[] = [
  { iata: "AA", icao: "AAL", name: "American Airlines" },
  { iata: "DL", icao: "DAL", name: "Delta Air Lines" },
  { iata: "UA", icao: "UAL", name: "United Airlines" },
  { iata: "WN", icao: "SWA", name: "Southwest Airlines" },
  { iata: "AS", icao: "ASA", name: "Alaska Airlines" },
  { iata: "B6", icao: "JBU", name: "JetBlue Airways" },
  { iata: "NK", icao: "NKS", name: "Spirit Airlines" },
  { iata: "F9", icao: "FFT", name: "Frontier Airlines" },
  { iata: "G4", icao: "AAY", name: "Allegiant Air" },
  { iata: "HA", icao: "HAL", name: "Hawaiian Airlines" },
  { iata: "SY", icao: "SCX", name: "Sun Country Airlines" },
  { iata: "MX", icao: "MXY", name: "Breeze Airways" },
];

const byIcao = new Map(AIRLINES.map((a) => [a.icao, a]));
const byIata = new Map(AIRLINES.map((a) => [a.iata, a]));

export function airlineByIcao(code: string): AirlineRef | undefined {
  return byIcao.get(code.toUpperCase());
}

export function airlineByIata(code: string): AirlineRef | undefined {
  return byIata.get(code.toUpperCase());
}

// Maps an OpenSky callsign (e.g. "UAL2823 ") to an airline ref, if known.
export function airlineFromCallsign(callsign: string): AirlineRef | undefined {
  const prefix = (callsign || "").trim().slice(0, 3).toUpperCase();
  return byIcao.get(prefix);
}
