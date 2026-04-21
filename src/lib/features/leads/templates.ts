import "server-only";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export type TemplateSummary = { key: string; name: string; channel: "EMAIL" | "SMS" | "WHATSAPP" | "CALL" | "OTHER" };

// Fallback template list used when the DB isn't connected yet. Keys match
// prisma/seed.ts so behavior is consistent once seeded.
const FALLBACK: TemplateSummary[] = [
  { key: "inquiry.confirmation.email", name: "Inquiry received — confirmation", channel: "EMAIL" },
  { key: "qualified.schedule.email", name: "Qualified — schedule consult", channel: "EMAIL" },
  { key: "consult.reminder.24h.email", name: "Consult reminder — 24h", channel: "EMAIL" },
  { key: "proposal.followup.d1.email", name: "Proposal follow-up — day 1", channel: "EMAIL" },
  { key: "proposal.breakup.d5.email", name: "Proposal breakup — final", channel: "EMAIL" },
  { key: "won.welcome.email", name: "Won — welcome + onboarding", channel: "EMAIL" },
  { key: "qualified.schedule.sms", name: "Qualified — schedule consult (SMS)", channel: "SMS" },
  { key: "consult.no_show.rebook.email", name: "Consult no-show — rebook nudge", channel: "EMAIL" },
  { key: "consult.no_show.rebook.sms", name: "Consult no-show — rebook (SMS)", channel: "SMS" },
];

export async function listSendableTemplates(): Promise<TemplateSummary[]> {
  if (!config.dbEnabled) return FALLBACK;
  const rows = await prisma.messageTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ channel: "asc" }, { name: "asc" }],
    select: { key: true, name: true, channel: true },
  });
  return rows.map((r) => ({ key: r.key, name: r.name, channel: r.channel }));
}
