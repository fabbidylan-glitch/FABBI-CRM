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
      // Previously this fanned out to 1 + 6×N queries (one per LeadSource per
      // metric) — with 14 sources that's up to 85 round-trips per dashboard
      // load on a free-tier Neon. Now we issue 5 queries total: three groupBy
      // on Lead, one findMany on Proposal (small table; bucket in JS by
      // lead.source which Prisma groupBy can't reach across the relation),
      // and one groupBy on MarketingSpend.
      const [leadTotals, leadQualified, leadConsults, proposals, spendTotals] =
        await Promise.all([
          prisma.lead.groupBy({
            by: ["source"],
            _count: { _all: true },
          }),
          prisma.lead.groupBy({
            by: ["source"],
            _count: { _all: true },
            where: { qualificationStatus: "QUALIFIED" },
          }),
          prisma.lead.groupBy({
            by: ["source"],
            _count: { _all: true },
            where: { pipelineStage: { in: ["CONSULT_BOOKED", "CONSULT_COMPLETED"] } },
          }),
          prisma.proposal.findMany({
            where: { proposalStatus: { not: "DRAFT" } },
            select: {
              acceptedAt: true,
              annualValue: true,
              lead: { select: { source: true } },
            },
          }),
          prisma.marketingSpend.groupBy({
            by: ["source"],
            _sum: { spendAmount: true },
          }),
        ]);

      // Index helpers — keyed by LeadSource enum value.
      const qualifiedBy = new Map(
        leadQualified.map((g) => [g.source, g._count._all])
      );
      const consultsBy = new Map(
        leadConsults.map((g) => [g.source, g._count._all])
      );
      const spendBy = new Map(
        spendTotals.map((g) => [g.source, Number(g._sum.spendAmount ?? 0)])
      );

      // Bucket proposals by lead.source in one pass.
      const proposalsBy = new Map<string, number>();
      const wonBy = new Map<string, number>();
      const wonArrBy = new Map<string, number>();
      for (const p of proposals) {
        const src = p.lead.source;
        proposalsBy.set(src, (proposalsBy.get(src) ?? 0) + 1);
        if (p.acceptedAt) {
          wonBy.set(src, (wonBy.get(src) ?? 0) + 1);
          wonArrBy.set(src, (wonArrBy.get(src) ?? 0) + Number(p.annualValue ?? 0));
        }
      }

      // Sort by total leads desc to match the previous orderBy contract.
      return [...leadTotals]
        .sort((a, b) => b._count._all - a._count._all)
        .map<SourcePerf>((g) => ({
          source: prettyEnum(g.source),
          leads: g._count._all,
          qualified: qualifiedBy.get(g.source) ?? 0,
          consults: consultsBy.get(g.source) ?? 0,
          proposals: proposalsBy.get(g.source) ?? 0,
          won: wonBy.get(g.source) ?? 0,
          wonArr: wonArrBy.get(g.source) ?? 0,
          spend: spendBy.get(g.source) ?? 0,
        }));
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
