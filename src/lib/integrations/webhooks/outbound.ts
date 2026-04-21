import "server-only";
import { prisma } from "@/lib/db";

type OutboundEvent = "lead.won" | "lead.lost" | "lead.stage_changed";

/**
 * Fire-and-forget outbound webhook for external automations like Make.com /
 * Pipedream / n8n. Configure by setting:
 *
 *   WEBHOOK_LEAD_WON_URL=https://hook.us1.make.com/abc123...
 *
 * We POST a JSON payload with every field Anchor / QuickBooks / Gusto etc.
 * would need to create a client, so the user can build a Make scenario like:
 *   Webhook trigger → Anchor "Create client" action
 * without having to re-enter contact details.
 *
 * Errors never throw — we log and move on. The CRM action (e.g. stage
 * change) must succeed even if the automation webhook is down.
 */
export async function fireOutboundWebhook(event: OutboundEvent, leadId: string): Promise<void> {
  const url = resolveWebhookUrl(event);
  if (!url) return; // no automation configured for this event — skip quietly

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        owner: { select: { firstName: true, lastName: true, email: true } },
        proposals: {
          where: { proposalStatus: { in: ["SENT", "VIEWED", "ACCEPTED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            externalProposalId: true,
            servicePackage: true,
            monthlyValue: true,
            annualValue: true,
            proposalStatus: true,
          },
        },
      },
    });
    if (!lead) return;

    const topProposal = lead.proposals[0];

    const payload = {
      event,
      occurredAt: new Date().toISOString(),
      lead: {
        id: lead.id,
        fullName:
          lead.fullName ||
          [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
          lead.email ||
          "Unknown",
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phoneE164 ?? lead.phone,
        companyName: lead.companyName,
        websiteUrl: lead.websiteUrl,
        airbnbOrListingUrl: lead.airbnbOrListingUrl,
        niche: lead.niche,
        serviceInterest: lead.serviceInterest,
        annualRevenueRange: lead.annualRevenueRange,
        taxesPaidLastYearRange: lead.taxesPaidLastYearRange,
        propertyCount: lead.propertyCount,
        statesOfOperation: lead.statesOfOperation,
        painPoint: lead.painPoint,
        source: lead.source,
        campaignName: lead.campaignName,
        score: lead.leadScore,
        grade: lead.leadGrade,
        pipelineStage: lead.pipelineStage,
        estimatedAnnualValue: lead.estimatedAnnualValue
          ? Number(lead.estimatedAnnualValue)
          : null,
        owner: lead.owner
          ? {
              name: `${lead.owner.firstName} ${lead.owner.lastName}`.trim(),
              email: lead.owner.email,
            }
          : null,
      },
      proposal: topProposal
        ? {
            externalProposalId: topProposal.externalProposalId,
            servicePackage: topProposal.servicePackage,
            monthlyValue: topProposal.monthlyValue ? Number(topProposal.monthlyValue) : null,
            annualValue: topProposal.annualValue ? Number(topProposal.annualValue) : null,
            status: topProposal.proposalStatus,
          }
        : null,
    };

    // Intentionally not awaited timeout — Vercel serverless kills us quickly,
    // but a 10s cap lets slow Make.com scenarios finish.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn(`[webhook:${event}] non-2xx: ${res.status} ${await res.text().catch(() => "")}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error(`[webhook:${event}] failed`, err);
  }
}

function resolveWebhookUrl(event: OutboundEvent): string | undefined {
  switch (event) {
    case "lead.won":
      return process.env.WEBHOOK_LEAD_WON_URL || undefined;
    case "lead.lost":
      return process.env.WEBHOOK_LEAD_LOST_URL || undefined;
    case "lead.stage_changed":
      return process.env.WEBHOOK_LEAD_STAGE_URL || undefined;
  }
}
