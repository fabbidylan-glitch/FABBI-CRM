import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { pushProposalToAnchor, type AnchorPushPayload } from "@/lib/messaging/anchor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Body flags:
 *   { skipAnchor: true } → bypass the outbound Anchor push even when
 *     ANCHOR_MAKE_WEBHOOK_URL is set. Used when the rep has already created
 *     the proposal in Anchor manually and just wants the CRM to track status.
 */
const schema = z
  .object({ skipAnchor: z.boolean().optional() })
  .default({});

export async function POST(req: NextRequest, ctx: { params: Promise<{ proposalId: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await ctx.params;

  // Accept an empty body — the common path is a button click with no payload.
  let parsed: z.infer<typeof schema> = {};
  try {
    const raw = await req.text();
    if (raw) {
      const result = schema.safeParse(JSON.parse(raw));
      if (!result.success)
        return NextResponse.json({ error: "Validation failed" }, { status: 422 });
      parsed = result.data;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      lead: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.proposalStatus !== "DRAFT")
    return NextResponse.json({ error: `Cannot send from ${proposal.proposalStatus}` }, { status: 409 });

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });
  const shouldPush = config.anchorOutboundEnabled && !parsed.skipAnchor;

  // Generate a deterministic externalProposalId so inbound Anchor→Make
  // webhooks can reconcile to this exact row. We write it BEFORE pushing so
  // a late-arriving inbound event (if the user's Make scenario is very fast)
  // still finds a row to upsert into.
  const externalProposalId = proposal.externalProposalId ?? `crm:${proposal.id}`;

  let makeResponse: unknown = null;
  let pushSkipReason: string | null = parsed.skipAnchor
    ? "skipped_by_user"
    : config.anchorOutboundEnabled
      ? null
      : "anchor_not_configured";

  if (shouldPush) {
    const monthlyTotal = proposal.lineItems
      .filter((li) => li.monthlyAmount && Number(li.monthlyAmount) > 0)
      .reduce((sum, li) => sum + Number(li.monthlyAmount ?? 0), 0);
    const onetimeTotal = proposal.lineItems
      .filter((li) => li.onetimeAmount && Number(li.onetimeAmount) > 0)
      .reduce((sum, li) => sum + Number(li.onetimeAmount ?? 0), 0);

    const payload: AnchorPushPayload = {
      externalProposalId,
      proposalInternalId: proposal.id,
      lead: {
        id: proposal.lead.id,
        firstName: proposal.lead.firstName,
        lastName: proposal.lead.lastName,
        email: proposal.lead.email,
        phone: proposal.lead.phone,
        companyName: proposal.lead.companyName,
      },
      servicePackage: proposal.servicePackage,
      scopeSummary: proposal.scopeSummary,
      monthlyTotal,
      onetimeTotal,
      annualValue: Math.round(monthlyTotal * 12),
      lineItems: proposal.lineItems.map((li) => ({
        kind: li.kind,
        description: li.description,
        monthlyAmount: li.monthlyAmount ? Number(li.monthlyAmount) : null,
        onetimeAmount: li.onetimeAmount ? Number(li.onetimeAmount) : null,
        quantity: li.quantity,
      })),
      sender: {
        name: actor ? `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim() : null,
        email: actor?.email ?? null,
      },
    };

    const result = await pushProposalToAnchor(payload);
    if (!result.ok) {
      // Don't mark SENT — give the rep a chance to fix and retry.
      return NextResponse.json(
        { error: `Anchor push failed: ${result.error}`, canRetry: true },
        { status: 502 }
      );
    }
    makeResponse = result.makeResponse;
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.proposal.update({
      where: { id: proposalId },
      data: {
        proposalStatus: "SENT",
        sentAt: now,
        externalProposalId,
        externalPayloadJson:
          makeResponse !== null && makeResponse !== undefined
            ? (makeResponse as Prisma.InputJsonValue)
            : undefined,
      },
    }),
    prisma.lead.update({
      where: { id: proposal.leadId },
      data: { pipelineStage: "PROPOSAL_SENT" },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId: proposal.leadId,
        actorUserId: actor?.id ?? null,
        eventType: "PROPOSAL_SENT",
        note: shouldPush
          ? `Proposal sent via Anchor — $${Number(proposal.monthlyValue ?? 0)}/mo`
          : pushSkipReason === "skipped_by_user"
            ? `Proposal marked sent (Anchor push skipped) — $${Number(proposal.monthlyValue ?? 0)}/mo`
            : `Proposal marked sent (Anchor not configured) — $${Number(proposal.monthlyValue ?? 0)}/mo`,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    pushedToAnchor: shouldPush,
    skipReason: pushSkipReason,
  });
}
