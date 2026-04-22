import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { computeDiscount } from "@/lib/features/proposals/discount";
import { renderProposalEmail } from "@/lib/messaging/proposal-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the rendered email (subject / to / bodyHtml / bodyText) that *would*
 * be sent if the rep clicks Send. Lets the modal show the draft so the rep can
 * review before committing. The signingUrl can be passed in body to preview
 * with a URL that hasn't been saved yet (draft scenario).
 */
const schema = z.object({
  signingUrl: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ proposalId: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await ctx.params;

  let parsed: z.infer<typeof schema> = {};
  try {
    const raw = await req.text();
    if (raw) parsed = schema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { lead: true, lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  if (!proposal.lead.email) {
    return NextResponse.json(
      { error: "Lead has no email on file — email can't be previewed." },
      { status: 422 }
    );
  }

  const signingUrl = parsed.signingUrl?.trim() || proposal.signingUrl || "";
  if (!signingUrl) {
    return NextResponse.json(
      {
        error:
          "No signing URL yet — paste the Anchor URL in the modal to see the email preview.",
      },
      { status: 422 }
    );
  }

  // Same subtotal/discount math as the send endpoint — keep the preview's
  // numbers identical to what the client would actually receive.
  const monthlySubtotal = proposal.lineItems
    .filter((li) => li.monthlyAmount && Number(li.monthlyAmount) > 0)
    .reduce((sum, li) => sum + Number(li.monthlyAmount ?? 0), 0);
  const onetimeSubtotal = proposal.lineItems
    .filter((li) => li.onetimeAmount && Number(li.onetimeAmount) > 0)
    .reduce((sum, li) => sum + Number(li.onetimeAmount ?? 0), 0);
  const discountResult = computeDiscount(monthlySubtotal, onetimeSubtotal, {
    discountLabel: proposal.discountLabel,
    discountAmount: proposal.discountAmount ? Number(proposal.discountAmount) : null,
    discountPct: proposal.discountPct ? Number(proposal.discountPct) : null,
    discountAppliesTo: proposal.discountAppliesTo,
  });
  const monthlyTotal = Math.max(0, monthlySubtotal - discountResult.monthly);
  const onetimeTotal = Math.max(0, onetimeSubtotal - discountResult.onetime);

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });

  const rendered = renderProposalEmail({
    to: proposal.lead.email,
    clientFirstName: proposal.lead.firstName ?? null,
    companyName: proposal.lead.companyName ?? null,
    monthlySubtotal,
    onetimeSubtotal,
    monthlyTotal,
    onetimeTotal,
    discount:
      discountResult.totalDollars > 0
        ? {
            label: discountResult.label,
            monthly: discountResult.monthly,
            onetime: discountResult.onetime,
          }
        : null,
    scopeSummary: proposal.scopeSummary,
    signingUrl,
    sender: {
      name: actor ? `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim() : null,
      email: actor?.email ?? null,
    },
  });

  return NextResponse.json({ ok: true, email: rendered });
}
