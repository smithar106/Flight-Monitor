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
    <div className={`rounded-lg border border-line bg-surface shadow-panel ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="text-[0.6875rem] font-medium uppercase tracking-eyebrow text-ink-faint">
            {eyebrow}
          </div>
        )}
        <h2 className="mt-0.5 text-base font-semibold tracking-tight text-ink">{title}</h2>
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
      ? "px-3 py-1 text-[0.8125rem]"
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
  size = "md",
}: {
  score: number;
  status: StatusLevel;
  size?: "sm" | "md" | "lg";
}) {
  const meta = STATUS_META[status];
  const num = size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-3xl";
  const unit = size === "lg" ? "text-sm" : size === "sm" ? "text-xs" : "text-sm";
  return (
    <div className="flex items-baseline gap-1">
      <span className={`font-mono ${num} font-semibold leading-none tracking-tight tabular-nums ${meta.text}`}>
        {score}
      </span>
      <span className={`font-mono ${unit} tabular-nums text-ink-faint`}>/100</span>
    </div>
  );
}

export function Dot({ status }: { status: StatusLevel }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${STATUS_META[status].dot}`} />
  );
}

export function Metric({
  value,
  label,
  sub,
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[1.75rem] font-medium leading-none tracking-tight tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-1.5 text-[0.8125rem] text-ink-muted">{label}</div>
      {sub ? <div className="mt-0.5 text-[0.6875rem] text-ink-faint">{sub}</div> : null}
    </div>
  );
}
