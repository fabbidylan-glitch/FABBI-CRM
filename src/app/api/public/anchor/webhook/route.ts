import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { ensureStageTasks } from "@/lib/features/leads/stage-workflow";
import { normalizePhoneE164 } from "@/lib/validators/lead-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anchor doesn't expose a public API, but it integrates with Zapier. You
 * build a Zap:
 *   Anchor trigger  →  Webhooks by Zapier → POST JSON → this endpoint
 * Events worth sending:
 *   - proposal.sent       → move lead → PROPOSAL_SENT
 *   - proposal.accepted   → move lead → WON + create Proposal row
 *   - proposal.declined   → move lead → LOST
 *   - contract.signed     → same effect as accepted (depending on Anchor)
 *
 * The payload shape you control in Zapier — this endpoint accepts either
 * Anchor's raw webhook body (if they ever expose one) or a Zap-shaped one.
 * Required: `event` + either `clientEmail` or `leadId`.
 *
 * Auth: set ANCHOR_WEBHOOK_SECRET in env; Zapier's Webhook action lets you
 * include an arbitrary header. We check `x-anchor-secret` against the env.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  const secret = process.env.ANCHOR_WEBHOOK_SECRET;
  if (secret) {
    const supplied = req.headers.get("x-anchor-secret") ?? "";
    if (supplied !== secret) {
      return NextResponse.json({ error: "bad secret" }, { status: 401 });
    }
  }

  if (!config.dbEnabled) return NextResponse.json({ ok: true, skipped: "db_not_configured" });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 }
    );
  }

  const input = parsed.data;

  // Resolve the lead by explicit id, email, or phone.
  let lead = null;
  if (input.leadId) {
    lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  }
  if (!lead && input.clientEmail) {
    lead = await prisma.lead.findFirst({
      where: { emailNormalized: input.clientEmail.toLowerCase() },
    });
  }
  if (!lead && input.clientPhone) {
    const e164 = normalizePhoneE164(input.clientPhone);
    if (e164) lead = await prisma.lead.findFirst({ where: { phoneE164: e164 } });
  }
  if (!lead) {
    return NextResponse.json(
      { ok: false, error: "No matching lead found for this event" },
      { status: 404 }
    );
  }

  const event = input.event.toLowerCase();
  const amount = input.annualValue ?? input.amount ?? null;

  if (event.includes("accepted") || event.includes("signed") || event === "proposal.accepted") {
    await handleAccepted(lead.id, input, Number(amount ?? 0));
    await ensureStageTasks({ leadId: lead.id, toStage: "WON" });
  } else if (event.includes("declined") || event.includes("rejected")) {
    await handleDeclined(lead.id, input);
  } else if (event.includes("sent")) {
    await handleSent(lead.id, input, Number(amount ?? 0));
    await ensureStageTasks({ leadId: lead.id, toStage: "PROPOSAL_SENT" });
  } else if (event.includes("viewed") || event.includes("opened")) {
    await handleViewed(lead.id, input);
  } else {
    await prisma.pipelineEvent.create({
      data: {
        leadId: lead.id,
        eventType: "OTHER",
        note: `Anchor event: ${input.event}`,
        metadataJson: input as unknown as object,
      },
    });
  }

  return NextResponse.json({ ok: true, leadId: lead.id, event });
}

async function handleSent(
  leadId: string,
  input: z.infer<typeof schema>,
  annualValue: number
) {
  await prisma.$transaction([
    prisma.proposal.upsert({
      where: { externalProposalId: input.proposalId ?? `anchor:${leadId}:${Date.now()}` },
      update: { proposalStatus: "SENT", sentAt: new Date(), annualValue },
      create: {
        leadId,
        externalProposalId: input.proposalId ?? `anchor:${leadId}:${Date.now()}`,
        proposalStatus: "SENT",
        servicePackage: input.servicePackage ?? null,
        annualValue,
        monthlyValue: annualValue ? annualValue / 12 : null,
        sentAt: new Date(),
      },
    }),
    prisma.lead.update({
      where: { id: leadId },
      data: { pipelineStage: "PROPOSAL_SENT", estimatedAnnualValue: annualValue || undefined },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId,
        eventType: "PROPOSAL_SENT",
        note: `Anchor proposal sent${annualValue ? ` — $${annualValue}/yr` : ""}`,
        metadataJson: input as unknown as object,
      },
    }),
  ]);
}

async function handleViewed(leadId: string, input: z.infer<typeof schema>) {
  if (input.proposalId) {
    await prisma.proposal.updateMany({
      where: { externalProposalId: input.proposalId },
      data: { proposalStatus: "VIEWED", viewedAt: new Date() },
    });
  }
  await prisma.pipelineEvent.create({
    data: {
      leadId,
      eventType: "PROPOSAL_VIEWED",
      note: "Proposal viewed (via Anchor)",
      metadataJson: input as unknown as object,
    },
  });
}

async function handleAccepted(
  leadId: string,
  input: z.infer<typeof schema>,
  annualValue: number
) {
  await prisma.$transaction([
    prisma.proposal.upsert({
      where: { externalProposalId: input.proposalId ?? `anchor:${leadId}:accept` },
      update: {
        proposalStatus: "ACCEPTED",
        acceptedAt: new Date(),
        annualValue: annualValue || undefined,
      },
      create: {
        leadId,
        externalProposalId: input.proposalId ?? `anchor:${leadId}:accept`,
        proposalStatus: "ACCEPTED",
        servicePackage: input.servicePackage ?? null,
        annualValue,
        monthlyValue: annualValue ? annualValue / 12 : null,
        sentAt: new Date(),
        acceptedAt: new Date(),
      },
    }),
    prisma.lead.update({
      where: { id: leadId },
      data: {
        pipelineStage: "WON",
        estimatedAnnualValue: annualValue || undefined,
      },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId,
        eventType: "PROPOSAL_ACCEPTED",
        note: `Won via Anchor${annualValue ? ` — $${annualValue}/yr` : ""}`,
        metadataJson: input as unknown as object,
      },
    }),
  ]);
}

async function handleDeclined(leadId: string, input: z.infer<typeof schema>) {
  if (input.proposalId) {
    await prisma.proposal.updateMany({
      where: { externalProposalId: input.proposalId },
      data: { proposalStatus: "DECLINED", declinedAt: new Date() },
    });
  }
  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: { pipelineStage: "LOST" },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId,
        eventType: "PROPOSAL_DECLINED",
        note: "Proposal declined (via Anchor)",
        metadataJson: input as unknown as object,
      },
    }),
  ]);
}

const schema = z.object({
  event: z.string().min(1),
  leadId: z.string().optional(),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional(),
  proposalId: z.string().optional(),
  servicePackage: z.string().optional(),
  annualValue: z.union([z.number(), z.string().transform((s) => Number(s) || 0)]).optional(),
  amount: z.union([z.number(), z.string().transform((s) => Number(s) || 0)]).optional(),
});
