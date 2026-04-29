import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { requireSTRAccess, STRAuthError } from "@/lib/features/str/auth";
import {
  dec,
  toCalcInput,
  type DealWithRelations,
} from "@/lib/features/str/queries";
import { computeUnderwriting } from "@/lib/str/calc";
import { generateMemo, type MemoCompInput, type MemoDealInput } from "@/lib/str/memo";
import { scoreDeal } from "@/lib/str/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/str-deals/[id]/memo
 * Regenerates the deterministic memo from the deal's current inputs and
 * persists a new STRMemo row. We intentionally append rather than overwrite
 * — keeping a history lets us see how the recommendation moved as the
 * underwriting was refined.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!config.dbEnabled || !config.authEnabled) {
    return NextResponse.json(
      { error: "Database + auth required." },
      { status: 503 }
    );
  }
  try {
    await requireSTRAccess();
  } catch (e) {
    if (e instanceof STRAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const { id: dealId } = await ctx.params;
  const deal = await prisma.sTRDeal.findUnique({
    where: { id: dealId },
    include: { expenses: true, comps: true },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const calcInput = toCalcInput(deal, deal.expenses);
  const calc = computeUnderwriting(calcInput);
  const score = scoreDeal({
    cashOnCash: calc.scenarios.BASE.cashOnCash,
    dscr: calc.scenarios.BASE.dscr,
    targetCashOnCash: calcInput.targetCashOnCash,
    targetDscr: calcInput.targetDscr,
    revenueConfidence: deal.revenueConfidence,
    compQuality: deal.compQualityRating,
    marketStrength: deal.marketStrength,
    upgradeUpside: deal.upgradeUpside,
    regulatoryRisk: deal.regulatoryRisk,
    maintenanceComplexity: deal.maintenanceComplexity,
    financingRisk: deal.financingRisk,
  });

  const memo = generateMemo({
    deal: toMemoDealInput(deal),
    calc,
    score,
    comps: deal.comps.map(toMemoCompInput),
  });

  const created = await prisma.sTRMemo.create({
    data: {
      dealId,
      scenarioType: memo.scenarioType,
      propertySummary: memo.propertySummary,
      revenueSummary: memo.revenueSummary,
      compSummary: memo.compSummary,
      keyStrengths: memo.keyStrengths,
      keyRisks: memo.keyRisks,
      knownLimits: memo.knownLimits,
      baseCaseReturnPct: memo.baseCaseReturnPct,
      downsideReturnPct: memo.downsideReturnPct,
      recommendedOffer: memo.recommendedOffer,
      recommendation: memo.recommendation,
      decision: memo.decision,
      score: memo.score,
      generator: "template",
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

function toMemoDealInput(
  deal: DealWithRelations | NonNullable<Awaited<ReturnType<typeof prisma.sTRDeal.findUnique>>>
): MemoDealInput {
  return {
    dealName: deal.dealName,
    city: deal.city,
    state: deal.state,
    market: deal.market,
    propertyAddress: deal.propertyAddress,
    propertyType: deal.propertyType,
    beds: deal.beds,
    baths: deal.baths ? deal.baths.toNumber() : null,
    sleeps: deal.sleeps,
    squareFootage: deal.squareFootage,
    yearBuilt: deal.yearBuilt,
    askingPrice: deal.askingPrice ? deal.askingPrice.toNumber() : null,
    purchasePrice: dec(deal.purchasePrice),
    targetOfferPrice: deal.targetOfferPrice ? deal.targetOfferPrice.toNumber() : null,
    adr: deal.adr ? deal.adr.toNumber() : null,
    occupancyPct: deal.occupancyPct ? deal.occupancyPct.toNumber() : null,
    conservativeRevenue: deal.conservativeRevenue ? deal.conservativeRevenue.toNumber() : null,
    baseRevenue: deal.baseRevenue ? deal.baseRevenue.toNumber() : null,
    aggressiveRevenue: deal.aggressiveRevenue ? deal.aggressiveRevenue.toNumber() : null,
    targetCashOnCash: dec(deal.targetCashOnCash, 0.10),
    targetDscr: dec(deal.targetDscr, 1.25),
    revenueConfidence: deal.revenueConfidence,
    compQualityRating: deal.compQualityRating,
    marketStrength: deal.marketStrength,
    upgradeUpside: deal.upgradeUpside,
    regulatoryRisk: deal.regulatoryRisk,
    maintenanceComplexity: deal.maintenanceComplexity,
    financingRisk: deal.financingRisk,
  };
}

function toMemoCompInput(
  c: NonNullable<DealWithRelations["comps"]>[number]
): MemoCompInput {
  return {
    name: c.name,
    adr: c.adr ? c.adr.toNumber() : null,
    occupancyPct: c.occupancyPct ? c.occupancyPct.toNumber() : null,
    annualRevenue: c.annualRevenue ? c.annualRevenue.toNumber() : null,
    reviewCount: c.reviewCount,
    rating: c.rating ? c.rating.toNumber() : null,
    qualityScore: c.qualityScore,
    source: c.source,
  };
}
