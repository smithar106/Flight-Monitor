// OpenSky Network client (anonymous by default). Provides real-time ADS-B
// state vectors for a geographic bounding box. See https://opensky-network.org

export interface OpenSkyState {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number | null;
  latitude: number | null;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  verticalRate: number | null;
  timePosition: number | null;
}

export interface OpenSkyStates {
  time: number;
  states: OpenSkyState[];
}

const BASE = "https://opensky-network.org/api";

// Continental United States bounding box (lat/lon).
const US_BBOX = { lamin: 24, lomin: -125, lamax: 49, lomax: -66 };

const CACHE_TTL_MS = 90_000;

let cache: { at: number; data: OpenSkyStates } | null = null;

function credentials(): string {
  const user = process.env.OPENSKY_USERNAME;
  const pass = process.env.OPENSKY_PASSWORD;
  if (user && pass) {
    return `?${new URLSearchParams({ user, pass }).toString()}`;
  }
  return "";
}

function parseState(s: unknown[]): OpenSkyState {
  const num = (v: unknown): number | null =>
    typeof v === "number" ? v : null;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const bool = (v: unknown): boolean => v === true;
  return {
    icao24: str(s[0]),
    callsign: str(s[1]),
    originCountry: str(s[2]),
    timePosition: num(s[3]),
    longitude: num(s[5]),
    latitude: num(s[6]),
    baroAltitude: num(s[7]),
    onGround: bool(s[8]),
    velocity: num(s[9]),
    verticalRate: num(s[11]),
  };
}

export async function fetchUsStates(): Promise<OpenSkyStates> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }
  const params = new URLSearchParams({
    lamin: String(US_BBOX.lamin),
    lomin: String(US_BBOX.lomin),
    lamax: String(US_BBOX.lamax),
    lomax: String(US_BBOX.lomax),
  });
  const url = `${BASE}/states/all?${params.toString()}${credentials().replace("?", "&")}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      throw new Error(`OpenSky HTTP ${res.status}`);
    }
    const json = (await res.json()) as { time: number; states: unknown[][] };
    const data: OpenSkyStates = {
      time: json.time,
      states: (json.states || []).map(parseState),
    };
    cache = { at: Date.now(), data };
    return data;
  } finally {
    clearTimeout(timer);
  }
}
