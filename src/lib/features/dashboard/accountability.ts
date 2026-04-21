import "server-only";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db/resilient";

export type OverdueTask = {
  id: string;
  title: string;
  leadId: string;
  leadName: string;
  assignee: string;
  dueAt: string;
  hoursOverdue: number;
};

export type StuckLead = {
  id: string;
  name: string;
  stage: string;
  hoursInStage: number;
  estimatedAnnualValue: number | null;
  ownerName: string | null;
};

/**
 * Tasks with `dueAt` in the past and status not COMPLETED/CANCELLED. Used
 * on the Dashboard to make stalled follow-ups impossible to ignore.
 */
export async function getOverdueTasks(
  limit = 25,
  opts: { assignedUserId?: string } = {}
): Promise<OverdueTask[]> {
  if (!config.dbEnabled) return [];
  return safeQuery(
    "dashboard.overdueTasks",
    async () => {
      const now = new Date();
      const rows = await prisma.task.findMany({
        where: {
          status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] },
          dueAt: { lt: now },
          ...(opts.assignedUserId ? { assignedUserId: opts.assignedUserId } : {}),
        },
        orderBy: [{ dueAt: "asc" }],
        take: limit,
        include: {
          assignedUser: { select: { firstName: true, lastName: true } },
          lead: { select: { firstName: true, lastName: true, fullName: true } },
        },
      });
      return rows.map((t) => ({
        id: t.id,
        title: t.title,
        leadId: t.leadId,
        leadName:
          t.lead.fullName ||
          `${t.lead.firstName ?? ""} ${t.lead.lastName ?? ""}`.trim() ||
          "Unknown",
        assignee: t.assignedUser
          ? `${t.assignedUser.firstName} ${t.assignedUser.lastName}`.trim()
          : "Unassigned",
        dueAt: (t.dueAt ?? t.createdAt).toISOString(),
        hoursOverdue: t.dueAt
          ? Math.round((now.getTime() - t.dueAt.getTime()) / 3_600_000)
          : 0,
      }));
    },
    () => []
  );
}

/**
 * "Stuck" leads: in an active stage past its SLA threshold. Used so the
 * dashboard surfaces deals the team has forgotten about.
 */
export async function getStuckLeads(
  limit = 10,
  opts: { ownerUserId?: string } = {}
): Promise<StuckLead[]> {
  if (!config.dbEnabled) return [];

  return safeQuery(
    "dashboard.stuckLeads",
    async () => {
      // Pull leads whose most recent stage change was > 48h ago and that are
      // still in an active (non-terminal) stage. We then filter by per-stage
      // SLA thresholds in memory.
      const candidates = await prisma.lead.findMany({
        where: {
          status: "ACTIVE",
          ...(opts.ownerUserId ? { ownerUserId: opts.ownerUserId } : {}),
          pipelineStage: {
            in: [
              "NEW_LEAD",
              "CONTACTED",
              "QUALIFIED",
              "CONSULT_BOOKED",
              "CONSULT_COMPLETED",
              "PROPOSAL_DRAFTING",
              "PROPOSAL_SENT",
              "FOLLOW_UP_NEGOTIATION",
            ],
          },
        },
        orderBy: { updatedAt: "asc" },
        take: 200,
        include: {
          owner: { select: { firstName: true, lastName: true } },
          pipelineEvents: {
            where: { eventType: "STAGE_CHANGED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      });

      const now = Date.now();
      // Stale hours threshold per stage — past this = show as stuck.
      const threshold: Record<string, number> = {
        NEW_LEAD: 4,
        CONTACTED: 72,
        QUALIFIED: 72,
        CONSULT_BOOKED: 168,
        CONSULT_COMPLETED: 72,
        PROPOSAL_DRAFTING: 72,
        PROPOSAL_SENT: 168,
        FOLLOW_UP_NEGOTIATION: 120,
      };

      const stuck: StuckLead[] = [];
      for (const l of candidates) {
        const anchor = l.pipelineEvents[0]?.createdAt ?? l.createdAt;
        const hours = (now - anchor.getTime()) / 3_600_000;
        const t = threshold[l.pipelineStage] ?? Infinity;
        if (hours >= t) {
          stuck.push({
            id: l.id,
            name:
              l.fullName ||
              `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() ||
              l.email ||
              "Unknown",
            stage: l.pipelineStage,
            hoursInStage: Math.round(hours),
            estimatedAnnualValue: l.estimatedAnnualValue
              ? Number(l.estimatedAnnualValue)
              : null,
            ownerName: l.owner ? `${l.owner.firstName} ${l.owner.lastName}`.trim() : null,
          });
        }
        if (stuck.length >= limit) break;
      }

      // Worst offenders first.
      stuck.sort((a, b) => b.hoursInStage - a.hoursInStage);
      return stuck;
    },
    () => []
  );
}

/** Active, unarchived leads with no owner assigned. */
export async function countUnassignedLeads(): Promise<number> {
  if (!config.dbEnabled) return 0;
  return safeQuery(
    "dashboard.unassigned",
    () =>
      prisma.lead.count({
        where: {
          status: "ACTIVE",
          ownerUserId: null,
          pipelineStage: { notIn: ["WON", "LOST", "COLD_NURTURE"] },
        },
      }),
    () => 0
  );
}
