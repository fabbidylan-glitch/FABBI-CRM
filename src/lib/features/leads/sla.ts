import type { Stage } from "@/lib/preview/fixtures";

/**
 * Per-stage hours before a deal is considered "slow" (amber) or "stale" (red).
 * Tuned to FABBI's sales cadence — early stages move fast, later stages
 * (e.g. waiting on the client to sign a proposal) are allowed to breathe.
 *
 * Once the RuleConfig admin UI exists, these move to DB.
 */
const STAGE_SLA_HOURS: Record<Stage, { amber: number; red: number } | null> = {
  NEW_LEAD: { amber: 1, red: 4 }, // A-lead SLA is 5 minutes; amber after 1h
  CONTACTED: { amber: 24, red: 72 },
  QUALIFIED: { amber: 24, red: 72 },
  CONSULT_BOOKED: { amber: 48, red: 168 },
  CONSULT_COMPLETED: { amber: 24, red: 72 },
  PROPOSAL_DRAFTING: { amber: 24, red: 72 },
  PROPOSAL_SENT: { amber: 72, red: 168 },
  FOLLOW_UP_NEGOTIATION: { amber: 48, red: 120 },
  // Terminal or dormant stages don't go stale.
  WON: null,
  LOST: null,
  COLD_NURTURE: null,
};

export type StaleLevel = "fresh" | "slow" | "stale";

export function computeStaleness(
  stage: Stage,
  lastStageChangeAt: string | Date | null | undefined,
  now: Date = new Date()
): { level: StaleLevel; hours: number } {
  const sla = STAGE_SLA_HOURS[stage];
  if (!sla) return { level: "fresh", hours: 0 };
  const anchor = lastStageChangeAt ? new Date(lastStageChangeAt) : null;
  if (!anchor) return { level: "fresh", hours: 0 };
  const hours = (now.getTime() - anchor.getTime()) / 3_600_000;
  if (hours >= sla.red) return { level: "stale", hours };
  if (hours >= sla.amber) return { level: "slow", hours };
  return { level: "fresh", hours };
}

export function staleBadgeStyle(level: StaleLevel): string {
  switch (level) {
    case "stale":
      return "bg-rose-100 text-rose-800 ring-rose-200";
    case "slow":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    case "fresh":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }
}

export function staleDot(level: StaleLevel): string {
  switch (level) {
    case "stale":
      return "bg-rose-500";
    case "slow":
      return "bg-amber-500";
    case "fresh":
      return "bg-emerald-500";
  }
}

export function humanHours(hours: number): string {
  if (hours < 1) {
    const m = Math.max(1, Math.round(hours * 60));
    return `${m}m`;
  }
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
