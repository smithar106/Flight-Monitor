// Lightweight in-memory rate limiting + optional API-key auth for the LLM
// endpoints. Single-instance aware (Railway runs one replica). No external
// dependency; if a real Redis-backed limiter is needed later, swap this file.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

// Auth is disabled unless ADMIN_API_KEY is set. When set, the LLM endpoints
// require `Authorization: Bearer <key>`.
export function isAuthorized(req: Request): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return true;
  const header = req.headers.get("authorization");
  return header === `Bearer ${expected}`;
}
