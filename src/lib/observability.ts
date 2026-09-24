// Structured JSON logging + a tiny in-memory metrics registry. Kept dependency-
// free; the metrics registry feeds /api/metrics.

export function logJson(event: string, data: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test") return;
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

const counters = new Map<string, number>();

export function incr(name: string, n = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + n);
}

export function metrics(): Record<string, number> {
  return Object.fromEntries(counters);
}
