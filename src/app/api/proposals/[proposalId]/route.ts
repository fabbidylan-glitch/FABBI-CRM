import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  scopeSummary: z.string().trim().max(2000).optional(),
  servicePackage: z.string().trim().max(80).nullable().optional(),
});

/** Edit proposal metadata (scope summary, service package label). Line items
 *  have their own endpoints; totals are derived. Only editable while DRAFT. */
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

  await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      scopeSummary: parsed.data.scopeSummary ?? proposal.scopeSummary,
      servicePackage:
        parsed.data.servicePackage === undefined
          ? proposal.servicePackage
          : parsed.data.servicePackage,
    },
  });

  return NextResponse.json({ ok: true });
}
