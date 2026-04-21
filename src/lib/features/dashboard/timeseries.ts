import "server-only";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db/resilient";
import type { PipelineStage } from "@prisma/client";

/**
 * Time-series + funnel queries powering the dashboard sparklines and hero
 * numbers. Kept separate from `queries.ts` so the dashboard landing page can
 * parallelize these with the point-in-time KPIs.
 *
 * Philosophy: one SQL-friendly roundtrip per metric. We bucket in app code
 * (not Postgres date_trunc) to keep the query simple and to avoid leaking
 * timezone edge cases.
 */

export type DailySeries = {
  /** Count or sum per day, oldest → newest. Length = window days. */
  values: number[];
  /** Total across the window. */
  total: number;
  /** Matching total for the *previous* window (used for deltas). */
  prevTotal: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dayBuckets(count: number): { starts: Date[]; windowStart: Date; windowEnd: Date } {
  // Bucket aligned to local midnight so "today" is the last bucket.
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1); // exclusive upper bound = start of tomorrow
  const starts: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - (i + 1) * DAY_MS);
    starts.push(d);
  }
  const windowStart = new Date(starts[0]);
  return { starts, windowStart, windowEnd: end };
}

function bucketize(createdAts: Date[], starts: Date[]): number[] {
  const values = new Array(starts.length).fill(0);
  if (createdAts.length === 0) return values;
  const starts_ms = starts.map((s) => s.getTime());
  for (const t of createdAts) {
    const ts = t.getTime();
    // Find the largest bucket-start ≤ ts. Since we may have up to 30 buckets,
    // a linear scan is totally fine.
    for (let i = starts_ms.length - 1; i >= 0; i--) {
      if (ts >= starts_ms[i]) {
        values[i]++;
        break;
      }
    }
  }
  return values;
}

/**
 * Count of Lead rows created per day for the last `days` days, plus the
 * previous-period total for delta comparisons.
 */
export async function getLeadsSeries(days = 30): Promise<DailySeries> {
  return safeQuery<DailySeries>(
    "dashboard.series.leads",
    async () => {
      const { starts, windowStart, windowEnd } = dayBuckets(days);
      const prevStart = new Date(windowStart.getTime() - days * DAY_MS);

      const [inWindow, prev] = await Promise.all([
        prisma.lead.findMany({
          where: { createdAt: { gte: windowStart, lt: windowEnd } },
          select: { createdAt: true },
        }),
        prisma.lead.count({
          where: { createdAt: { gte: prevStart, lt: windowStart } },
        }),
      ]);

      const values = bucketize(
        inWindow.map((l) => l.createdAt),
        starts
      );
      return { values, total: inWindow.length, prevTotal: prev };
    },
    () => ({ values: new Array(days).fill(0), total: 0, prevTotal: 0 })
  );
}

/** Per-day STAGE_CHANGED-into-target-stage — deduped per lead per day. */
async function stageSeries(stage: PipelineStage, days = 30): Promise<DailySeries> {
  const { starts, windowStart, windowEnd } = dayBuckets(days);
  const prevStart = new Date(windowStart.getTime() - days * DAY_MS);

  const [inWindow, prev] = await Promise.all([
    prisma.pipelineEvent.findMany({
      where: {
        eventType: "STAGE_CHANGED",
        toStage: stage,
        createdAt: { gte: windowStart, lt: windowEnd },
      },
      distinct: ["leadId"],
      select: { createdAt: true },
    }),
    prisma.pipelineEvent.findMany({
      where: {
        eventType: "STAGE_CHANGED",
        toStage: stage,
        createdAt: { gte: prevStart, lt: windowStart },
      },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
  ]);

  const values = bucketize(
    inWindow.map((e) => e.createdAt),
    starts
  );
  return { values, total: inWindow.length, prevTotal: prev.length };
}

export async function getQualifiedSeries(days = 30): Promise<DailySeries> {
  return safeQuery<DailySeries>(
    "dashboard.series.qualified",
    async () => {
      const { starts, windowStart, windowEnd } = dayBuckets(days);
      const prevStart = new Date(windowStart.getTime() - days * DAY_MS);
      const [inWindow, prev] = await Promise.all([
        prisma.lead.findMany({
          where: {
            qualificationStatus: "QUALIFIED",
            createdAt: { gte: windowStart, lt: windowEnd },
          },
          select: { createdAt: true },
        }),
        prisma.lead.count({
          where: {
            qualificationStatus: "QUALIFIED",
            createdAt: { gte: prevStart, lt: windowStart },
          },
        }),
      ]);
      return {
        values: bucketize(inWindow.map((l) => l.createdAt), starts),
        total: inWindow.length,
        prevTotal: prev,
      };
    },
    () => ({ values: new Array(days).fill(0), total: 0, prevTotal: 0 })
  );
}

export async function getConsultsSeries(days = 30): Promise<DailySeries> {
  return safeQuery("dashboard.series.consults", () => stageSeries("CONSULT_BOOKED", days), () => ({
    values: new Array(days).fill(0),
    total: 0,
    prevTotal: 0,
  }));
}

export async function getProposalsSeries(days = 30): Promise<DailySeries> {
  return safeQuery("dashboard.series.proposals", () => stageSeries("PROPOSAL_SENT", days), () => ({
    values: new Array(days).fill(0),
    total: 0,
    prevTotal: 0,
  }));
}

export async function getWonSeries(days = 30): Promise<DailySeries> {
  return safeQuery("dashboard.series.won", () => stageSeries("WON", days), () => ({
    values: new Array(days).fill(0),
    total: 0,
    prevTotal: 0,
  }));
}

/**
 * ARR won per day for the window — sum each lead's estimatedAnnualValue into
 * the bucket its STAGE_CHANGED→WON event landed in. Kept as a separate
 * function because it involves a second fetch (lead values) that shouldn't
 * run on every metric.
 */
export async function getWonArrSeries(days = 30): Promise<DailySeries> {
  return safeQuery<DailySeries>(
    "dashboard.series.wonArr",
    async () => {
      const { starts, windowStart, windowEnd } = dayBuckets(days);
      const prevStart = new Date(windowStart.getTime() - days * DAY_MS);

      const [wonEvts, prevEvts] = await Promise.all([
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "WON",
            createdAt: { gte: windowStart, lt: windowEnd },
          },
          distinct: ["leadId"],
          select: { leadId: true, createdAt: true },
        }),
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "WON",
            createdAt: { gte: prevStart, lt: windowStart },
          },
          distinct: ["leadId"],
          select: { leadId: true },
        }),
      ]);

      const ids = Array.from(new Set([...wonEvts.map((e) => e.leadId), ...prevEvts.map((e) => e.leadId)]));
      const valueMap = new Map<string, number>();
      if (ids.length > 0) {
        const rows = await prisma.lead.findMany({
          where: { id: { in: ids } },
          select: { id: true, estimatedAnnualValue: true },
        });
        for (const r of rows) {
          valueMap.set(r.id, Number(r.estimatedAnnualValue ?? 0));
        }
      }

      const starts_ms = starts.map((s) => s.getTime());
      const values = new Array(starts.length).fill(0);
      let total = 0;
      for (const e of wonEvts) {
        const v = valueMap.get(e.leadId) ?? 0;
        total += v;
        const ts = e.createdAt.getTime();
        for (let i = starts_ms.length - 1; i >= 0; i--) {
          if (ts >= starts_ms[i]) {
            values[i] += v;
            break;
          }
        }
      }

      const prevTotal = prevEvts.reduce((sum, e) => sum + (valueMap.get(e.leadId) ?? 0), 0);
      return { values, total, prevTotal };
    },
    () => ({ values: new Array(days).fill(0), total: 0, prevTotal: 0 })
  );
}

/**
 * Pipeline conversion funnel — counts of DISTINCT leads that reached each
 * stage in the last `days` days. A lead counts at every stage it *has ever*
 * reached, so PROPOSAL_SENT naturally is ≤ CONSULT_BOOKED ≤ QUALIFIED ≤
 * LEAD_CREATED. (We don't require linear progression — a lead that skipped
 * stages still counts at whatever it landed on.)
 */
export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  /** Drop-off percentage relative to the previous stage — null for the first. */
  dropOffPct: number | null;
};

export async function getPipelineFunnel(days = 30): Promise<FunnelStage[]> {
  return safeQuery<FunnelStage[]>(
    "dashboard.funnel",
    async () => {
      const { windowStart, windowEnd } = dayBuckets(days);

      // Lead created in the window — the "top of funnel" for this period.
      const [leadCount, qualifiedCount, consultsBooked, consultsCompleted, proposalsSent, wons] = await Promise.all([
        prisma.lead.count({ where: { createdAt: { gte: windowStart, lt: windowEnd } } }),
        prisma.lead.count({
          where: {
            qualificationStatus: "QUALIFIED",
            createdAt: { gte: windowStart, lt: windowEnd },
          },
        }),
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "CONSULT_BOOKED",
            createdAt: { gte: windowStart, lt: windowEnd },
          },
          distinct: ["leadId"],
          select: { leadId: true },
        }),
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "CONSULT_COMPLETED",
            createdAt: { gte: windowStart, lt: windowEnd },
          },
          distinct: ["leadId"],
          select: { leadId: true },
        }),
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "PROPOSAL_SENT",
            createdAt: { gte: windowStart, lt: windowEnd },
          },
          distinct: ["leadId"],
          select: { leadId: true },
        }),
        prisma.pipelineEvent.findMany({
          where: {
            eventType: "STAGE_CHANGED",
            toStage: "WON",
            createdAt: { gte: windowStart, lt: windowEnd },
          },
          distinct: ["leadId"],
          select: { leadId: true },
        }),
      ]);

      const stages: FunnelStage[] = [
        { key: "leads", label: "Leads", count: leadCount, dropOffPct: null },
        { key: "qualified", label: "Qualified", count: qualifiedCount, dropOffPct: null },
        { key: "consult_booked", label: "Consult booked", count: consultsBooked.length, dropOffPct: null },
        { key: "consult_completed", label: "Consult completed", count: consultsCompleted.length, dropOffPct: null },
        { key: "proposal_sent", label: "Proposal sent", count: proposalsSent.length, dropOffPct: null },
        { key: "won", label: "Won", count: wons.length, dropOffPct: null },
      ];

      for (let i = 1; i < stages.length; i++) {
        const prev = stages[i - 1].count;
        if (prev === 0) {
          stages[i].dropOffPct = null;
        } else {
          const kept = stages[i].count / prev;
          stages[i].dropOffPct = Math.round((1 - kept) * 100);
        }
      }

      return stages;
    },
    () => [
      { key: "leads", label: "Leads", count: 0, dropOffPct: null },
      { key: "qualified", label: "Qualified", count: 0, dropOffPct: null },
      { key: "consult_booked", label: "Consult booked", count: 0, dropOffPct: null },
      { key: "consult_completed", label: "Consult completed", count: 0, dropOffPct: null },
      { key: "proposal_sent", label: "Proposal sent", count: 0, dropOffPct: null },
      { key: "won", label: "Won", count: 0, dropOffPct: null },
    ]
  );
}

/** Helper — compute delta label + tone from a DailySeries. */
export function deltaFor(series: DailySeries): { label: string; tone: "positive" | "negative" | "neutral" } | undefined {
  if (series.prevTotal === 0 && series.total === 0) return undefined;
  if (series.prevTotal === 0) return { label: `+${series.total}`, tone: "positive" };
  const delta = series.total - series.prevTotal;
  if (delta === 0) return { label: "0%", tone: "neutral" };
  const pct = Math.round((delta / series.prevTotal) * 100);
  const sign = delta > 0 ? "+" : "";
  return { label: `${sign}${pct}%`, tone: delta > 0 ? "positive" : "negative" };
}
