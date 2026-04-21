import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { calculatePricing } from "@/lib/pricing/calculate";
import { ScopingInputSchema } from "@/lib/pricing/scoping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save a scoping session. Creates one Quote + a matching draft Proposal so the
 * rep can jump straight from scoping → proposal preview. A lead can have
 * multiple quotes over time — we don't overwrite; the rep picks which quote to
 * send on the preview page.
 */
const schema = z.object({
  leadId: z.string().min(1),
  scoping: ScopingInputSchema,
});

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

  const { leadId, scoping } = parsed.data;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });

  const result = calculatePricing(scoping);

  // Move the lead into PROPOSAL_DRAFTING if we're still upstream. Never move
  // backwards from PROPOSAL_SENT / WON / etc.
  const upstreamStages = ["NEW_LEAD", "CONTACTED", "QUALIFIED", "CONSULT_BOOKED", "CONSULT_COMPLETED"] as const;
  const shouldAdvance = (upstreamStages as readonly string[]).includes(lead.pipelineStage);

  const quote = await prisma.quote.create({
    data: {
      leadId,
      packageKey: scoping.packageKey || null,
      scopingInputs: scoping as Prisma.InputJsonValue,
      floorPrice: result.monthlyFloor,
      recommendedPrice: result.monthlyRecommended,
      stretchPrice: result.monthlyStretch,
      catchupQuote: result.catchupQuote || null,
      taxQuote: result.taxQuote || null,
      advisoryQuote: result.advisoryMonthly || null,
      complexityLevel: result.complexityLevel,
      internalNotes: scoping.complexityNotes || null,
    },
  });

  // Create the draft Proposal + its line items in one go.
  const proposal = await prisma.proposal.create({
    data: {
      leadId,
      quoteId: quote.id,
      proposalStatus: "DRAFT",
      servicePackage: scoping.packageKey || null,
      monthlyValue: result.monthlyRecommended,
      onetimeValue: result.onetimeTotal || null,
      annualValue: result.monthlyRecommended * 12,
      scopeSummary: buildScopeSummary(scoping),
      lineItems: {
        createMany: {
          data: result.lineItems.map((li, idx) => ({
            kind: li.kind,
            description: li.description,
            monthlyAmount: li.monthly ?? null,
            onetimeAmount: li.onetime ?? null,
            sortOrder: idx,
          })),
        },
      },
    },
  });

  await prisma.pipelineEvent.create({
    data: {
      leadId,
      actorUserId: actor?.id ?? null,
      eventType: "PROPOSAL_DRAFTED",
      note: `Proposal drafted — $${result.monthlyRecommended}/mo (${result.complexityLevel.toLowerCase()})`,
    },
  });

  if (shouldAdvance) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        pipelineStage: "PROPOSAL_DRAFTING",
        estimatedAnnualValue: result.monthlyRecommended * 12,
      },
    });
    await prisma.pipelineEvent.create({
      data: {
        leadId,
        actorUserId: actor?.id ?? null,
        eventType: "STAGE_CHANGED",
        fromStage: lead.pipelineStage,
        toStage: "PROPOSAL_DRAFTING",
        note: "Auto-advanced on proposal drafting",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    quoteId: quote.id,
    proposalId: proposal.id,
    summary: {
      monthlyRecommended: result.monthlyRecommended,
      monthlyFloor: result.monthlyFloor,
      monthlyStretch: result.monthlyStretch,
      onetimeTotal: result.onetimeTotal,
      complexityLevel: result.complexityLevel,
    },
  });
}

function buildScopeSummary(s: z.infer<typeof ScopingInputSchema>): string {
  const bits: string[] = [];
  bits.push(`${s.entityType} · ${s.entityCount} entit${s.entityCount === 1 ? "y" : "ies"}`);
  bits.push(`~${s.monthlyTxnVolume} txns/mo`);
  if (s.payroll) bits.push(`payroll (${s.payrollEmployees} emp.)`);
  if (s.salesTax) bits.push(`sales tax (${s.salesTaxStates} states)`);
  if (s.cleanupMonths > 0) bits.push(`${s.cleanupMonths}mo cleanup`);
  if (s.taxScope !== "NONE") bits.push(`tax: ${s.taxScope.replaceAll("_", " ").toLowerCase()}`);
  if (s.advisoryLevel !== "NONE") bits.push(`advisory: ${s.advisoryLevel.toLowerCase()}`);
  return bits.join(" · ");
}
