import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { recomputeProposalTotals } from "@/lib/features/proposals/recompute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  description: z.string().trim().min(1).max(200).optional(),
  monthlyAmount: z.number().nonnegative().nullable().optional(),
  onetimeAmount: z.number().nonnegative().nullable().optional(),
  quantity: z.number().int().positive().optional(),
});

async function assertDraft(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { proposalStatus: true },
  });
  if (!proposal) return { ok: false as const, status: 404, error: "Proposal not found" };
  if (proposal.proposalStatus !== "DRAFT")
    return {
      ok: false as const,
      status: 409,
      error: `Cannot edit line items — proposal is ${proposal.proposalStatus}.`,
    };
  return { ok: true as const };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ proposalId: string; itemId: string }> }
) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });
  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId, itemId } = await ctx.params;
  const guard = await assertDraft(proposalId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const item = await prisma.proposalLineItem.findUnique({ where: { id: itemId } });
  if (!item || item.proposalId !== proposalId)
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );

  await prisma.proposalLineItem.update({
    where: { id: itemId },
    data: {
      description: parsed.data.description ?? item.description,
      monthlyAmount: parsed.data.monthlyAmount === undefined ? item.monthlyAmount : parsed.data.monthlyAmount,
      onetimeAmount: parsed.data.onetimeAmount === undefined ? item.onetimeAmount : parsed.data.onetimeAmount,
      quantity: parsed.data.quantity ?? item.quantity,
    },
  });

  await recomputeProposalTotals(proposalId);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ proposalId: string; itemId: string }> }
) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });
  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId, itemId } = await ctx.params;
  const guard = await assertDraft(proposalId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const item = await prisma.proposalLineItem.findUnique({ where: { id: itemId } });
  if (!item || item.proposalId !== proposalId)
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });

  await prisma.proposalLineItem.delete({ where: { id: itemId } });
  await recomputeProposalTotals(proposalId);

  return NextResponse.json({ ok: true });
}
