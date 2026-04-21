import "server-only";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db/resilient";
import { LEADS, TIMELINE } from "@/lib/preview/fixtures";

export type ActivityItem = {
  id: string;
  at: string;
  eventType: string;
  title: string;
  note?: string;
  actor: string;
  leadId: string;
  leadName: string;
  leadGrade: "A" | "B" | "C" | "D";
};

export async function listRecentActivity(limit = 40): Promise<ActivityItem[]> {
  const fixturesFallback = (): ActivityItem[] => {
    const out: ActivityItem[] = [];
    for (const lead of LEADS) {
      for (const t of TIMELINE[lead.id] ?? []) {
        out.push({
          id: `${lead.id}-${t.at}`,
          at: t.at,
          eventType: t.type,
          title: t.title,
          note: t.body,
          actor: t.actor ?? "System",
          leadId: lead.id,
          leadName: `${lead.firstName} ${lead.lastName}`,
          leadGrade: lead.grade,
        });
      }
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  };

  if (!config.dbEnabled) return fixturesFallback();

  return safeQuery(
    "activity.recent",
    () => listRecentActivityFromDb(limit),
    fixturesFallback
  );
}

async function listRecentActivityFromDb(limit: number): Promise<ActivityItem[]> {
  const rows = await prisma.pipelineEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { firstName: true, lastName: true } },
      lead: { select: { firstName: true, lastName: true, leadGrade: true } },
    },
  });

  return rows.map((e) => ({
    id: e.id,
    at: e.createdAt.toISOString(),
    eventType: e.eventType,
    title:
      e.note ??
      (e.fromStage && e.toStage
        ? `Moved ${e.fromStage} → ${e.toStage}`
        : e.eventType.replace(/_/g, " ")),
    actor: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : "System",
    leadId: e.leadId,
    leadName: `${e.lead.firstName ?? ""} ${e.lead.lastName ?? ""}`.trim() || "Unknown lead",
    leadGrade: (e.lead.leadGrade ?? "D") as ActivityItem["leadGrade"],
  }));
}
