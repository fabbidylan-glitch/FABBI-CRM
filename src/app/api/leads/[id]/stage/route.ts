import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { ensureStageTasks } from "@/lib/features/leads/stage-workflow";
import { fireOutboundWebhook } from "@/lib/integrations/webhooks/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  stage: z.enum([
    "NEW_LEAD",
    "CONTACTED",
    "QUALIFIED",
    "CONSULT_BOOKED",
    "CONSULT_COMPLETED",
    "PROPOSAL_DRAFTING",
    "PROPOSAL_SENT",
    "FOLLOW_UP_NEGOTIATION",
    "WON",
    "LOST",
    "COLD_NURTURE",
  ]),
  note: z.string().max(500).optional(),
  lostReasonCode: z.string().optional(),
  lostReasonNote: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!config.dbEnabled)
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  if (!config.authEnabled)
    return NextResponse.json({ error: "Auth not configured." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.pipelineStage === parsed.data.stage)
    return NextResponse.json({ ok: true, unchanged: true });

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });

  // Resolve the lost reason if one was supplied.
  let lostReasonId: string | null = lead.lostReasonId;
  let lostReasonLabel: string | null = null;
  if (parsed.data.stage === "LOST" && parsed.data.lostReasonCode) {
    const reason = await prisma.lostReason.findUnique({
      where: { code: parsed.data.lostReasonCode },
    });
    if (reason) {
      lostReasonId = reason.id;
      lostReasonLabel = reason.label;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.lead.update({
      where: { id },
      data: {
        pipelineStage: parsed.data.stage,
        ...(parsed.data.stage === "LOST" ? { lostReasonId } : {}),
        ...(parsed.data.stage === "LOST" && parsed.data.lostReasonNote
          ? { disqualificationReason: parsed.data.lostReasonNote }
          : {}),
      },
    });
    const noteParts: string[] = [];
    if (parsed.data.note) noteParts.push(parsed.data.note);
    if (lostReasonLabel) noteParts.push(`Lost reason: ${lostReasonLabel}`);
    if (parsed.data.lostReasonNote) noteParts.push(`Detail: ${parsed.data.lostReasonNote}`);
    await tx.pipelineEvent.create({
      data: {
        leadId: id,
        actorUserId: actor?.id ?? null,
        eventType: "STAGE_CHANGED",
        fromStage: lead.pipelineStage,
        toStage: parsed.data.stage,
        note: noteParts.length > 0 ? noteParts.join(" · ") : `Stage changed.`,
      },
    });
    return row;
  });

  // Workflow enforcement: stamp the appropriate follow-up tasks for this
  // stage so the sales rep always has a next action. Idempotent.
  await ensureStageTasks({
    leadId: id,
    toStage: parsed.data.stage,
    actorUserId: actor?.id ?? null,
  });

  // Fire outbound automations — e.g. Make.com scenario that creates an
  // Anchor client or QuickBooks customer when a lead is won. Non-blocking
  // so the HTTP response isn't held up waiting on Make.com.
  if (parsed.data.stage === "WON") {
    void fireOutboundWebhook("lead.won", id);
  } else if (parsed.data.stage === "LOST") {
    void fireOutboundWebhook("lead.lost", id);
  }
  void fireOutboundWebhook("lead.stage_changed", id);

  return NextResponse.json({
    ok: true,
    leadId: updated.id,
    fromStage: lead.pipelineStage,
    toStage: updated.pipelineStage,
  });
}
