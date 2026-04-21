import type { Stage } from "@/lib/preview/fixtures";
import { computeStaleness, humanHours, staleBadgeStyle, staleDot } from "@/lib/features/leads/sla";

export function StaleDot({
  stage,
  lastStageChangeAt,
  className = "",
}: {
  stage: Stage;
  lastStageChangeAt?: string | null;
  className?: string;
}) {
  const { level, hours } = computeStaleness(stage, lastStageChangeAt);
  if (level === "fresh") return null;
  return (
    <span
      title={`${level === "stale" ? "Stale" : "Slow"} — ${humanHours(hours)} in ${stage.replace(/_/g, " ").toLowerCase()}`}
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${staleDot(level)} ${className}`}
    />
  );
}

export function StaleBadge({
  stage,
  lastStageChangeAt,
  className = "",
}: {
  stage: Stage;
  lastStageChangeAt?: string | null;
  className?: string;
}) {
  const { level, hours } = computeStaleness(stage, lastStageChangeAt);
  if (level === "fresh") return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${staleBadgeStyle(level)} ${className}`}
      title={`${level === "stale" ? "Stale" : "Slow"} — ${humanHours(hours)} in stage`}
    >
      {level === "stale" ? "stale" : "slow"} · {humanHours(hours)}
    </span>
  );
}
