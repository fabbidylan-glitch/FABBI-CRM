import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ proposalId: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await ctx.params;
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.proposalStatus !== "DRAFT")
    return NextResponse.json({ error: `Cannot send from ${proposal.proposalStatus}` }, { status: 409 });

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });
  const now = new Date();

  await prisma.$transaction([
    prisma.proposal.update({
      where: { id: proposalId },
      data: { proposalStatus: "SENT", sentAt: now },
    }),
    prisma.lead.update({
      where: { id: proposal.leadId },
      data: { pipelineStage: "PROPOSAL_SENT", lastStageChangeAt: now },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId: proposal.leadId,
        actorUserId: actor?.id ?? null,
        eventType: "PROPOSAL_SENT",
        note: `Proposal marked sent — $${Number(proposal.monthlyValue ?? 0)}/mo`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
