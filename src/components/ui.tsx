import type { ReactNode } from "react";
import type { StatusLevel } from "@/lib/types";
import { STATUS_META } from "@/lib/format";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-sm2 border border-line bg-surface shadow-panel ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <div className="text-[0.6875rem] font-semibold uppercase tracking-eyebrow text-ink-faint">
          {eyebrow}
        </div>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

export function StatusPill({
  status,
  size = "md",
}: {
  status: StatusLevel;
  size?: "sm" | "md" | "lg";
}) {
  const meta = STATUS_META[status];
  const dims =
    size === "lg"
      ? "px-3.5 py-1.5 text-sm"
      : size === "sm"
        ? "px-2 py-0.5 text-[0.6875rem]"
        : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${meta.border} ${meta.bg} ${meta.text} font-medium ${dims}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function ScoreBadge({
  score,
  status,
}: {
  score: number;
  status: StatusLevel;
}) {
  const meta = STATUS_META[status];
  return (
    <div className="flex items-baseline gap-1">
      <span
        className={`font-mono text-2xl font-semibold tabular-nums ${meta.text}`}
      >
        {score}
      </span>
      <span className={`font-mono text-xs tabular-nums text-ink-faint`}>
        / 100
      </span>
    </div>
  );
}

export function Dot({ status }: { status: StatusLevel }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${STATUS_META[status].dot}`}
    />
  );
}
