import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { recomputeProposalTotals } from "@/lib/features/proposals/recompute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  scopeSummary: z.string().trim().max(2000).optional(),
  servicePackage: z.string().trim().max(80).nullable().optional(),
  // Discount — setting any of these clears the others client-side, but the
  // server is tolerant and will just store whatever was sent.
  discountLabel: z.string().trim().max(80).nullable().optional(),
  discountAmount: z.number().nonnegative().max(1_000_000).nullable().optional(),
  discountPct: z.number().nonnegative().max(100).nullable().optional(),
  discountAppliesTo: z.enum(["MONTHLY", "ONETIME", "BOTH"]).nullable().optional(),
  // Anchor-hosted signing URL. Auto-populated by a successful Make push, or
  // pasted manually by the rep if they created the proposal in Anchor by hand.
  signingUrl: z
    .string()
    .trim()
    .url()
    .max(1000)
    .nullable()
    .optional()
    .or(z.literal("")),
});

/** Edit proposal metadata (scope summary, service package label, discount).
 *  Line items have their own endpoints; totals are derived. Only editable
 *  while DRAFT. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ proposalId: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await ctx.params;
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.proposalStatus !== "DRAFT")
    return NextResponse.json(
      { error: `Cannot edit — proposal is ${proposal.proposalStatus}.` },
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

  const d = parsed.data;
  const discountFieldsTouched =
    d.discountLabel !== undefined ||
    d.discountAmount !== undefined ||
    d.discountPct !== undefined ||
    d.discountAppliesTo !== undefined;

  // Empty-string signingUrl is treated as "clear it".
  const resolvedSigningUrl =
    d.signingUrl === undefined
      ? proposal.signingUrl
      : d.signingUrl === "" || d.signingUrl === null
        ? null
        : d.signingUrl;

  await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      scopeSummary: d.scopeSummary ?? proposal.scopeSummary,
      servicePackage:
        d.servicePackage === undefined ? proposal.servicePackage : d.servicePackage,
      discountLabel: d.discountLabel === undefined ? proposal.discountLabel : d.discountLabel,
      discountAmount:
        d.discountAmount === undefined ? proposal.discountAmount : d.discountAmount,
      discountPct: d.discountPct === undefined ? proposal.discountPct : d.discountPct,
      discountAppliesTo:
        d.discountAppliesTo === undefined ? proposal.discountAppliesTo : d.discountAppliesTo,
      signingUrl: resolvedSigningUrl,
    },
  });

  // Any change to the discount re-derives stored totals so the preview,
  // pipeline KPIs, and Anchor payload all match.
  if (discountFieldsTouched) {
    await recomputeProposalTotals(proposalId);
  }

  return NextResponse.json({ ok: true });
}
