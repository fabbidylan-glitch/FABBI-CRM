import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { exitEnrollment } from "@/lib/automation/engine";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Decline requires BOTH a structured lost-reason code (so we can roll it up in
// the dashboard) and the rep's free-text note explaining what happened. The
// code is required; the free-text stays optional but capped.
const schema = z.object({
  lostReasonCode: z.string().trim().min(1, "Lost reason code is required").max(80),
  reason: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ proposalId: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Lost reason required", issues: parsed.error.issues },
      { status: 422 }
    );

  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.proposalStatus !== "SENT" && proposal.proposalStatus !== "VIEWED")
    return NextResponse.json(
      { error: `Cannot decline from ${proposal.proposalStatus}` },
      { status: 409 }
    );

  const lostReason = await prisma.lostReason.findUnique({
    where: { code: parsed.data.lostReasonCode },
  });
  if (!lostReason || !lostReason.isActive)
    return NextResponse.json(
      { error: `Unknown or inactive lost reason: ${parsed.data.lostReasonCode}` },
      { status: 422 }
    );

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });
  const now = new Date();
  const lead = await prisma.lead.findUnique({ where: { id: proposal.leadId } });

  // Compose a single human-readable note combining the structured reason
  // label + the free-text explanation. Capped at 200 chars for pipeline event
  // display but the raw strings are preserved on the proposal + lead rows.
  const composedNote =
    parsed.data.reason && parsed.data.reason.length > 0
      ? `${lostReason.label} — ${parsed.data.reason}`
      : lostReason.label;

  await prisma.$transaction([
    prisma.proposal.update({
      where: { id: proposalId },
      data: {
        proposalStatus: "DECLINED",
        declinedAt: now,
        declineReason: composedNote,
      },
    }),
    prisma.lead.update({
      where: { id: proposal.leadId },
      data: { pipelineStage: "LOST", lostReasonId: lostReason.id },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId: proposal.leadId,
        actorUserId: actor?.id ?? null,
        eventType: "PROPOSAL_DECLINED",
        fromStage: lead?.pipelineStage,
        toStage: "LOST",
        note: `Proposal declined: ${composedNote}`.slice(0, 200),
      },
    }),
  ]);

  // Exit any active proposal-followup sequence — no point in continuing the
  // nudge cadence once we know they said no.
  const enr = await prisma.sequenceEnrollment.findUnique({
    where: { leadId_sequenceKey: { leadId: proposal.leadId, sequenceKey: "proposal_followup_v1" } },
  });
  if (enr && enr.status !== "EXITED" && enr.status !== "COMPLETED") {
    await exitEnrollment(enr.id, "PROPOSAL_DECLINED").catch((err) =>
      console.error("[proposal-decline] sequence exit failed", err)
    );
  }

  return NextResponse.json({ ok: true });
}
