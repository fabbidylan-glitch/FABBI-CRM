import "server-only";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db/resilient";
import { listLeads, type LeadListItem } from "@/lib/features/leads/queries";
import {
  DASHBOARD_KPIS,
  SOURCE_PERFORMANCE,
  TASKS,
  type SourcePerf,
  type TaskItem,
} from "@/lib/preview/fixtures";

export type Kpis = typeof DASHBOARD_KPIS;

export async function getDashboardKpis(): Promise<Kpis> {
  if (!config.dbEnabled) return DASHBOARD_KPIS;

  return safeQuery(
    "dashboard.kpis",
    async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Monthly activity KPIs count DISTINCT leads that reached each stage
      // this month. Using distinct leadId (not raw event count) prevents a
      // lead yo-yoing between stages during testing from inflating numbers —
      // a lead that bounced WON → PROPOSAL_SENT → WON counts as 1 Won, not 2.
      const [
        leadsThisMonth,
        qualifiedThisMonth,
        consultsBookedLeads,
        proposalsSentLeads,
        wonLeads,
      ] = await Promise.all([
        prisma.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.lead.count({
          where: { createdAt: { gte: startOfMonth }, qualificationStatus: "QUALIFIED" },
        }),
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "CONSULT_BOOKED",
            createdAt: { gte: startOfMonth },
          },
          distinct: ["leadId"],
          select: { leadId: true },
        }),
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "PROPOSAL_SENT",
            createdAt: { gte: startOfMonth },
          },
          distinct: ["leadId"],
          select: { leadId: true },
        }),
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "WON",
            createdAt: { gte: startOfMonth },
          },
          distinct: ["leadId"],
          select: { leadId: true },
        }),
      ]);

      const consultsBookedThisMonth = consultsBookedLeads.length;
      const proposalsSent = proposalsSentLeads.length;

      // Won this month reflects current state: a lead that went WON then got
      // reversed to LOST (e.g. test data, clawback) should NOT count. We
      // filter the distinct-lead list against leads whose pipelineStage is
      // still WON — the event said they won but the record says they're not
      // anymore. Same filter drives wonArrThisMonth so the ARR matches.
      const wonLeadRecords =
        wonLeads.length > 0
          ? await prisma.lead.findMany({
              where: {
                id: { in: wonLeads.map((l) => l.leadId) },
                pipelineStage: "WON",
              },
              select: { estimatedAnnualValue: true },
            })
          : [];
      const wonThisMonth = wonLeadRecords.length;
      const wonArrThisMonth = wonLeadRecords.reduce(
        (sum, l) => sum + (l.estimatedAnnualValue ? Number(l.estimatedAnnualValue) : 0),
        0
      );
      const pipelineValueAgg = await prisma.lead.aggregate({
        where: {
          status: "ACTIVE",
          pipelineStage: { notIn: ["WON", "LOST", "COLD_NURTURE"] },
        },
        _sum: { estimatedAnnualValue: true },
      });

      // Avg response time: minutes between lead.createdAt and the first
      // outbound Communication for leads created in the last 30 days.
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3_600_000);
      const responseSample = await prisma.lead.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: {
          createdAt: true,
          communications: {
            where: { direction: "OUTBOUND", sentAt: { not: null } },
            orderBy: { sentAt: "asc" },
            take: 1,
            select: { sentAt: true },
          },
        },
        take: 500,
      });
      const deltas = responseSample
        .map((l) => {
          const first = l.communications[0]?.sentAt;
          if (!first) return null;
          return (first.getTime() - l.createdAt.getTime()) / 60_000;
        })
        .filter((d): d is number => d !== null && d >= 0);
      const avgResponseMinutes =
        deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0;

      // Show rate: of distinct leads who BOOKED a consult in the last 30 days,
      // how many actually moved to CONSULT_COMPLETED. Both directions are
      // event-sourced and distinct on leadId so the same lead doesn't skew
      // the ratio.
      const [bookedLeads30d, completedLeads30d] = await Promise.all([
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "CONSULT_BOOKED",
            createdAt: { gte: thirtyDaysAgo },
          },
          distinct: ["leadId"],
          select: { leadId: true },
        }),
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "CONSULT_COMPLETED",
            createdAt: { gte: thirtyDaysAgo },
          },
          distinct: ["leadId"],
          select: { leadId: true },
        }),
      ]);
      const showRate =
        bookedLeads30d.length > 0
          ? Number((completedLeads30d.length / bookedLeads30d.length).toFixed(2))
          : 0;

      return {
        leadsThisMonth,
        qualifiedThisMonth,
        consultsBookedThisMonth,
        proposalsSent,
        wonThisMonth,
        wonArrThisMonth,
        pipelineValue: Number(pipelineValueAgg._sum.estimatedAnnualValue ?? 0),
        avgResponseMinutes,
        showRate,
        closeRate: proposalsSent > 0 ? Number((wonThisMonth / proposalsSent).toFixed(2)) : 0,
      };
    },
    () => DASHBOARD_KPIS
  );
}

export async function getSourcePerformance(): Promise<SourcePerf[]> {
  if (!config.dbEnabled) return SOURCE_PERFORMANCE;

  return safeQuery(
    "dashboard.sourcePerf",
    async () => {
      const groups = await prisma.lead.groupBy({
        by: ["source"],
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
      });

      const out: SourcePerf[] = [];
      for (const g of groups) {
        const [qualified, consults, proposals, won, wonArrAgg, spendAgg] = await Promise.all([
          prisma.lead.count({ where: { source: g.source, qualificationStatus: "QUALIFIED" } }),
          prisma.lead.count({
            where: {
              source: g.source,
              pipelineStage: { in: ["CONSULT_BOOKED", "CONSULT_COMPLETED"] },
            },
          }),
          prisma.proposal.count({
            where: { lead: { source: g.source }, proposalStatus: { not: "DRAFT" } },
          }),
          prisma.proposal.count({
            where: { lead: { source: g.source }, acceptedAt: { not: null } },
          }),
          prisma.proposal.aggregate({
            where: { lead: { source: g.source }, acceptedAt: { not: null } },
            _sum: { annualValue: true },
          }),
          prisma.marketingSpend.aggregate({
            where: { source: g.source },
            _sum: { spendAmount: true },
          }),
        ]);
        out.push({
          source: prettyEnum(g.source),
          leads: g._count._all,
          qualified,
          consults,
          proposals,
          won,
          wonArr: Number(wonArrAgg._sum.annualValue ?? 0),
          spend: Number(spendAgg._sum.spendAmount ?? 0),
        });
      }
      return out;
    },
    () => SOURCE_PERFORMANCE
  );
}

export async function getRecentLeads(n: number): Promise<LeadListItem[]> {
  const all = await listLeads();
  return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, n);
}

export async function getOpenTasks(): Promise<TaskItem[]> {
  if (!config.dbEnabled) return TASKS;

  return safeQuery(
    "dashboard.openTasks",
    async () => {
      const rows = await prisma.task.findMany({
        where: { status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
        include: { assignedUser: true, lead: { select: { id: true } } },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
        take: 20,
      });
      return rows.map((t) => ({
        id: t.id,
        leadId: t.leadId,
        title: t.title,
        type: (["CALL", "EMAIL", "SMS", "MEETING", "REVIEW"].includes(t.taskType)
          ? t.taskType
          : "CALL") as TaskItem["type"],
        dueAt: (t.dueAt ?? t.createdAt).toISOString(),
        priority: t.priority,
        assignee: t.assignedUser
          ? `${t.assignedUser.firstName} ${t.assignedUser.lastName}`
          : "Unassigned",
      }));
    },
    () => TASKS
  );
}

function prettyEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
