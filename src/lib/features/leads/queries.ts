import "server-only";
import type { Prisma } from "@prisma/client";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db/resilient";
import {
  COMMUNICATIONS,
  LEADS,
  TASKS,
  TIMELINE,
  type CommLog,
  type Lead,
  type Stage,
  type TaskItem,
  type TimelineEntry,
} from "@/lib/preview/fixtures";

export type LeadListItem = Lead;

export type LeadsSortKey =
  | "name"
  | "niche"
  | "service"
  | "source"
  | "score"
  | "stage"
  | "arr"
  | "created"
  | "owner"
  | "nextAction";

export type LeadsFilter = {
  search?: string;
  stage?: Stage;
  source?: string;
  grade?: "A" | "B" | "C" | "D";
  qualification?: Lead["qualification"];
  niche?: string;
  serviceInterest?: string;
  urgency?: string;
  ownerUserId?: string;
  sort?: LeadsSortKey;
  dir?: "asc" | "desc";
  /**
   * Archive scope for the list. Default ("active") hides archived leads —
   * "only" shows just the archived ones (an "archive bin" view), "include"
   * shows everything regardless of status. Active is the default because
   * after the rep clicks Archive in the bulk bar, they expect those rows to
   * disappear from the working list.
   */
  archived?: "active" | "only" | "include";
};

export async function listLeads(filter: LeadsFilter = {}): Promise<LeadListItem[]> {
  if (!config.dbEnabled) return filterFixtureLeads(filter);

  return safeQuery(
    "leads.list",
    () => listLeadsFromDb(filter),
    () => filterFixtureLeads(filter)
  );
}

async function listLeadsFromDb(filter: LeadsFilter): Promise<LeadListItem[]> {
  const where: Prisma.LeadWhereInput = {};
  // Status scoping. Default behavior is "active" — archiving has to actually
  // remove the lead from the rep's working list, otherwise it looks like the
  // archive button does nothing.
  const archivedScope = filter.archived ?? "active";
  if (archivedScope === "active") where.status = "ACTIVE";
  else if (archivedScope === "only") where.status = "ARCHIVED";
  // "include" → no status filter
  if (filter.stage) where.pipelineStage = filter.stage;
  if (filter.source) where.source = filter.source as Prisma.LeadWhereInput["source"];
  if (filter.grade) where.leadGrade = filter.grade;
  if (filter.qualification) where.qualificationStatus = filter.qualification;
  if (filter.niche) where.niche = filter.niche as Prisma.LeadWhereInput["niche"];
  if (filter.serviceInterest)
    where.serviceInterest = filter.serviceInterest as Prisma.LeadWhereInput["serviceInterest"];
  if (filter.urgency) where.urgency = filter.urgency as Prisma.LeadWhereInput["urgency"];
  if (filter.ownerUserId) where.ownerUserId = filter.ownerUserId;
  if (filter.search) {
    const q = filter.search.trim();
    if (q.length > 0) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
      ];
    }
  }

  const rows = await prisma.lead.findMany({
    where,
    orderBy: buildPrismaOrder(filter.sort, filter.dir),
    include: {
      owner: true,
      tasks: {
        where: { status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
        orderBy: [{ dueAt: "asc" }],
        take: 1,
        select: { id: true, title: true, dueAt: true, priority: true },
      },
      pipelineEvents: {
        where: { eventType: "STAGE_CHANGED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    take: 500,
  });
  const mapped = rows.map(toListItem);

  // "Next action" isn't a column Prisma can sort by (it's the min dueAt of the
  // lead's open tasks), so we finish that sort in memory.
  if (filter.sort === "nextAction") {
    const dir = filter.dir ?? "asc";
    const mult = dir === "asc" ? 1 : -1;
    mapped.sort((a, b) => {
      const av = a.nextActionAt ?? null;
      const bv = b.nextActionAt ?? null;
      if (av === bv) return 0;
      if (av === null) return 1; // no next action → sink to bottom
      if (bv === null) return -1;
      return av.localeCompare(bv) * mult;
    });
  }
  return mapped;
}

function buildPrismaOrder(
  key: LeadsSortKey | undefined,
  dir: "asc" | "desc" | undefined
): Prisma.LeadOrderByWithRelationInput[] {
  const d = dir ?? (key === "score" || key === "arr" || key === "created" ? "desc" : "asc");
  switch (key) {
    case "name":
      return [{ firstName: d }, { lastName: d }];
    case "niche":
      return [{ niche: d }, { leadScore: "desc" }];
    case "service":
      return [{ serviceInterest: d }, { leadScore: "desc" }];
    case "source":
      return [{ source: d }, { leadScore: "desc" }];
    case "stage":
      return [{ pipelineStage: d }, { leadScore: "desc" }];
    case "arr":
      return [{ estimatedAnnualValue: { sort: d, nulls: "last" } }, { leadScore: "desc" }];
    case "created":
      return [{ createdAt: d }];
    case "owner":
      return [
        { owner: { firstName: d } },
        { owner: { lastName: d } },
        { leadScore: "desc" },
      ];
    case "nextAction":
      // Sorted in memory after fetch (Prisma can't sort by aggregate of a
      // relation). Default order so we still have something useful.
      return [{ leadScore: "desc" }];
    case "score":
    default:
      return [{ leadScore: d ?? "desc" }, { createdAt: "desc" }];
  }
}

function filterFixtureLeads(f: LeadsFilter): Lead[] {
  const q = f.search?.trim().toLowerCase() ?? "";
  const archivedScope = f.archived ?? "active";
  const rows = [...LEADS].filter((l) => {
    const status = l.status ?? "ACTIVE";
    if (archivedScope === "active" && status !== "ACTIVE") return false;
    if (archivedScope === "only" && status !== "ARCHIVED") return false;
    if (f.stage && l.stage !== f.stage) return false;
    if (f.grade && l.grade !== f.grade) return false;
    if (f.qualification && l.qualification !== f.qualification) return false;
    if (f.source && !l.source.toLowerCase().includes(prettyDash(f.source))) return false;
    if (f.niche && !l.niche.toLowerCase().includes(prettyDash(f.niche))) return false;
    if (f.serviceInterest && !l.serviceInterest.toLowerCase().includes(prettyDash(f.serviceInterest)))
      return false;
    if (f.urgency && !l.urgency.toLowerCase().includes(prettyDash(f.urgency))) return false;
    if (q) {
      const hay = `${l.firstName} ${l.lastName} ${l.email} ${l.companyName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  rows.sort(compareBy(f.sort, f.dir));
  return rows;
}

function compareBy(key: LeadsSortKey | undefined, dir: "asc" | "desc" | undefined) {
  const d = dir ?? (key === "score" || key === "arr" || key === "created" ? "desc" : "asc");
  const mult = d === "asc" ? 1 : -1;
  return (a: Lead, b: Lead) => {
    const cmp = (() => {
      switch (key) {
        case "name": {
          const an = `${a.firstName} ${a.lastName}`.toLowerCase();
          const bn = `${b.firstName} ${b.lastName}`.toLowerCase();
          return an.localeCompare(bn);
        }
        case "niche":
          return a.niche.localeCompare(b.niche);
        case "service":
          return a.serviceInterest.localeCompare(b.serviceInterest);
        case "source":
          return a.source.localeCompare(b.source);
        case "stage":
          return a.stage.localeCompare(b.stage);
        case "arr":
          return (a.estimatedAnnualValue ?? 0) - (b.estimatedAnnualValue ?? 0);
        case "created":
          return a.createdAt.localeCompare(b.createdAt);
        case "score":
        default:
          return a.score - b.score;
      }
    })();
    return cmp * mult;
  };
}

function prettyDash(enumVal: string) {
  return enumVal.toLowerCase().replaceAll("_", " ");
}

export type LeadNote = {
  id: string;
  body: string;
  authorName: string;
  noteType: "GENERAL" | "CALL_SUMMARY" | "MEETING_SUMMARY" | "DISCOVERY" | "INTERNAL";
  createdAt: string;
};

export type ScoreBreakdown = {
  revenueScore: number;
  taxScore: number;
  serviceScore: number;
  fitScore: number;
  urgencyScore: number;
  sourceScore: number;
  complexityScore: number;
  bookedConsultScore: number;
  totalScore: number;
};

export type LeadDetail = {
  lead: LeadListItem;
  ownerUserId: string | null;
  timeline: TimelineEntry[];
  communications: CommLog[];
  tasks: TaskItem[];
  notes: LeadNote[];
  scoreBreakdown: ScoreBreakdown | null;
  /** True if an inbound Communication exists after the latest outbound. */
  hasUnansweredInbound: boolean;
};

export async function getLead(id: string): Promise<LeadDetail | null> {
  const fallback = (): LeadDetail | null => {
    const lead = LEADS.find((l) => l.id === id);
    if (!lead) return null;
    return {
      lead,
      ownerUserId: null,
      timeline: TIMELINE[id] ?? [],
      communications: COMMUNICATIONS[id] ?? [],
      tasks: TASKS.filter((t) => t.leadId === id),
      notes: [],
      scoreBreakdown: null,
      hasUnansweredInbound: false,
    };
  };
  if (!config.dbEnabled) return fallback();

  return safeQuery<LeadDetail | null>("leads.get", () => getLeadFromDb(id), fallback);
}

async function getLeadFromDb(id: string): Promise<LeadDetail | null> {
  const row = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: true,
      pipelineEvents: { orderBy: { createdAt: "desc" }, take: 50, include: { actor: true } },
      communications: { orderBy: { createdAt: "desc" }, take: 50 },
      tasks: { where: { status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } }, include: { assignedUser: true } },
      noteEntries: { orderBy: { createdAt: "desc" }, take: 50, include: { author: true } },
      scoreBreakdowns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          revenueScore: true,
          taxScore: true,
          serviceScore: true,
          fitScore: true,
          urgencyScore: true,
          sourceScore: true,
          complexityScore: true,
          bookedConsultScore: true,
          totalScore: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    lead: toListItem(row),
    ownerUserId: row.ownerUserId ?? null,
    timeline: row.pipelineEvents.map((e) => ({
      at: e.createdAt.toISOString(),
      type: mapEventType(e.eventType),
      title:
        e.note ??
        (e.fromStage && e.toStage
          ? `Moved ${e.fromStage} → ${e.toStage}`
          : e.eventType.replace(/_/g, " ")),
      actor: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : "System",
    })),
    communications: row.communications.map((c) => ({
      at: c.createdAt.toISOString(),
      channel: c.channel,
      direction: c.direction,
      subject: c.subject ?? undefined,
      preview: c.bodyText.slice(0, 180),
      status: c.deliveryStatus === "UNDELIVERED" ? "FAILED" : (c.deliveryStatus as CommLog["status"]),
    })),
    tasks: row.tasks.map((t) => ({
      id: t.id,
      leadId: t.leadId,
      title: t.title,
      type: mapTaskType(t.taskType),
      dueAt: (t.dueAt ?? t.createdAt).toISOString(),
      priority: t.priority,
      assignee: t.assignedUser ? `${t.assignedUser.firstName} ${t.assignedUser.lastName}` : "Unassigned",
    })),
    notes: row.noteEntries.map((n) => ({
      id: n.id,
      body: n.body,
      authorName:
        n.author ? `${n.author.firstName} ${n.author.lastName}`.trim() || n.author.email : "Unknown",
      noteType: n.noteType as LeadNote["noteType"],
      createdAt: n.createdAt.toISOString(),
    })),
    scoreBreakdown: row.scoreBreakdowns[0] ?? null,
    hasUnansweredInbound: computeUnansweredInbound(row.communications),
  };
}

function computeUnansweredInbound(
  comms: Array<{ direction: string; createdAt: Date }>
): boolean {
  // Comms come ordered desc. Find the most recent inbound; if any outbound
  // is newer than it, the reply has been answered.
  const latestInbound = comms.find((c) => c.direction === "INBOUND");
  if (!latestInbound) return false;
  const latestOutbound = comms.find((c) => c.direction === "OUTBOUND");
  if (!latestOutbound) return true;
  return latestInbound.createdAt.getTime() > latestOutbound.createdAt.getTime();
}

// ── mappers ──────────────────────────────────────────────────────────────────

type PrismaLeadWithOwner = Awaited<ReturnType<typeof prisma.lead.findMany>>[number] & {
  owner?: { firstName: string; lastName: string } | null;
  tasks?: Array<{ id: string; title: string; dueAt: Date | null; priority: string }>;
  pipelineEvents?: Array<{ createdAt: Date }>;
};

function toListItem(row: PrismaLeadWithOwner): Lead {
  const nextTask = row.tasks?.[0];
  const latestStageEvt = row.pipelineEvents?.[0];
  const lastStageChangeAt = (latestStageEvt?.createdAt ?? row.createdAt).toISOString();
  return {
    id: row.id,
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    email: row.email ?? "",
    phone: row.phoneE164 ?? row.phone ?? "",
    companyName: row.companyName ?? undefined,
    niche: prettyEnum(row.niche),
    fitType: prettyEnum(row.fitType),
    source: prettyEnum(row.source),
    campaignName: row.campaignName ?? undefined,
    serviceInterest: prettyEnum(row.serviceInterest),
    annualRevenueRange: prettyEnum(row.annualRevenueRange),
    taxesPaidLastYearRange: prettyEnum(row.taxesPaidLastYearRange),
    propertyCount: prettyEnum(row.propertyCount),
    urgency: prettyEnum(row.urgency),
    states: (row.statesOfOperation as string[] | null) ?? [],
    painPoint: row.painPoint ?? undefined,
    stage: row.pipelineStage as Stage,
    qualification: row.qualificationStatus as Lead["qualification"],
    score: row.leadScore,
    grade: (row.leadGrade ?? "D") as Lead["grade"],
    estimatedAnnualValue: row.estimatedAnnualValue
      ? Number(row.estimatedAnnualValue.toString())
      : undefined,
    ownerName: row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : undefined,
    w2IncomeFlag: row.w2IncomeFlag,
    payrollFlag: row.payrollFlag,
    otherBusinessIncomeFlag: row.otherBusinessIncomeFlag,
    // Niche-specific — undefined when null so the UI can omit the section
    // entirely for leads where the field doesn't apply.
    costSegInterest: row.costSegInterest ?? undefined,
    salesChannels: (row.salesChannels as string[] | null) ?? undefined,
    monthlyAdSpendRange: row.monthlyAdSpendRange
      ? prettyEnum(row.monthlyAdSpendRange)
      : undefined,
    booksStatus: row.booksStatus
      ? humanBooksStatus(row.booksStatus)
      : undefined,
    // Attribution. Forwarded raw so the admin can see exact UTM strings,
    // sub-brand hostnames, and the full landing-page URL.
    utmSource: row.utmSource ?? undefined,
    utmMedium: row.utmMedium ?? undefined,
    utmCampaign: row.utmCampaign ?? undefined,
    utmTerm: row.utmTerm ?? undefined,
    utmContent: row.utmContent ?? undefined,
    serviceLine: row.serviceLine ?? undefined,
    sourceSubdomain: row.sourceSubdomain ?? undefined,
    landingPageUrl: row.landingPageUrl ?? undefined,
    referrer: row.referrer ?? undefined,
    createdAt: row.createdAt.toISOString(),
    lastContactedAt: row.lastContactedAt?.toISOString(),
    nextActionAt: nextTask?.dueAt?.toISOString() ?? row.nextActionAt?.toISOString(),
    nextActionTitle: nextTask?.title,
    nextActionPriority: nextTask?.priority as Lead["nextActionPriority"],
    lastStageChangeAt,
  };
}

// booksStatus is stored as a free-form short code (UP_TO_DATE, BEHIND_1_3,
// BEHIND_4_PLUS, NEVER_DONE, UNSURE) so we can add codes without a migration.
// Render with copy that's easier to scan in the lead detail panel.
function humanBooksStatus(code: string): string {
  switch (code) {
    case "UP_TO_DATE":
      return "Up to date";
    case "BEHIND_1_3":
      return "Behind 1–3 months";
    case "BEHIND_4_PLUS":
      return "Behind 4+ months";
    case "NEVER_DONE":
      return "Never done";
    case "UNSURE":
      return "Unsure";
    default:
      return code;
  }
}

function prettyEnum(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function mapEventType(e: string): TimelineEntry["type"] {
  const known: Record<string, TimelineEntry["type"]> = {
    LEAD_CREATED: "LEAD_CREATED",
    STAGE_CHANGED: "STAGE_CHANGED",
    NOTE_ADDED: "NOTE_ADDED",
    COMMUNICATION_SENT: "COMMUNICATION_SENT",
    PROPOSAL_SENT: "PROPOSAL_SENT",
    TASK_CREATED: "TASK_CREATED",
    HANDOFF_COMPLETED: "HANDOFF_COMPLETED",
  };
  return known[e] ?? "LEAD_CREATED";
}

function mapTaskType(t: string): TaskItem["type"] {
  const known: Record<string, TaskItem["type"]> = {
    CALL: "CALL",
    EMAIL: "EMAIL",
    SMS: "SMS",
    MEETING: "MEETING",
    REVIEW: "REVIEW",
  };
  return known[t] ?? "CALL";
}
