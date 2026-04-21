import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { ensureStageTasks } from "@/lib/features/leads/stage-workflow";
import { fireOutboundWebhook } from "@/lib/integrations/webhooks/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assignOwner"),
    leadIds: z.array(z.string()).min(1).max(500),
    ownerUserId: z.string().nullable(),
  }),
  z.object({
    action: z.literal("changeStage"),
    leadIds: z.array(z.string()).min(1).max(500),
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
  }),
  z.object({
    action: z.literal("archive"),
    leadIds: z.array(z.string()).min(1).max(500),
  }),
]);

export async function POST(req: NextRequest) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });

  const input = parsed.data;

  if (input.action === "assignOwner") {
    const owner = input.ownerUserId
      ? await prisma.user.findUnique({ where: { id: input.ownerUserId } })
      : null;
    if (input.ownerUserId && !owner)
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: { id: { in: input.leadIds } },
        data: { ownerUserId: input.ownerUserId },
      });
      await tx.pipelineEvent.createMany({
        data: input.leadIds.map((id) => ({
          leadId: id,
          actorUserId: actor?.id ?? null,
          eventType: "OWNER_CHANGED" as const,
          note: `Bulk assigned to ${owner ? `${owner.firstName} ${owner.lastName}` : "Unassigned"}`,
        })),
      });
    });
    return NextResponse.json({ ok: true, updated: input.leadIds.length });
  }

  if (input.action === "changeStage") {
    const existing = await prisma.lead.findMany({
      where: { id: { in: input.leadIds } },
      select: { id: true, pipelineStage: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: { id: { in: input.leadIds } },
        data: { pipelineStage: input.stage },
      });
      await tx.pipelineEvent.createMany({
        data: existing
          .filter((e) => e.pipelineStage !== input.stage)
          .map((e) => ({
            leadId: e.id,
            actorUserId: actor?.id ?? null,
            eventType: "STAGE_CHANGED" as const,
            fromStage: e.pipelineStage,
            toStage: input.stage,
            note: "Bulk stage change",
          })),
      });
    });

    // Workflow enforcement + outbound webhooks for every lead that actually
    // changed stage.
    const webhookEvent: "lead.won" | "lead.lost" | "lead.stage_changed" =
      input.stage === "WON"
        ? "lead.won"
        : input.stage === "LOST"
          ? "lead.lost"
          : "lead.stage_changed";
    for (const e of existing) {
      if (e.pipelineStage !== input.stage) {
        await ensureStageTasks({
          leadId: e.id,
          toStage: input.stage,
          actorUserId: actor?.id ?? null,
        });
        void fireOutboundWebhook(webhookEvent, e.id);
      }
    }

    return NextResponse.json({ ok: true, updated: input.leadIds.length });
  }

  // archive
  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({
      where: { id: { in: input.leadIds } },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await tx.pipelineEvent.createMany({
      data: input.leadIds.map((id) => ({
        leadId: id,
        actorUserId: actor?.id ?? null,
        eventType: "ARCHIVED" as const,
        note: "Bulk archived",
      })),
    });
  });
  return NextResponse.json({ ok: true, updated: input.leadIds.length });
}
