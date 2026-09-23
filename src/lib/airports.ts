import type { AirportRef } from "./types";

// Major U.S. airports (passenger-volume prioritized). Coordinates are decimal
// degrees (WGS84) for the airport reference point.
export const AIRPORTS: AirportRef[] = [
  { iata: "ATL", icao: "KATL", name: "Hartsfield-Jackson Atlanta International", city: "Atlanta", state: "GA", lat: 33.6407, lon: -84.4277, tz: "America/New_York" },
  { iata: "LAX", icao: "KLAX", name: "Los Angeles International", city: "Los Angeles", state: "CA", lat: 33.9416, lon: -118.4085, tz: "America/Los_Angeles" },
  { iata: "ORD", icao: "KORD", name: "Chicago O'Hare International", city: "Chicago", state: "IL", lat: 41.9742, lon: -87.9073, tz: "America/Chicago" },
  { iata: "DFW", icao: "KDFW", name: "Dallas/Fort Worth International", city: "Dallas-Fort Worth", state: "TX", lat: 32.8998, lon: -97.0403, tz: "America/Chicago" },
  { iata: "DEN", icao: "KDEN", name: "Denver International", city: "Denver", state: "CO", lat: 39.8561, lon: -104.6737, tz: "America/Denver" },
  { iata: "JFK", icao: "KJFK", name: "John F. Kennedy International", city: "New York", state: "NY", lat: 40.6413, lon: -73.7781, tz: "America/New_York" },
  { iata: "SFO", icao: "KSFO", name: "San Francisco International", city: "San Francisco", state: "CA", lat: 37.6213, lon: -122.3790, tz: "America/Los_Angeles" },
  { iata: "SEA", icao: "KSEA", name: "Seattle-Tacoma International", city: "Seattle", state: "WA", lat: 47.4502, lon: -122.3088, tz: "America/Los_Angeles" },
  { iata: "LAS", icao: "KLAS", name: "Harry Reid International", city: "Las Vegas", state: "NV", lat: 36.0840, lon: -115.1537, tz: "America/Los_Angeles" },
  { iata: "MCO", icao: "KMCO", name: "Orlando International", city: "Orlando", state: "FL", lat: 28.4312, lon: -81.3081, tz: "America/New_York" },
  { iata: "EWR", icao: "KEWR", name: "Newark Liberty International", city: "Newark", state: "NJ", lat: 40.6895, lon: -74.1745, tz: "America/New_York" },
  { iata: "CLT", icao: "KCLT", name: "Charlotte Douglas International", city: "Charlotte", state: "NC", lat: 35.2140, lon: -80.9431, tz: "America/New_York" },
  { iata: "PHX", icao: "KPHX", name: "Phoenix Sky Harbor International", city: "Phoenix", state: "AZ", lat: 33.4373, lon: -112.0078, tz: "America/Phoenix" },
  { iata: "IAH", icao: "KIAH", name: "George Bush Intercontinental", city: "Houston", state: "TX", lat: 29.9902, lon: -95.3368, tz: "America/Chicago" },
  { iata: "MIA", icao: "KMIA", name: "Miami International", city: "Miami", state: "FL", lat: 25.7959, lon: -80.2870, tz: "America/New_York" },
  { iata: "BOS", icao: "KBOS", name: "Boston Logan International", city: "Boston", state: "MA", lat: 42.3656, lon: -71.0096, tz: "America/New_York" },
  { iata: "MSP", icao: "KMSP", name: "Minneapolis-St. Paul International", city: "Minneapolis", state: "MN", lat: 44.8848, lon: -93.2223, tz: "America/Chicago" },
  { iata: "DTW", icao: "KDTW", name: "Detroit Metropolitan", city: "Detroit", state: "MI", lat: 42.2162, lon: -83.3554, tz: "America/New_York" },
  { iata: "PHL", icao: "KPHL", name: "Philadelphia International", city: "Philadelphia", state: "PA", lat: 39.8744, lon: -75.2424, tz: "America/New_York" },
  { iata: "LGA", icao: "KLGA", name: "LaGuardia", city: "New York", state: "NY", lat: 40.7769, lon: -73.8740, tz: "America/New_York" },
  { iata: "BWI", icao: "KBWI", name: "Baltimore/Washington International", city: "Baltimore", state: "MD", lat: 39.1754, lon: -76.6682, tz: "America/New_York" },
  { iata: "SLC", icao: "KSLC", name: "Salt Lake City International", city: "Salt Lake City", state: "UT", lat: 40.7898, lon: -111.9796, tz: "America/Denver" },
  { iata: "SAN", icao: "KSAN", name: "San Diego International", city: "San Diego", state: "CA", lat: 32.7338, lon: -117.1933, tz: "America/Los_Angeles" },
  { iata: "IAD", icao: "KIAD", name: "Washington Dulles International", city: "Dulles", state: "VA", lat: 38.9531, lon: -77.4565, tz: "America/New_York" },
  { iata: "TPA", icao: "KTPA", name: "Tampa International", city: "Tampa", state: "FL", lat: 27.9755, lon: -82.5332, tz: "America/New_York" },
  { iata: "MDW", icao: "KMDW", name: "Chicago Midway International", city: "Chicago", state: "IL", lat: 41.7860, lon: -87.7524, tz: "America/Chicago" },
  { iata: "DCA", icao: "KDCA", name: "Ronald Reagan Washington National", city: "Arlington", state: "VA", lat: 38.8512, lon: -77.0402, tz: "America/New_York" },
  { iata: "FLL", icao: "KFLL", name: "Fort Lauderdale-Hollywood International", city: "Fort Lauderdale", state: "FL", lat: 26.0742, lon: -80.1506, tz: "America/New_York" },
  { iata: "PDX", icao: "KPDX", name: "Portland International", city: "Portland", state: "OR", lat: 45.5898, lon: -122.5951, tz: "America/Los_Angeles" },
  { iata: "STL", icao: "KSTL", name: "St. Louis Lambert International", city: "St. Louis", state: "MO", lat: 38.7487, lon: -90.3700, tz: "America/Chicago" },
  { iata: "AUS", icao: "KAUS", name: "Austin-Bergstrom International", city: "Austin", state: "TX", lat: 30.1975, lon: -97.6664, tz: "America/Chicago" },
  { iata: "HNL", icao: "PHNL", name: "Daniel K. Inouye International", city: "Honolulu", state: "HI", lat: 21.3187, lon: -157.9225, tz: "Pacific/Honolulu" },
  { iata: "BNA", icao: "KBNA", name: "Nashville International", city: "Nashville", state: "TN", lat: 36.1263, lon: -86.6774, tz: "America/Chicago" },
  { iata: "RDU", icao: "KRDU", name: "Raleigh-Durham International", city: "Raleigh", state: "NC", lat: 35.8776, lon: -78.7875, tz: "America/New_York" },
  { iata: "SMF", icao: "KSMF", name: "Sacramento International", city: "Sacramento", state: "CA", lat: 38.6954, lon: -121.5910, tz: "America/Los_Angeles" },
  { iata: "SJC", icao: "KSJC", name: "San Jose International", city: "San Jose", state: "CA", lat: 37.3619, lon: -121.9290, tz: "America/Los_Angeles" },
  { iata: "OAK", icao: "KOAK", name: "Oakland International", city: "Oakland", state: "CA", lat: 37.7213, lon: -122.2207, tz: "America/Los_Angeles" },
  { iata: "RSW", icao: "KRSW", name: "Southwest Florida International", city: "Fort Myers", state: "FL", lat: 26.5362, lon: -81.7552, tz: "America/New_York" },
  { iata: "CLE", icao: "KCLE", name: "Cleveland Hopkins International", city: "Cleveland", state: "OH", lat: 41.4090, lon: -81.8548, tz: "America/New_York" },
  { iata: "CVG", icao: "KCVG", name: "Cincinnati/Northern Kentucky International", city: "Cincinnati", state: "OH", lat: 39.0461, lon: -84.6622, tz: "America/New_York" },
];

const byIata = new Map(AIRPORTS.map((a) => [a.iata, a]));
const byIcao = new Map(AIRPORTS.map((a) => [a.icao, a]));

export function airportByIata(code: string): AirportRef | undefined {
  return byIata.get(code.toUpperCase());
}

export function airportByIcao(code: string): AirportRef | undefined {
  return byIcao.get(code.toUpperCase());
}
