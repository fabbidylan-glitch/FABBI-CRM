import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendClientWelcomeEmail } from "@/lib/messaging/welcome-email";
import { getTemplate } from "@/lib/onboarding/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accepting a proposal is the critical CRM→Service handoff moment. We:
 *   1. Mark the proposal ACCEPTED
 *   2. Move the lead to WON
 *   3. Create an Onboarding stub (Phase 2 will flesh out tasks + checklist)
 *   4. Log a PROPOSAL_ACCEPTED event for timeline/reporting
 * All four in a single transaction — if any step fails, none happen.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ proposalId: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await ctx.params;
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { quote: true },
  });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.proposalStatus !== "SENT" && proposal.proposalStatus !== "VIEWED")
    return NextResponse.json(
      { error: `Cannot accept from ${proposal.proposalStatus}` },
      { status: 409 }
    );

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });
  const now = new Date();

  // Derive onboarding template from scoping — a reasonable default the rep
  // can override later on the onboarding record.
  const templateKey = deriveOnboardingTemplate(proposal);

  const lead = await prisma.lead.findUnique({ where: { id: proposal.leadId } });

  await prisma.$transaction([
    prisma.proposal.update({
      where: { id: proposalId },
      data: { proposalStatus: "ACCEPTED", acceptedAt: now },
    }),
    prisma.lead.update({
      where: { id: proposal.leadId },
      data: { pipelineStage: "WON" },
    }),
    prisma.onboarding.create({
      data: {
        leadId: proposal.leadId,
        proposalId: proposal.id,
        templateKey,
        stage: "SIGNED",
        assignedUserId: lead?.ownerUserId ?? actor?.id ?? null,
        monthlyFee: proposal.monthlyValue,
        catchupFee: proposal.quote?.catchupQuote ?? null,
        taxFee: proposal.quote?.taxQuote ?? null,
        scopeSummary: proposal.scopeSummary,
        checklistItems: {
          createMany: {
            data: getTemplate(templateKey).items.map((item, idx) => ({
              kind: item.kind,
              label: item.label,
              description: item.description ?? null,
              sortOrder: idx,
            })),
          },
        },
      },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId: proposal.leadId,
        actorUserId: actor?.id ?? null,
        eventType: "PROPOSAL_ACCEPTED",
        fromStage: lead?.pipelineStage,
        toStage: "WON",
        note: `Proposal accepted — $${Number(proposal.monthlyValue ?? 0)}/mo`,
      },
    }),
  ]);

  // Welcome email — best effort. If email isn't configured or the send fails
  // we log it and continue; the proposal is already accepted and onboarding is
  // live, so the rep can always resend manually.
  let welcomeEmailStatus: "sent" | "skipped" | "failed" = "skipped";
  let welcomeEmailError: string | null = null;
  if (lead?.email) {
    try {
      const owner = lead.ownerUserId
        ? await prisma.user.findUnique({ where: { id: lead.ownerUserId } })
        : null;
      const onboarding = await prisma.onboarding.findFirst({
        where: { proposalId: proposal.id },
        select: { id: true },
      });
      const portalUrl = onboarding ? `${config.appUrl}/onboarding/${onboarding.id}` : undefined;
      await sendClientWelcomeEmail({
        to: lead.email,
        clientFirstName: lead.firstName ?? null,
        companyName: lead.companyName ?? null,
        monthlyFee: proposal.monthlyValue ? Number(proposal.monthlyValue) : null,
        catchupFee: proposal.quote?.catchupQuote ? Number(proposal.quote.catchupQuote) : null,
        taxFee: proposal.quote?.taxQuote ? Number(proposal.quote.taxQuote) : null,
        templateKey,
        onboardingManagerName: owner
          ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim()
          : null,
        onboardingManagerEmail: owner?.email ?? null,
        portalUrl,
      });
      welcomeEmailStatus = "sent";
    } catch (err) {
      welcomeEmailStatus = "failed";
      welcomeEmailError = err instanceof Error ? err.message : "Unknown error";
      console.error("[welcome-email] failed", err);
    }
  }

  return NextResponse.json({
    ok: true,
    welcomeEmail: { status: welcomeEmailStatus, error: welcomeEmailError },
  });
}

function deriveOnboardingTemplate(proposal: { quote?: { scopingInputs: unknown } | null }): string {
  const inputs = (proposal.quote?.scopingInputs ?? {}) as Record<string, unknown>;
  const taxScope = String(inputs.taxScope ?? "NONE");
  const cleanup = Number(inputs.cleanupMonths ?? 0);
  const advisory = String(inputs.advisoryLevel ?? "NONE");
  const industry = String(inputs.industry ?? "GENERAL");

  if (advisory === "FRACTIONAL_CFO" || advisory === "MONTHLY") return "advisory_cfo_v1";
  if (industry === "STR" || industry === "REAL_ESTATE") return "str_client_v1";
  if (cleanup > 6) return "catchup_cleanup_v1";
  if (taxScope !== "NONE") return "bookkeeping_plus_tax_v1";
  return "bookkeeping_only_v1";
}
