"use client";

import { useState } from "react";
import type { AskAnswer } from "@/lib/types";

const EXAMPLES = [
  "Why are delays high today?",
  "Which airports are deteriorating fastest?",
  "How is JFK doing compared with normal?",
  "Where are cancellations concentrated?",
  "Which airline is performing unusually well?",
  "What should I be watching this afternoon?",
];

export function Ask() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setAnswer(data);
      }
    } catch {
      setError("Unable to reach the analysis service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(question)}
          placeholder="Ask about U.S. flight operations…"
          className="min-w-0 flex-1 rounded-sm2 border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pulse focus:outline-none"
        />
        <button
          onClick={() => submit(question)}
          disabled={loading || !question.trim()}
          className="rounded-sm2 bg-pulse px-4 py-2.5 text-sm font-medium text-abyss transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "…" : "Ask"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => {
              setQuestion(e);
              submit(e);
            }}
            className="rounded-full border border-line px-2.5 py-1 text-[0.6875rem] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {e}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-4 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-severe">{error}</p>}

      {answer && !loading && (
        <div className="mt-4 rounded-sm2 border border-line bg-surface-2 p-4">
          <p className="text-sm leading-relaxed text-ink/90">{answer.answer}</p>
          {answer.evidence.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3">
              {answer.evidence.map((ev) => (
                <div key={ev.label}>
                  <div className="text-[0.625rem] uppercase tracking-eyebrow text-ink-faint">
                    {ev.label}
                  </div>
                  <div className="font-mono text-xs tabular-nums text-ink">
                    {ev.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
