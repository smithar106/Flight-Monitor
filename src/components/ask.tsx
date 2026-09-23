"use client";

import { useState } from "react";
import type { AskAnswer } from "@/lib/types";

const SUGGESTIONS = [
  "Where is disruption worst right now?",
  "Why are delays high today?",
  "How is JFK doing vs normal?",
  "Where are cancellations concentrated?",
  "Which airline is performing unusually well?",
];

export function Ask() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  async function submit(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setShowEvidence(false);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong");
      else setAnswer(data);
    } catch {
      setError("Unable to reach the analysis service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(question)}
            placeholder="Ask about U.S. flight operations…"
            aria-label="Ask a question about flight operations"
            className="w-full rounded-lg border border-line bg-surface pl-9 pr-3 py-2.5 text-[0.875rem] text-ink placeholder:text-ink-faint transition-colors focus:border-pulse focus:outline-none"
          />
        </div>
        <button
          onClick={() => submit(question)}
          disabled={loading || !question.trim()}
          className="rounded-lg bg-pulse px-4 text-[0.875rem] font-medium text-white transition-colors hover:bg-pulse-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "…" : "Ask"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQuestion(s);
              submit(s);
            }}
            className="rounded-full border border-line bg-surface px-3 py-1 text-[0.75rem] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-5 flex items-center gap-2 text-[0.8125rem] text-ink-faint">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pulse" />
          Analyzing current conditions…
        </div>
      )}

      {error && <p className="mt-5 text-[0.875rem] text-severe">{error}</p>}

      {answer && !loading && (
        <div className="mt-5">
          <p className="text-[0.9375rem] leading-relaxed text-ink">{answer.answer}</p>

          {answer.evidence.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowEvidence((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-muted transition-colors hover:text-ink"
                aria-expanded={showEvidence}
              >
                {showEvidence ? "Hide" : "View"} evidence
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                  className={`transition-transform ${showEvidence ? "rotate-180" : ""}`}
                >
                  <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showEvidence && (
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-line bg-surface-2 p-4 sm:grid-cols-3">
                  {answer.evidence.map((ev) => (
                    <div key={ev.label}>
                      <dt className="text-[0.625rem] font-medium uppercase tracking-eyebrow text-ink-faint">
                        {ev.label}
                      </dt>
                      <dd className="mt-0.5 font-mono text-[0.8125rem] tabular-nums text-ink">
                        {ev.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
