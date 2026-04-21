import "server-only";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db/resilient";
import type { OnboardingStage } from "@prisma/client";

export type OnboardingListRow = {
  id: string;
  leadId: string;
  leadName: string;
  companyName: string | null;
  templateKey: string | null;
  stage: OnboardingStage;
  ownerName: string | null;
  monthlyFee: number | null;
  blockerNote: string | null;
  blockedAt: string | null;
  completedAt: string | null;
  daysInStage: number;
  openItems: number;
  blockedItems: number;
  totalItems: number;
  createdAt: string;
};

export type OnboardingFilter = {
  status?: "active" | "blocked" | "complete" | "all";
  assignedUserId?: string;
};

export async function listOnboardings(filter: OnboardingFilter = {}): Promise<OnboardingListRow[]> {
  return safeQuery<OnboardingListRow[]>(
    "onboarding.list",
    () => listFromDb(filter),
    () => []
  );
}

async function listFromDb(filter: OnboardingFilter): Promise<OnboardingListRow[]> {
  const where = buildWhere(filter);

  const rows = await prisma.onboarding.findMany({
    where,
    include: {
      lead: { select: { firstName: true, lastName: true, companyName: true } },
      assignedUser: { select: { firstName: true, lastName: true } },
      checklistItems: { select: { status: true } },
    },
    // Postgres DESC defaults to NULLS LAST, which is what we want here —
    // blocked onboardings float to the top, active ones sort by creation.
    orderBy: [{ blockedAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const now = Date.now();

  return rows.map((r) => {
    const items = r.checklistItems;
    const blockedItems = items.filter((i) => i.status === "BLOCKED").length;
    const openItems = items.filter((i) => i.status === "PENDING").length;
    const daysInStage = Math.max(
      0,
      Math.floor((now - new Date(r.updatedAt).getTime()) / (24 * 3600 * 1000))
    );
    return {
      id: r.id,
      leadId: r.leadId,
      leadName: `${r.lead.firstName ?? ""} ${r.lead.lastName ?? ""}`.trim(),
      companyName: r.lead.companyName ?? null,
      templateKey: r.templateKey,
      stage: r.stage,
      ownerName: r.assignedUser
        ? `${r.assignedUser.firstName ?? ""} ${r.assignedUser.lastName ?? ""}`.trim()
        : null,
      monthlyFee: r.monthlyFee ? Number(r.monthlyFee) : null,
      blockerNote: r.blockerNote,
      blockedAt: r.blockedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      daysInStage,
      openItems,
      blockedItems,
      totalItems: items.length,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

function buildWhere(filter: OnboardingFilter) {
  const where: Record<string, unknown> = {};
  if (filter.assignedUserId) where.assignedUserId = filter.assignedUserId;
  switch (filter.status) {
    case "blocked":
      where.blockedAt = { not: null };
      where.completedAt = null;
      break;
    case "complete":
      where.completedAt = { not: null };
      break;
    case "active":
      where.completedAt = null;
      break;
    // "all" and undefined — no status filter
  }
  return where;
}

export async function countOnboardings(): Promise<{
  active: number;
  blocked: number;
  complete: number;
}> {
  return safeQuery<{ active: number; blocked: number; complete: number }>(
    "onboarding.counts",
    async () => {
      const [active, blocked, complete] = await Promise.all([
        prisma.onboarding.count({ where: { completedAt: null } }),
        prisma.onboarding.count({
          where: { blockedAt: { not: null }, completedAt: null },
        }),
        prisma.onboarding.count({ where: { completedAt: { not: null } } }),
      ]);
      return { active, blocked, complete };
    },
    () => ({ active: 0, blocked: 0, complete: 0 })
  );
}

export async function getOnboarding(id: string) {
  return safeQuery(
    "onboarding.get",
    async () =>
      prisma.onboarding.findUnique({
        where: { id },
        include: {
          lead: true,
          proposal: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } },
          assignedUser: true,
          checklistItems: { orderBy: { sortOrder: "asc" } },
        },
      }),
    () => null
  );
}
