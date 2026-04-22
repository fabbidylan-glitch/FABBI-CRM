import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { recomputeProposalTotals } from "@/lib/features/proposals/recompute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum([
    "MONTHLY_BOOKKEEPING",
    "MONTHLY_TAX",
    "MONTHLY_ADVISORY",
    "MONTHLY_ADDON",
    "ONETIME_CLEANUP",
    "ONETIME_TAX_RETURN",
    "ONETIME_SETUP",
    "ONETIME_OTHER",
  ]),
  description: z.string().trim().min(1).max(200),
  monthlyAmount: z.number().nonnegative().nullable().optional(),
  onetimeAmount: z.number().nonnegative().nullable().optional(),
  quantity: z.number().int().positive().optional().default(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ proposalId: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await ctx.params;
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.proposalStatus !== "DRAFT")
    return NextResponse.json(
      { error: `Cannot edit line items — proposal is ${proposal.proposalStatus}.` },
      { status: 409 }
    );

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

  // Append at the end (max sortOrder + 1)
  const last = await prisma.proposalLineItem.findFirst({
    where: { proposalId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const item = await prisma.proposalLineItem.create({
    data: {
      proposalId,
      kind: parsed.data.kind,
      description: parsed.data.description,
      monthlyAmount: parsed.data.monthlyAmount ?? null,
      onetimeAmount: parsed.data.onetimeAmount ?? null,
      quantity: parsed.data.quantity ?? 1,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  await recomputeProposalTotals(proposalId);

  return NextResponse.json({ ok: true, itemId: item.id });
}
