// Rate limiting + optional API-key auth for the LLM endpoints. Single-instance
// aware (Railway runs one replica). No external dependency; if a real
// Redis-backed limiter is needed later, swap this file.
//
// Defense-in-depth for a publicly-exposed LLM:
//   - per-IP buckets (best-effort client identity)
//   - a global bucket (bounds bursts regardless of source IP)
//   - a persisted monthly call budget (hard cost ceiling, survives restarts)

import fs from "fs";
import path from "path";

const buckets = new Map<string, { count: number; resetAt: number }>();
const globalBuckets = new Map<string, { count: number; resetAt: number }>();

export function clientIp(req: Request): string {
  // Prefer single-value headers set by a trusted proxy, which a client cannot
  // trivially spoof. `x-forwarded-for` is read right-to-left because a client
  // can prepend arbitrary entries to the left side; the rightmost hop is the
  // one our edge proxy added.
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",");
    for (let i = parts.length - 1; i >= 0; i--) {
      const ip = parts[i]?.trim();
      if (ip) return ip;
    }
  }
  return "unknown";
}

function consume(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  return consume(buckets, key, limit, windowMs);
}

// A single shared bucket across all clients — bounds total traffic to the LLM
// endpoints regardless of how many distinct IPs an attacker rotates through.
export function globalRateLimit(key: string, limit: number, windowMs: number): boolean {
  return consume(globalBuckets, key, limit, windowMs);
}

// Auth is disabled unless ADMIN_API_KEY is set. When set, the LLM endpoints
// require `Authorization: Bearer <key>`.
export function isAuthorized(req: Request): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return true;
  const header = req.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

// --- Monthly LLM call budget (persisted) ------------------------------------
//
// Enforced at the point of LLM spend (llm.ts), so reaching the ceiling degrades
// gracefully to the deterministic fallback rather than erroring the request.

const USAGE_FILE = path.join(process.cwd(), "data", ".llm-usage.json");

function llmMonthlyLimit(): number {
  const n = parseInt(process.env.LLM_MAX_MONTHLY_CALLS ?? "20000", 10);
  return Number.isFinite(n) && n > 0 ? n : 20000;
}

function readUsage(): { month: string; calls: number } {
  try {
    const raw = JSON.parse(fs.readFileSync(USAGE_FILE, "utf-8")) as {
      month?: string;
      calls?: number;
    };
    return { month: raw.month ?? "", calls: raw.calls ?? 0 };
  } catch {
    return { month: "", calls: 0 };
  }
}

function writeUsage(u: { month: string; calls: number }): void {
  try {
    fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
    fs.writeFileSync(USAGE_FILE, JSON.stringify(u));
  } catch {
    /* best-effort */
  }
}

// Atomically increments the monthly budget. Returns true when the call is
// allowed and false when the budget is exhausted. Counts individual LLM
// invocations (the ask flow may issue two).
export function consumeLlmCall(limit = llmMonthlyLimit()): boolean {
  const month = new Date().toISOString().slice(0, 7);
  const u = readUsage();
  const current = u.month === month ? u : { month, calls: 0 };
  if (current.calls >= limit) {
    if (u.month !== month) writeUsage(current);
    return false;
  }
  current.calls += 1;
  writeUsage(current);
  return true;
}
