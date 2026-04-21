import "server-only";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import type { ContactType } from "@/lib/features/contacts/queries";
import { COMMUNICATIONS, LEADS, TIMELINE, type Lead, type Stage } from "@/lib/preview/fixtures";

export type ContactLeadSummary = {
  leadId: string;
  createdAt: string;
  stage: Stage;
  grade: "A" | "B" | "C" | "D";
  score: number;
  serviceInterest: string;
  source: string;
  estimatedAnnualValue?: number;
};

export type ContactTimelineEntry = {
  id: string;
  at: string;
  eventType: string;
  title: string;
  actor: string;
  leadId: string;
};

export type ContactCommEntry = {
  id: string;
  at: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "CALL" | "OTHER";
  direction: "OUTBOUND" | "INBOUND";
  subject?: string;
  preview: string;
  status: string;
  leadId: string;
};

export type ContactNoteEntry = {
  id: string;
  at: string;
  body: string;
  author: string;
  leadId: string;
};

export type ContactDetail = {
  key: string;
  email: string;
  fullName: string;
  phone?: string;
  company?: string;
  type: ContactType;
  totalEstimatedValue: number;
  ownerName?: string;
  firstSeenAt: string;
  lastContactedAt?: string;
  leads: ContactLeadSummary[];
  timeline: ContactTimelineEntry[];
  communications: ContactCommEntry[];
  notes: ContactNoteEntry[];
};

/**
 * Aggregate every inquiry / communication / note for a single contact,
 * identified by normalized email. Useful when the same person has submitted
 * multiple times — we want the person-centric view, not per-lead.
 */
export async function getContactDetail(emailKey: string): Promise<ContactDetail | null> {
  const normalized = emailKey.toLowerCase();
  if (!config.dbEnabled) return aggregateFromFixtures(normalized);

  const leads = await prisma.lead.findMany({
    where: { emailNormalized: normalized },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      pipelineEvents: { orderBy: { createdAt: "desc" }, include: { actor: true } },
      communications: { orderBy: { createdAt: "desc" } },
      noteEntries: { orderBy: { createdAt: "desc" }, include: { author: true } },
    },
  });
  if (leads.length === 0) return null;

  const latest = leads[0]!;
  const type = classify(leads.map((l) => l.pipelineStage as Stage));
  const firstSeen = leads[leads.length - 1]!.createdAt;
  const totalEstimatedValue = leads.reduce(
    (s, l) => s + (l.estimatedAnnualValue ? Number(l.estimatedAnnualValue) : 0),
    0
  );
  const lastContactedAt = leads
    .map((l) => l.lastContactedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const timeline: ContactTimelineEntry[] = leads.flatMap((l) =>
    l.pipelineEvents.map((e) => ({
      id: e.id,
      at: e.createdAt.toISOString(),
      eventType: e.eventType,
      title:
        e.note ??
        (e.fromStage && e.toStage ? `Moved ${e.fromStage} → ${e.toStage}` : e.eventType.replace(/_/g, " ")),
      actor: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : "System",
      leadId: l.id,
    }))
  );
  timeline.sort((a, b) => b.at.localeCompare(a.at));

  const communications: ContactCommEntry[] = leads.flatMap((l) =>
    l.communications.map((c) => ({
      id: c.id,
      at: c.createdAt.toISOString(),
      channel: c.channel,
      direction: c.direction,
      subject: c.subject ?? undefined,
      preview: c.bodyText.slice(0, 180),
      status: c.deliveryStatus,
      leadId: l.id,
    }))
  );
  communications.sort((a, b) => b.at.localeCompare(a.at));

  const notes: ContactNoteEntry[] = leads.flatMap((l) =>
    l.noteEntries.map((n) => ({
      id: n.id,
      at: n.createdAt.toISOString(),
      body: n.body,
      author: n.author
        ? `${n.author.firstName} ${n.author.lastName}`.trim() || n.author.email
        : "Unknown",
      leadId: l.id,
    }))
  );
  notes.sort((a, b) => b.at.localeCompare(a.at));

  return {
    key: normalized,
    email: latest.email ?? normalized,
    fullName:
      latest.fullName ||
      `${latest.firstName ?? ""} ${latest.lastName ?? ""}`.trim() ||
      latest.email ||
      "Unknown",
    phone: latest.phoneE164 ?? latest.phone ?? undefined,
    company: latest.companyName ?? undefined,
    type,
    totalEstimatedValue,
    ownerName: latest.owner
      ? `${latest.owner.firstName} ${latest.owner.lastName}`.trim()
      : undefined,
    firstSeenAt: firstSeen.toISOString(),
    lastContactedAt: lastContactedAt?.toISOString(),
    leads: leads.map((l) => ({
      leadId: l.id,
      createdAt: l.createdAt.toISOString(),
      stage: l.pipelineStage as Stage,
      grade: (l.leadGrade ?? "D") as ContactLeadSummary["grade"],
      score: l.leadScore,
      serviceInterest: l.serviceInterest,
      source: l.source,
      estimatedAnnualValue: l.estimatedAnnualValue ? Number(l.estimatedAnnualValue) : undefined,
    })),
    timeline,
    communications,
    notes,
  };
}

function classify(stages: Stage[]): ContactType {
  if (stages.includes("WON")) return "CLIENT";
  if (stages.some((s) => !["WON", "LOST", "COLD_NURTURE"].includes(s))) return "PROSPECT";
  if (stages.includes("COLD_NURTURE")) return "NURTURE";
  return "LOST";
}

function aggregateFromFixtures(normalized: string): ContactDetail | null {
  const bucket: Lead[] = LEADS.filter((l) => l.email.toLowerCase() === normalized);
  if (bucket.length === 0) return null;
  const latest = bucket[0]!;
  const timeline: ContactTimelineEntry[] = bucket.flatMap((l) =>
    (TIMELINE[l.id] ?? []).map((t, i) => ({
      id: `${l.id}-${i}`,
      at: t.at,
      eventType: t.type,
      title: t.title,
      actor: t.actor ?? "System",
      leadId: l.id,
    }))
  );
  const communications: ContactCommEntry[] = bucket.flatMap((l) =>
    (COMMUNICATIONS[l.id] ?? []).map((c, i) => ({
      id: `${l.id}-c-${i}`,
      at: c.at,
      channel: c.channel,
      direction: c.direction,
      subject: c.subject,
      preview: c.preview,
      status: c.status,
      leadId: l.id,
    }))
  );
  return {
    key: normalized,
    email: latest.email,
    fullName: `${latest.firstName} ${latest.lastName}`,
    phone: latest.phone,
    type: classify(bucket.map((b) => b.stage)),
    totalEstimatedValue: bucket.reduce((s, b) => s + (b.estimatedAnnualValue ?? 0), 0),
    ownerName: latest.ownerName,
    firstSeenAt: latest.createdAt,
    lastContactedAt: latest.lastContactedAt,
    leads: bucket.map((l) => ({
      leadId: l.id,
      createdAt: l.createdAt,
      stage: l.stage,
      grade: l.grade,
      score: l.score,
      serviceInterest: l.serviceInterest,
      source: l.source,
      estimatedAnnualValue: l.estimatedAnnualValue,
    })),
    timeline: timeline.sort((a, b) => b.at.localeCompare(a.at)),
    communications: communications.sort((a, b) => b.at.localeCompare(a.at)),
    notes: [],
  };
}
