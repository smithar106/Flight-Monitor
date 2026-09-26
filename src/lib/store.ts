// Persisted key-value counters for budget tracking (LLM calls, AviationStack
// requests). Backed by Postgres when DATABASE_URL is set — atomic, survives
// redeploys, shared across replicas. Otherwise falls back to a local JSON file
// so the app still runs out of the box. All writes are best-effort: a failure
// must never break the product.

import fs from "fs";
import path from "path";
import { Pool } from "pg";

const FILE = path.join(process.cwd(), "data", ".counters.json");

// Reuse the pool across dev hot-reloads.
const globalForDb = globalThis as unknown as { __fpPool?: Pool };

function getPool(): Pool | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (!globalForDb.__fpPool) {
    globalForDb.__fpPool = new Pool({
      connectionString: url,
      max: 3,
      ...(process.env.PG_SSL === "true"
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    });
  }
  return globalForDb.__fpPool;
}

async function ensureSchema(p: Pool): Promise<void> {
  await p.query(`
    CREATE TABLE IF NOT EXISTS budget_counters (
      name   TEXT   NOT NULL,
      period TEXT   NOT NULL,
      value  BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (name, period)
    )
  `);
}

// --- File fallback ----------------------------------------------------------

function readFile(): Record<string, number> {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8")) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeFile(data: Record<string, number>): void {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data));
  } catch {
    /* best-effort */
  }
}

function fileKey(name: string, period: string): string {
  return `${name}|${period}`;
}

// --- Public API -------------------------------------------------------------

export async function counterGet(name: string, period: string): Promise<number> {
  const p = getPool();
  if (p) {
    try {
      await ensureSchema(p);
      const res = await p.query(
        "SELECT value FROM budget_counters WHERE name = $1 AND period = $2",
        [name, period]
      );
      return res.rows[0] ? Number(res.rows[0].value) : 0;
    } catch {
      // Fall through to the file store on any DB failure.
    }
  }
  const data = readFile();
  return data[fileKey(name, period)] ?? 0;
}

export async function counterAdd(
  name: string,
  period: string,
  delta: number
): Promise<number> {
  const p = getPool();
  if (p) {
    try {
      await ensureSchema(p);
      const res = await p.query(
        `INSERT INTO budget_counters (name, period, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (name, period)
         DO UPDATE SET value = budget_counters.value + EXCLUDED.value
         RETURNING value`,
        [name, period, delta]
      );
      return Number(res.rows[0].value);
    } catch {
      // Fall through to the file store on any DB failure.
    }
  }
  const key = fileKey(name, period);
  const data = readFile();
  const next = (data[key] ?? 0) + delta;
  data[key] = next;
  writeFile(data);
  return next;
}
