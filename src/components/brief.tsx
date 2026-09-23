"use client";

import { useEffect, useState } from "react";
import type { OperationsBrief } from "@/lib/types";

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-11/12 animate-pulse rounded bg-surface-3" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-surface-3" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-surface-3" />
    </div>
  );
}

export function Brief() {
  const [brief, setBrief] = useState<OperationsBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/brief")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (active) setBrief(d);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-lg border border-line bg-surface shadow-panel">
      <div className="border-l-2 border-l-pulse p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[0.6875rem] font-medium uppercase tracking-eyebrow text-ink-faint">
            AI operations brief
          </div>
          <span className="text-[0.6875rem] text-ink-faint">
            {brief?.generatedBy === "llm" ? "AI · from live metrics" : "Auto-generated"}
          </span>
        </div>

        {loading ? (
          <div className="mt-4">
            <Skeleton />
          </div>
        ) : error || !brief ? (
          <p className="mt-4 text-body text-ink-muted">
            The operations brief is unavailable right now. Live metrics remain available below.
          </p>
        ) : (
          <>
            <p className="mt-4 text-[1.0625rem] leading-[1.6] text-ink">{brief.body}</p>

            {brief.references.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-5">
                {brief.references.map((r) => (
                  <div key={r.label}>
                    <div className="text-[0.625rem] font-medium uppercase tracking-eyebrow text-ink-faint">
                      {r.label}
                    </div>
                    <div className="mt-0.5 font-mono text-[0.8125rem] tabular-nums text-ink">
                      {r.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
