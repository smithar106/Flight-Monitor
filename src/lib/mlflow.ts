// Minimal, best-effort MLflow Tracking client (REST API).
//
// Used to log agent performance and infra processes. It is disabled unless
// MLFLOW_TRACKING_URI is set, and every call is fire-and-forget + swallowed:
// telemetry must never affect the product.

const URI = (process.env.MLFLOW_TRACKING_URI ?? "").replace(/\/+$/, "");

const experimentIds = new Map<string, string>();

function enabled(): boolean {
  return URI.length > 0;
}

async function request(path: string, method: "GET" | "POST", body?: unknown): Promise<any> {
  const res = await fetch(`${URI}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`MLflow HTTP ${res.status}`);
  return res.json();
}

async function ensureExperiment(name: string): Promise<string> {
  const cached = experimentIds.get(name);
  if (cached) return cached;

  let id: string | undefined;
  try {
    const byName = await request(
      `/api/2.0/mlflow/experiments/get-by-name?experiment_name=${encodeURIComponent(name)}`,
      "GET"
    );
    id = byName?.experiment?.experiment_id;
  } catch {
    // 404 = experiment does not exist yet — fall through to create it.
  }

  if (!id) {
    const created = await request("/api/2.0/mlflow/experiments/create", "POST", { name });
    id = created?.experiment_id;
  }

  if (!id) throw new Error("MLflow experiment create returned no id");
  experimentIds.set(name, id);
  return id;
}

export interface MlflowRun {
  experiment: string;
  runName: string;
  params?: Record<string, string>;
  metrics?: Record<string, number>;
  tags?: Record<string, string>;
  status?: "FINISHED" | "FAILED";
}

export function mlflowEnabled(): boolean {
  return enabled();
}

export async function logRun(entry: MlflowRun): Promise<void> {
  if (!enabled()) return;
  try {
    const experimentId = await ensureExperiment(entry.experiment);
    const created = await request("/api/2.0/mlflow/runs/create", "POST", {
      experiment_id: experimentId,
      run_name: entry.runName,
      start_time: Date.now(),
      tags: Object.entries(entry.tags ?? {}).map(([key, value]) => ({ key, value })),
    });
    const runId = created?.run?.info?.run_id;
    if (!runId) return;

    const payload: Record<string, unknown> = { run_id: runId };
    if (entry.metrics && Object.keys(entry.metrics).length > 0) {
      payload.metrics = Object.entries(entry.metrics).map(([key, value]) => ({
        key,
        value,
        timestamp: Date.now(),
        step: 0,
      }));
    }
    if (entry.params && Object.keys(entry.params).length > 0) {
      payload.params = Object.entries(entry.params).map(([key, value]) => ({ key, value }));
    }
    await request("/api/2.0/mlflow/runs/log-batch", "POST", payload);
    await request("/api/2.0/mlflow/runs/update", "POST", {
      run_id: runId,
      status: entry.status ?? "FINISHED",
      end_time: Date.now(),
    });
  } catch {
    // Best-effort: ignore any telemetry failure.
  }
}
