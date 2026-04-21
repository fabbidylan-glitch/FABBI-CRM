import "server-only";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db/resilient";
import { LEADS, type Stage } from "@/lib/preview/fixtures";

export type ContactType = "CLIENT" | "PROSPECT" | "NURTURE" | "LOST";

export type ContactSummary = {
  email: string;
  fullName: string;
  phone?: string;
  company?: string;
  type: ContactType;
  leadCount: number;
  latestLeadId: string;
  latestLeadStage: Stage;
  latestLeadGrade: "A" | "B" | "C" | "D";
  latestLeadScore: number;
  totalEstimatedValue: number;
  ownerName?: string;
  lastContactedAt?: string;
  nextActionAt?: string;
  firstSeenAt: string;
};

export type ContactsFilter = {
  type?: ContactType;
  search?: string;
};

/**
 * Derived view: every person who has submitted at least one lead, keyed by
 * their normalized email. Later we may split this into a first-class Contact
 * entity (with partners / referrers / vendors that never submitted a lead),
 * but for now the data all comes from Lead rows.
 */
export async function listContacts(filter: ContactsFilter = {}): Promise<ContactSummary[]> {
  if (!config.dbEnabled) {
    return aggregateFromFixtures(filter);
  }

  return safeQuery(
    "contacts.list",
    () => listContactsFromDb(filter),
    () => aggregateFromFixtures(filter)
  );
}

async function listContactsFromDb(filter: ContactsFilter): Promise<ContactSummary[]> {
  const rows = await prisma.lead.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { owner: { select: { firstName: true, lastName: true } } },
    take: 1000,
  });

  // Group in app memory — bounded by take:1000 so this stays snappy.
  const byKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = (r.emailNormalized ?? r.email ?? r.phoneE164 ?? r.id).toLowerCase();
    const bucket = byKey.get(key) ?? [];
    bucket.push(r);
    byKey.set(key, bucket);
  }

  const contacts: ContactSummary[] = [];
  for (const [, bucket] of byKey) {
    const sorted = [...bucket].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const latest = sorted[0];
    if (!latest) continue;

    const type = classifyContact(bucket.map((b) => b.pipelineStage));
    const totalEstimatedValue = bucket.reduce(
      (sum, b) => sum + (b.estimatedAnnualValue ? Number(b.estimatedAnnualValue) : 0),
      0
    );
    const lastContactedAt = bucket
      .map((b) => b.lastContactedAt)
      .filter((d): d is Date => d != null)
      .sort((a, b) => b.getTime() - a.getTime())[0]
      ?.toISOString();
    const nextActionAt = bucket
      .map((b) => b.nextActionAt)
      .filter((d): d is Date => d != null)
      .sort((a, b) => a.getTime() - b.getTime())[0]
      ?.toISOString();
    const firstSeenAt = sorted[sorted.length - 1]?.createdAt.toISOString() ?? latest.createdAt.toISOString();

    contacts.push({
      email: (latest.email ?? "").toLowerCase(),
      fullName:
        latest.fullName ||
        `${latest.firstName ?? ""} ${latest.lastName ?? ""}`.trim() ||
        latest.email ||
        "Unknown",
      phone: latest.phoneE164 ?? latest.phone ?? undefined,
      company: latest.companyName ?? undefined,
      type,
      leadCount: bucket.length,
      latestLeadId: latest.id,
      latestLeadStage: latest.pipelineStage as Stage,
      latestLeadGrade: (latest.leadGrade ?? "D") as ContactSummary["latestLeadGrade"],
      latestLeadScore: latest.leadScore,
      totalEstimatedValue,
      ownerName: latest.owner
        ? `${latest.owner.firstName} ${latest.owner.lastName}`.trim()
        : undefined,
      lastContactedAt,
      nextActionAt,
      firstSeenAt,
    });
  }

  return applyContactFilter(contacts, filter);
}

function aggregateFromFixtures(filter: ContactsFilter): ContactSummary[] {
  const byEmail = new Map<string, typeof LEADS>();
  for (const l of LEADS) {
    const key = l.email.toLowerCase();
    const bucket = byEmail.get(key) ?? [];
    bucket.push(l);
    byEmail.set(key, bucket);
  }
  const contacts: ContactSummary[] = [];
  for (const [, bucket] of byEmail) {
    const sorted = [...bucket].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = sorted[0];
    if (!latest) continue;
    contacts.push({
      email: latest.email.toLowerCase(),
      fullName: `${latest.firstName} ${latest.lastName}`,
      phone: latest.phone,
      type: classifyContact(bucket.map((b) => b.stage)),
      leadCount: bucket.length,
      latestLeadId: latest.id,
      latestLeadStage: latest.stage,
      latestLeadGrade: latest.grade,
      latestLeadScore: latest.score,
      totalEstimatedValue: bucket.reduce((s, b) => s + (b.estimatedAnnualValue ?? 0), 0),
      ownerName: latest.ownerName,
      lastContactedAt: latest.lastContactedAt,
      nextActionAt: latest.nextActionAt,
      firstSeenAt: sorted[sorted.length - 1]?.createdAt ?? latest.createdAt,
    });
  }
  return applyContactFilter(contacts, filter);
}

function classifyContact(stages: Stage[]): ContactType {
  if (stages.includes("WON")) return "CLIENT";
  if (stages.some((s) => ["NEW_LEAD", "CONTACTED", "QUALIFIED", "CONSULT_BOOKED", "CONSULT_COMPLETED", "PROPOSAL_DRAFTING", "PROPOSAL_SENT", "FOLLOW_UP_NEGOTIATION"].includes(s)))
    return "PROSPECT";
  if (stages.includes("COLD_NURTURE")) return "NURTURE";
  return "LOST";
}

function applyContactFilter(rows: ContactSummary[], f: ContactsFilter): ContactSummary[] {
  const q = f.search?.trim().toLowerCase() ?? "";
  return rows
    .filter((c) => {
      if (f.type && c.type !== f.type) return false;
      if (q) {
        const hay = `${c.fullName} ${c.email} ${c.company ?? ""} ${c.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Clients first, then prospects, then nurture, then lost; within each
      // group sort by last activity (most recent first).
      const typeRank: Record<ContactType, number> = { CLIENT: 0, PROSPECT: 1, NURTURE: 2, LOST: 3 };
      const byType = typeRank[a.type] - typeRank[b.type];
      if (byType !== 0) return byType;
      const aTime = a.lastContactedAt ?? a.firstSeenAt;
      const bTime = b.lastContactedAt ?? b.firstSeenAt;
      return bTime.localeCompare(aTime);
    });
}
