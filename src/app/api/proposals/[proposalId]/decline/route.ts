import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ reason: z.string().trim().min(1).max(2000) });

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
      { error: "Decline reason is required", issues: parsed.error.issues },
      { status: 422 }
    );

  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.proposalStatus !== "SENT" && proposal.proposalStatus !== "VIEWED")
    return NextResponse.json(
      { error: `Cannot decline from ${proposal.proposalStatus}` },
      { status: 409 }
    );

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });
  const now = new Date();
  const lead = await prisma.lead.findUnique({ where: { id: proposal.leadId } });

  await prisma.$transaction([
    prisma.proposal.update({
      where: { id: proposalId },
      data: {
        proposalStatus: "DECLINED",
        declinedAt: now,
        declineReason: parsed.data.reason,
      },
    }),
    prisma.lead.update({
      where: { id: proposal.leadId },
      data: { pipelineStage: "LOST" },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId: proposal.leadId,
        actorUserId: actor?.id ?? null,
        eventType: "PROPOSAL_DECLINED",
        fromStage: lead?.pipelineStage,
        toStage: "LOST",
        note: `Proposal declined: ${parsed.data.reason}`.slice(0, 200),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
